import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import React from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import CompletedSurveyCard from "@/components/completedSurveyCard";
import SurveyCard, { type SurveyCardData } from "@/components/surveyCard";
import type { HomeDashboardData } from "@/domain/models";
import { palette } from "@/theme/palette";

const HOME_DASHBOARD: HomeDashboardData = {
    activeSurvey: {
        id: "active-1",
        title: "Consumer Spending Habits Q1 2025",
        description: "Q1 consumer trends",
        status: "live",
        categories: [{ id: "cat-finance", label: "Finance" }],
        progress: {
            responseCount: 247,
            targetResponses: 500,
        },
        budget: {
            rewardPerVoter: {
                amount: 1,
                currency: "USD",
            },
        },
        timeInfo: {
            displayLabel: "Mar 15, 2025",
        },
    },
    recentlyParticipated: [
        {
            surveyId: "cp-1",
            title: "Healthcare Access Study",
            categoryLabel: "Medical",
            votedAt: "Mar 10",
            rewardStatus: "paid",
            reward: { amount: 2, currency: "USD" },
        },
        {
            surveyId: "cp-2",
            title: "Healthcare Access Study",
            categoryLabel: "Medical",
            votedAt: "Mar 10",
            rewardStatus: "paid",
            reward: { amount: 2, currency: "USD" },
        },
        {
            surveyId: "cp-3",
            title: "Healthcare Access Study",
            categoryLabel: "Medical",
            votedAt: "Mar 10",
            rewardStatus: "paid",
            reward: { amount: 2, currency: "USD" },
        },
    ],
    availableForYou: [
        {
            id: "available-1",
            title: "Prescription Drug Affordability",
            description:
                "Share your experience with prescription costs and insurance coverage. Anonymous & secure.",
            status: "live",
            categories: [
                { id: "cat-health", label: "Health" },
                { id: "cat-finance", label: "Finance" },
            ],
            progress: {
                responseCount: 203,
                targetResponses: 400,
            },
            budget: {
                rewardPerVoter: { amount: 3.5, currency: "USD" },
            },
            estimatedMinutes: 8,
            eligibility: {
                decision: "qualify",
                matchedRequirements: [],
                failedRequirements: [],
            },
            listVariant: "available",
        },
    ],
};

function formatDollars(value: number) {
    return `$${value.toFixed(2)}`;
}

function SectionHeader({
    title,
    action,
    onPress,
}: {
    title: string;
    action: string;
    onPress: () => void;
}) {
    return (
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <Pressable style={styles.linkButton} onPress={onPress}>
                <Text style={styles.linkText}>{action}</Text>
                <MaterialIcons name="arrow-forward" size={16} color={palette.primary} />
            </Pressable>
        </View>
    );
}

