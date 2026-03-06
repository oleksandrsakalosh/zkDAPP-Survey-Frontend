import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { palette } from "@/theme/palette";

type Status = "active" | "draft" | "results";

export type CreatedSurveyCardData = {
    id: string;
    title: string;
    category: string;
    status: Status;
    rewardPerVoter?: number;
    endsAt?: string | null;
    responsesCurrent?: number;
    responsesTarget?: number;
    spent?: number;
    budget?: number;
    totalSpent?: number;
};

type Props = {
    survey: CreatedSurveyCardData;
    onManage: (id: string) => void;
    onEdit: (id: string) => void;
    onResults: (id: string) => void;
};

type StatusDisplay = {
    text: string;
    backgroundColor: string;
    textColor: string;
    showDot: boolean;
};

type ActionConfig = {
    text: string;
    onPress: () => void;
};

type MetricConfig = {
    label: string;
    value: string;
};

function toNumber(value?: number | null) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatWholeDollars(value: number) {
    return `$${value.toFixed(0)}`;
}

function formatDollars(value: number) {
    return `$${value.toFixed(2)}`;
}

function getProgress(current: number, target: number) {
    const safeTarget = Math.max(1, target);
    return Math.min(1, Math.max(0, current / safeTarget));
}

function getStatusDisplay(status: Status): StatusDisplay {
    if (status === "active") {
        return {
            text: "Live",
            backgroundColor: palette.successLight,
            textColor: palette.success,
            showDot: true,
        };
    }

    if (status === "draft") {
        return {
            text: "Draft",
            backgroundColor: palette.primaryNegative,
            textColor: palette.textSecondary,
            showDot: false,
        };
    }

    return {
        text: "Ended",
        backgroundColor: palette.primaryNegative,
        textColor: palette.textSecondary,
        showDot: false,
    };
}

function getSubtitle(status: Status, endsAt?: string | null) {
    if (status === "active") return `Closes on ${endsAt ?? "-"}`;
    if (status === "draft") return "Not published";
    return `Ended on ${endsAt ?? "-"}`;
}

function getProgressLabel(status: Status) {
    return status === "results" ? "Final responses" : "Responses";
}

function getProgressColor(status: Status) {
    if (status === "active") return palette.primary;
    if (status === "draft") return palette.border;
    return palette.success;
}

function getMetric(status: Status, spent: number, budget: number, totalSpent: number): MetricConfig {
    if (status === "results") {
        return { label: "Total spent", value: formatWholeDollars(totalSpent) };
    }

    if (status === "draft") {
        return { label: "Budget", value: formatWholeDollars(budget) };
    }

    return { label: "Spent", value: formatWholeDollars(spent) };
}

function getAction(
    status: Status,
    id: string,
    onManage: Props["onManage"],
    onEdit: Props["onEdit"],
    onResults: Props["onResults"],
): ActionConfig {
    if (status === "active") {
        return { text: "Manage", onPress: () => onManage(id) };
    }

    if (status === "draft") {
        return { text: "Edit", onPress: () => onEdit(id) };
    }

    return { text: "Results", onPress: () => onResults(id) };
}

