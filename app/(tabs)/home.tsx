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
import {
    getMyCreatedElections,
    getMyRegisteredElections,
    getUnstartedContractElections,
} from "@/services/contractService";
import { useEligibilityProfile } from "@/app/hooks/useEligibilityProfile";
import { palette } from "@/theme/palette";
import { ChainElection, ContractElectionStatus } from "@/types/election";
import { checkEligibility } from "@/utils/checkEligibility";
import { loadOrFetchElectionMetadataMap, StoredElectionMetadata } from "@/utils/electionMetadataStore";
import { createVocdoniClient } from "@/utils/vocdoni/sdk";
import { getOrCreateDeviceWallet } from "@/utils/vocdoni/wallet";
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

const sortByCreatedDesc = (a: ChainElection, b: ChainElection) => b.createdAt - a.createdAt;

const sortByStartedOrCreatedDesc = (a: ChainElection, b: ChainElection) =>
    (b.startedAt || b.createdAt) - (a.startedAt || a.createdAt);

const isChainElectionExpired = (election: ChainElection) => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    return election.endDate > 0 && election.endDate <= nowSeconds;
};

const isReadyToStart = (election: ChainElection) => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const maxReached = election.maxVoters > 0 && election.registeredVoters >= election.maxVoters;
    const startReached = election.startDate === 0 || nowSeconds >= election.startDate;
    return maxReached || startReached;
};

const mapChainElectionToSurveySummary = (
    election: ChainElection,
    stored?: StoredElectionMetadata
): SurveySummary => {
    const metadata = stored?.metadata;
    const eligibility = stored?.eligibility;
    const category = metadata?.category || "On-chain";
    const startDateIso =
        metadata?.startDate ??
        (election.startDate > 0 ? new Date(election.startDate * 1000).toISOString() : undefined);
    const endDateIso =
        metadata?.endDate ??
        (election.endDate > 0 ? new Date(election.endDate * 1000).toISOString() : undefined);
    const isStarted = election.status === ContractElectionStatus.Started;

    return {
        id: isStarted ? election.vocdoniElectionId || `chain-${election.id}` : `chain-${election.id}`,
        title: metadata?.title || `On-chain survey #${election.id}`,
        description:
            metadata?.description ||
            (isStarted
                ? `Started on Vocdoni as ${election.vocdoniElectionId || "pending id"}.`
                : "Registered on the smart contract and waiting for Vocdoni start."),
        status: isStarted ? "active" : "draft",
        categories: [
            {
                id: category.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "on-chain",
                label: category,
            },
        ],
        tags: metadata?.tags.map((tag) => ({
            id: tag.toLowerCase().replace(/[^a-z0-9]+/g, "-") || tag,
            label: tag,
        })),
        estimatedMinutes: Math.max(1, metadata?.questions.length || 1),
        progress: {
            responseCount: election.registeredVoters,
            targetResponses: election.maxVoters || election.registeredVoters,
        },
        eligibility: {
            decision: "verification_required",
            matchedRequirements: [],
            failedRequirements: [],
            checkedAt: new Date().toISOString(),
        },
        requirements: eligibility?.requirements ?? [],
        timeInfo: {
            opensAt: startDateIso,
            closesAt: endDateIso,
            isOpen: isStarted,
            displayLabel: startDateIso ? `Starts ${new Date(startDateIso).toLocaleString()}` : "Can start anytime",
        },
    };
};

const mapChainElectionToSurveyCard = (
    election: ChainElection,
    stored?: StoredElectionMetadata
): SurveyCardData => {
    const summary = mapChainElectionToSurveySummary(election, stored);
    const metadata = stored?.metadata;

    return {
        ...summary,
        id: `chain-${election.id}`,
        listVariant: "available",
        questions: metadata?.questions ?? [],
        primaryAction: "details",
        primaryActionLabel: "Register",
    };
};

const mapChainElectionToParticipated = (
    election: ChainElection,
    stored?: StoredElectionMetadata
): ParticipatedSurveySummary => ({
    id: election.vocdoniElectionId || `chain-${election.id}`,
    title: stored?.metadata.title || `On-chain survey #${election.id}`,
    category: stored?.metadata.category || "On-chain",
    votedAt:
        election.startedAt > 0
            ? new Date(election.startedAt * 1000).toISOString()
            : new Date().toISOString(),
});

