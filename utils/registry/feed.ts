import {
  SurveyCardData,
  SurveyCategory,
  SurveyDetail,
  SurveyQuestion,
  SurveyQuestionOption,
  SurveyRequirement,
} from "@/domain/models";
import { listRegisteredSurveys, RegistrySurveyRecord } from "@/utils/registry/client";
import { createVocdoniClient } from "@/utils/vocdoni/sdk";
import { getOrCreateDeviceWallet } from "@/utils/vocdoni/wallet";

export type RegisteredSurveyFeedItem = {
  registry: RegistrySurveyRecord;
  card: SurveyCardData;
  detail: SurveyDetail;
};

export type SurveyResultOption = {
  id: string;
  label: string;
  count: number;
  percent: number;
};

export type SurveyQuestionResult = {
  id: string;
  questionNumber: number;
  title: string;
  options: SurveyResultOption[];
};

export type RegisteredSurveyResultsItem = RegisteredSurveyFeedItem & {
  questionResults: SurveyQuestionResult[];
  finalResults: boolean;
};

type LoadRegisteredSurveyFeedOptions = {
  excludeClosed?: boolean;
  excludeVoted?: boolean;
};

type RegistryHydratedElection = {
  election: unknown;
  hasVoted: boolean;
};

type SurveyCardMeta = {
  category?: string;
  tags?: string[];
  rewardPerVoter?: number;
  estimatedMinutes?: number;
  voterCap?: number;
  requirements?: SurveyRequirement[];
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const getValueByPath = (value: unknown, path: string) => {
  if (!value) {
    return undefined;
  }

  const pathSegments = path.split(".");
  let currentValue: unknown = value;

  for (const segment of pathSegments) {
    const currentRecord = asRecord(currentValue);
    if (!currentRecord || !(segment in currentRecord)) {
      return undefined;
    }

    currentValue = currentRecord[segment];
  }

  return currentValue;
};

const pickText = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const next = pickText(item);
      if (next) {
        return next;
      }
    }
  }

  const objectValue = asRecord(value);
  if (!objectValue) {
    return null;
  }

  for (const key of ["default", "en", "title", "value", "text"]) {
    const next = pickText(objectValue[key]);
    if (next) {
      return next;
    }
  }

  for (const nestedValue of Object.values(objectValue)) {
    const next = pickText(nestedValue);
    if (next) {
      return next;
    }
  }

  return null;
};

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.getTime() : undefined;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

const toIsoDate = (value: unknown): string | undefined => {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : undefined;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : undefined;
  }

  const numericValue = toNumber(value);
  if (numericValue == null) {
    return undefined;
  }

  const parsed = new Date(numericValue);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : undefined;
};

const normalizeCategory = (category: string): SurveyCategory => ({
  id: category.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "general",
  label: category || "General",
});

const getSurveyCardMeta = (electionValue?: Record<string, unknown>): SurveyCardMeta => {
  if (!electionValue) {
    return {};
  }

  const getter = electionValue.get;
  if (typeof getter === "function") {
    const viaGetter = getter.call(electionValue, "meta.surveyCard");
    if (viaGetter && typeof viaGetter === "object") {
      return viaGetter as SurveyCardMeta;
    }
  }

  const nestedMeta = getValueByPath(electionValue, "meta.surveyCard");
  if (nestedMeta && typeof nestedMeta === "object") {
    return nestedMeta as SurveyCardMeta;
  }

  const directMeta = asRecord(electionValue.meta);
  return directMeta ? (directMeta as SurveyCardMeta) : {};
};

const pickStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => pickText(item))
    .filter((item): item is string => Boolean(item));
};

const resolveCategoryLabel = (registry: RegistrySurveyRecord, electionValue?: Record<string, unknown>) => {
  const surveyCardMeta = getSurveyCardMeta(electionValue);
  if (typeof surveyCardMeta.category === "string" && surveyCardMeta.category.trim()) {
    return surveyCardMeta.category.trim();
  }

  const registryCategory = registry.category.trim();
  if (registryCategory) {
    return registryCategory;
  }

  const metadataRecord = asRecord(electionValue?.metadata);
  const directCategory =
    pickText(electionValue?.category) ??
    pickText(metadataRecord?.category) ??
    pickText(metadataRecord?.categories) ??
    pickText(metadataRecord?.tag) ??
    pickText(metadataRecord?.tags);

  if (directCategory) {
    return directCategory;
  }

  const categoryList = [
    ...pickStringArray(electionValue?.categories),
    ...pickStringArray(metadataRecord?.categories),
    ...pickStringArray(metadataRecord?.tags),
  ];

  return categoryList[0] ?? "General";
};

