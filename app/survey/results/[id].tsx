import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Platform,
    Pressable,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";

import { SurveyDetail, SurveyQuestion, SurveyQuestionOption } from "@/domain/models";
import { getMyCreatedElections, getMyRegisteredElections } from "@/services/contractService";
import { palette } from "@/theme/palette";
import { ContractElectionStatus } from "@/types/election";
import { loadOrFetchElectionMetadata } from "@/utils/electionMetadataStore";
import { showAlert } from "@/utils/platformAlert";
import { createVocdoniClient } from "@/utils/vocdoni/sdk";
import { getOrCreateDeviceWallet } from "@/utils/vocdoni/wallet";

type SurveyResultOption = {
    id: string;
    label: string;
    count: number;
    percent: number;
};

type SurveyQuestionResult = {
    id: string;
    questionNumber: number;
    title: string;
    options: SurveyResultOption[];
};

type SurveyResultsViewModel = {
    detail: SurveyDetail;
    questionResults: SurveyQuestionResult[];
    finalResults: boolean;
};

const RESULT_COLORS = [
    palette.success,
    palette.primary,
    palette.orange,
    palette.textMuted,
    palette.border,
];

function formatStatusText(item: SurveyResultsViewModel) {
    const closesAt = item.detail.timeInfo?.closesAt;
    const closeLabel = closesAt
        ? new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        }).format(new Date(closesAt))
        : "Open-ended";

    if (item.detail.status === "results") {
        return `Completed - ${closeLabel}`;
    }

    return `Live results - ${closeLabel}`;
}

function buildCsvContent(item: SurveyResultsViewModel) {
    const rows: string[][] = [
        ["survey_id", "title", "status", "category", "responses", "target_responses"],
        [
            item.detail.id,
            item.detail.title,
            item.detail.status,
            item.detail.categories[0]?.label ?? "General",
            String(item.detail.progress?.responseCount ?? 0),
            String(item.detail.progress?.targetResponses ?? 0),
        ],
        [],
        ["question_number", "question_title", "option_label", "count", "percent"],
    ];

    for (const question of item.questionResults) {
        if (question.options.length === 0) {
            rows.push([
                String(question.questionNumber),
                question.title,
                "No aggregated option data",
                "0",
                "0",
            ]);
            continue;
        }

        for (const option of question.options) {
            rows.push([
                String(question.questionNumber),
                question.title,
                option.label,
                String(option.count),
                String(option.percent),
            ]);
        }
    }

    return rows
        .map((row) => row.map((cell) => `"${cell.replace(/"/g, "\"\"")}"`).join(","))
        .join("\n");
}

const normalizeVocdoniStatus = (status?: string | null) =>
    String(status ?? "").trim().toUpperCase();

const isVocdoniCompletedStatus = (status?: string | null) => {
    const normalized = normalizeVocdoniStatus(status);
    return (
        normalized === "ENDED" ||
        normalized === "CLOSED" ||
        normalized === "RESULTS" ||
        normalized === "CANCELED" ||
        normalized === "CANCELLED" ||
        normalized === "ARCHIVED"
    );
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
    questions: SurveyQuestion[] = []
): SurveyQuestionResult[] => {
    const rawQuestions = Array.isArray(election?.questions) ? election.questions : [];
    const rawResults = Array.isArray(election?.results) ? election.results : [];
    const sourceQuestions = questions.length > 0 ? questions : rawQuestions;

    return sourceQuestions.map((question: any, questionIndex: number) => {
        const rawQuestion = rawQuestions[questionIndex];
        const sourceOptions: SurveyQuestionOption[] =
            question.options ?? rawQuestion?.choices ?? rawQuestion?.options ?? [];
        const resultValues = rawResults[questionIndex] ?? [];

        const options = sourceOptions.map((option: any, choiceIndex: number) => {
            const rawChoice = rawQuestion?.choices?.[choiceIndex] ?? rawQuestion?.options?.[choiceIndex];
            const count = toNumberResult(
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
                count,
                percent: 0,
            };
        });

        const totalVotes = options.reduce((sum, option) => sum + option.count, 0);

        return {
            id: String(question.id ?? `${questionIndex}`),
            questionNumber: questionIndex + 1,
            title: String(question.title ?? getLocalizedText(rawQuestion?.title) ?? `Question ${questionIndex + 1}`),
            options: options.map((option) => ({
                ...option,
                percent: totalVotes > 0 ? Math.round((option.count / totalVotes) * 100) : 0,
            })),
        };
    });
};

