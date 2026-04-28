import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    RefreshControl,
    ScrollView,
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
import {
    getMyCreatedElections,
    getMyRegisteredElections,
    resolveElectionUiStates,
    startElectionWithVocdoni,
} from "@/services/contractService";
import { ChainElection, ContractElectionStatus } from "@/types/election";
import { loadOrFetchElectionMetadataMap, StoredElectionMetadata } from "@/utils/electionMetadataStore";
import { registerSurveyInRegistry } from "@/utils/registry/client";
import { useDeviceWallet } from "@/utils/vocdoni/WalletProvider";
import { publishSurveyDraft } from "@/utils/vocdoni/publishSurvey";
import { voteSurvey } from "@/utils/vocdoni/voteSurvey";
import { showAlert } from "@/utils/platformAlert";
import { getOrCreateDeviceWallet } from "@/utils/vocdoni/wallet";
import { createVocdoniClient } from "@/utils/vocdoni/sdk";

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
        anonymity: false,
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

const mapChainElectionToCreatedSurvey = (
    election: ChainElection,
    stored?: StoredElectionMetadata
): CreatedSurveyCardData => {
    const metadata = stored?.metadata;
    const ended =
        election.endDate > 0 && election.endDate <= Math.floor(Date.now() / 1000);
    const endsAt =
        metadata?.endDate ??
        (election.endDate > 0 ? new Date(election.endDate * 1000).toISOString() : null);

    return {
        id: election.vocdoniElectionId || `chain-${election.id}`,
        title: metadata?.title || `On-chain survey #${election.id}`,
        category: metadata?.category || "On-chain",
        status: ended ? "results" : "active",
        rewardPerVoter: metadata?.rewardPerVoter ?? 0,
        endsAt: endsAt ? formatShortDate(endsAt) : null,
        responsesCurrent: election.registeredVoters,
        responsesTarget: election.maxVoters || election.registeredVoters,
        spent: 0,
    };
};

const mapChainElectionToParticipatedSurvey = (
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
    rewardStatus: "not_applicable",
    reward:
        stored?.metadata.rewardPerVoter != null
            ? { amount: stored.metadata.rewardPerVoter, currency: "TOKEN" }
            : undefined,
});