const normalizeOptions = (questionValue: Record<string, unknown>): SurveyQuestionOption[] | undefined => {
  const optionCandidates =
    (Array.isArray(questionValue.choices) && questionValue.choices) ||
    (Array.isArray(questionValue.options) && questionValue.options) ||
    (Array.isArray(questionValue.answers) && questionValue.answers) ||
    [];

  const options = optionCandidates
    .map((optionValue, index) => {
      const optionRecord = asRecord(optionValue);
      const label = pickText(optionRecord?.title) ?? pickText(optionRecord?.value) ?? pickText(optionValue);

      if (!label) {
        return null;
      }

      return {
        id: `${index}`,
        label,
        order: index,
      };
    })
    .filter((option): option is SurveyQuestionOption => Boolean(option));

  return options.length > 0 ? options : undefined;
};

const normalizeRequirements = (value: unknown): SurveyRequirement[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      const requirement = asRecord(item);
      const type = pickText(requirement?.type);
      const requirementValue = pickText(requirement?.value);

      if (!type || !requirementValue) {
        return null;
      }

      return {
        id: pickText(requirement?.id) ?? `meta-requirement-${index}`,
        type,
        value: requirementValue,
      } as SurveyRequirement;
    })
    .filter((item): item is SurveyRequirement => item !== null);
};

const normalizeQuestions = (electionValue: Record<string, unknown>): SurveyQuestion[] => {
  const metadataRecord = asRecord(electionValue.metadata);
  const questionsValue = Array.isArray(electionValue.questions)
    ? electionValue.questions
    : Array.isArray(metadataRecord?.questions)
      ? metadataRecord.questions
      : [];

  const questions = questionsValue.map<SurveyQuestion | null>((questionValue, index) => {
      const questionRecord = asRecord(questionValue);
      const title =
        pickText(questionRecord?.title) ??
        pickText(questionRecord?.question) ??
        pickText(questionValue);

      if (!title) {
        return null;
      }

      const options = questionRecord ? normalizeOptions(questionRecord) : undefined;
      const isTextarea = !options || options.length === 0;
      const allowsMultiple =
        questionRecord?.type === "multiple_choice" ||
        questionRecord?.allowMultiple === true ||
        toNumber(questionRecord?.maxChoices) !== 1;

      return {
        id: `${index + 1}`,
        order: index + 1,
        title,
        isRequired: true,
        type:  allowsMultiple ? "multiple_choice" : "single_choice",
        options,
      };
    })
    .filter((question): question is SurveyQuestion => question !== null);

  return questions;
};

const normalizeQuestionResults = (
  electionValue: Record<string, unknown>,
  questions: SurveyQuestion[],
  participantCount: number
): SurveyQuestionResult[] => {
  const matrixRows = Array.isArray(electionValue.results) ? electionValue.results : [];
  const rawQuestions = Array.isArray(electionValue.questions) ? electionValue.questions : [];

  return questions.map((question, questionIndex) => {
    const rawQuestion = asRecord(rawQuestions[questionIndex]);
    const rawChoices = Array.isArray(rawQuestion?.choices) ? rawQuestion.choices : [];
    const matrixRow = Array.isArray(matrixRows[questionIndex]) ? matrixRows[questionIndex] : [];

    const options = (question.options ?? []).map((option, optionIndex) => {
      const rawChoice = asRecord(rawChoices[optionIndex]);
      const choiceCount = toNumber(rawChoice?.results);
      const matrixCount = toNumber(matrixRow[optionIndex]);
      const count = Math.max(0, choiceCount ?? matrixCount ?? 0);

      return {
        id: option.id,
        label: option.label,
        count,
        percent: 0,
      };
    });

    const totalCount = options.reduce((sum, option) => sum + option.count, 0);
    const denominator = Math.max(totalCount, participantCount, 0);

    return {
      id: question.id,
      questionNumber: question.order,
      title: question.title,
      options: options.map((option) => ({
        ...option,
        percent:
          denominator > 0 ? Math.round((option.count / denominator) * 100) : 0,
      })),
    };
  });
};

