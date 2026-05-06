import React, { useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";

import { SurveyManageDetail, SurveyRequirement } from "@/domain/models";
import { palette } from "@/theme/palette";
import { getMyCreatedElections } from "@/services/contractService";
import { ContractElectionStatus } from "@/types/election";
import { loadOrFetchElectionMetadata } from "@/utils/electionMetadataStore";
import { loadRegisteredSurveyDetail } from "@/utils/registry/feed";
import { showAlert } from "@/utils/platformAlert";
import { createVocdoniClient } from "@/utils/vocdoni/sdk";
import { getOrCreateDeviceWallet } from "@/utils/vocdoni/wallet";

type ResultChoice = {
  id: string;
  label: string;
  votes: number;
  percent: number;
};

type QuestionResult = {
  id: string;
  title: string;
  totalVotes: number;
  choices: ResultChoice[];
};

function buildRequirements(requirements: SurveyRequirement[] = []) {
  return requirements.map((item) => `${item.type} ${item.value}`);
}

function formatDurationLabel(opensAt?: string, closesAt?: string) {
  if (!opensAt && !closesAt) {
    return "Open-ended";
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const openLabel = opensAt ? formatter.format(new Date(opensAt)) : "Unknown start";
  const closeLabel = closesAt ? formatter.format(new Date(closesAt)) : "Open-ended";
  return `${openLabel} - ${closeLabel}`;
}

function formatClosesLabel(closesAt?: string) {
  if (!closesAt) {
    return "Open-ended";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(closesAt));
}

const daysRemainingFrom = (iso?: string) => {
  if (!iso) {
    return 0;
  }

  const diffMs = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
};

const getLocalizedText = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return String(record.default ?? record.en ?? Object.values(record)[0] ?? "");
  }

  return "";
};

const toNumberResult = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildQuestionResults = (
  election: any,
  questions: SurveyManageDetail["questions"] = []
): QuestionResult[] => {
  const rawQuestions = Array.isArray(election?.questions) ? election.questions : [];
  const rawResults = Array.isArray(election?.results) ? election.results : [];
  const sourceQuestions = questions.length > 0 ? questions : rawQuestions;

  return sourceQuestions.map((question: any, questionIndex: number) => {
    const rawQuestion = rawQuestions[questionIndex];
    const sourceOptions = question.options ?? rawQuestion?.choices ?? rawQuestion?.options ?? [];
    const resultValues = rawResults[questionIndex] ?? [];

    const choices: ResultChoice[] = sourceOptions.map((option: any, choiceIndex: number) => {
      const rawChoice = rawQuestion?.choices?.[choiceIndex] ?? rawQuestion?.options?.[choiceIndex];
      const votes = toNumberResult(
        resultValues[choiceIndex] ??
          rawChoice?.results ??
          option.results ??
          0
      );

      return {
        id: String(option.id ?? rawChoice?.id ?? `${questionIndex}-${choiceIndex}`),
        label: String(
          option.label ??
            getLocalizedText(rawChoice?.title) ??
            rawChoice?.label ??
            `Option ${choiceIndex + 1}`
        ),
        votes,
        percent: 0,
      };
    });

    const totalVotes = choices.reduce((sum, choice) => sum + choice.votes, 0);

    return {
      id: String(question.id ?? `${questionIndex}`),
      title: String(question.title ?? getLocalizedText(rawQuestion?.title) ?? `Question ${questionIndex + 1}`),
      totalVotes,
      choices: choices.map((choice) => ({
        ...choice,
        percent: totalVotes > 0 ? Math.round((choice.votes / totalVotes) * 100) : 0,
      })),
    };
  });
};

