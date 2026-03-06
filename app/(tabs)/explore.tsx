import Feather from "@expo/vector-icons/Feather";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import React, { useMemo, useState } from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

type Survey = {
    id: string;
    name: string;
    reward: number;
    description: string;
    tags: string[];
    minutes: number;
    participants: number;
    participantsLimit: number;
    qualifies: boolean;
};

type SortKey = "rewardDesc" | "rewardAsc" | "nameAsc";

const CATEGORIES = ["All", "Health", "Finance", "Tech", "Politics", "Lifestyle", "Productivity"];

const SURVEYS: Survey[] = [
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

const TAG_COLOR: Record<string, { bg: string; text: string }> = {
    Health: { bg: "rgba(22, 163, 74, 0.16)", text: "#16A34A" },
    Lifestyle: { bg: "rgba(37, 99, 235, 0.16)", text: "#2563EB" },
    Finance: { bg: "rgba(100, 116, 139, 0.14)", text: "#64748B" },
    Tech: { bg: "rgba(37, 99, 235, 0.16)", text: "#2563EB" },
    Productivity: { bg: "rgba(100, 116, 139, 0.14)", text: "#64748B" },
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
                <View key={survey.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>{survey.name}</Text>
                        <Text style={styles.rewardText}>${survey.reward.toFixed(2)}</Text>
                    </View>

                    <Text style={styles.descriptionText}>{survey.description}</Text>

                    <View style={styles.tagRow}>
                        {survey.tags.map((tag) => {
                            const colors = TAG_COLOR[tag] ?? {
                                bg: "rgba(100, 116, 139, 0.14)",
                                text: "#64748B",
                            };
                            return (
                                <View key={tag} style={[styles.tag, { backgroundColor: colors.bg }]}>
                                    <Text style={[styles.tagText, { color: colors.text }]}>{tag}</Text>
                                </View>
                            );
                        })}
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.cardFooter}>
                        <View style={styles.metaRow}>
                            <FontAwesome6 name="clock" size={13} color="#000000" />
                            <Text style={styles.metaText}>{survey.minutes} min</Text>
                        </View>
                        <View style={styles.metaRow}>
                            <MaterialCommunityIcons
                                name="account"
                                size={16}
                                color="#000000"
                            />
                            <Text style={styles.metaText}>
                                {survey.participants}/{survey.participantsLimit}
                            </Text>
                        </View>
                        {survey.qualifies ? (
                            <View style={styles.metaRow}>
                                <Feather name="check-circle" size={14} color="#16A34A" />
                                <Text
                                    style={[
                                        styles.metaText,
                                        { color: "#16A34A" },
                                    ]}
                                >
                                    You qualify
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.metaRow}>
                                <Feather name="x-circle" size={14} color="#DC2626" />
                                <Text
                                    style={[
                                        styles.metaText,
                                        { color: "#DC2626" },
                                    ]}
                                >
                                    You don't qualify
                                </Text>
                            </View>
                        )}
                        
                        <Pressable style={styles.voteButton}>
                            <Text style={styles.voteButtonText}>Vote</Text>
                        </Pressable>
                    </View>
                </View>
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
    card: {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(100, 116, 139, 0.2)",
        padding: 16,
        backgroundColor: "#FFFFFF",
        gap: 12,
    },
    cardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 12,
    },
    cardTitle: {
        flex: 1,
        color: "#000000",
        fontSize: 29 / 2,
        fontWeight: "700",
        lineHeight: 22,
    },
    rewardText: {
        color: "#16A34A",
        fontSize: 26 / 2,
        fontWeight: "700",
    },
    descriptionText: {
        color: "#64748B",
        fontSize: 23 / 2,
        lineHeight: 20,
    },
    tagRow: {
        flexDirection: "row",
        gap: 8,
        flexWrap: "wrap",
    },
    tag: {
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    tagText: {
        fontSize: 11,
        fontWeight: "600",
    },
    divider: {
        height: 1,
        backgroundColor: "rgba(100, 116, 139, 0.22)",
    },
    cardFooter: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
    },
    metaRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
    },
    metaText: {
        color: "#64748B",
        fontSize: 14,
    },
    voteButton: {
        marginLeft: "auto",
        backgroundColor: "#2563EB",
        borderRadius: 10,
        paddingHorizontal: 20,
        paddingVertical: 10,
        minWidth: 82,
        alignItems: "center",
    },
    voteButtonText: {
        color: "#FFFFFF",
        fontWeight: "700",
        fontSize: 16,
    },
});