export default function CreatedSurveyCard({
    survey,
    onManage,
    onEdit,
    onResults,
}: Props) {
    const rewardPerVoter = toNumber(survey.rewardPerVoter);
    const responsesCurrent = toNumber(survey.responsesCurrent);
    const responsesTarget = toNumber(survey.responsesTarget);
    const spent = toNumber(survey.spent);
    const budget = toNumber(survey.budget);
    const totalSpent = toNumber(survey.totalSpent);

    const statusDisplay = getStatusDisplay(survey.status);
    const subtitle = getSubtitle(survey.status, survey.endsAt);
    const progressLabel = getProgressLabel(survey.status);
    const progress = getProgress(responsesCurrent, responsesTarget);
    const progressColor = getProgressColor(survey.status);
    const metric = getMetric(survey.status, spent, budget, totalSpent);
    const action = getAction(survey.status, survey.id, onManage, onEdit, onResults);

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <Text style={styles.title} numberOfLines={1}>
                    {survey.title}
                </Text>

                <View
                    style={[
                        styles.statusPill,
                        { backgroundColor: statusDisplay.backgroundColor },
                    ]}
                >
                    {statusDisplay.showDot ? (
                        <View
                            style={[
                                styles.statusDot,
                                { backgroundColor: statusDisplay.textColor },
                            ]}
                        />
                    ) : null}
                    <Text
                        style={[
                            styles.statusText,
                            { color: statusDisplay.textColor },
                        ]}
                    >
                        {statusDisplay.text}
                    </Text>
                </View>
            </View>

            <View style={styles.meta}>
                <Text style={styles.metaText}>{subtitle}</Text>

                <View style={styles.categoryPill}>
                    <Text style={styles.categoryText}>{survey.category}</Text>
                </View>

                <Text style={styles.metaText}>{formatDollars(rewardPerVoter)}/voter</Text>
            </View>

            <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>{progressLabel}</Text>
                <Text
                    style={[
                        styles.progressValue,
                        survey.status === "results" && styles.progressValueResults,
                    ]}
                >
                    {responsesCurrent} / {responsesTarget}
                </Text>
            </View>

            <View style={styles.progressTrack}>
                <View
                    style={[
                        styles.progressFill,
                        {
                            width: `${progress * 100}%`,
                            backgroundColor: progressColor,
                        },
                    ]}
                />
            </View>

            <View style={styles.footer}>
                <View style={styles.metricBlock}>
                    <Text style={styles.metricValue}>{metric.value}</Text>
                    <Text style={styles.metricLabel}>{metric.label}</Text>
                </View>

                <Pressable
                    onPress={action.onPress}
                    android_ripple={{ color: palette.primaryLight }}
                    style={({ pressed }) => [
                        styles.actionButton,
                        pressed && styles.actionButtonPressed,
                    ]}
                >
                    <Text style={styles.actionText}>{action.text}</Text>
                    <MaterialIcons
                        name="chevron-right"
                        size={18}
                        color={palette.primary}
                    />
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: palette.background,
        borderWidth: 1,
        borderColor: palette.border,
        borderRadius: 18,
        padding: 14,
        marginBottom: 14,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
    },
    title: {
        flex: 1,
        fontSize: 16,
        fontWeight: "600",
        color: palette.textPrimary,
    },
    statusPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusText: {
        fontSize: 12,
        fontWeight: "500",
    },
    meta: {
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 10,
        marginTop: 8,
    },
    metaText: {
        fontSize: 12,
        fontWeight: "400",
        color: palette.textSecondary,
    },
    categoryPill: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: palette.primaryNegative,
    },
    categoryText: {
        fontSize: 12,
        fontWeight: "500",
        color: palette.primary,
    },
    progressHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 12,
    },
    progressLabel: {
        fontSize: 12,
        fontWeight: "400",
        color: palette.textSecondary,
    },
    progressValue: {
        fontSize: 12,
        fontWeight: "500",
        color: palette.textPrimary,
    },
    progressValueResults: {
        color: palette.success,
    },
    progressTrack: {
        marginTop: 8,
        height: 6,
        borderRadius: 999,
        overflow: "hidden",
        backgroundColor: palette.border,
    },
    progressFill: {
        height: "100%",
        borderRadius: 999,
    },
    footer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        marginTop: 14,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: palette.border,
    },
    metricBlock: {
        flex: 1,
        paddingVertical: 2,
    },
    metricValue: {
        fontSize: 16,
        fontWeight: "500",
        color: palette.textPrimary,
    },
    metricLabel: {
        marginTop: 2,
        fontSize: 12,
        fontWeight: "400",
        color: palette.textSecondary,
    },
    actionButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: palette.primaryNegative,
    },
    actionButtonPressed: {
        transform: [{ scale: 0.98 }],
        backgroundColor: palette.primaryLight,
    },
    actionText: {
        fontSize: 12,
        fontWeight: "500",
        color: palette.primary,
    },
});
