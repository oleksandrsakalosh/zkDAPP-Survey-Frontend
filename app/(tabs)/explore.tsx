import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React, { useMemo, useState } from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { router } from "expo-router";

import SurveyCard from "@/components/surveyCard";
import { SurveyCardData, SortKey } from "@/domain/models";

import { palette } from "@/theme/palette";
import FilterModal from "@/components/filterModal";
import { CATEGORIES } from "@/constants/surveyFilters";


const SURVEYS: SurveyCardData[] = [
    {
        "id": "1",
        "title": "Fitness App Usage Habits",
        "description": "How often do you use fitness apps and what features matter most? 10-question study.",
        "status": "active",
        "categories": [
            { "id": "health", "label": "Health" },
            { "id": "lifestyle", "label": "Lifestyle" }
        ],
        "tags": [
            { "id": "health", "label": "Health" },
            { "id": "lifestyle", "label": "Lifestyle" }
        ],
        "estimatedMinutes": 5,
        "eligibility": {
            "decision": "qualify",
            "matchedRequirements": [],
            "failedRequirements": []
        },
        "budget": {
            "rewardPerVoter": { "amount": 2, "currency": "USD" }
        },
        "progress": {
            "responseCount": 88,
            "targetResponses": 200
        },
        "listVariant": "explore",
        "primaryAction": "vote",
        "primaryActionLabel": "Start"
    },
    {
        "id": "2",
        "title": "Prescription Drug Affordability",
        "description": "Share your experience with prescription costs and insurance coverage. Anonymous and secure.",
        "status": "active",
        "categories": [
            { "id": "health", "label": "Health" },
            { "id": "finance", "label": "Finance" }
        ],
        "tags": [
            { "id": "health", "label": "Health" },
            { "id": "finance", "label": "Finance" }
        ],
        "estimatedMinutes": 8,
        "eligibility": {
            "decision": "not_qualified",
            "matchedRequirements": [],
            "failedRequirements": []
        },
        "budget": {
            "rewardPerVoter": { "amount": 3.5, "currency": "USD" }
        },
        "progress": {
            "responseCount": 203,
            "targetResponses": 400
        },
        "listVariant": "explore",
        "primaryAction": "details",
        "primaryActionLabel": "View"
    },
    {
        "id": "3",
        "title": "Remote Work Tool Preferences",
        "description": "Help us compare productivity tools used by distributed teams across different industries.",
        "status": "active",
        "categories": [
            { "id": "tech", "label": "Tech" },
            { "id": "productivity", "label": "Productivity" }
        ],
        "tags": [
            { "id": "tech", "label": "Tech" },
            { "id": "productivity", "label": "Productivity" }
        ],
        "estimatedMinutes": 6,
        "eligibility": {
            "decision": "qualify",
            "matchedRequirements": [],
            "failedRequirements": []
        },
        "budget": {
            "rewardPerVoter": { "amount": 1.25, "currency": "USD" }
        },
        "progress": {
            "responseCount": 52,
            "targetResponses": 180
        },
        "listVariant": "explore",
        "primaryAction": "vote",
        "primaryActionLabel": "Start"
    },
    {
        "id": "4",
        "title": "Personal Banking Mobile UX",
        "description": "Tell us what works and what does not in your banking app experience over the last 3 months.",
        "status": "active",
        "categories": [
            { "id": "finance", "label": "Finance" },
            { "id": "tech", "label": "Tech" }
        ],
        "tags": [
            { "id": "finance", "label": "Finance" },
            { "id": "tech", "label": "Tech" }
        ],
        "estimatedMinutes": 7,
        "eligibility": {
            "decision": "qualify",
            "matchedRequirements": [],
            "failedRequirements": []
        },
        "budget": {
            "rewardPerVoter": { "amount": 2.75, "currency": "USD" }
        },
        "progress": {
            "responseCount": 119,
            "targetResponses": 250
        },
        "listVariant": "explore",
        "primaryAction": "vote",
        "primaryActionLabel": "Start"
    }
];

const SORT_LABELS: Record<SortKey, string> = {
    rewardDesc: "Reward ↓",
    rewardAsc: "Reward ↑",
    nameAsc: "Name A-Z",
};

const SORT_KEYS: SortKey[] = ["rewardDesc", "rewardAsc", "nameAsc"];

export default function Explore() {
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

    const filteredSurveys = useMemo(() => {
        const loweredQuery = query.trim().toLowerCase();

        let result = SURVEYS.filter((survey) =>
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
        } else if (appliedTime === "5–10 min") {
            result = result.filter(
                (survey) =>
                    (survey.estimatedMinutes ?? 0) >= 5 &&
                    (survey.estimatedMinutes ?? 0) <= 10
            );
        } else if (appliedTime === "10–20 min") {
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
        appliedCategories,
        appliedMinReward,
        appliedOpenOnly,
        appliedTime,
        appliedQualifiedOnly,
    ]);

    const categoryFilteredSurveys = useMemo(() => {
        if (selectedCategory.length === 0 || selectedCategory.includes("All")) {
            return filteredSurveys;
        }

        return filteredSurveys.filter((survey) =>
            survey.categories.some((cat) => selectedCategory.includes(cat.label))
        );
    }, [filteredSurveys, selectedCategory]);

    const nextSort = () => {
        const currentIndex = SORT_KEYS.indexOf(sortBy);
        const nextIndex = (currentIndex + 1) % SORT_KEYS.length;
        setSortBy(SORT_KEYS[nextIndex]);
    };

    const handleViewDetails = (id: string) => {
        router.push(`/voting/${id}` as any);
    };

    const selectCategory = (category: string) => {
        if (category === "All") {
            setSelectedCategory(["All"]);
            return;
        }

        if (selectedCategory.includes(category)) {
            const newSelection = selectedCategory.filter((c) => c !== category);
            setSelectedCategory(newSelection.length === 0 ? ["All"] : newSelection);
        } else {
            setSelectedCategory((prev) => [...prev.filter((c) => c !== "All"), category]);
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
            <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
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

                {categoryFilteredSurveys.map((survey) => (
                    <SurveyCard
                        key={survey.id}
                        survey={survey}
                        onVote={handleViewDetails}
                        voteLabel="Details"
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
});
