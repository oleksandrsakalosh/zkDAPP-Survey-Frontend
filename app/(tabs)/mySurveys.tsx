import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    Alert,
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import CreatedSurveys from "@/app/survey/createdSurveys";
import ParticipatedSurveys from "@/app/survey/participatedSurveys";
import {
    CreatedSurveyCardData,
    ParticipatedSurveySummary,
    SurveyDraft,
} from "@/domain/models";
import { palette } from "@/theme/palette";
import { router, useLocalSearchParams } from "expo-router";
import { registerSurveyInRegistry } from "@/utils/registry/client";
import { loadRegisteredSurveyFeed, RegisteredSurveyFeedItem } from "@/utils/registry/feed";
import { useDeviceWallet } from "@/utils/vocdoni/WalletProvider";
import { publishSurveyDraft } from "@/utils/vocdoni/publishSurvey";
import { fetchElectionAsSurveyDetail } from "@/utils/vocdoni/fetchElection";

const { width } = Dimensions.get("window");

const formatShortDate = (dateIso: string) =>
    new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
    }).format(new Date(dateIso));

// ─── Gaming survey (5 questions) ─────────────────────────────────────────────

const buildQuickVocdoniTestDraft = (): SurveyDraft => {
    const now = new Date();
    const endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    return {
        name: "Gamer Habits & Preferences Survey",
        description: "A quick survey about your gaming habits, favourite genres and platforms. Your answers are anonymous and help us understand the modern gaming landscape.",
        startDate: now.toISOString(),
        endDate: endDate.toISOString(),
        tags: ["gaming", "games", "survey"],
        category: "Gaming",
        rewardPerVoter: 0,
        voterCap: 5,
        requirements: [],
        questions: [
            {
                id: "gq1",
                order: 1,
                type: "single_choice",
                title: "How many hours per week do you spend playing video games?",
                isRequired: true,
                options: [
                    { id: "gq1-o1", label: "Less than 1 hour", order: 0 },
                    { id: "gq1-o2", label: "1–5 hours", order: 1 },
                    { id: "gq1-o3", label: "5–15 hours", order: 2 },
                    { id: "gq1-o4", label: "15–30 hours", order: 3 },
                    { id: "gq1-o5", label: "More than 30 hours", order: 4 },
                ],
            },
            {
                id: "gq2",
                order: 2,
                type: "single_choice",
                title: "Which gaming platform do you use most often?",
                isRequired: true,
                options: [
                    { id: "gq2-o1", label: "PC / Steam", order: 0 },
                    { id: "gq2-o2", label: "PlayStation", order: 1 },
                    { id: "gq2-o3", label: "Xbox", order: 2 },
                    { id: "gq2-o4", label: "Nintendo Switch", order: 3 },
                    { id: "gq2-o5", label: "Mobile (iOS / Android)", order: 4 },
                ],
            },
            {
                id: "gq3",
                order: 3,
                type: "single_choice",
                title: "What is your favourite game genre?",
                isRequired: true,
                options: [
                    { id: "gq3-o1", label: "Action / Adventure", order: 0 },
                    { id: "gq3-o2", label: "RPG (Role-Playing Game)", order: 1 },
                    { id: "gq3-o3", label: "FPS / Shooter", order: 2 },
                    { id: "gq3-o4", label: "Strategy / Simulation", order: 3 },
                    { id: "gq3-o5", label: "Sports / Racing", order: 4 },
                ],
            },
            {
                id: "gq4",
                order: 4,
                type: "single_choice",
                title: "Do you prefer playing solo or with others online?",
                isRequired: true,
                options: [
                    { id: "gq4-o1", label: "Always solo", order: 0 },
                    { id: "gq4-o2", label: "Mostly solo, sometimes online", order: 1 },
                    { id: "gq4-o3", label: "Mix of both equally", order: 2 },
                    { id: "gq4-o4", label: "Mostly online, sometimes solo", order: 3 },
                    { id: "gq4-o5", label: "Always online multiplayer", order: 4 },
                ],
            },
            {
                id: "gq5",
                order: 5,
                type: "single_choice",
                title: "How satisfied are you with the current state of the gaming industry?",
                isRequired: true,
                options: [
                    { id: "gq5-o1", label: "Very satisfied", order: 0 },
                    { id: "gq5-o2", label: "Somewhat satisfied", order: 1 },
                    { id: "gq5-o3", label: "Neutral", order: 2 },
                    { id: "gq5-o4", label: "Somewhat dissatisfied", order: 3 },
                    { id: "gq5-o5", label: "Very dissatisfied", order: 4 },
                ],
            },
        ],
    };
};