const buildTimeInfo = (createdAt: number, closesAt?: string) => {
  if (!closesAt) {
    return {
      opensAt: new Date(createdAt * 1000).toISOString(),
      isOpen: true,
      displayLabel: "Open-ended",
    };
  }

  const openedDate = new Date(createdAt * 1000);
  const closesDate = new Date(closesAt);
  const now = Date.now();
  const daysRemaining = Math.max(0, Math.ceil((closesDate.getTime() - now) / (24 * 60 * 60 * 1000)));

  return {
    opensAt: openedDate.toISOString(),
    closesAt,
    isOpen: closesDate.getTime() > now,
    daysRemaining,
    displayLabel: new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(openedDate) + " - " + new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(closesDate),
  };
};

const buildFallbackSurvey = (registry: RegistrySurveyRecord, hasVoted = false): RegisteredSurveyFeedItem => {
  const category = normalizeCategory(resolveCategoryLabel(registry));
  const createdAtIso = new Date(registry.createdAt * 1000).toISOString();
  const detail: SurveyDetail = {
    id: registry.electionId,
    title: `Survey ${registry.electionId.slice(0, 8)}`,
    description: "This survey is registered on-chain, but its Vocdoni metadata could not be loaded right now.",
    status: "active",
    categories: [category],
    estimatedMinutes: 5,
    progress: {
      responseCount: 0,
      targetResponses: 0,
    },
    budget: {
      rewardPerVoter: {
        amount: 0,
        currency: "USD",
      },
    },
    eligibility: {
      decision: hasVoted ? "already_voted" : "qualify",
      matchedRequirements: [],
      failedRequirements: [],
      checkedAt: createdAtIso,
    },
    timeInfo: {
      opensAt: createdAtIso,
      isOpen: true,
      displayLabel: "Registered on-chain",
    },
    questions: [],
    canParticipate: true,
    hasVoted,
  };

  return {
    registry,
    detail,
    card: {
      ...detail,
      listVariant: "explore",
      primaryAction: "details",
      primaryActionLabel: "Details",
    },
  };
};

const mapElectionToFeedItem = (
  registry: RegistrySurveyRecord,
  election: unknown,
  hasVoted: boolean
): RegisteredSurveyFeedItem => {
  const electionRecord = asRecord(election);
  if (!electionRecord) {
    return buildFallbackSurvey(registry, hasVoted);
  }

  const surveyCardMeta = getSurveyCardMeta(electionRecord);
  const category = normalizeCategory(resolveCategoryLabel(registry, electionRecord));
  const questions = normalizeQuestions(electionRecord);
  const title = pickText(electionRecord.title) ?? pickText(asRecord(electionRecord.metadata)?.title) ?? `Survey ${registry.electionId.slice(0, 8)}`;
  const description =
    pickText(electionRecord.description) ??
    pickText(asRecord(electionRecord.metadata)?.description) ??
    "Registered Vocdoni survey.";
  const closesAt =
    toIsoDate(electionRecord.endDate) ??
    toIsoDate(asRecord(electionRecord.raw)?.endDate) ??
    toIsoDate(asRecord(electionRecord.raw)?.end_date);
  const participantCount =
    toNumber(electionRecord.voteCount) ??
    toNumber(electionRecord.votes) ??
    toNumber(asRecord(electionRecord.results)?.voteCount) ??
    0;
  const targetResponses =
    toNumber(surveyCardMeta.voterCap) ??
    toNumber(electionRecord.maxCensusSize) ??
    toNumber(electionRecord.censusSize) ??
    toNumber(asRecord(electionRecord.census)?.size) ??
    0;
  const statusText = String(electionRecord.status ?? "").toUpperCase();
  const isClosedByStatus =
    statusText === "ENDED" ||
    statusText === "RESULTS" ||
    statusText === "PAUSED" ||
    statusText === "CANCELED";
  const status = isClosedByStatus ? "results" : "active";
  const isOpen = !isClosedByStatus && (!closesAt || new Date(closesAt).getTime() > Date.now());
  const estimatedMinutes = toNumber(surveyCardMeta.estimatedMinutes) ?? Math.max(1, questions.length || 1);
  const rewardPerVoter = toNumber(surveyCardMeta.rewardPerVoter) ?? 0;
  const tags = (surveyCardMeta.tags ?? [])
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => normalizeCategory(tag));
  const requirements = normalizeRequirements(surveyCardMeta.requirements);

  const detail: SurveyDetail = {
    id: registry.electionId,
    title,
    description,
    status,
    categories: [category],
    tags: tags.length > 0 ? tags : [category],
    estimatedMinutes,
    progress: {
      responseCount: participantCount,
      targetResponses,
    },
    budget: {
      rewardPerVoter: {
        amount: rewardPerVoter,
        currency: "USD",
      },
    },
    eligibility: {
      decision: hasVoted ? "already_voted" : "qualify",
      matchedRequirements: [],
      failedRequirements: [],
      checkedAt: new Date(registry.createdAt * 1000).toISOString(),
    },
    timeInfo: {
      ...buildTimeInfo(registry.createdAt, closesAt),
      isOpen,
    },
    requirements,
    questions,
    canParticipate: isOpen && !hasVoted,
    hasVoted,
  };

  return {
    registry,
    detail,
    card: {
      ...detail,
      listVariant: "explore",
      primaryAction: "details",
      primaryActionLabel: "Details",
    },
  };
};

