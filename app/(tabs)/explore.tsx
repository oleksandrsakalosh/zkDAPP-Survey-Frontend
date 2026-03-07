import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import React, { useMemo, useState } from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import SurveyCard, { type SurveyCardData } from "@/components/surveyCard";

type SortKey = "rewardDesc" | "rewardAsc" | "nameAsc";

const CATEGORIES = ["All", "Health", "Finance", "Tech", "Politics", "Lifestyle", "Productivity"];

const SURVEYS: SurveyCardData[] = [
    {
        id: "1",
        name: "Fitness App Usage Habits",
        reward: 2,
        description:
            "How often do you use fitness apps and what features matter most? 10-question study.",
        tags: ["Health", "Lifestyle"],
        minutes: 5,
        participants: 88,
        participantsLimit: 200,
        qualifies: true,
    },
    {
        id: "2",
        name: "Prescription Drug Affordability",
        reward: 3.5,
        description:
            "Share your experience with prescription costs and insurance coverage. Anonymous and secure.",
        tags: ["Health", "Finance"],
        minutes: 8,
        participants: 203,
        participantsLimit: 400,
        qualifies: false,
    },
    {
        id: "3",
        name: "Remote Work Tool Preferences",
        reward: 1.25,
        description:
            "Help us compare productivity tools used by distributed teams across different industries.",
        tags: ["Tech", "Productivity"],
        minutes: 6,
        participants: 52,
        participantsLimit: 180,
        qualifies: true,
    },
    {
        id: "4",
        name: "Personal Banking Mobile UX",
        reward: 2.75,
        description:
            "Tell us what works and what does not in your banking app experience over the last 3 months.",
        tags: ["Finance", "Tech"],
        minutes: 7,
        participants: 119,
        participantsLimit: 250,
        qualifies: true,
    },
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

    const filteredSurveys = useMemo(() => {
        const loweredQuery = query.trim().toLowerCase();

        const searchFiltered = SURVEYS.filter((survey) =>
            survey.name.toLowerCase().includes(loweredQuery)
        );

        return [...searchFiltered].sort((a, b) => {
            if (sortBy === "rewardDesc") {
                return b.reward - a.reward;
            }
            if (sortBy === "rewardAsc") {
                return a.reward - b.reward;
            }
            return a.name.localeCompare(b.name);
        });
    }, [query, sortBy]);

    const nextSort = () => {
        const currentIndex = SORT_KEYS.indexOf(sortBy);
        const nextIndex = (currentIndex + 1) % SORT_KEYS.length;
        setSortBy(SORT_KEYS[nextIndex]);
    };

    const categoryFilteredSurveys = useMemo(() => {
        if (selectedCategory.length === 0 || selectedCategory.includes("All")) {
            return filteredSurveys;
        }
        return filteredSurveys.filter((survey) =>
            survey.tags.some((tag) => selectedCategory.includes(tag))
        );
    }, [filteredSurveys, selectedCategory]);

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

    return (
        <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
            <View style={styles.searchRow}>
                <View style={styles.searchBox}>
                    <FontAwesome6
                        name="magnifying-glass"
                        size={16}
                        color="#64748B"
                    />
                    <TextInput
                        value={query}
                        onChangeText={setQuery}
                        placeholder="Search by survey name"
                        placeholderTextColor="#64748B"
                        style={styles.searchInput}
                    />
                </View>
                <Pressable style={styles.filterButton}>
                    <Text style={styles.filterButtonText}>Filter</Text>
                </Pressable>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryRow}
            >
                {CATEGORIES.map((item) => (
                    <View
                        key={item}
                        style={[styles.categoryChip, selectedCategory.includes(item) && styles.categoryChipActive]}
                        onTouchStart={() => selectCategory(item)}
                    >
                        <Text
                            style={[
                                styles.categoryChipText,
                                selectedCategory.includes(item) && styles.categoryChipTextActive,
                            ]}
                        >
                            {item}
                        </Text>
                    </View>
                ))}
            </ScrollView>

            <View style={styles.filterTagsRow}>
                <Text style={styles.activeText}>Active:</Text>
                <View style={styles.activeTag}>
                    <Text style={styles.activeTagText}>Reward: $1+</Text>
                </View>
                <View style={styles.activeTag}>
                    <Text style={styles.activeTagText}>Open only</Text>
                </View>
            </View>

            <View style={styles.resultsRow}>
                <Text style={styles.resultsText}>
                    {categoryFilteredSurveys.length} survey{categoryFilteredSurveys.length === 1 ? "" : "s"} found
                </Text>
                <Pressable onPress={nextSort}>
                    <Text style={styles.sortText}>Sort: {SORT_LABELS[sortBy]}</Text>
                </Pressable>
            </View>

            {categoryFilteredSurveys.map((survey) => (
                <SurveyCard key={survey.id} survey={survey} />
            ))}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: "#FFFFFF",
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
        borderColor: "rgba(100, 116, 139, 0.28)",
        backgroundColor: "rgba(100, 116, 139, 0.09)",
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        gap: 9,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: "#000000",
    },
    filterButton: {
        height: 44,
        borderRadius: 12,
        backgroundColor: "#2563EB",
        paddingHorizontal: 18,
        alignItems: "center",
        justifyContent: "center",
    },
    filterButtonText: {
        color: "#FFFFFF",
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
        borderColor: "rgba(100, 116, 139, 0.3)",
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: "#FFFFFF",
    },
    categoryChipActive: {
        backgroundColor: "#2563EB",
        borderColor: "#2563EB",
    },
    categoryChipText: {
        color: "#64748B",
        fontSize: 14,
        fontWeight: "500",
    },
    categoryChipTextActive: {
        color: "#FFFFFF",
    },
    filterTagsRow: {
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 8,
    },
    activeText: {
        color: "#64748B",
        fontSize: 14,
    },
    activeTag: {
        backgroundColor: "rgba(37, 99, 235, 0.12)",
        borderRadius: 9,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    activeTagText: {
        color: "#2563EB",
        fontSize: 13,
        fontWeight: "500",
    },
    resultsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    resultsText: {
        color: "#64748B",
        fontSize: 17,
    },
    sortText: {
        color: "#2563EB",
        fontSize: 15,
        fontWeight: "600",
    },
});