const loadContractSurveyResults = async (selectedId: string): Promise<SurveyResultsViewModel | null> => {
    const chainId = selectedId.startsWith("chain-") ? Number(selectedId.replace("chain-", "")) : null;
    const [createdElections, registeredElections] = await Promise.all([
        getMyCreatedElections(),
        getMyRegisteredElections(),
    ]);
    const allVisibleElections = [...createdElections, ...registeredElections];
    const election = allVisibleElections.find(
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
    const vocdoniStatus = String(vocdoniElection?.status ?? "");

    const stored = await loadOrFetchElectionMetadata({
        electionId: election.id,
        metadataURI: election.metadataURI,
        metadataHash: election.metadataHash,
        eligibilityHash: election.eligibilityHash,
    });
    const metadata = stored?.metadata;
    const eligibility = stored?.eligibility;
    const startDateIso =
        metadata?.startDate ??
        (election.startDate > 0 ? new Date(election.startDate * 1000).toISOString() : undefined);
    const endDateIso =
        metadata?.endDate ??
        (election.endDate > 0 ? new Date(election.endDate * 1000).toISOString() : undefined);
    const responseCount = Number(vocdoniElection?.voteCount ?? election.registeredVoters);
    const targetResponses = election.maxVoters || Math.max(responseCount, election.registeredVoters);
    const finalResults =
        isVocdoniCompletedStatus(vocdoniStatus) ||
        Boolean(endDateIso && new Date(endDateIso).getTime() <= Date.now());

    return {
        detail: {
            id: election.vocdoniElectionId,
            title: metadata?.title || `On-chain survey #${election.id}`,
            description:
                metadata?.description ||
                "Contract-backed Vocdoni survey using the ERC1155 eligibility token census.",
            status: finalResults ? "results" : "active",
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
            estimatedMinutes: Math.max(1, metadata?.questions.length || 1),
            requirements: eligibility?.requirements ?? [],
            questions: metadata?.questions ?? [],
            timeInfo: {
                opensAt: startDateIso,
                closesAt: endDateIso,
                isOpen: !finalResults,
                displayLabel: endDateIso ? new Date(endDateIso).toLocaleString() : "Open-ended",
            },
        },
        questionResults: buildQuestionResults(vocdoniElection, metadata?.questions ?? []),
        finalResults,
    };
};

export default function SurveyResultsScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id?: string | string[] }>();
    const selectedId = Array.isArray(id) ? id[0] : id;

    const [surveyResults, setSurveyResults] = useState<SurveyResultsViewModel | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const loadResults = async () => {
            try {
                setIsLoading(true);
                setErrorMessage(null);

                if (!selectedId) {
                    throw new Error("Missing survey id.");
                }

                const nextResults = await loadContractSurveyResults(selectedId);
                if (!nextResults) {
                    throw new Error("Survey not found in your contract-created Vocdoni surveys.");
                }

                if (!isMounted) {
                    return;
                }

                setSurveyResults(nextResults);
            } catch (error) {
                if (!isMounted) {
                    return;
                }

                setSurveyResults(null);
                setErrorMessage(
                    error instanceof Error ? error.message : "Unable to load survey results."
                );
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        loadResults();

        return () => {
            isMounted = false;
        };
    }, [selectedId]);

    const questionsWithTallies = useMemo(
        () => surveyResults?.questionResults.filter((question) =>
            question.options.some((option) => option.count > 0)
        ) ?? [],
        [surveyResults?.questionResults]
    );

    const handleShare = async () => {
        if (!surveyResults) {
            return;
        }

        try {
            await Share.share({
                title: surveyResults.detail.title,
                message: `Survey results\n\n${surveyResults.detail.title}\nSurvey ID: ${surveyResults.detail.id}\nResponses: ${surveyResults.detail.progress?.responseCount ?? 0}`,
            });
        } catch (error) {
            showAlert(
                "Share failed",
                error instanceof Error ? error.message : "Unable to share survey results."
            );
        }
    };

    const handleExportCsv = async () => {
        if (!surveyResults || isExporting) {
            return;
        }

        try {
            setIsExporting(true);

            const csvContent = buildCsvContent(surveyResults);
            const baseDir = FileSystem.documentDirectory;

            if (!baseDir) {
                throw new Error("Document directory is unavailable on this device.");
            }

            const safeTitle = surveyResults.detail.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
            const fileName = `${safeTitle || "survey-results"}-${Date.now()}.csv`;
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
                    dialogTitle: "Export survey results CSV",
                });
            } else {
                showAlert("CSV exported", `Saved to ${fileUri}`);
            }
        } catch (error) {
            showAlert(
                "Export failed",
                error instanceof Error ? error.message : "Unable to export survey results."
            );
        } finally {
            setIsExporting(false);
        }
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.centerBox}>
                    <ActivityIndicator color={palette.white} />
                    <Text style={styles.centerText}>Loading survey results...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!surveyResults) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.centerBox}>
                    <Text style={styles.emptyTitle}>Results unavailable</Text>
                    <Text style={styles.centerText}>
                        {errorMessage ?? "Unable to load survey results."}
                    </Text>
                    <Pressable style={styles.errorBackButton} onPress={() => router.back()}>
                        <Text style={styles.secondaryButtonText}>Back</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    const categoryLabel = surveyResults.detail.categories[0]?.label ?? "General";
    const totalResponses = surveyResults.detail.progress?.responseCount ?? 0;
    const resultStatusText = formatStatusText(surveyResults);

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <View style={styles.topBar}>
                        <Pressable style={styles.backButton} onPress={() => router.back()}>
                            <Ionicons name="chevron-back" size={20} color={palette.white} />
                        </Pressable>

                        <View style={styles.titleWrap}>
                            <Text style={styles.overline}>SURVEY RESULTS</Text>
                            <Text style={styles.headerTitle}>{surveyResults.detail.title}</Text>
                        </View>
                    </View>

                    <View style={styles.statusBadge}>
                        <Ionicons
                            name={surveyResults.finalResults ? "checkmark" : "time-outline"}
                            size={14}
                            color={palette.green.text}
                        />
                        <Text style={styles.statusText}>{resultStatusText}</Text>
                    </View>

                    <View style={styles.metaRow}>
                        <View style={styles.categoryPill}>
                            <Text style={styles.categoryText}>{categoryLabel}</Text>
                        </View>
                        <Text style={styles.metaText}>
                            {surveyResults.finalResults ? "Final tally" : "Live tally"}
                        </Text>
                    </View>

                    <View style={styles.statsRow}>
                        <StatCard label="Total resp." value={String(totalResponses)} />
                        <StatCard label="Target" value={String(surveyResults.detail.progress?.targetResponses ?? 0)} />
                        <StatCard label="Questions" value={String(surveyResults.detail.questions?.length ?? 0)} />
                    </View>
                </View>

                <View style={styles.content}>
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {questionsWithTallies.length > 0 ? (
                            questionsWithTallies.map((question) => (
                                <QuestionCard key={question.id} question={question} />
                            ))
                        ) : (
                            <View style={styles.emptyCard}>
                                <Text style={styles.emptyCardTitle}>No aggregated option results yet</Text>
                                <Text style={styles.emptyCardText}>
                                    This survey has real registry and Vocdoni data, but there is no option-level tally available for display right now.
                                </Text>
                            </View>
                        )}

                        <View style={styles.buttonRow}>
                            <Pressable style={styles.secondaryButton} onPress={handleShare}>
                                <Ionicons
                                    name="share-social-outline"
                                    size={18}
                                    color={palette.primaryDark}
                                />
                                <Text style={styles.secondaryButtonText}>Share</Text>
                            </Pressable>

                            <Pressable
                                style={styles.primaryButton}
                                onPress={handleExportCsv}
                                disabled={isExporting}
                            >
                                <Ionicons
                                    name="download-outline"
                                    size={18}
                                    color={palette.white}
                                />
                                <Text style={styles.primaryButtonText}>
                                    {isExporting ? "Exporting..." : "Export CSV"}
                                </Text>
                            </Pressable>
                        </View>
                    </ScrollView>
                </View>
            </View>
        </SafeAreaView>
    );
}