const fetchHydratedElection = async (client: any, electionId: string): Promise<RegistryHydratedElection> => {
  client.setElectionId(electionId);
  const [election, voteId] = await Promise.all([
    client.fetchElection(electionId),
    client.hasAlreadyVoted(),
  ]);

  return {
    election,
    hasVoted: Boolean(voteId),
  };
};

const loadRegistryEntry = async (electionId: string) => {
  const registryEntries = await listRegisteredSurveys();
  return registryEntries.find((entry) => entry.electionId === electionId) ?? null;
};

export const loadRegisteredSurveyFeed = async (
  options: LoadRegisteredSurveyFeedOptions = {}
): Promise<RegisteredSurveyFeedItem[]> => {
  const { excludeClosed = true, excludeVoted = true } = options;
  const registryEntries = await listRegisteredSurveys();

  if (registryEntries.length === 0) {
    return [];
  }

  const wallet = await getOrCreateDeviceWallet();
  const client = await createVocdoniClient(wallet);

  const feedItems: RegisteredSurveyFeedItem[] = [];

  for (const registry of registryEntries) {
    try {
      const { election, hasVoted } = await fetchHydratedElection(client, registry.electionId);
      feedItems.push(mapElectionToFeedItem(registry, election, hasVoted));
    } catch (error) {
      console.warn("[registry-feed] election hydration failed", {
        electionId: registry.electionId,
        error: error instanceof Error ? error.message : error,
      });
      feedItems.push(buildFallbackSurvey(registry));
    }
  }

  return feedItems.filter((item) => {
    if (excludeClosed && item.detail.timeInfo?.isOpen === false) {
      return false;
    }

    if (excludeVoted && item.detail.hasVoted === true) {
      return false;
    }

    return true;
  });
};

export const loadRegisteredSurveyDetail = async (
  electionId: string,
  options: LoadRegisteredSurveyFeedOptions = {}
) => {
  const feed = await loadRegisteredSurveyFeed(options);
  return feed.find((item) => item.registry.electionId === electionId) ?? null;
};

export const loadRegisteredSurveyResultsDetail = async (
  electionId: string
): Promise<RegisteredSurveyResultsItem | null> => {
  const registryEntry = await loadRegistryEntry(electionId);
  if (!registryEntry) {
    return null;
  }

  const wallet = await getOrCreateDeviceWallet();
  const client = await createVocdoniClient(wallet);

  try {
    const { election, hasVoted } = await fetchHydratedElection(client, registryEntry.electionId);
    const feedItem = mapElectionToFeedItem(registryEntry, election, hasVoted);
    const electionRecord = asRecord(election);

    if (!electionRecord) {
      return {
        ...feedItem,
        questionResults: [],
        finalResults: false,
      };
    }

    const participantCount = feedItem.detail.progress?.responseCount ?? 0;

    return {
      ...feedItem,
      questionResults: normalizeQuestionResults(
        electionRecord,
        feedItem.detail.questions ?? [],
        participantCount
      ),
      finalResults: electionRecord.finalResults === true,
    };
  } catch (error) {
    console.warn("[registry-feed] results hydration failed", {
      electionId: registryEntry.electionId,
      error: error instanceof Error ? error.message : error,
    });

    const fallbackItem = buildFallbackSurvey(registryEntry);
    return {
      ...fallbackItem,
      questionResults: [],
      finalResults: false,
    };
  }
};
