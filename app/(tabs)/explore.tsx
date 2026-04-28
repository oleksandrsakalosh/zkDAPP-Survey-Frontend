import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { router } from "expo-router";

import FilterModal from "@/components/filterModal";
import SurveyCard from "@/components/surveyCard";
import { CATEGORIES } from "@/constants/surveyFilters";
import { SurveyCardData, SortKey } from "@/domain/models";
import {
    getUnstartedContractElections,
    getMyRegisteredElections,
} from "@/services/contractService";
import { palette } from "@/theme/palette";
import { useEligibilityProfile } from "../hooks/useEligibilityProfile";
import { checkEligibility } from "@/utils/checkEligibility";
import { ChainElection, ContractElectionStatus } from "@/types/election";
import { loadOrFetchElectionMetadataMap, StoredElectionMetadata } from "@/utils/electionMetadataStore";
import { showAlert } from "@/utils/platformAlert";
import { createVocdoniClient } from "@/utils/vocdoni/sdk";
import { getOrCreateDeviceWallet } from "@/utils/vocdoni/wallet";

const SORT_LABELS: Record<SortKey, string> = {
    rewardDesc: "Reward ↓",
    rewardAsc: "Reward ↑",
    nameAsc: "Name A-Z",
};

const SORT_KEYS: SortKey[] = ["rewardDesc", "rewardAsc", "nameAsc"];