function QuestionCard({ question }: { question: SurveyQuestionResult }) {
    return (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <Text style={styles.questionTitle}>{question.title}</Text>
                <Text style={styles.questionNumber}>Q{question.questionNumber}</Text>
            </View>

            {question.options.length > 0 ? (
                question.options.map((option, index) => {
                    const color = RESULT_COLORS[index % RESULT_COLORS.length];

                    return (
                        <View key={option.id} style={styles.optionBlock}>
                            <View style={styles.optionRow}>
                                <Text style={styles.optionLabel}>{option.label}</Text>
                                <Text style={[styles.optionPercent, { color }]}>
                                    {option.percent}%
                                </Text>
                            </View>

                            <View style={styles.progressTrack}>
                                <View
                                    style={[
                                        styles.progressFill,
                                        {
                                            width: `${option.percent}%`,
                                            backgroundColor: color,
                                        },
                                    ]}
                                />
                            </View>

                            <Text style={styles.optionCount}>{option.count} responses</Text>
                        </View>
                    );
                })
            ) : (
                <Text style={styles.questionEmptyText}>
                    No aggregated option data available for this question.
                </Text>
            )}
        </View>
    );
}

function StatCard({ value, label }: { value: string; label: string }) {
    return (
        <View style={styles.statCard}>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: palette.primaryDark,
    },
    container: {
        flex: 1,
        backgroundColor: palette.primaryDark,
    },
    centerBox: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24,
        gap: 10,
    },
    centerText: {
        color: palette.white50,
        fontSize: 14,
        textAlign: "center",
        lineHeight: 20,
    },
    emptyTitle: {
        color: palette.white,
        fontSize: 18,
        fontWeight: "700",
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 20,
        backgroundColor: palette.primaryDark,
    },
    topBar: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: palette.white7,
        alignItems: "center",
        justifyContent: "center",
    },
    titleWrap: {
        flex: 1,
    },
    overline: {
        color: palette.white50,
        fontSize: 12,
        fontWeight: "700",
        marginBottom: 2,
    },
    headerTitle: {
        color: palette.white,
        fontSize: 24,
        fontWeight: "800",
    },
    statusBadge: {
        marginTop: 16,
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: palette.green.bgSoft,
        borderColor: palette.successLight,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
    },
    statusText: {
        color: palette.green.text,
        fontSize: 14,
        fontWeight: "700",
    },
    metaRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginTop: 14,
    },
    metaText: {
        color: palette.white50,
        fontSize: 13,
        fontWeight: "600",
    },
    categoryPill: {
        borderRadius: 999,
        backgroundColor: palette.white7,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    categoryText: {
        color: palette.white,
        fontSize: 12,
        fontWeight: "700",
    },
    statsRow: {
        flexDirection: "row",
        gap: 12,
        marginTop: 16,
    },
    statCard: {
        flex: 1,
        backgroundColor: palette.white7,
        borderRadius: 16,
        padding: 14,
    },
    statValue: {
        color: palette.white,
        fontSize: 18,
        fontWeight: "800",
    },
    statLabel: {
        color: palette.white50,
        fontSize: 13,
        marginTop: 4,
    },
    content: {
        flex: 1,
        backgroundColor: palette.surfaceMuted,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        overflow: "hidden",
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 30,
    },
    card: {
        backgroundColor: palette.white,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: palette.border,
        padding: 16,
        marginBottom: 16,
    },
    emptyCard: {
        backgroundColor: palette.white,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: palette.border,
        padding: 18,
        marginBottom: 16,
    },
    emptyCardTitle: {
        color: palette.primaryDark,
        fontSize: 18,
        fontWeight: "800",
    },
    emptyCardText: {
        marginTop: 8,
        color: palette.textMuted,
        fontSize: 14,
        lineHeight: 21,
    },
    cardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 10,
        marginBottom: 14,
    },
    questionTitle: {
        flex: 1,
        fontSize: 22,
        fontWeight: "800",
        color: palette.primaryDark,
        lineHeight: 28,
    },
    questionNumber: {
        color: palette.textMuted,
        fontSize: 14,
        fontWeight: "700",
    },
    questionEmptyText: {
        color: palette.textMuted,
        fontSize: 14,
        lineHeight: 20,
    },
    optionBlock: {
        marginBottom: 16,
    },
    optionRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 8,
        gap: 10,
    },
    optionLabel: {
        flex: 1,
        color: palette.primaryDark,
        fontSize: 16,
        fontWeight: "700",
    },
    optionPercent: {
        fontSize: 16,
        fontWeight: "800",
    },
    progressTrack: {
        height: 10,
        borderRadius: 999,
        backgroundColor: palette.border,
        overflow: "hidden",
    },
    progressFill: {
        height: "100%",
        borderRadius: 999,
    },
    optionCount: {
        marginTop: 6,
        color: palette.textMuted,
        fontSize: 14,
    },
    buttonRow: {
        flexDirection: "row",
        gap: 12,
        marginTop: 8,
    },
    secondaryButton: {
        flex: 1,
        height: 54,
        backgroundColor: palette.white,
        borderWidth: 1,
        borderColor: palette.border,
        borderRadius: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingHorizontal: 16,
    },
    errorBackButton: {
        minWidth: 140,
        height: 54,
        backgroundColor: palette.white,
        borderWidth: 1,
        borderColor: palette.border,
        borderRadius: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 16,
    },
    secondaryButtonText: {
        color: palette.primaryDark,
        fontSize: 16,
        fontWeight: "700",
    },
    primaryButton: {
        flex: 1.4,
        height: 54,
        backgroundColor: palette.primary,
        borderRadius: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingHorizontal: 16,
    },
    primaryButtonText: {
        color: palette.white,
        fontSize: 16,
        fontWeight: "700",
    },
});