const loadContractManageDetail = async (selectedId: string): Promise<SurveyManageDetail | null> => {
  const chainId = selectedId.startsWith("chain-") ? Number(selectedId.replace("chain-", "")) : null;
  const createdElections = await getMyCreatedElections();
  const election = createdElections.find(
    (candidate) =>
      candidate.status === ContractElectionStatus.Started &&
      (candidate.vocdoniElectionId === selectedId || candidate.id === chainId)
  );

  if (!election?.vocdoniElectionId) {
    return null;
  }

  const wallet = await getOrCreateDeviceWallet();
  const client = await createVocdoniClient(wallet);
  client.setElectionId(election.vocdoniElectionId);
  const vocdoniElection = await client.fetchElection(election.vocdoniElectionId);

  const stored = await loadOrFetchElectionMetadata({
    electionId: election.id,
    metadataURI: election.metadataURI,
    metadataHash: election.metadataHash,
    eligibilityHash: election.eligibilityHash,
  });
  const metadata = stored?.metadata;
  const eligibility = stored?.eligibility;
  const responseCount = Number(vocdoniElection?.voteCount ?? election.registeredVoters);
  const targetResponses = election.maxVoters || election.registeredVoters;
  const endDateIso =
    metadata?.endDate ??
    (election.endDate > 0 ? new Date(election.endDate * 1000).toISOString() : undefined);
  const startDateIso =
    metadata?.startDate ??
    (election.startDate > 0 ? new Date(election.startDate * 1000).toISOString() : undefined);

  return {
    id: election.vocdoniElectionId,
    title: metadata?.title || `On-chain survey #${election.id}`,
    description:
      metadata?.description ||
      "Contract-backed Vocdoni survey using the ERC1155 eligibility token census.",
    status:
      vocdoniElection?.status === "ENDED" ||
      vocdoniElection?.status === "RESULTS" ||
      (endDateIso && new Date(endDateIso).getTime() <= Date.now())
        ? "results"
        : "active",
    categories: [
      {
        id: (metadata?.category || "on-chain").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        label: metadata?.category || "On-chain",
      },
    ],
    tags: metadata?.tags.map((tag) => ({
      id: tag.toLowerCase().replace(/[^a-z0-9]+/g, "-") || tag,
      label: tag,
    })),
    estimatedMinutes: Math.max(1, metadata?.questions.length || 1),
    progress: {
      responseCount,
      targetResponses,
    },
    eligibility: {
      decision: "qualify",
      matchedRequirements: [],
      failedRequirements: [],
      checkedAt: new Date().toISOString(),
    },
    requirements: eligibility?.requirements ?? [],
    questions: metadata?.questions ?? [],
    timeInfo: {
      opensAt: startDateIso,
      closesAt: endDateIso,
      isOpen: true,
      daysRemaining: daysRemainingFrom(endDateIso),
      displayLabel: formatDurationLabel(startDateIso, endDateIso),
    },
    recentResponses: [],
    allowedActions: ["share", "export_csv"],
  };
};