export default function MySurveys() {
    const params = useLocalSearchParams<{ tab?: string | string[] }>();
    const { walletAddress, isLoading: isWalletLoading } = useDeviceWallet();

    type MySurveyTab = "created" | "pending" | "participated";

    const normalizeTab = (value?: string | string[]): MySurveyTab => {
        const rawValue = Array.isArray(value) ? value[0] : value;
        if (rawValue === "pending") {
            return "pending";
        }
        return rawValue === "participated" ? "participated" : "created";
    };

    const [activeTab, setActiveTab] = useState<MySurveyTab>(
        normalizeTab(params.tab)
    );
    const [createdChainElections, setCreatedChainElections] = useState<ChainElection[]>([]);
    const [createdVocdoniElections, setCreatedVocdoniElections] = useState<ChainElection[]>([]);
    const [participatedChainElections, setParticipatedChainElections] = useState<ChainElection[]>([]);
    const [metadataByElectionId, setMetadataByElectionId] = useState<Record<number, StoredElectionMetadata>>({});
    const [publishedExplorerUrls, setPublishedExplorerUrls] = useState<Record<string, string>>({});
    const [publishedRegistryTxHashes, setPublishedRegistryTxHashes] = useState<Record<string, string>>({});
    const [submittedVoteIds, setSubmittedVoteIds] = useState<Record<string, string>>({});
    const [latestPublishedTestSurveyId, setLatestPublishedTestSurveyId] = useState<string | null>(null);
    const [isRegistryLoading, setIsRegistryLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isQuickPublishing, setIsQuickPublishing] = useState(false);
    const [isQuickVoting, setIsQuickVoting] = useState(false);
    const [startingElectionId, setStartingElectionId] = useState<number | null>(null);

    useEffect(() => {
        setActiveTab(normalizeTab(params.tab));
    }, [params.tab]);

    const reloadMySurveys = useCallback(async () => {
        try {
            setIsRegistryLoading(true);
            const [nextChainElections, registeredChainElections] = await Promise.all([
                getMyCreatedElections(),
                getMyRegisteredElections(),
            ]);
            const metadataMap = await loadOrFetchElectionMetadataMap([
                ...nextChainElections,
                ...registeredChainElections,
            ]);
            const wallet = await getOrCreateDeviceWallet();
            const vocdoniClient = await createVocdoniClient(wallet);

            const fetchableCreated: ChainElection[] = [];
            for (const election of nextChainElections) {
                if (election.status !== ContractElectionStatus.Started || !election.vocdoniElectionId) {
                    continue;
                }

                try {
                    vocdoniClient.setElectionId(election.vocdoniElectionId);
                    await vocdoniClient.fetchElection(election.vocdoniElectionId);
                    fetchableCreated.push(election);
                } catch (error) {
                    console.warn("[my-surveys] created:vocdoni-check:miss", {
                        electionId: election.id,
                        vocdoniElectionId: election.vocdoniElectionId,
                        error: error instanceof Error ? error.message : error,
                    });
                }
            }

            const votedRegistered: ChainElection[] = [];
            for (const election of registeredChainElections) {
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
                    console.warn("[my-surveys] participated:vocdoni-check:miss", {
                        electionId: election.id,
                        vocdoniElectionId: election.vocdoniElectionId,
                        error: error instanceof Error ? error.message : error,
                    });
                }
            }

            setCreatedChainElections(nextChainElections);
            setCreatedVocdoniElections(fetchableCreated);
            setParticipatedChainElections(votedRegistered);
            setMetadataByElectionId(metadataMap);
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

        reloadMySurveys();
    }, [isWalletLoading, reloadMySurveys, walletAddress]);

    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true);
        await reloadMySurveys();
        setIsRefreshing(false);
    }, [reloadMySurveys]);

    const createdSurveys = useMemo(() => {
        if (!walletAddress) {
            return [];
        }

        return createdVocdoniElections.map((election) =>
            mapChainElectionToCreatedSurvey(election, metadataByElectionId[election.id])
        );
    }, [createdVocdoniElections, metadataByElectionId, walletAddress]);

    const participatedSurveys = useMemo(() => {
        if (!walletAddress) {
            return [];
        }

        return participatedChainElections.map((election) =>
            mapChainElectionToParticipatedSurvey(election, metadataByElectionId[election.id])
        );
    }, [metadataByElectionId, participatedChainElections, walletAddress]);

    const pendingChainElections = useMemo(
        () =>
            createdChainElections.filter(
                (election) =>
                    !isChainElectionExpired(election) &&
                    (election.status === ContractElectionStatus.Created ||
                        (election.status === ContractElectionStatus.Started && !election.vocdoniElectionId))
            ),
        [createdChainElections]
    );

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
            await reloadMySurveys();

            showAlert(
                registryTxHash ? "Vocdoni test survey created" : "Vocdoni survey created, registry failed",
                registryTxHash
                    ? publishedElection.rotatedWallet
                        ? `Election ${publishedElection.electionId} was created on Vocdoni DEV, registered on-chain, and added to your list.\n\nRegistry tx: ${registryTxHash}\n\nThe app switched to a fresh test wallet because the previous DEV faucet wallet was rate-limited. New wallet: ${publishedElection.walletAddress}`
                        : `Election ${publishedElection.electionId} was created on Vocdoni DEV, registered on-chain, and added to your list.\n\nRegistry tx: ${registryTxHash}`
                    : `Election ${publishedElection.electionId} was created on Vocdoni DEV, but registry submission failed. The survey will not appear in the public feed until it is registered on-chain.`
            );
        } catch (error) {
            showAlert(
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
            showAlert(
                "No test survey yet",
                "Create a Vocdoni test survey first, then use the vote button."
            );
            return;
        }

        const targetSurvey = createdSurveys.find((survey) => survey.id === latestPublishedTestSurveyId);
        if (!targetSurvey) {
            showAlert(
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

            await reloadMySurveys();

            showAlert(
                submittedVote.alreadyVoted ? "Vote already recorded" : "Test vote submitted",
                submittedVote.alreadyVoted
                    ? `This device wallet already voted on election ${latestPublishedTestSurveyId}.\n\nVote ID: ${submittedVote.voteId}`
                    : `Vote ID: ${submittedVote.voteId}\n\nElection: ${latestPublishedTestSurveyId}`
            );
        } catch (error) {
            showAlert(
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
            showAlert(
                "Vocdoni test survey",
                voteId
                    ? `Election ${id}\n\nExplorer: ${explorerUrl}${registryTxHash ? `\n\nRegistry tx: ${registryTxHash}` : ""}\n\nLatest vote: ${voteId}`
                    : `Election ${id}\n\nExplorer: ${explorerUrl}${registryTxHash ? `\n\nRegistry tx: ${registryTxHash}` : ""}`
            );
            return;
        }

        router.push(`/survey/manage/${id}`);
    };

    const handleStartContractElection = async (election: ChainElection) => {
        if (startingElectionId != null) {
            return;
        }

        const storedMetadata = metadataByElectionId[election.id];

        if (!storedMetadata?.metadata) {
            showAlert(
                "Metadata unavailable",
                "This election cannot be started until its metadata is loaded from IPFS."
            );
            return;
        }

        try {
            setStartingElectionId(election.id);
            const started = await startElectionWithVocdoni(election.id, {
                metadata: storedMetadata.metadata,
            });
            await reloadMySurveys();

            showAlert(
                "Election started",
                `Vocdoni election ${started.vocdoniElectionId} was created and linked on-chain.\n\nTx: ${started.txHash}`
            );
        } catch (error) {
            console.error("[my-surveys] start-contract-election:error", error);
            showAlert(
                "Start failed",
                error instanceof Error ? error.message : "Unable to start this election."
            );
        } finally {
            setStartingElectionId(null);
        }
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
                        onPress={() => setActiveTab("pending")}
                    >
                        <Text
                            style={[
                                styles.tabText,
                                activeTab === "pending" && styles.activeText,
                            ]}
                        >
                            Pending start
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
                            left:
                                activeTab === "created"
                                    ? 0
                                    : activeTab === "pending"
                                        ? width / 3
                                        : (width / 3) * 2,
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
                        isLoading={isRegistryLoading}
                        onRefresh={handleRefresh}
                        onManage={handleManageSurvey}
                        onEdit={() => {}}
                        onResults={(id) => { router.push(`/survey/results/${id}`); }}
                    />
                ) : activeTab === "pending" ? (
                    <PendingStartSurveys
                        elections={pendingChainElections}
                        metadataByElectionId={metadataByElectionId}
                        startingElectionId={startingElectionId}
                        isRefreshing={isRefreshing}
                        isLoading={isRegistryLoading}
                        onRefresh={handleRefresh}
                        onStartElection={handleStartContractElection}
                    />
                ) : (
                    <ParticipatedSurveys
                        surveys={participatedSurveys}
                        isRefreshing={isRefreshing}
                        isLoading={isRegistryLoading}
                        onRefresh={handleRefresh}
                    />
                )}
            </View>
        </View>
    );
}

