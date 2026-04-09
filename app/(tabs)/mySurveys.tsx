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
import { voteSurvey } from "@/utils/vocdoni/voteSurvey";

const { width } = Dimensions.get("window");

const formatShortDate = (dateIso: string) =>
    new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
    }).format(new Date(dateIso));

const buildQuickVocdoniTestDraft = (): SurveyDraft => {
    const now = new Date();
    const endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const surveySuffix = now.toISOString().slice(11, 19).replace(/:/g, "-");

    return {
        name: `Vocdoni Test Survey ${surveySuffix}`,
        description: "Quick integration test survey created directly from the My Surveys screen.",
        startDate: now.toISOString(),
        endDate: endDate.toISOString(),
        tags: ["vocdoni", "test"],
        category: "Vocdoni DEV",
        rewardPerVoter: 1,
        voterCap: 5,
        requirements: [],
        questions: [
            {
                id: "vocdoni-test-question-1",
                order: 1,
                type: "single_choice",
                title: "Did this Vocdoni test survey publish successfully?",
                isRequired: true,
                options: [
                    { id: "yes", label: "Yes", order: 0 },
                    { id: "no", label: "No", order: 1 },
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
    const [publishedRegistryTxHashes, setPublishedRegistryTxHashes] = useState<Record<string, string>>({});
    const [submittedVoteIds, setSubmittedVoteIds] = useState<Record<string, string>>({});
    const [latestPublishedTestSurveyId, setLatestPublishedTestSurveyId] = useState<string | null>(null);
    const [isRegistryLoading, setIsRegistryLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isQuickPublishing, setIsQuickPublishing] = useState(false);
    const [isQuickVoting, setIsQuickVoting] = useState(false);

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
            setLatestPublishedTestSurveyId(publishedElection.electionId);
            await reloadRegistryFeed();

            Alert.alert(
                registryTxHash ? "Vocdoni test survey created" : "Vocdoni survey created, registry failed",
                registryTxHash
                    ? publishedElection.rotatedWallet
                        ? `Election ${publishedElection.electionId} was created on Vocdoni DEV, registered on-chain, and added to your list.\n\nRegistry tx: ${registryTxHash}\n\nThe app switched to a fresh test wallet because the previous DEV faucet wallet was rate-limited. New wallet: ${publishedElection.walletAddress}`
                        : `Election ${publishedElection.electionId} was created on Vocdoni DEV, registered on-chain, and added to your list.\n\nRegistry tx: ${registryTxHash}`
                    : `Election ${publishedElection.electionId} was created on Vocdoni DEV, but registry submission failed. The survey will not appear in the public feed until it is registered on-chain.`
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

    const handleQuickVoteTest = async () => {
        if (isQuickVoting) return;

        if (!latestPublishedTestSurveyId) {
            Alert.alert(
                "No test survey yet",
                "Create a Vocdoni test survey first, then use the vote button."
            );
            return;
        }

        const targetSurvey = createdSurveys.find((survey) => survey.id === latestPublishedTestSurveyId);
        if (!targetSurvey) {
            Alert.alert(
                "Survey not found",
                "The latest test survey is no longer in your created registry list. Create a new test survey and try again."
            );
            return;
        }

        try {
            setIsQuickVoting(true);

            const submittedVote = await voteSurvey(latestPublishedTestSurveyId, [0]);

            setSubmittedVoteIds((current) => ({
                ...current,
                [latestPublishedTestSurveyId]: submittedVote.voteId,
            }));

            await reloadRegistryFeed();

            Alert.alert(
                submittedVote.alreadyVoted ? "Vote already recorded" : "Test vote submitted",
                submittedVote.alreadyVoted
                    ? `This device wallet already voted on election ${latestPublishedTestSurveyId}.\n\nVote ID: ${submittedVote.voteId}`
                    : `Vote ID: ${submittedVote.voteId}\n\nElection: ${latestPublishedTestSurveyId}`
            );
        } catch (error) {
            Alert.alert(
                "Vote failed",
                error instanceof Error ? error.message : "Unable to submit the test vote to Vocdoni."
            );
        } finally {
            setIsQuickVoting(false);
        }
    };

    const handleManageSurvey = (id: string) => {
        const explorerUrl = publishedExplorerUrls[id];
        const registryTxHash = publishedRegistryTxHashes[id];
        const voteId = submittedVoteIds[id];
        if (explorerUrl) {
            Alert.alert(
                "Vocdoni test survey",
                voteId
                    ? `Election ${id}\n\nExplorer: ${explorerUrl}${registryTxHash ? `\n\nRegistry tx: ${registryTxHash}` : ""}\n\nLatest vote: ${voteId}`
                    : `Election ${id}\n\nExplorer: ${explorerUrl}${registryTxHash ? `\n\nRegistry tx: ${registryTxHash}` : ""}`
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
                        onQuickVoteTest={handleQuickVoteTest}
                        canQuickVoteTest={Boolean(latestPublishedTestSurveyId)}
                        isQuickVoting={isQuickVoting}
                        isRefreshing={isRefreshing}
                        onRefresh={handleRefresh}
                        onManage={handleManageSurvey}
                        onEdit={() => {}}
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
