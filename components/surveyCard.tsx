import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { SurveyCardData } from "@/domain/models";

import { palette } from "@/theme/palette";

type Props = {
    survey: SurveyCardData;
    onVote?: (id: string) => void;
    voteLabel?: string;
};

const TAG_COLOR: Record<string, { bg: string; text: string }> = {
  Health: {
    bg: palette.green.bgSoft,
    text: palette.green.text,
  },
  Lifestyle: {
    bg: palette.blue.bgSoft,
    text: palette.blue.text,
  },
  Finance: {
    bg: palette.gray.bgSoft,
    text: palette.gray.text,
  },
  Tech: {
    bg: palette.blue.bgSoft,
    text: palette.blue.text,
  },
  Productivity: {
    bg: palette.gray.bgSoft,
    text: palette.gray.text,
  },
};

export default function SurveyCard({ survey, onVote, voteLabel = "Vote" }: Props) {
    return (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{survey.title}</Text>
                <Text style={styles.rewardText}>{survey.budget?.rewardPerVoter?.amount.toFixed(2) ?? "0.00"} {survey.budget?.rewardPerVoter?.currency ?? "USD"}</Text>
            </View>

            <Text style={styles.descriptionText}>{survey.description}</Text>

            <View style={styles.tagRow}>
                {survey.categories.map((cat) => {
                    const colors = TAG_COLOR[cat.label] ?? {
                        bg: palette.gray.bgSoft,
                        text: palette.gray.text,
                    };
                    return (
                        <View key={cat.id} style={[styles.tag, { backgroundColor: colors.bg }]}>
                            <Text style={[styles.tagText, { color: colors.text }]}>{cat.label}</Text>
                        </View>
                    );
                })}
            </View>

            {(survey.requirements?.length ?? 0) > 0 && (
                <View style={styles.infoBlock}>
                    <Text style={styles.infoLabel}>Eligibility</Text>
                    {survey.requirements?.map((requirement) => (
                        <Text key={requirement.id} style={styles.infoText}>
                            {requirement.type}: {requirement.value}
                        </Text>
                    ))}
                </View>
            )}

            {(survey.questions?.length ?? 0) > 0 && (
                <View style={styles.infoBlock}>
                    <Text style={styles.infoLabel}>Questions</Text>
                    {survey.questions?.slice(0, 3).map((question) => (
                        <Text key={question.id} style={styles.infoText}>
                            {question.order}. {question.title}
                        </Text>
                    ))}
                    {(survey.questions?.length ?? 0) > 3 && (
                        <Text style={styles.infoText}>
                            +{(survey.questions?.length ?? 0) - 3} more
                        </Text>
                    )}
                </View>
            )}

            <View style={styles.divider} />

            <View style={styles.cardFooter}>
                <View style={styles.metaRow}>
                    <MaterialIcons name="schedule" size={13} color={palette.black} />
                    <Text style={styles.metaText}>{survey.estimatedMinutes} min</Text>
                </View>
                <View style={styles.metaRow}>
                    <MaterialCommunityIcons name="account" size={16} color={palette.black} />
                    <Text style={styles.metaText}>
                        {survey.progress?.responseCount ?? 0}/{survey.progress?.targetResponses ?? 0}
                    </Text>
                </View>
                {survey.eligibility?.decision === "qualify" ? (
                    <View style={styles.metaRow}>
                        <Feather name="check-circle" size={14} color={palette.success} />
                        <Text style={[styles.metaText, styles.metaTextPositive]}>
                            You qualify
                        </Text>
                    </View>
                ) : (
                    <View style={styles.metaRow}>
                        <Feather name="x-circle" size={14} color={palette.warning} />
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
        borderColor: palette.grayBorder,
        padding: 16,
        backgroundColor: palette.white,
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
        color: palette.black,
        fontSize: 29 / 2,
        fontWeight: "700",
        lineHeight: 22,
    },
    rewardText: {
        color: palette.success,
        fontSize: 26 / 2,
        fontWeight: "700",
    },
    descriptionText: {
        color: palette.textSecondary,
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
    infoBlock: {
        borderRadius: 10,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surfaceMuted,
        padding: 10,
        gap: 4,
    },
    infoLabel: {
        color: palette.primaryDark,
        fontSize: 12,
        fontWeight: "800",
    },
    infoText: {
        color: palette.textSecondary,
        fontSize: 12,
        lineHeight: 17,
    },
    divider: {
        height: 1,
        backgroundColor: palette.grayBackground,
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
        color: palette.textSecondary,
        fontSize: 14,
    },
    metaTextPositive: {
        color: palette.success,
    },
    metaTextNegative: {
        color: palette.warning,
    },
    voteButton: {
        marginLeft: "auto",
        backgroundColor: palette.primary,
        borderRadius: 10,
        paddingHorizontal: 20,
        paddingVertical: 10,
        minWidth: 82,
        alignItems: "center",
    },
    voteButtonText: {
        color: palette.white,
        fontWeight: "700",
        fontSize: 16,
    },
});