export default function Explore() {
    const [availableChainElections, setAvailableChainElections] = useState<ChainElection[]>([]);
    const [registeredChainElections, setRegisteredChainElections] = useState<ChainElection[]>([]);
    const [metadataByElectionId, setMetadataByElectionId] = useState<Record<number, StoredElectionMetadata>>({});
    const [activeVoterTab, setActiveVoterTab] = useState<"available" | "registered">("available");
    const [isLoadingSurveys, setIsLoadingSurveys] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [feedError, setFeedError] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [sortBy, setSortBy] = useState<SortKey>("rewardDesc");
    const [selectedCategory, setSelectedCategory] = useState<string[]>([]);

    const [isFilterVisible, setIsFilterVisible] = useState(false);

    const [draftCategories, setDraftCategories] = useState<string[]>([]);
    const [draftMinReward, setDraftMinReward] = useState(0);
    const [draftOpenOnly, setDraftOpenOnly] = useState(false);
    const [draftTime, setDraftTime] = useState("");
    const [draftQualifiedOnly, setDraftQualifiedOnly] = useState(false);

    const [appliedCategories, setAppliedCategories] = useState<string[]>([]);
    const [appliedMinReward, setAppliedMinReward] = useState(0);
    const [appliedOpenOnly, setAppliedOpenOnly] = useState(false);
    const [appliedTime, setAppliedTime] = useState("");
    const [appliedQualifiedOnly, setAppliedQualifiedOnly] = useState(false);

    const hydrateFeed = async (mode: "initial" | "refresh" = "initial") => {
        try {
            if (mode === "initial") {
                setIsLoadingSurveys(true);
            } else {
                setIsRefreshing(true);
            }
            setFeedError(null);

            const [unstarted, registered] = await Promise.all([
                getUnstartedContractElections(),
                getMyRegisteredElections(),
            ]);
            const wallet = await getOrCreateDeviceWallet();
            const vocdoniClient = await createVocdoniClient(wallet);
            const visibleRegistered: ChainElection[] = [];

            for (const election of registered) {
                if (isChainElectionExpired(election)) {
                    continue;
                }

                if (election.status !== ContractElectionStatus.Started || !election.vocdoniElectionId) {
                    visibleRegistered.push(election);
                    continue;
                }

                try {
                    vocdoniClient.setElectionId(election.vocdoniElectionId);
                    await vocdoniClient.fetchElection(election.vocdoniElectionId);
                    const voteId = await vocdoniClient.hasAlreadyVoted();
                    if (!voteId) {
                        visibleRegistered.push(election);
                    }
                } catch (error) {
                    console.warn("[explore] registered:vocdoni-check:miss", {
                        electionId: election.id,
                        vocdoniElectionId: election.vocdoniElectionId,
                        error: error instanceof Error ? error.message : error,
                    });
                    visibleRegistered.push(election);
                }
            }

            const registeredIds = new Set(visibleRegistered.map((election) => election.id));
            const visibleUnstarted = unstarted.filter(
                (election) => !registeredIds.has(election.id) && !isChainElectionExpired(election)
            );
            const metadataMap = await loadOrFetchElectionMetadataMap([
                ...visibleUnstarted,
                ...visibleRegistered,
            ]);

            setAvailableChainElections(visibleUnstarted);
            setRegisteredChainElections(visibleRegistered);
            setMetadataByElectionId(metadataMap);
        } catch (error) {
            setFeedError(
                error instanceof Error ? error.message : "Unable to load contract surveys."
            );
            setAvailableChainElections([]);
            setRegisteredChainElections([]);
            setMetadataByElectionId({});
        } finally {
            if (mode === "initial") {
                setIsLoadingSurveys(false);
            } else {
                setIsRefreshing(false);
            }
        }
    };
    const { profile } = useEligibilityProfile();

    useEffect(() => {
        hydrateFeed();
    }, []);

    const surveysWithEligibility = useMemo(
        () =>
            [
                ...availableChainElections.map((election) =>
                    mapChainElectionToSurveyCard(election, "available", metadataByElectionId[election.id])
                ),
                ...registeredChainElections.map((election) =>
                    mapChainElectionToSurveyCard(election, "participated", metadataByElectionId[election.id])
                ),
            ].map((survey) => ({
                ...survey,
                eligibility: !survey.id.startsWith("chain-")
                                ? checkEligibility(survey.requirements ?? [], profile)
                                : checkEligibility([], null),
            })),
        [availableChainElections, metadataByElectionId, profile, registeredChainElections]
    );

    const filteredSurveys = useMemo(() => {
        const loweredQuery = query.trim().toLowerCase();

        let result = surveysWithEligibility.filter((survey) =>
            survey.title.toLowerCase().includes(loweredQuery)
        );

        if (appliedCategories.length > 0 && !appliedCategories.includes("All")) {
            result = result.filter((survey) =>
                survey.categories.some((cat) => appliedCategories.includes(cat.label))
            );
        }

        result = result.filter(
            (survey) => (survey.budget?.rewardPerVoter?.amount ?? 0) >= appliedMinReward
        );

        if (appliedOpenOnly) {
            result = result.filter((survey) => survey.status === "active");
        }

        if (appliedQualifiedOnly) {
            result = result.filter(
                (survey) => survey.eligibility?.decision === "qualify"
            );
        }

        if (appliedTime === "Under 5 min") {
            result = result.filter((survey) => (survey.estimatedMinutes ?? 0) < 5);
        } else if (appliedTime === "5-10 min" || appliedTime === "5â€“10 min") {
            result = result.filter(
                (survey) =>
                    (survey.estimatedMinutes ?? 0) >= 5 &&
                    (survey.estimatedMinutes ?? 0) <= 10
            );
        } else if (appliedTime === "10-20 min" || appliedTime === "10â€“20 min") {
            result = result.filter(
                (survey) =>
                    (survey.estimatedMinutes ?? 0) >= 10 &&
                    (survey.estimatedMinutes ?? 0) <= 20
            );
        }

        return [...result].sort((a, b) => {
            if (sortBy === "rewardDesc") {
                return (b.budget?.rewardPerVoter?.amount ?? 0) - (a.budget?.rewardPerVoter?.amount ?? 0);
            }
            if (sortBy === "rewardAsc") {
                return (a.budget?.rewardPerVoter?.amount ?? 0) - (b.budget?.rewardPerVoter?.amount ?? 0);
            }
            return a.title.localeCompare(b.title);
        });
    }, [
        query,
        sortBy,
        surveysWithEligibility,
        appliedCategories,
        appliedMinReward,
        appliedOpenOnly,
        appliedTime,
        appliedQualifiedOnly,
    ]);

    const categoryFilteredSurveys = useMemo(() => {
        const tabFiltered =
            activeVoterTab === "available"
                ? filteredSurveys.filter((survey) => survey.listVariant !== "participated")
                : filteredSurveys.filter((survey) => survey.listVariant === "participated");

        if (selectedCategory.length === 0 || selectedCategory.includes("All")) {
            return tabFiltered;
        }

        return tabFiltered.filter((survey) =>
            survey.categories.some((cat) => selectedCategory.includes(cat.label))
        );
    }, [activeVoterTab, filteredSurveys, selectedCategory]);

    const nextSort = () => {
        const currentIndex = SORT_KEYS.indexOf(sortBy);
        const nextIndex = (currentIndex + 1) % SORT_KEYS.length;
        setSortBy(SORT_KEYS[nextIndex]);
    };

    const handleViewDetails = async (id: string) => {
        if (id.startsWith("chain-")) {
            const electionId = Number(id.replace("chain-", ""));
            const chainElection = [...availableChainElections, ...registeredChainElections].find(
                (election) => election.id === electionId
            );

            if (!chainElection) {
                showAlert("Election unavailable", "Pull down to refresh and try again.");
                return;
            }

            if (activeVoterTab === "available") {
                router.push(`/register/${electionId}/eligibility` as any);
                return;
            }

            if (chainElection.status !== ContractElectionStatus.Started || !chainElection.vocdoniElectionId) {
                showAlert("Not started yet", "You are registered, but this election has not started on Vocdoni yet.");
                return;
            }

            router.push(`/voting/${chainElection.vocdoniElectionId}` as any);
            return;
        }

        router.push(`/voting/${id}` as any);
    };

    const selectCategory = (category: string) => {
        if (category === "All") {
            setSelectedCategory(["All"]);
            return;
        }

        if (selectedCategory.includes(category)) {
            const newSelection = selectedCategory.filter((item) => item !== category);
            setSelectedCategory(newSelection.length === 0 ? ["All"] : newSelection);
        } else {
            setSelectedCategory((current) => [...current.filter((item) => item !== "All"), category]);
        }
    };

    const openFilterModal = () => {
        setDraftCategories(appliedCategories);
        setDraftMinReward(appliedMinReward);
        setDraftOpenOnly(appliedOpenOnly);
        setDraftTime(appliedTime);
        setDraftQualifiedOnly(appliedQualifiedOnly);
        setIsFilterVisible(true);
    };

    const resetFilters = () => {
        setDraftCategories([]);
        setDraftMinReward(0);
        setDraftOpenOnly(false);
        setDraftTime("");
        setDraftQualifiedOnly(false);
    };

    const applyFilters = () => {
        setAppliedCategories(draftCategories);
        setAppliedMinReward(Number(draftMinReward) || 0);
        setAppliedOpenOnly(draftOpenOnly);
        setAppliedTime(draftTime);
        setAppliedQualifiedOnly(draftQualifiedOnly);
        setIsFilterVisible(false);
    };

    return (
        <>
            <ScrollView
                style={styles.screen}
                contentContainerStyle={styles.container}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={() => hydrateFeed("refresh")}
                        tintColor={palette.primary}
                    />
                }
            >
                <View style={styles.searchRow}>
                    <View style={styles.searchBox}>
                        <MaterialIcons
                            name="search"
                            size={16}
                            color={palette.textSecondary}
                        />
                        <TextInput
                            value={query}
                            onChangeText={setQuery}
                            placeholder="Search by survey name"
                            placeholderTextColor={palette.textSecondary}
                            style={styles.searchInput}
                        />
                    </View>

                    <Pressable style={styles.filterButton} onPress={openFilterModal}>
                        <Text style={styles.filterButtonText}>Filter</Text>
                    </Pressable>
                </View>

                <View style={styles.voterTabs}>
                    <Pressable
                        style={[styles.voterTab, activeVoterTab === "available" && styles.voterTabActive]}
                        onPress={() => setActiveVoterTab("available")}
                    >
                        <Text
                            style={[
                                styles.voterTabText,
                                activeVoterTab === "available" && styles.voterTabTextActive,
                            ]}
                        >
                            Explore & register
                        </Text>
                    </Pressable>
                    <Pressable
                        style={[styles.voterTab, activeVoterTab === "registered" && styles.voterTabActive]}
                        onPress={() => setActiveVoterTab("registered")}
                    >
                        <Text
                            style={[
                                styles.voterTabText,
                                activeVoterTab === "registered" && styles.voterTabTextActive,
                            ]}
                        >
                            Registered
                        </Text>
                    </Pressable>
                </View>

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categoryRow}
                >
                    {CATEGORIES.map((item) => (
                        <Pressable
                            key={item}
                            style={[
                                styles.categoryChip,
                                selectedCategory.includes(item) && styles.categoryChipActive,
                            ]}
                            onPress={() => selectCategory(item)}
                        >
                            <Text
                                style={[
                                    styles.categoryChipText,
                                    selectedCategory.includes(item) && styles.categoryChipTextActive,
                                ]}
                            >
                                {item}
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>

                <View style={styles.filterTagsRow}>
                    <Text style={styles.activeText}>Active:</Text>

                    {appliedCategories.length > 0 && !appliedCategories.includes("All") && (
                        <View style={styles.activeTag}>
                            <Text style={styles.activeTagText}>
                                Categories: {appliedCategories.join(", ")}
                            </Text>
                        </View>
                    )}

                    {appliedMinReward > 0 && (
                        <View style={styles.activeTag}>
                            <Text style={styles.activeTagText}>Reward: ${appliedMinReward}+</Text>
                        </View>
                    )}

                    {appliedOpenOnly && (
                        <View style={styles.activeTag}>
                            <Text style={styles.activeTagText}>Open only</Text>
                        </View>
                    )}

                    {appliedTime !== "" && (
                        <View style={styles.activeTag}>
                            <Text style={styles.activeTagText}>Time: {appliedTime}</Text>
                        </View>
                    )}

                    {appliedQualifiedOnly && (
                        <View style={styles.activeTag}>
                            <Text style={styles.activeTagText}>Qualified only</Text>
                        </View>
                    )}
                </View>

                <View style={styles.resultsRow}>
                    <Text style={styles.resultsText}>
                        {categoryFilteredSurveys.length} survey
                        {categoryFilteredSurveys.length === 1 ? "" : "s"} found
                    </Text>

                    <Pressable onPress={nextSort}>
                        <Text style={styles.sortText}>Sort: {SORT_LABELS[sortBy]}</Text>
                    </Pressable>
                </View>

                {isLoadingSurveys && (
                    <View style={styles.feedbackCard}>
                        <ActivityIndicator color={palette.primary} />
                        <Text style={styles.feedbackText}>Loading contract surveys...</Text>
                    </View>
                )}

                {!isLoadingSurveys && feedError && (
                    <View style={styles.feedbackCard}>
                        <Text style={styles.feedbackTitle}>Contract surveys unavailable</Text>
                        <Text style={styles.feedbackText}>{feedError}</Text>
                    </View>
                )}

                {!isLoadingSurveys && !feedError && categoryFilteredSurveys.length === 0 && (
                    <View style={styles.feedbackCard}>
                        <Text style={styles.feedbackTitle}>No contract surveys</Text>
                        <Text style={styles.feedbackText}>
                            {activeVoterTab === "available"
                                ? "Registration-open surveys will appear here after they are created on-chain."
                                : "Elections you registered for will appear here. Started elections can be opened for voting."}
                        </Text>
                    </View>
                )}

                {categoryFilteredSurveys.map((survey) => (
                    <SurveyCard
                        key={survey.id}
                        survey={survey}
                        onVote={handleViewDetails}
                        voteLabel={
                            !survey.id.startsWith("chain-")
                                ? "Details"
                                : activeVoterTab === "available"
                                    ? "Register"
                                    : "Vote"
                        }
                    />
                ))}
            </ScrollView>

            <FilterModal
                visible={isFilterVisible}
                onClose={() => setIsFilterVisible(false)}
                onReset={resetFilters}
                onApply={applyFilters}
                draftCategories={draftCategories}
                setDraftCategories={setDraftCategories}
                draftMinReward={draftMinReward}
                setDraftMinReward={setDraftMinReward}
                draftOpenOnly={draftOpenOnly}
                setDraftOpenOnly={setDraftOpenOnly}
                draftTime={draftTime}
                setDraftTime={setDraftTime}
                draftQualifiedOnly={draftQualifiedOnly}
                setDraftQualifiedOnly={setDraftQualifiedOnly}
            />
        </>
    );
}

const mapChainElectionToSurveyCard = (
    election: ChainElection,
    listVariant: SurveyCardData["listVariant"],
    stored?: StoredElectionMetadata
): SurveyCardData => {
    const isStarted = election.status === ContractElectionStatus.Started;
    const targetResponses = election.maxVoters || election.registeredVoters;
    const metadata = stored?.metadata;
    const eligibility = stored?.eligibility;
    const category = metadata?.category || "On-chain";
    const questions = metadata?.questions ?? [];
    const requirements = eligibility?.requirements ?? [];
    const dates = [
        metadata?.startDate ? `Starts ${new Date(metadata.startDate).toLocaleString()}` : null,
        metadata?.endDate ? `Ends ${new Date(metadata.endDate).toLocaleString()}` : null,
    ].filter(Boolean);

    return {
        id: `chain-${election.id}`,
        title: metadata?.title || `On-chain survey #${election.id}`,
        description: metadata?.description || (isStarted
            ? `Started on Vocdoni as ${election.vocdoniElectionId || "pending id"}.`
            : "Registration is controlled by the SurveyElectionManager smart contract."),
        status: isStarted ? "active" : "draft",
        categories: [{ id: category.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "on-chain", label: category }],
        tags: metadata?.tags.map((tag) => ({
            id: tag.toLowerCase().replace(/[^a-z0-9]+/g, "-") || tag,
            label: tag,
        })),
        estimatedMinutes: Math.max(1, questions.length || 1),
        progress: {
            responseCount: election.registeredVoters,
            targetResponses,
        },
        budget: {
            rewardPerVoter: {
                amount: metadata?.rewardPerVoter ?? 0,
                currency: "TOKEN",
            },
        },
        eligibility: {
            decision: "verification_required",
            matchedRequirements: [],
            failedRequirements: [],
            checkedAt: new Date().toISOString(),
        },
        requirements,
        questions,
        timeInfo: {
            opensAt: metadata?.startDate ?? (election.startDate > 0 ? new Date(election.startDate * 1000).toISOString() : undefined),
            closesAt: metadata?.endDate ?? undefined,
            isOpen: !isStarted,
            displayLabel: dates.length > 0
                ? dates.join(" - ")
                : election.startDate > 0
                    ? `Starts ${new Date(election.startDate * 1000).toLocaleString()}`
                    : "Can start anytime",
        },
        listVariant,
        primaryAction: isStarted ? "vote" : "details",
        primaryActionLabel: isStarted ? "Vote" : "Register",
    };
};

const isChainElectionExpired = (election: ChainElection) => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    return election.endDate > 0 && election.endDate <= nowSeconds;
};

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: palette.background,
    },
    container: {
        padding: 14,
        paddingBottom: 28,
        gap: 12,
    },
    searchRow: {
        flexDirection: "row",
        gap: 10,
        alignItems: "center",
    },
    searchBox: {
        flex: 1,
        height: 44,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surfaceMuted,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        gap: 9,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: palette.textPrimary,
    },
    filterButton: {
        height: 44,
        borderRadius: 12,
        backgroundColor: palette.primary,
        paddingHorizontal: 18,
        alignItems: "center",
        justifyContent: "center",
    },
    filterButtonText: {
        color: palette.white,
        fontWeight: "600",
        fontSize: 14,
    },
    voterTabs: {
        flexDirection: "row",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.white,
        padding: 4,
        gap: 4,
    },
    voterTab: {
        flex: 1,
        borderRadius: 9,
        paddingVertical: 10,
        alignItems: "center",
    },
    voterTabActive: {
        backgroundColor: palette.primary,
    },
    voterTabText: {
        color: palette.textSecondary,
        fontSize: 13,
        fontWeight: "700",
    },
    voterTabTextActive: {
        color: palette.white,
    },
    categoryRow: {
        gap: 9,
        paddingVertical: 2,
    },
    categoryChip: {
        borderRadius: 20,
        borderWidth: 1,
        borderColor: palette.border,
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: palette.white,
    },
    categoryChipActive: {
        backgroundColor: palette.primary,
        borderColor: palette.primary,
    },
    categoryChipText: {
        color: palette.textSecondary,
        fontSize: 14,
        fontWeight: "500",
    },
    categoryChipTextActive: {
        color: palette.white,
    },
    filterTagsRow: {
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 8,
    },
    activeText: {
        color: palette.textSecondary,
        fontSize: 14,
    },
    activeTag: {
        backgroundColor: palette.primaryNegative,
        borderRadius: 9,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: palette.primaryLight,
    },
    activeTagText: {
        color: palette.primary,
        fontSize: 13,
        fontWeight: "500",
    },
    resultsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    resultsText: {
        color: palette.textSecondary,
        fontSize: 17,
    },
    sortText: {
        color: palette.primary,
        fontSize: 15,
        fontWeight: "600",
    },
    feedbackCard: {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.white,
        paddingHorizontal: 16,
        paddingVertical: 18,
        gap: 10,
        alignItems: "center",
    },
    feedbackTitle: {
        color: palette.primaryDark,
        fontSize: 16,
        fontWeight: "700",
    },
    feedbackText: {
        color: palette.textSecondary,
        fontSize: 14,
        textAlign: "center",
    },
});
