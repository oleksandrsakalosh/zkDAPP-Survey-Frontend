import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import CompletedSurveyCard from "@/components/completedSurveyCard";
import SurveyCard from "@/components/surveyCard";
import type { ParticipatedSurveySummary, SurveyCardData, SurveySummary } from "@/domain/models";
import { useEligibilityProfile } from "@/app/hooks/useEligibilityProfile";
import { palette } from "@/theme/palette";
import { checkEligibility } from "@/utils/checkEligibility";
import { RegisteredSurveyFeedItem, loadRegisteredSurveyFeed } from "@/utils/registry/feed";
import { useDeviceWallet } from "@/utils/vocdoni/WalletProvider";

function formatShortDate(dateIso?: string | null) {
    if (!dateIso) {
        return "-";
    }

    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
    }).format(new Date(dateIso));
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

function EmptySection({ text }: { text: string }) {
    return (
        <View style={styles.emptySection}>
            <Text style={styles.emptySectionText}>{text}</Text>
        </View>
    );
}

const mapFeedItemToParticipated = (item: RegisteredSurveyFeedItem): ParticipatedSurveySummary => ({
    id: item.registry.electionId,
    title: item.detail.title,
    category: item.detail.categories[0]?.label ?? "General",
    votedAt:
        item.detail.timeInfo?.opensAt ??
        new Date(item.registry.createdAt * 1000).toISOString(),
});

export default function Home() {
    const router = useRouter();
    const { walletAddress, isLoading: isWalletLoading } = useDeviceWallet();
    const { profile } = useEligibilityProfile();

    const [feedItems, setFeedItems] = useState<RegisteredSurveyFeedItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const loadDashboard = useCallback(async (mode: "initial" | "refresh" = "initial") => {
        try {
            if (mode === "initial") {
                setIsLoading(true);
            } else {
                setIsRefreshing(true);
            }

            const nextFeed = await loadRegisteredSurveyFeed({
                excludeClosed: false,
                excludeVoted: false,
            });
            setFeedItems(nextFeed);
        } catch (error) {
            console.error("[home] dashboard:load:error", error);
            setFeedItems([]);
        } finally {
            if (mode === "initial") {
                setIsLoading(false);
            } else {
                setIsRefreshing(false);
            }
        }
    }, []);

    useEffect(() => {
        if (isWalletLoading || !walletAddress) {
            return;
        }

        loadDashboard();
    }, [isWalletLoading, loadDashboard, walletAddress]);

    const myCreatedItems = useMemo(
        () =>
            walletAddress
                ? feedItems.filter(
                    (item) => item.registry.creator.toLowerCase() === walletAddress.toLowerCase()
                )
                : [],
        [feedItems, walletAddress]
    );

    const votedItems = useMemo(
        () => feedItems.filter((item) => item.detail.hasVoted === true).slice(0, 3),
        [feedItems]
    );

    const availableForYou = useMemo<SurveyCardData[]>(
        () =>
            walletAddress
                ? feedItems
                    .filter(
                        (item) =>
                            item.registry.creator.toLowerCase() !== walletAddress.toLowerCase() &&
                            item.detail.timeInfo?.isOpen !== false &&
                            item.detail.hasVoted !== true
                    )
                    .map((item) => ({
                        ...item.card,
                        eligibility: checkEligibility(item.card.requirements ?? [], profile),
                    }))
                    .filter((survey) => survey.eligibility?.decision === "qualify")
                    .slice(0, 1)
                : [],
        [feedItems, profile, walletAddress]
    );

    const activeSurvey = useMemo<SurveySummary | undefined>(
        () => myCreatedItems[0]?.detail,
        [myCreatedItems]
    );

    const recentlyParticipated = useMemo<ParticipatedSurveySummary[]>(
        () => votedItems.map(mapFeedItemToParticipated),
        [votedItems]
    );

    const activeResponses = activeSurvey?.progress?.responseCount ?? 0;
    const activeTarget = activeSurvey?.progress?.targetResponses ?? 0;
    const activeCategory = activeSurvey?.categories?.[0]?.label ?? "General";
    const activeClosesAt =
        activeSurvey?.timeInfo?.closesAt
            ? formatShortDate(activeSurvey.timeInfo.closesAt)
            : activeSurvey?.timeInfo?.displayLabel ?? "-";
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
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={() => loadDashboard("refresh")}
                        tintColor={palette.primary}
                    />
                }
            >
                <View style={styles.greetingBlock}>
                    <Text style={styles.greeting}>
                        Hey, <Text style={styles.greetingAccent}>Tralalela</Text> {"\uD83D\uDC4B"}
                    </Text>
                    <Text style={styles.subGreeting}>Your survey dashboard</Text>
                </View>

                {isLoading ? (
                    <View style={styles.loadingCard}>
                        <ActivityIndicator color={palette.primary} />
                        <Text style={styles.loadingText}>Loading dashboard...</Text>
                    </View>
                ) : (
                    <>
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

                        {activeSurvey ? (
                            <View style={styles.activeCard}>
                                <Text style={styles.activeTitle}>{activeSurvey.title}</Text>
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
                                            {progressPercent}%
                                        </Text>
                                        <Text style={styles.metricLabel}>Progress</Text>
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
                                        router.push(`/survey/manage/${activeSurvey.id}` as any)
                                    }
                                >
                                    <Text style={styles.manageButtonText}>Manage Survey</Text>
                                </Pressable>
                            </View>
                        ) : (
                            <EmptySection text="No created surveys yet. Create one to see it here." />
                        )}

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

                        {recentlyParticipated.length > 0 ? (
                            recentlyParticipated.map((survey) => (
                                <CompletedSurveyCard
                                    key={survey.id}
                                    id={survey.id}
                                    title={survey.title}
                                    category={survey.category ?? "General"}
                                    date={formatShortDate(survey.votedAt)}
                                />
                            ))
                        ) : (
                            <EmptySection text="No recent votes yet. Surveys you vote on will appear here." />
                        )}

                        <SectionHeader
                            title="Available for You"
                            action="Browse all"
                            onPress={() => router.push("/(tabs)/explore")}
                        />

                        {availableForYou.length > 0 ? (
                            availableForYou.map((survey) => (
                                <SurveyCard
                                    key={survey.id}
                                    survey={survey}
                                    voteLabel="Details"
                                    onVote={(id) => router.push(`/voting/${id}` as any)}
                                />
                            ))
                        ) : (
                            <EmptySection text="No available surveys right now. Pull to refresh and check again." />
                        )}
                    </>
                )}
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
    loadingCard: {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.background,
        paddingVertical: 24,
        alignItems: "center",
        gap: 10,
    },
    loadingText: {
        color: palette.textSecondary,
        fontSize: 14,
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
    emptySection: {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.background,
        paddingHorizontal: 16,
        paddingVertical: 18,
        marginBottom: 16,
    },
    emptySectionText: {
        color: palette.textSecondary,
        fontSize: 14,
        textAlign: "center",
        lineHeight: 20,
    },
});
