import { SurveyCardData, SurveyCategory, SurveyDetail, SurveyQuestion, SurveyQuestionOption } from "@/domain/models";
import { listRegisteredSurveys, RegistrySurveyRecord } from "@/utils/registry/client";
import { createVocdoniClient } from "@/utils/vocdoni/sdk";
import { getOrCreateDeviceWallet } from "@/utils/vocdoni/wallet";

export type RegisteredSurveyFeedItem = {
  registry: RegistrySurveyRecord;
  card: SurveyCardData;
  detail: SurveyDetail;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

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

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

const normalizeCategory = (category: string): SurveyCategory => ({
  id: category.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "general",
  label: category || "General",
});

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
        type: isTextarea ? "textarea" : allowsMultiple ? "multiple_choice" : "single_choice",
        options,
      };
    })
    .filter((question): question is SurveyQuestion => question !== null);

  return questions;
};

const buildTimeInfo = (createdAt: number, closesAt?: string) => {
  if (!closesAt) {
    return {
      opensAt: new Date(createdAt * 1000).toISOString(),
      isOpen: true,
      displayLabel: "Open-ended",
    };
  }

  const closesDate = new Date(closesAt);
  const now = Date.now();
  const daysRemaining = Math.max(0, Math.ceil((closesDate.getTime() - now) / (24 * 60 * 60 * 1000)));

  return {
    opensAt: new Date(createdAt * 1000).toISOString(),
    closesAt,
    isOpen: closesDate.getTime() > now,
    daysRemaining,
    displayLabel: new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(closesDate),
  };
};

const buildFallbackSurvey = (registry: RegistrySurveyRecord): RegisteredSurveyFeedItem => {
  const category = normalizeCategory(registry.category);
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
      decision: "qualify",
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
    hasVoted: false,
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

const mapElectionToFeedItem = (registry: RegistrySurveyRecord, election: unknown): RegisteredSurveyFeedItem => {
  const electionRecord = asRecord(election);
  if (!electionRecord) {
    return buildFallbackSurvey(registry);
  }

  const category = normalizeCategory(registry.category);
  const questions = normalizeQuestions(electionRecord);
  const title = pickText(electionRecord.title) ?? pickText(asRecord(electionRecord.metadata)?.title) ?? `Survey ${registry.electionId.slice(0, 8)}`;
  const description =
    pickText(electionRecord.description) ??
    pickText(asRecord(electionRecord.metadata)?.description) ??
    "Registered Vocdoni survey.";
  const endDateValue = toNumber(electionRecord.endDate);
  const closesAt = endDateValue ? new Date(endDateValue).toISOString() : undefined;
  const participantCount =
    toNumber(electionRecord.voteCount) ??
    toNumber(electionRecord.votes) ??
    toNumber(asRecord(electionRecord.results)?.voteCount) ??
    0;
  const targetResponses =
    toNumber(electionRecord.maxCensusSize) ??
    toNumber(electionRecord.censusSize) ??
    toNumber(asRecord(electionRecord.census)?.size) ??
    0;
  const statusText = String(electionRecord.status ?? "").toUpperCase();
  const status = statusText === "ENDED" || statusText === "RESULTS" ? "results" : "active";
  const estimatedMinutes = Math.max(1, questions.length || 1);

  const detail: SurveyDetail = {
    id: registry.electionId,
    title,
    description,
    status,
    categories: [category],
    tags: [category],
    estimatedMinutes,
    progress: {
      responseCount: participantCount,
      targetResponses,
    },
    budget: {
      rewardPerVoter: {
        amount: 0,
        currency: "USD",
      },
    },
    eligibility: {
      decision: "qualify",
      matchedRequirements: [],
      failedRequirements: [],
      checkedAt: new Date(registry.createdAt * 1000).toISOString(),
    },
    timeInfo: buildTimeInfo(registry.createdAt, closesAt),
    questions,
    canParticipate: true,
    hasVoted: false,
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

export const loadRegisteredSurveyFeed = async (): Promise<RegisteredSurveyFeedItem[]> => {
  const registryEntries = await listRegisteredSurveys();

  if (registryEntries.length === 0) {
    return [];
  }

  const wallet = await getOrCreateDeviceWallet();
  const client = await createVocdoniClient(wallet);

  const feedItems = await Promise.all(
    registryEntries.map(async (registry) => {
      try {
        const election = await client.fetchElection(registry.electionId);
        return mapElectionToFeedItem(registry, election);
      } catch (error) {
        console.warn("[registry-feed] election hydration failed", {
          electionId: registry.electionId,
          error: error instanceof Error ? error.message : error,
        });
        return buildFallbackSurvey(registry);
      }
    })
  );

  return feedItems;
};

export const loadRegisteredSurveyDetail = async (electionId: string) => {
  const feed = await loadRegisteredSurveyFeed();
  return feed.find((item) => item.registry.electionId === electionId) ?? null;
};