export default function Home() {
    const router = useRouter();
    const { walletAddress, isLoading: isWalletLoading } = useDeviceWallet();
    const { profile } = useEligibilityProfile();

    const [createdElections, setCreatedElections] = useState<ChainElection[]>([]);
    const [startedCreatedElections, setStartedCreatedElections] = useState<ChainElection[]>([]);
    const [votedElections, setVotedElections] = useState<ChainElection[]>([]);
    const [availableElections, setAvailableElections] = useState<ChainElection[]>([]);
    const [metadataByElectionId, setMetadataByElectionId] = useState<Record<number, StoredElectionMetadata>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const loadDashboard = useCallback(async (mode: "initial" | "refresh" = "initial") => {
        try {
            if (mode === "initial") {
                setIsLoading(true);
            } else {
                setIsRefreshing(true);
            }

            const [nextCreated, nextRegistered, nextUnstarted] = await Promise.all([
                getMyCreatedElections(),
                getMyRegisteredElections(),
                getUnstartedContractElections(),
            ]);
            const wallet = await getOrCreateDeviceWallet();
            const vocdoniClient = await createVocdoniClient(wallet);

            const fetchableStartedCreated: ChainElection[] = [];
            for (const election of nextCreated) {
                if (election.status !== ContractElectionStatus.Started || !election.vocdoniElectionId) {
                    continue;
                }

                try {
                    vocdoniClient.setElectionId(election.vocdoniElectionId);
                    await vocdoniClient.fetchElection(election.vocdoniElectionId);
                    fetchableStartedCreated.push(election);
                } catch (error) {
                    console.warn("[home] created:vocdoni-check:miss", {
                        electionId: election.id,
                        vocdoniElectionId: election.vocdoniElectionId,
                        error: error instanceof Error ? error.message : error,
                    });
                }
            }

            const votedRegistered: ChainElection[] = [];
            for (const election of nextRegistered) {
                if (election.status !== ContractElectionStatus.Started || !election.vocdoniElectionId) {
                    continue;
                }

                try {
                    vocdoniClient.setElectionId(election.vocdoniElectionId);
                    await vocdoniClient.fetchElection(election.vocdoniElectionId);
                    const voteId = await vocdoniClient.hasAlreadyVoted();
                    if (voteId) {
                        votedRegistered.push(election);
                    }
                } catch (error) {
                    console.warn("[home] participated:vocdoni-check:miss", {
                        electionId: election.id,
                        vocdoniElectionId: election.vocdoniElectionId,
                        error: error instanceof Error ? error.message : error,
                    });
                }
            }

            const registeredIds = new Set(nextRegistered.map((election) => election.id));
            const available = nextUnstarted.filter(
                (election) =>
                    !isChainElectionExpired(election) &&
                    !registeredIds.has(election.id) &&
                    election.creator.toLowerCase() !== wallet.address.toLowerCase() &&
                    (election.maxVoters === 0 || election.registeredVoters < election.maxVoters)
            );
            const metadataMap = await loadOrFetchElectionMetadataMap([
                ...nextCreated,
                ...nextRegistered,
                ...available,
            ]);

            setCreatedElections(nextCreated);
            setStartedCreatedElections(fetchableStartedCreated);
            setVotedElections(votedRegistered);
            setAvailableElections(available);
            setMetadataByElectionId(metadataMap);
        } catch (error) {
            console.error("[home] dashboard:load:error", error);
            setCreatedElections([]);
            setStartedCreatedElections([]);
            setVotedElections([]);
            setAvailableElections([]);
            setMetadataByElectionId({});
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

    const activeElection = useMemo(
        () => [...startedCreatedElections].sort(sortByStartedOrCreatedDesc)[0],
        [startedCreatedElections]
    );

    const pendingStartElection = useMemo(
        () =>
            createdElections
                .filter(
                    (election) =>
                        !isChainElectionExpired(election) &&
                        election.status === ContractElectionStatus.Created
                )
                .sort(sortByCreatedDesc)[0],
        [createdElections]
    );

    const activeSurvey = useMemo<SurveySummary | undefined>(
        () =>
            activeElection
                ? mapChainElectionToSurveySummary(activeElection, metadataByElectionId[activeElection.id])
                : undefined,
        [activeElection, metadataByElectionId]
    );

    const pendingStartSurvey = useMemo<SurveySummary | undefined>(
        () =>
            pendingStartElection
                ? mapChainElectionToSurveySummary(
                    pendingStartElection,
                    metadataByElectionId[pendingStartElection.id]
                )
                : undefined,
        [metadataByElectionId, pendingStartElection]
    );

    const recentlyParticipated = useMemo<ParticipatedSurveySummary[]>(
        () =>
            [...votedElections]
                .sort(sortByStartedOrCreatedDesc)
                .slice(0, 1)
                .map((election) =>
                    mapChainElectionToParticipated(election, metadataByElectionId[election.id])
                ),
        [metadataByElectionId, votedElections]
    );

    const availableForYou = useMemo<SurveyCardData[]>(
        () =>
            availableElections
                .map((election) =>
                    mapChainElectionToSurveyCard(election, metadataByElectionId[election.id])
                )
                .map((survey) => ({
                    ...survey,
                    eligibility: checkEligibility(survey.requirements ?? [], profile),
                }))
                .filter((survey) => survey.eligibility?.decision === "qualify")
                .sort((a, b) => a.title.localeCompare(b.title))
                .slice(0, 1),
        [availableElections, metadataByElectionId, profile]
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
                            title="Pending Start Survey"
                            action="View pending"
                            onPress={() =>
                                router.push({
                                    pathname: "/(tabs)/mySurveys",
                                    params: { tab: "pending" },
                                })
                            }
                        />

                        {pendingStartSurvey && pendingStartElection ? (
                            <View style={styles.pendingCard}>
                                <View style={styles.pendingCardHeader}>
                                    <View style={styles.pendingTitleBlock}>
                                        <Text style={styles.pendingTitle}>{pendingStartSurvey.title}</Text>
                                        <Text style={styles.pendingSubtitle}>
                                            {pendingStartSurvey.categories[0]?.label ?? "General"}
                                        </Text>
                                    </View>
                                    <View style={styles.pendingBadge}>
                                        <Text style={styles.pendingBadgeText}>
                                            {isReadyToStart(pendingStartElection) ? "Ready" : "Pending"}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.metricsRowDark}>
                                    <View style={styles.metricItemDark}>
                                        <Text style={styles.metricValueDark}>
                                            {pendingStartElection.registeredVoters}
                                        </Text>
                                        <Text style={styles.metricLabelDark}>Registered</Text>
                                    </View>
                                    <View style={styles.metricItemDark}>
                                        <Text style={styles.metricValueDark}>
                                            {pendingStartElection.maxVoters || "Unlimited"}
                                        </Text>
                                        <Text style={styles.metricLabelDark}>Max voters</Text>
                                    </View>
                                    <View style={styles.metricItemDark}>
                                        <Text style={styles.metricValueDark}>
                                            {pendingStartSurvey.timeInfo?.opensAt
                                                ? formatShortDate(pendingStartSurvey.timeInfo.opensAt)
                                                : "Anytime"}
                                        </Text>
                                        <Text style={styles.metricLabelDark}>Start date</Text>
                                    </View>
                                </View>

                                <Pressable
                                    style={styles.pendingButton}
                                    onPress={() =>
                                        router.push({
                                            pathname: "/(tabs)/mySurveys",
                                            params: { tab: "pending" },
                                        })
                                    }
                                >
                                    <Text style={styles.pendingButtonText}>Open Pending Start</Text>
                                </Pressable>
                            </View>
                        ) : (
                            <EmptySection text="No contract surveys are waiting to be started." />
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
                                    voteLabel="Register"
                                    onVote={(id) => {
                                        const electionId = Number(id.replace("chain-", ""));
                                        router.push(`/register/${electionId}/eligibility` as any);
                                    }}
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
    pendingCard: {
        backgroundColor: palette.white,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: palette.border,
        padding: 14,
        marginBottom: 16,
        gap: 12,
    },
    pendingCardHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
    },
    pendingTitleBlock: {
        flex: 1,
        gap: 3,
    },
    pendingTitle: {
        color: palette.primaryDark,
        fontSize: 15,
        fontWeight: "800",
    },
    pendingSubtitle: {
        color: palette.textSecondary,
        fontSize: 12,
    },
    pendingBadge: {
        borderRadius: 999,
        backgroundColor: palette.primaryNegative,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    pendingBadgeText: {
        color: palette.primary,
        fontSize: 12,
        fontWeight: "800",
    },
    metricsRowDark: {
        flexDirection: "row",
        gap: 10,
        flexWrap: "wrap",
    },
    metricItemDark: {
        flex: 1,
        minWidth: 90,
        borderRadius: 12,
        backgroundColor: palette.surfaceMuted,
        padding: 10,
    },
    metricValueDark: {
        color: palette.primaryDark,
        fontSize: 14,
        fontWeight: "800",
    },
    metricLabelDark: {
        color: palette.textSecondary,
        fontSize: 11,
        fontWeight: "600",
        marginTop: 3,
    },
    pendingButton: {
        alignSelf: "flex-start",
        backgroundColor: palette.primary,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    pendingButtonText: {
        color: palette.white,
        fontSize: 12,
        fontWeight: "800",
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