function PendingStartSurveys({
    elections,
    metadataByElectionId,
    startingElectionId,
    isRefreshing,
    isLoading,
    onRefresh,
    onStartElection,
}: {
    elections: ChainElection[];
    metadataByElectionId: Record<number, StoredElectionMetadata>;
    startingElectionId: number | null;
    isRefreshing: boolean;
    isLoading: boolean;
    onRefresh: () => void;
    onStartElection: (election: ChainElection) => void;
}) {
    const totalRegistered = elections.reduce((sum, election) => sum + election.registeredVoters, 0);
    const readyCount = elections.filter((election) =>
        resolveElectionUiStates({ election }).includes("Ready to start")
    ).length;
    const cappedCount = elections.filter(
        (election) => election.maxVoters > 0 && election.registeredVoters >= election.maxVoters
    ).length;

    return (
        <ScrollView
            style={styles.pendingContainer}
            contentContainerStyle={styles.pendingContent}
            refreshControl={
                <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={onRefresh}
                    tintColor={palette.primary}
                />
            }
        >
            <View style={styles.pendingStatsRow}>
                <View style={styles.pendingStatCard}>
                    <Text style={styles.pendingStatValue}>{elections.length}</Text>
                    <Text style={styles.pendingStatLabel}>On-chain</Text>
                </View>
                <View style={styles.pendingStatCard}>
                    <Text style={styles.pendingStatValue}>{totalRegistered}</Text>
                    <Text style={styles.pendingStatLabel}>Registered</Text>
                </View>
                <View style={styles.pendingStatCard}>
                    <Text style={styles.pendingStatValue}>{readyCount}</Text>
                    <Text style={styles.pendingStatLabel}>Ready</Text>
                </View>
            </View>

            {isLoading ? (
                <View style={styles.pendingEmpty}>
                    <ActivityIndicator color={palette.primary} />
                    <Text style={styles.pendingEmptyText}>Loading pending contract surveys...</Text>
                </View>
            ) : elections.length === 0 ? (
                <View style={styles.pendingEmpty}>
                    <Text style={styles.pendingEmptyTitle}>No pending contract surveys</Text>
                    <Text style={styles.pendingEmptyText}>
                        Surveys created on the smart contract before Vocdoni start will appear here.
                    </Text>
                </View>
            ) : (
                elections.map((election) => {
                    const states = resolveElectionUiStates({ election });
                    const stored = metadataByElectionId[election.id];
                    const metadata = stored?.metadata;
                    const eligibility = stored?.eligibility;
                    const isReady = states.includes("Ready to start");
                    const isStarting = startingElectionId === election.id;
                    const capacityLabel = election.maxVoters > 0 ? String(election.maxVoters) : "Unlimited";
                    const startLabel =
                        metadata?.startDate
                            ? new Date(metadata.startDate).toLocaleString()
                            : election.startDate > 0
                            ? new Date(election.startDate * 1000).toLocaleString()
                            : "Anytime";

                    return (
                        <View key={election.id} style={styles.pendingCard}>
                            <View style={styles.pendingCardHeader}>
                                <View style={styles.pendingTitleBlock}>
                                    <Text style={styles.pendingTitle}>
                                        {metadata?.title || `Election #${election.id}`}
                                    </Text>
                                    <Text style={styles.pendingDescription}>
                                        {metadata?.description || "Metadata is not available on this device."}
                                    </Text>
                                </View>
                                <View style={styles.pendingPill}>
                                    <Text style={styles.pendingPillText}>
                                        {isReady ? "Ready" : "Collecting voters"}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.pendingMetricsGrid}>
                                <View style={styles.pendingMetric}>
                                    <Text style={styles.pendingMetricValue}>{election.registeredVoters}</Text>
                                    <Text style={styles.pendingMetricLabel}>Registered voters</Text>
                                </View>
                                <View style={styles.pendingMetric}>
                                    <Text style={styles.pendingMetricValue}>
                                        {metadata?.voterCap != null ? metadata.voterCap : capacityLabel}
                                    </Text>
                                    <Text style={styles.pendingMetricLabel}>Max voters</Text>
                                </View>
                                <View style={styles.pendingMetric}>
                                    <Text style={styles.pendingMetricValue}>#{election.tokenId}</Text>
                                    <Text style={styles.pendingMetricLabel}>ERC1155 token</Text>
                                </View>
                                <View style={styles.pendingMetric}>
                                    <Text style={styles.pendingMetricValue}>{startLabel}</Text>
                                    <Text style={styles.pendingMetricLabel}>Start condition</Text>
                                </View>
                            </View>

                            {metadata && (
                                <View style={styles.pendingInfoBlock}>
                                    <Text style={styles.pendingInfoLabel}>Survey details</Text>
                                    <Text style={styles.pendingInfoText}>Category: {metadata.category}</Text>
                                    {metadata.tags.length > 0 && (
                                        <Text style={styles.pendingInfoText}>
                                            Tags: {metadata.tags.join(", ")}
                                        </Text>
                                    )}
                                    {metadata.endDate && (
                                        <Text style={styles.pendingInfoText}>
                                            Ends: {new Date(metadata.endDate).toLocaleString()}
                                        </Text>
                                    )}
                                </View>
                            )}

                            {(eligibility?.requirements.length ?? 0) > 0 && (
                                <View style={styles.pendingInfoBlock}>
                                    <Text style={styles.pendingInfoLabel}>Eligibility</Text>
                                    {eligibility?.requirements.map((requirement) => (
                                        <Text key={requirement.id} style={styles.pendingInfoText}>
                                            {requirement.type}: {requirement.value}
                                        </Text>
                                    ))}
                                </View>
                            )}

                            {(metadata?.questions.length ?? 0) > 0 && (
                                <View style={styles.pendingInfoBlock}>
                                    <Text style={styles.pendingInfoLabel}>Questions</Text>
                                    {metadata?.questions.map((question) => (
                                        <Text key={question.id} style={styles.pendingInfoText}>
                                            {question.order}. {question.title}
                                        </Text>
                                    ))}
                                </View>
                            )}

                            <View style={styles.pendingProgressTrack}>
                                <View
                                    style={[
                                        styles.pendingProgressFill,
                                        {
                                            width: `${
                                                election.maxVoters > 0
                                                    ? Math.min(
                                                        100,
                                                        (election.registeredVoters / election.maxVoters) * 100
                                                    )
                                                    : 0
                                            }%`,
                                        },
                                    ]}
                                />
                            </View>

                            <Text style={styles.pendingHashText}>
                                metadata {election.metadataHash.slice(0, 10)}... · eligibility{" "}
                                {election.eligibilityHash.slice(0, 10)}...
                            </Text>

                            <TouchableOpacity
                                style={[
                                    styles.pendingStartButton,
                                    (!isReady || !metadata || isStarting) && styles.pendingStartButtonDisabled,
                                ]}
                                disabled={!isReady || !metadata || isStarting}
                                onPress={() => onStartElection(election)}
                            >
                                <Text style={styles.pendingStartButtonText}>
                                    {isStarting ? "Starting..." : "Start on Vocdoni"}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    );
                })
            )}

            {cappedCount > 0 && (
                <Text style={styles.pendingFootnote}>
                    {cappedCount} election{cappedCount === 1 ? "" : "s"} reached the voter cap.
                </Text>
            )}
        </ScrollView>
    );
}