export default function ManageSurveyPage() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const selectedId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [survey, setSurvey] = React.useState<SurveyManageDetail | null>(null);
  const [questionResults, setQuestionResults] = React.useState<QuestionResult[]>([]);
  const [vocdoniStatus, setVocdoniStatus] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshingResults, setIsRefreshingResults] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [isEndingSurvey, setIsEndingSurvey] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const refreshVocdoniResults = React.useCallback(async (surveyId: string, detail?: SurveyManageDetail) => {
    const wallet = await getOrCreateDeviceWallet();
    const client = await createVocdoniClient(wallet);
    client.setElectionId(surveyId);
    const election = await client.fetchElection(surveyId);
    const nextResults = buildQuestionResults(election, detail?.questions ?? []);
    const nextVoteCount = Number(election?.voteCount ?? detail?.progress?.responseCount ?? 0);
    const nextStatus = String(election?.status ?? "");

    setVocdoniStatus(nextStatus || null);
    setQuestionResults(nextResults);
    setSurvey((current) => {
      const base = detail ?? current;
      if (!base) {
        return current;
      }

      return {
        ...base,
        status: nextStatus === "ENDED" || nextStatus === "RESULTS" ? "results" : base.status,
        progress: {
          ...base.progress,
          responseCount: nextVoteCount,
        },
        timeInfo: {
          ...base.timeInfo,
          isOpen: nextStatus !== "ENDED" && nextStatus !== "RESULTS",
        },
      };
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadSurvey = async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        if (!selectedId) {
          throw new Error("Missing survey id.");
        }

        const surveyDetail = await loadRegisteredSurveyDetail(selectedId, {
          excludeClosed: false,
          excludeVoted: false,
        });

        if (surveyDetail) {
          if (!isMounted) {
            return;
          }

          const responseCount = surveyDetail.detail.progress?.responseCount ?? 0;
          const targetResponses = surveyDetail.detail.progress?.targetResponses ?? 0;

          const nextSurvey: SurveyManageDetail = {
            ...surveyDetail.detail,
            progress: {
              ...surveyDetail.detail.progress,
              responseCount,
              targetResponses,
            },
            recentResponses: [],
            allowedActions: ["share", "export_csv"],
          };
          setSurvey(nextSurvey);
          await refreshVocdoniResults(selectedId, nextSurvey);
          return;
        }

        const contractDetail = await loadContractManageDetail(selectedId);
        if (!contractDetail) {
          throw new Error("Survey not found in your contract-created Vocdoni surveys.");
        }

        if (isMounted) {
          setSurvey(contractDetail);
          await refreshVocdoniResults(contractDetail.id, contractDetail);
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setSurvey(null);
        setErrorMessage(error instanceof Error ? error.message : "Unable to load survey.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadSurvey();

    return () => {
      isMounted = false;
    };
  }, [refreshVocdoniResults, selectedId]);

  const durationLabel = useMemo(
    () => formatDurationLabel(survey?.timeInfo?.opensAt, survey?.timeInfo?.closesAt),
    [survey?.timeInfo?.closesAt, survey?.timeInfo?.opensAt]
  );
  const closesLabel = useMemo(
    () => formatClosesLabel(survey?.timeInfo?.closesAt),
    [survey?.timeInfo?.closesAt]
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centerBox}>
          <ActivityIndicator color={palette.primary} />
          <Text style={styles.centerText}>Loading survey dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!survey) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centerBox}>
          <Text style={styles.errorTitle}>Survey unavailable</Text>
          <Text style={styles.centerText}>{errorMessage ?? "Unable to load survey dashboard."}</Text>
          <Pressable onPress={() => router.back()} style={styles.backToAppButton}>
            <Text style={styles.backToAppText}>Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const totalResponses = survey.progress?.responseCount ?? 0;
  const targetResponses = survey.progress?.targetResponses ?? 0;
  const responseProgress = targetResponses > 0 ? Math.min(1, totalResponses / targetResponses) : 0;
  const responseProgressLabel = `${Math.round(responseProgress * 100)}%`;
  const daysRemaining = survey.timeInfo?.daysRemaining ?? 0;
  const requirements = buildRequirements(survey.requirements);
  const categoryLabel = survey.categories[0]?.label ?? "General";

  const handleRefreshResults = async () => {
    if (!survey || isRefreshingResults) {
      return;
    }

    try {
      setIsRefreshingResults(true);
      await refreshVocdoniResults(survey.id, survey);
    } catch (error) {
      showAlert(
        "Refresh failed",
        error instanceof Error ? error.message : "Unable to refresh Vocdoni results."
      );
    } finally {
      setIsRefreshingResults(false);
    }
  };

  const handleExportCsv = async () => {
    if (isExporting) return;

    try {
      setIsExporting(true);

      const csvRows: string[][] = [
        [
          "survey_id",
          "title",
          "status",
          "category",
          "duration",
          "total_responses",
          "target_responses",
          "requirements",
        ],
        [
          survey.id,
          survey.title,
          survey.status,
          categoryLabel,
          durationLabel,
          String(totalResponses),
          String(targetResponses),
          requirements.join(" | "),
        ],
      ];

      const escapeCsvCell = (value: string) => `"${value.replace(/"/g, "\"\"")}"`;
      const csvContent = csvRows
        .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
        .join("\n");

      const baseDir = FileSystem.documentDirectory;
      if (!baseDir) {
        throw new Error("Document directory is unavailable on this device.");
      }

      const safeTitle = survey.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const fileName = `${safeTitle || "survey"}-${Date.now()}.csv`;
      const fileUri = `${baseDir}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (Platform.OS === "web") {
        showAlert("CSV exported", `File prepared: ${fileName}`);
        return;
      }

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "text/csv",
          UTI: "public.comma-separated-values-text",
          dialogTitle: "Export survey CSV",
        });
      } else {
        showAlert("CSV exported", `Saved to ${fileUri}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to export CSV.";
      showAlert("Export failed", message);
    } finally {
      setIsExporting(false);
    }
  };

  const endSurvey = async () => {
    if (!survey || isEndingSurvey) {
      return;
    }

    try {
      setIsEndingSurvey(true);
      const wallet = await getOrCreateDeviceWallet();
      const client = await createVocdoniClient(wallet);
      client.setElectionId(survey.id);
      await client.endElection(survey.id);
      await refreshVocdoniResults(survey.id, survey);
      showAlert(
        "Survey ended",
        "The Vocdoni election was ended successfully.",
        [
          {
            text: "OK",
            onPress: () =>
              router.replace({
                pathname: "/(tabs)/mySurveys",
                params: { tab: "created" },
              }),
          },
        ]
      );
    } catch (error) {
      showAlert(
        "End failed",
        error instanceof Error ? error.message : "Unable to end this survey on Vocdoni."
      );
    } finally {
      setIsEndingSurvey(false);
    }
  };

  const handleEndSurvey = () => {
    if (survey.status === "results" || vocdoniStatus === "ENDED" || vocdoniStatus === "RESULTS") {
      showAlert("Survey already ended", "This Vocdoni election is already ended.");
      return;
    }

    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("End this survey now? Voters will no longer be able to submit votes.")) {
        endSurvey();
      }
      return;
    }

    Alert.alert(
      "End survey?",
      "Voters will no longer be able to submit votes. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "End Survey", style: "destructive", onPress: endSurvey },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { paddingTop: 16 }]}>
          <View style={styles.heroHeader}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
            >
              <MaterialIcons name="chevron-left" size={18} color={palette.white} />
            </Pressable>
            <View style={styles.heroTitleWrap}>
              <Text style={styles.heroKicker}>Survey Dashboard</Text>
              <Text style={styles.heroTitle}>{survey.title}</Text>
            </View>
            <Pressable style={({ pressed }) => [styles.menuButton, pressed && styles.iconButtonPressed]}>
              <MaterialIcons name="more-horiz" size={18} color={palette.white} />
            </Pressable>
          </View>

          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>
              {survey.status === "results" ? "CLOSED" : "LIVE"} - {vocdoniStatus ?? categoryLabel}
            </Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{totalResponses}</Text>
              <Text style={styles.statLabel}>Total resp.</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{targetResponses}</Text>
              <Text style={styles.statLabel}>Target</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{daysRemaining}</Text>
              <Text style={styles.statLabel}>Days left</Text>
            </View>
          </View>

          <View style={styles.progressWrap}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Response progress</Text>
              <Text style={styles.progressValue}>
                {responseProgressLabel}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${responseProgress * 100}%` }]} />
            </View>
            <Text style={styles.progressHint}>
              Closes {closesLabel}{daysRemaining > 0 ? ` - ${daysRemaining} days remaining` : ""}
            </Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Live Results</Text>
            <Pressable
              onPress={handleRefreshResults}
              disabled={isRefreshingResults}
              style={({ pressed }) => [
                styles.linkButton,
                pressed && !isRefreshingResults && styles.linkButtonPressed,
                isRefreshingResults && styles.linkButtonDisabled,
              ]}
            >
              <Text style={styles.linkText}>{isRefreshingResults ? "Refreshing..." : "Refresh"}</Text>
            </Pressable>
          </View>

          {questionResults.length > 0 ? (
            <View style={styles.resultsContent}>
              {questionResults.map((question) => (
                <View key={question.id} style={styles.resultQuestion}>
                  <View style={styles.resultQuestionHeader}>
                    <Text style={styles.resultQuestionTitle}>{question.title}</Text>
                    <Text style={styles.resultQuestionTotal}>{question.totalVotes} votes</Text>
                  </View>

                  {question.choices.length > 0 ? (
                    question.choices.map((choice) => (
                      <View key={choice.id} style={styles.resultChoice}>
                        <View style={styles.resultChoiceHeader}>
                          <Text style={styles.resultChoiceLabel}>{choice.label}</Text>
                          <Text style={styles.resultChoiceValue}>
                            {choice.votes} ({choice.percent}%)
                          </Text>
                        </View>
                        <View style={styles.resultBarTrack}>
                          <View style={[styles.resultBarFill, { width: `${choice.percent}%` }]} />
                        </View>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyResultsText}>No choices found for this question.</Text>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyResults}>
              <Text style={styles.emptyResultsText}>
                No result rows returned yet. Refresh after votes are submitted.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Survey Info</Text>
            <Pressable
              onPress={handleExportCsv}
              disabled={isExporting}
              style={({ pressed }) => [
                styles.linkButton,
                pressed && !isExporting && styles.linkButtonPressed,
                isExporting && styles.linkButtonDisabled,
              ]}
            >
              <Text style={styles.linkText}>{isExporting ? "Exporting..." : "Export CSV"}</Text>
            </Pressable>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel} numberOfLines={1}>
              Category
            </Text>
            <View style={styles.infoPill}>
              <Text style={styles.infoPillText}>{categoryLabel}</Text>
            </View>
          </View>

          <View style={[styles.infoRow, styles.rowDivider]}>
            <Text style={styles.infoLabel} numberOfLines={1}>
              Duration
            </Text>
            <Text style={styles.infoValue}>{durationLabel}</Text>
          </View>

          <View style={[styles.infoRow, styles.rowDivider]}>
            <Text style={styles.infoLabel} numberOfLines={1}>
              Response target
            </Text>
            <Text style={styles.infoValue}>
              {targetResponses > 0 ? `${targetResponses} voters` : "Open registration"}
            </Text>
          </View>

          <View style={[styles.infoRow, styles.requirementsRow]}>
            <Text style={styles.infoLabel} numberOfLines={1}>
              Requirements
            </Text>
            <View style={styles.requirementsWrap}>
              {requirements.length > 0 ? (
                requirements.map((item) => (
                  <View key={item} style={styles.requirementPill}>
                    <Text style={styles.requirementText}>{item}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.infoValue}>No requirements</Text>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.actionBar}>
        <Pressable style={({ pressed }) => [styles.shareButton, pressed && styles.shareButtonPressed]}>
          <MaterialIcons name="share" size={15} color={palette.primaryDark} />
          <Text style={styles.shareText}>Share</Text>
        </Pressable>
        <Pressable
          disabled={isEndingSurvey}
          onPress={handleEndSurvey}
          style={({ pressed }) => [
            styles.endButton,
            pressed && !isEndingSurvey && styles.endButtonPressed,
            isEndingSurvey && styles.endButtonDisabled,
          ]}
        >
          <MaterialIcons name="cancel" size={15} color={palette.warning} />
          <Text style={styles.endText}>{isEndingSurvey ? "Ending..." : "End Survey"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.surfaceSoft,
  },
  content: {
    paddingBottom: 98,
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 10,
  },
  centerText: {
    color: palette.textSecondary,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  errorTitle: {
    color: palette.primaryDark,
    fontSize: 18,
    fontWeight: "700",
  },
  backToAppButton: {
    marginTop: 8,
    backgroundColor: palette.primary,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  backToAppText: {
    color: palette.white,
    fontWeight: "700",
    fontSize: 14,
  },
  hero: {
    backgroundColor: palette.primaryPressed,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: palette.white25,
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonPressed: {
    backgroundColor: "rgba(255,255,255,0.35)",
    transform: [{ scale: 0.97 }],
  },
  menuButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonPressed: {
    backgroundColor: "rgba(255,255,255,0.2)",
    transform: [{ scale: 0.97 }],
  },
  heroTitleWrap: {
    flex: 1,
  },
  heroKicker: {
    color: palette.white50,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  heroTitle: {
    marginTop: 2,
    color: palette.white,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 21,
  },
  livePill: {
    marginTop: 14,
    alignSelf: "flex-start",
    backgroundColor: palette.white25,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#4ADE80",
  },
  liveText: {
    fontSize: 11,
    color: palette.white,
    fontWeight: "700",
  },
  statsRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: palette.white25,
    borderRadius: 11,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  statValue: {
    color: palette.white,
    fontSize: 18,
    fontWeight: "500",
  },
  statLabel: {
    marginTop: 2,
    color: palette.white50,
    fontSize: 10,
    fontWeight: "500",
  },
  progressWrap: {
    marginTop: 12,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
  },
  progressValue: {
    fontSize: 11,
    color: palette.white,
    fontWeight: "500",
  },
  progressTrack: {
    marginTop: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.2)",
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: 3,
  },
  progressHint: {
    marginTop: 6,
    color: palette.white50,
    fontSize: 10,
  },
  sectionCard: {
    marginTop: 14,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 16,
    backgroundColor: palette.white,
    paddingBottom: 4,
  },
  resultsContent: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 14,
  },
  resultQuestion: {
    gap: 10,
  },
  resultQuestionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  resultQuestionTitle: {
    flex: 1,
    color: palette.primaryDark,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  resultQuestionTotal: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  resultChoice: {
    gap: 5,
  },
  resultChoiceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  resultChoiceLabel: {
    flex: 1,
    color: palette.textPrimary,
    fontSize: 12,
    fontWeight: "600",
  },
  resultChoiceValue: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  resultBarTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: palette.surfaceMuted,
    overflow: "hidden",
  },
  resultBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: palette.primary,
  },
  emptyResults: {
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  emptyResultsText: {
    color: palette.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  sectionHeader: {
    height: 40,
    borderBottomWidth: 1,
    borderBottomColor: palette.surfaceMuted,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.primaryDark,
  },
  linkText: {
    fontSize: 12,
    fontWeight: "600",
    color: palette.primary,
  },
  linkButton: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  linkButtonPressed: {
    backgroundColor: palette.primaryNegative,
  },
  linkButtonDisabled: {
    opacity: 0.6,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: palette.surfaceSoft,
  },
  infoRow: {
    minHeight: 46,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  requirementsRow: {
    alignItems: "flex-start",
    paddingVertical: 12,
  },
  infoLabel: {
    width: 92,
    flexShrink: 0,
    fontSize: 12,
    color: palette.textMuted,
    fontWeight: "700",
  },
  infoValue: {
    flex: 1,
    fontSize: 13,
    color: palette.primaryDark,
    fontWeight: "500",
  },
  infoPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: palette.primaryNegative,
  },
  infoPillText: {
    fontSize: 11,
    fontWeight: "600",
    color: palette.primary,
  },
  requirementsWrap: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  requirementPill: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: palette.surfaceMuted,
  },
  requirementText: {
    fontSize: 12,
    fontWeight: "600",
    color: palette.primaryDarkText,
  },
  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 82,
    paddingTop: 14,
    paddingBottom: 18,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.white,
    flexDirection: "row",
    gap: 10,
  },
  shareButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  shareButtonPressed: {
    backgroundColor: palette.primaryNegative,
    transform: [{ scale: 0.985 }],
  },
  shareText: {
    fontSize: 14,
    fontWeight: "700",
    color: palette.primaryDark,
  },
  endButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.warningLight,
    backgroundColor: palette.primaryNegative,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  endButtonPressed: {
    backgroundColor: palette.warningLight,
    transform: [{ scale: 0.985 }],
  },
  endButtonDisabled: {
    opacity: 0.6,
  },
  endText: {
    fontSize: 14,
    fontWeight: "700",
    color: palette.warning,
  },
});
