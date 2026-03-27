import React, { useEffect, useState } from "react";
import { Alert, Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import CreatedSurveys from "@/app/survey/createdSurveys";
import ParticipatedSurveys from "@/app/survey/participatedSurveys";
import { CreatedSurveyCardData, ParticipatedSurveySummary, SurveyDraft } from "@/domain/models";
import { palette } from "@/theme/palette";
import { router, useLocalSearchParams } from "expo-router";
import { publishSurveyDraft } from "@/utils/vocdoni/publishSurvey";
import { voteSurvey } from "@/utils/vocdoni/voteSurvey";

const { width } = Dimensions.get("window");

const INITIAL_CREATED_SURVEYS: CreatedSurveyCardData[] = [
    {
        id: "c1",
        title: "Healthcare Access Study",
        category: "Medical",
        status: "active",
        rewardPerVoter: 2,
        endsAt: "Mar 10",
        responsesCurrent: 500,
        responsesTarget: 250,
        spent: 364,
    },
    {
        id: "c2",
        title: "AI Product Attitudes",
        category: "Technology",
        status: "active",
        rewardPerVoter: 1.5,
        endsAt: "Mar 8",
        responsesCurrent: 96,
        responsesTarget: 150,
        spent: 144,
    },
    {
        id: "c3",
        title: "Sustainable Shopping Habits",
        category: "Environment",
        status: "draft",
        rewardPerVoter: 0.75,
        responsesCurrent: 0,
        responsesTarget: 200,
        budget: 150,
    },
    {
        id: "c4",
        title: "Remote Work Satisfaction",
        category: "Workplace",
        status: "results",
        rewardPerVoter: 1.25,
        endsAt: "Feb 1",
        responsesCurrent: 468,
        responsesTarget: 300,
        spent: 375,
        totalSpent: 375,
    },
    {
        id: "c5",
        title: "Remote Work Satisfaction",
        category: "Workplace",
        status: "results",
        rewardPerVoter: 1.25,
        endsAt: "Feb 1",
        responsesCurrent: 300,
        responsesTarget: 300,
        spent: 375,
        totalSpent: 375,
    },
];

const INITIAL_PARTICIPATED_SURVEYS: ParticipatedSurveySummary[] = [
    { id: "1", title: "Healthcare Access Study", category: "Medical", votedAt: "Mar 10", rewardStatus: "paid", reward: { amount: 2.0, currency: "USD" } },
    { id: "2", title: "AI Product Attitudes", category: "Technology", votedAt: "Mar 8", rewardStatus: "paid", reward: { amount: 1.5, currency: "USD" } },
    { id: "3", title: "Eco-Conscious Buying", category: "Environment", votedAt: "Mar 6", rewardStatus: "unpaid", reward: { amount: 0, currency: "USD" } },
    { id: "4", title: "Public Transit Feedback", category: "Civic", votedAt: "Mar 4", rewardStatus: "paid", reward: { amount: 0.8, currency: "USD" } },
    { id: "5", title: "Crypto Wallet UX", category: "Technology", votedAt: "Mar 2", rewardStatus: "paid", reward: { amount: 1.2, currency: "USD" } },
    { id: "6", title: "Healthy Eating Habits", category: "Lifestyle", votedAt: "Feb 28", rewardStatus: "unpaid", reward: { amount: 0, currency: "USD" } },
];

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
        rewardPerVoter: 0,
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

export default function MySurveys() {
    const params = useLocalSearchParams<{ tab?: string | string[] }>();

    const normalizeTab = (value?: string | string[]): "created" | "participated" => {
        const rawValue = Array.isArray(value) ? value[0] : value;
        return rawValue === "participated" ? "participated" : "created";
    };

    const [activeTab, setActiveTab] = useState<"created" | "participated">(
        normalizeTab(params.tab)
    );
    const [createdSurveys, setCreatedSurveys] = useState<CreatedSurveyCardData[]>(INITIAL_CREATED_SURVEYS);
    const [participatedSurveys, setParticipatedSurveys] = useState<ParticipatedSurveySummary[]>(INITIAL_PARTICIPATED_SURVEYS);
    const [publishedExplorerUrls, setPublishedExplorerUrls] = useState<Record<string, string>>({});
    const [submittedVoteIds, setSubmittedVoteIds] = useState<Record<string, string>>({});
    const [latestPublishedTestSurveyId, setLatestPublishedTestSurveyId] = useState<string | null>(null);
    const [isQuickPublishing, setIsQuickPublishing] = useState(false);
    const [isQuickVoting, setIsQuickVoting] = useState(false);

    useEffect(() => {
        setActiveTab(normalizeTab(params.tab));
    }, [params.tab]);

    const handleQuickPublishTest = async () => {
        if (isQuickPublishing) return;

        const draft = buildQuickVocdoniTestDraft();

        try {
            setIsQuickPublishing(true);

            const publishedElection = await publishSurveyDraft(draft);

            setPublishedExplorerUrls((current) => ({
                ...current,
                [publishedElection.electionId]: publishedElection.explorerUrl,
            }));
            setLatestPublishedTestSurveyId(publishedElection.electionId);

            setCreatedSurveys((current) => [
                {
                    id: publishedElection.electionId,
                    title: draft.name,
                    category: draft.category || "Vocdoni DEV",
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
                "Vocdoni test survey created",
                publishedElection.rotatedWallet
                    ? `Election ${publishedElection.electionId} was created on Vocdoni DEV and added to your list.\n\nThe app switched to a fresh test wallet because the previous DEV faucet wallet was rate-limited. New wallet: ${publishedElection.walletAddress}`
                    : `Election ${publishedElection.electionId} was created on Vocdoni DEV and added to your list.`
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
                "The latest test survey is no longer in the local list. Create a new test survey and try again."
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

            if (!submittedVote.alreadyVoted) {
                setCreatedSurveys((current) =>
                    current.map((survey) =>
                        survey.id === latestPublishedTestSurveyId
                            ? {
                                ...survey,
                                responsesCurrent: (survey.responsesCurrent ?? 0) + 1,
                            }
                            : survey
                    )
                );

                setParticipatedSurveys((current) => {
                    if (current.some((survey) => survey.id === latestPublishedTestSurveyId)) {
                        return current;
                    }

                    return [
                        {
                            id: latestPublishedTestSurveyId,
                            title: targetSurvey.title,
                            category: targetSurvey.category,
                            votedAt: formatShortDate(new Date().toISOString()),
                            rewardStatus: "not_applicable",
                        },
                        ...current,
                    ];
                });
            }

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
        const voteId = submittedVoteIds[id];
        if (explorerUrl) {
            Alert.alert(
                "Vocdoni test survey",
                voteId
                    ? `Election ${id}\n\nExplorer: ${explorerUrl}\n\nLatest vote: ${voteId}`
                    : `Election ${id}\n\nExplorer: ${explorerUrl}`
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
                        onCreateNew={() => {router.push("/create-survey")}}
                        onQuickPublishTest={handleQuickPublishTest}
                        isQuickPublishing={isQuickPublishing}
                        onQuickVoteTest={handleQuickVoteTest}
                        canQuickVoteTest={Boolean(latestPublishedTestSurveyId)}
                        isQuickVoting={isQuickVoting}
                        onManage={handleManageSurvey}
                        onEdit={() => {}}
                        onResults={(id) => { router.push(`/survey/results/${id}`) }}
                    />
                ) : (
                    <ParticipatedSurveys surveys={participatedSurveys} />
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