const isChainElectionExpired = (election: ChainElection) => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    return election.endDate > 0 && election.endDate <= nowSeconds;
};

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
        width: width / 3,
        backgroundColor: palette.primary,
    },
    content: {
        flex: 1,
    },
    pendingContainer: {
        flex: 1,
        backgroundColor: palette.background,
    },
    pendingContent: {
        padding: 16,
        paddingBottom: 28,
        gap: 12,
    },
    pendingStatsRow: {
        flexDirection: "row",
        gap: 10,
    },
    pendingStatCard: {
        flex: 1,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.white,
        padding: 12,
    },
    pendingStatValue: {
        color: palette.primary,
        fontSize: 20,
        fontWeight: "800",
    },
    pendingStatLabel: {
        color: palette.textSecondary,
        fontSize: 12,
        fontWeight: "600",
        marginTop: 2,
    },
    pendingEmpty: {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.white,
        paddingHorizontal: 16,
        paddingVertical: 20,
        alignItems: "center",
        gap: 8,
    },
    pendingEmptyTitle: {
        color: palette.primaryDark,
        fontSize: 16,
        fontWeight: "700",
    },
    pendingEmptyText: {
        color: palette.textSecondary,
        fontSize: 14,
        textAlign: "center",
        lineHeight: 20,
    },
    pendingCard: {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.white,
        padding: 14,
        gap: 12,
    },
    pendingCardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
    },
    pendingTitle: {
        color: palette.primaryDark,
        fontSize: 16,
        fontWeight: "800",
    },
    pendingTitleBlock: {
        flex: 1,
        gap: 4,
    },
    pendingDescription: {
        color: palette.textSecondary,
        fontSize: 12,
        lineHeight: 17,
    },
    pendingPill: {
        borderRadius: 999,
        backgroundColor: palette.primaryNegative,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    pendingPillText: {
        color: palette.primary,
        fontSize: 12,
        fontWeight: "700",
    },
    pendingMetricsGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
    },
    pendingMetric: {
        width: "48%",
        borderRadius: 12,
        backgroundColor: palette.surfaceMuted,
        padding: 10,
    },
    pendingMetricValue: {
        color: palette.primaryDark,
        fontSize: 13,
        fontWeight: "800",
    },
    pendingMetricLabel: {
        color: palette.textSecondary,
        fontSize: 11,
        fontWeight: "600",
        marginTop: 3,
    },
    pendingProgressTrack: {
        height: 6,
        borderRadius: 999,
        backgroundColor: palette.border,
        overflow: "hidden",
    },
    pendingProgressFill: {
        height: "100%",
        borderRadius: 999,
        backgroundColor: palette.primary,
    },
    pendingInfoBlock: {
        borderRadius: 12,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surfaceMuted,
        padding: 10,
        gap: 4,
    },
    pendingInfoLabel: {
        color: palette.primaryDark,
        fontSize: 12,
        fontWeight: "800",
    },
    pendingInfoText: {
        color: palette.textSecondary,
        fontSize: 12,
        lineHeight: 17,
    },
    pendingHashText: {
        color: palette.textSecondary,
        fontSize: 12,
    },
    pendingStartButton: {
        height: 46,
        borderRadius: 12,
        backgroundColor: palette.primary,
        alignItems: "center",
        justifyContent: "center",
    },
    pendingStartButtonDisabled: {
        opacity: 0.5,
    },
    pendingStartButtonText: {
        color: palette.white,
        fontSize: 14,
        fontWeight: "800",
    },
    pendingFootnote: {
        color: palette.textSecondary,
        fontSize: 13,
        textAlign: "center",
    },
});