const mapFeedItemToCreatedSurvey = (item: RegisteredSurveyFeedItem): CreatedSurveyCardData => ({
    id: item.registry.electionId,
    title: item.detail.title,
    category: item.detail.categories[0]?.label ?? "General",
    status: item.detail.status,
    rewardPerVoter: item.detail.budget?.rewardPerVoter?.amount ?? 0,
    endsAt: item.detail.timeInfo?.closesAt ? formatShortDate(item.detail.timeInfo.closesAt) : null,
    responsesCurrent: item.detail.progress?.responseCount ?? 0,
    responsesTarget: item.detail.progress?.targetResponses ?? 0,
    spent: 0,
});

const mapFeedItemToParticipatedSurvey = (item: RegisteredSurveyFeedItem): ParticipatedSurveySummary => ({
    id: item.registry.electionId,
    title: item.detail.title,
    category: item.detail.categories[0]?.label ?? "General",
    votedAt: item.detail.timeInfo?.opensAt ?? new Date(item.registry.createdAt * 1000).toISOString(),
    rewardStatus: "not_applicable",
    reward: item.detail.budget?.rewardPerVoter,
});

export default function MySurveys() {
    const params = useLocalSearchParams<{ tab?: string | string[] }>();
    const { walletAddress, isLoading: isWalletLoading } = useDeviceWallet();

    const normalizeTab = (value?: string | string[]): "created" | "participated" => {
        const rawValue = Array.isArray(value) ? value[0] : value;
        return rawValue === "participated" ? "participated" : "created";
    };

    const [activeTab, setActiveTab] = useState<"created" | "participated">(
        normalizeTab(params.tab)
    );
    const [registryFeed, setRegistryFeed] = useState<RegisteredSurveyFeedItem[]>([]);
    const [publishedExplorerUrls, setPublishedExplorerUrls] = useState<Record<string, string>>({});

    // Хранится ТОЛЬКО electionId — никаких данных о survey
    const [latestElectionId, setLatestElectionId] = useState<string | null>(null);

    const [isQuickPublishing, setIsQuickPublishing] = useState(false);
    const [isStartingVotingFlow, setIsStartingVotingFlow] = useState(false);

    useEffect(() => {
        setActiveTab(normalizeTab(params.tab));
    }, [params.tab]);

    const reloadRegistryFeed = useCallback(async () => {
        try {
            setIsRegistryLoading(true);
            const nextFeed = await loadRegisteredSurveyFeed({
                excludeClosed: false,
                excludeVoted: false,
            });
            setRegistryFeed(nextFeed);
        } catch (error) {
            console.error("[my-surveys] registry:load:error", error);
        } finally {
            setIsRegistryLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isWalletLoading || !walletAddress) {
            return;
        }

        reloadRegistryFeed();
    }, [isWalletLoading, reloadRegistryFeed, walletAddress]);

    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true);
        await reloadRegistryFeed();
        setIsRefreshing(false);
    }, [reloadRegistryFeed]);

    const createdSurveys = useMemo(() => {
        if (!walletAddress) {
            return [];
        }

        const normalizedWalletAddress = walletAddress.toLowerCase();

        return registryFeed
            .filter((item) => item.registry.creator.toLowerCase() === normalizedWalletAddress)
            .map(mapFeedItemToCreatedSurvey);
    }, [registryFeed, walletAddress]);

    const participatedSurveys = useMemo(() => {
        if (!walletAddress) {
            return [];
        }

        return registryFeed
            .filter(
                (item) =>
                    item.detail.hasVoted === true
            )
            .map(mapFeedItemToParticipatedSurvey);
    }, [registryFeed, walletAddress]);

    const handleQuickPublishTest = async () => {
        if (isQuickPublishing) return;

        const draft = buildQuickVocdoniTestDraft();

        try {
            setIsQuickPublishing(true);

            const publishedElection = await publishSurveyDraft(draft);
            let registryTxHash: string | null = null;

            try {
                const registryRegistration = await registerSurveyInRegistry({
                    electionId: publishedElection.electionId,
                    category: draft.category || "General",
                });
                registryTxHash = registryRegistration.txHash;
                setPublishedRegistryTxHashes((current) => ({
                    ...current,
                    [publishedElection.electionId]: registryRegistration.txHash,
                }));
            } catch (registryError) {
                console.error("[my-surveys] registry:register:error", registryError);
            }

            setPublishedExplorerUrls((current) => ({
                ...current,
                [publishedElection.electionId]: publishedElection.explorerUrl,
            }));

            // Сохраняем только ID — данные будут получены с Vocdoni при запуске флоу
            setLatestElectionId(publishedElection.electionId);

            setCreatedSurveys((current) => [
                {
                    id: publishedElection.electionId,
                    title: draft.name,
                    category: draft.category || "Gaming",
                    status: "active",
                    rewardPerVoter: draft.rewardPerVoter ?? 0,
                    endsAt: draft.endDate ? formatShortDate(draft.endDate) : null,
                    responsesCurrent: 0,
                    responsesTarget: draft.voterCap ?? publishedElection.censusSize,
                    spent: 0,
                },
                ...current,
            ]);

            Alert.alert(
                "Gaming survey created on Vocdoni",
                `Election ID: ${publishedElection.electionId}\n\nTap "Test voting with created survey" to fetch the survey from Vocdoni and go through the full voting flow.`
            );
        } catch (error) {
            Alert.alert(
                "Vocdoni publish failed",
                error instanceof Error ? error.message : "Unable to create the test survey on Vocdoni."
            );
        } finally {
            setIsQuickPublishing(false);
        }
    };

    /**
     * Получает данные election с Vocdoni по сохранённому electionId,
     * затем запускает полный UI флоу голосования.
     * Никакие локальные данные о структуре survey не используются.
     */
    const handleStartVotingFlow = async () => {
        if (isStartingVotingFlow) return;

        if (!latestElectionId) {
            Alert.alert(
                "No published survey yet",
                "First create a survey via \"Create Test Survey on Vocdoni\", then tap this button."
            );
            return;
        }

        setIsStartingVotingFlow(true);
        console.log('[mySurveys] votingFlow:start', { electionId: latestElectionId });

        try {
            console.log('[mySurveys] votingFlow:fetchingFromVocdoni', { electionId: latestElectionId });

            // Единственный источник данных — Vocdoni
            const surveyDetail = await fetchElectionAsSurveyDetail(latestElectionId);

            console.log('[mySurveys] votingFlow:fetchedOk', {
                electionId: latestElectionId,
                title: surveyDetail.title,
                questionCount: surveyDetail.questions?.length ?? 0,
            });

            router.push({
                pathname: `/voting/${latestElectionId}` as any,
                params: {
                    electionId: latestElectionId,
                    // Передаём данные, полученные с Vocdoni, как JSON-строку в параметре маршрута
                    surveyJson: JSON.stringify(surveyDetail),
                },
            });
        } catch (error) {
            console.error('[mySurveys] votingFlow:fetchError', {
                electionId: latestElectionId,
                error: error instanceof Error ? error.message : error,
            });
            Alert.alert(
                "Failed to load survey from Vocdoni",
                error instanceof Error
                    ? error.message
                    : "Unable to fetch the election data. Please try again."
            );
        } finally {
            setIsStartingVotingFlow(false);
        }
    };

    const handleManageSurvey = (id: string) => {
        const explorerUrl = publishedExplorerUrls[id];
        if (explorerUrl) {
            Alert.alert(
                "Vocdoni test survey",
                `Election ${id}\n\nExplorer: ${explorerUrl}`
            );
            return;
        }

        router.push(`/survey/manage/${id}`);
    };

    return (
        <View style={styles.container}>
            <View style={styles.tabWrapper}>
                <View style={styles.tabRow}>
                    <TouchableOpacity
                        style={styles.tab}
                        onPress={() => setActiveTab("created")}
                    >
                        <Text
                            style={[
                                styles.tabText,
                                activeTab === "created" && styles.activeText,
                            ]}
                        >
                            Created
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.tab}
                        onPress={() => setActiveTab("participated")}
                    >
                        <Text
                            style={[
                                styles.tabText,
                                activeTab === "participated" && styles.activeText,
                            ]}
                        >
                            Participated
                        </Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.divider} />

                <View
                    style={[
                        styles.indicator,
                        {
                            left: activeTab === "created" ? 0 : width / 2,
                        },
                    ]}
                />
            </View>

            <View style={styles.content}>
                {activeTab === "created" ? (
                    <CreatedSurveys
                        surveys={createdSurveys}
                        onCreateNew={() => { router.push("/create-survey"); }}
                        onQuickPublishTest={handleQuickPublishTest}
                        isQuickPublishing={isQuickPublishing}
                        onStartVotingFlow={handleStartVotingFlow}
                        canStartVotingFlow={Boolean(latestElectionId)}
                        isStartingVotingFlow={isStartingVotingFlow}
                        onManage={handleManageSurvey}
                        onEdit={() => { }}
                        onResults={(id) => { router.push(`/survey/results/${id}`); }}
                    />
                ) : (
                    <ParticipatedSurveys
                        surveys={participatedSurveys}
                        isRefreshing={isRefreshing}
                        onRefresh={handleRefresh}
                    />
                )}
            </View>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: palette.white,
    },
    tabWrapper: {
        position: "relative",
    },
    tabRow: {
        flexDirection: "row",
    },
    tab: {
        flex: 1,
        alignItems: "center",
        paddingVertical: 16,
    },
    tabText: {
        fontSize: 16,
        color: palette.textMuted,
        fontWeight: "500",
    },
    activeText: {
        color: palette.primary,
    },
    divider: {
        height: 1,
        backgroundColor: palette.border,
    },
    indicator: {
        position: "absolute",
        bottom: 0,
        height: 3,
        width: width / 2,
        backgroundColor: palette.primary,
    },
    content: {
        flex: 1,
    },
});