export default function Home() {
    const router = useRouter();
    const activeSurvey = HOME_DASHBOARD.activeSurvey;
    const activeResponses = activeSurvey?.progress?.responseCount ?? 0;
    const activeTarget = activeSurvey?.progress?.targetResponses ?? 0;
    const activeRewardPerVoter = activeSurvey?.budget?.rewardPerVoter?.amount ?? 0;
    const activeCategory = activeSurvey?.categories?.[0]?.label ?? "General";
    const activeClosesAt = activeSurvey?.timeInfo?.displayLabel ?? "-";
    const recentlyParticipated = HOME_DASHBOARD.recentlyParticipated ?? [];
    const availableForYou: SurveyCardData[] = (HOME_DASHBOARD.availableForYou ?? []).map(
        (survey) => ({
            id: survey.id,
            name: survey.title,
            reward: survey.budget?.rewardPerVoter?.amount ?? 0,
            description: survey.shortDescription ?? survey.description,
            tags: survey.categories.map((item) => item.label),
            minutes: survey.estimatedMinutes ?? 0,
            participants: survey.progress?.responseCount ?? 0,
            participantsLimit: survey.progress?.targetResponses ?? 0,
            qualifies: survey.eligibility?.decision !== "not_qualified",
        })
    );
    const progressPercent = Math.min(
        100,
        Math.max(0, Math.round((activeResponses / Math.max(activeTarget, 1)) * 100))
    );

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView
                style={styles.screen}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.greetingBlock}>
                    <Text style={styles.greeting}>
                        Hey, <Text style={styles.greetingAccent}>Tralalela</Text> {"\uD83D\uDC4B"}
                    </Text>
                    <Text style={styles.subGreeting}>Your survey dashboard</Text>
                </View>

                <SectionHeader
                    title="My Active Survey"
                    action="View all"
                    onPress={() =>
                        router.push({
                            pathname: "/(tabs)/mySurveys",
                            params: { tab: "created" },
                        })
                    }
                />

                <View style={styles.activeCard}>
                    <Text style={styles.activeTitle}>{activeSurvey?.title ?? "-"}</Text>
                    <Text style={styles.activeSubtitle}>
                        {activeCategory} - Closes {activeClosesAt}
                    </Text>

                    <View style={styles.metricsRow}>
                        <View style={styles.metricItem}>
                            <Text style={styles.metricValue}>{activeResponses}</Text>
                            <Text style={styles.metricLabel}>Responses</Text>
                        </View>
                        <View style={styles.metricItem}>
                            <Text style={styles.metricValue}>{activeTarget}</Text>
                            <Text style={styles.metricLabel}>Target</Text>
                        </View>
                        <View style={styles.metricItem}>
                            <Text style={styles.metricValue}>
                                {formatDollars(activeRewardPerVoter)}
                            </Text>
                            <Text style={styles.metricLabel}>Per Voter</Text>
                        </View>
                    </View>

                    <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
                    </View>

                    <Text style={styles.progressLabelInline}>
                        {progressPercent}% of voter cap reached
                    </Text>

                    <Pressable
                        style={styles.manageButton}
                        onPress={() =>
                            router.push({
                                pathname: "/(tabs)/mySurveys",
                                params: { tab: "created" },
                            })
                        }
                    >
                        <Text style={styles.manageButtonText}>Manage Survey</Text>
                    </Pressable>
                </View>

                <SectionHeader
                    title="Recently Participated"
                    action="See all"
                    onPress={() =>
                        router.push({
                            pathname: "/(tabs)/mySurveys",
                            params: { tab: "participated" },
                        })
                    }
                />

                {recentlyParticipated.map((survey) => (
                    <CompletedSurveyCard
                        key={survey.surveyId}
                        id={survey.surveyId}
                        title={survey.title}
                        category={survey.categoryLabel ?? "General"}
                        date={survey.votedAt}
                        reward={survey.reward?.amount}
                    />
                ))}

                <SectionHeader
                    title="Available for You"
                    action="Browse all"
                    onPress={() => router.push("/(tabs)/explore")}
                />

                {availableForYou.map((survey) => (
                    <SurveyCard key={survey.id} survey={survey} voteLabel="Vote" />
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: palette.white,
    },
    screen: {
        flex: 1,
        backgroundColor: palette.white,
    },
    content: {
        paddingHorizontal: 14,
        paddingTop: 10,
        paddingBottom: 20,
    },
    greetingBlock: {
        marginBottom: 18,
    },
    greeting: {
        fontSize: 42 / 2,
        fontWeight: "700",
        color: palette.primaryDark,
        lineHeight: 28,
    },
    greetingAccent: {
        color: palette.primary,
    },
    subGreeting: {
        marginTop: 2,
        fontSize: 22 / 2,
        color: palette.textSecondary,
    },
    sectionHeader: {
        marginBottom: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    sectionTitle: {
        fontSize: 30 / 2,
        fontWeight: "700",
        color: palette.primaryDark,
    },
    linkButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 2,
    },
    linkText: {
        color: palette.primary,
        fontSize: 13,
        fontWeight: "600",
    },
    activeCard: {
        backgroundColor: palette.primary,
        borderRadius: 16,
        padding: 14,
        marginBottom: 16,
    },
    activeTitle: {
        color: palette.white,
        fontSize: 15,
        fontWeight: "600",
    },
    activeSubtitle: {
        color: palette.white75,
        fontSize: 12,
        marginTop: 2,
    },
    metricsRow: {
        flexDirection: "row",
        gap: 20,
        marginTop: 12,
    },
    metricItem: {
        gap: 2,
    },
    metricValue: {
        color: palette.white,
        fontSize: 28 / 2,
        fontWeight: "800",
    },
    metricLabel: {
        color: palette.white50,
        fontSize: 10,
    },
    progressTrack: {
        marginTop: 10,
        height: 4,
        borderRadius: 999,
        backgroundColor: palette.white25,
        overflow: "hidden",
    },
    progressFill: {
        height: "100%",
        backgroundColor: palette.white,
    },
    progressLabelInline: {
        marginTop: 6,
        color: palette.white75,
        fontSize: 10,
    },
    manageButton: {
        marginTop: 12,
        alignSelf: "flex-start",
        backgroundColor: palette.white,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    manageButtonText: {
        fontSize: 12,
        fontWeight: "700",
        color: palette.primary,
    },
});
