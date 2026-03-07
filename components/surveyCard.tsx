import Feather from "@expo/vector-icons/Feather";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export type SurveyCardData = {
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

type Props = {
    survey: SurveyCardData;
    onVote?: (id: string) => void;
    voteLabel?: string;
};

const TAG_COLOR: Record<string, { bg: string; text: string }> = {
    Health: { bg: "rgba(22, 163, 74, 0.16)", text: "#16A34A" },
    Lifestyle: { bg: "rgba(37, 99, 235, 0.16)", text: "#2563EB" },
    Finance: { bg: "rgba(100, 116, 139, 0.14)", text: "#64748B" },
    Tech: { bg: "rgba(37, 99, 235, 0.16)", text: "#2563EB" },
    Productivity: { bg: "rgba(100, 116, 139, 0.14)", text: "#64748B" },
};

export default function SurveyCard({ survey, onVote, voteLabel = "Vote" }: Props) {
    return (
        <View style={styles.card}>
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
                    <MaterialCommunityIcons name="account" size={16} color="#000000" />
                    <Text style={styles.metaText}>
                        {survey.participants}/{survey.participantsLimit}
                    </Text>
                </View>
                {survey.qualifies ? (
                    <View style={styles.metaRow}>
                        <Feather name="check-circle" size={14} color="#16A34A" />
                        <Text style={[styles.metaText, styles.metaTextPositive]}>
                            You qualify
                        </Text>
                    </View>
                ) : (
                    <View style={styles.metaRow}>
                        <Feather name="x-circle" size={14} color="#DC2626" />
                        <Text style={[styles.metaText, styles.metaTextNegative]}>
                            You do not qualify
                        </Text>
                    </View>
                )}

                <Pressable style={styles.voteButton} onPress={() => onVote?.(survey.id)}>
                    <Text style={styles.voteButtonText}>{voteLabel}</Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
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
    metaTextPositive: {
        color: "#16A34A",
    },
    metaTextNegative: {
        color: "#DC2626",
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
