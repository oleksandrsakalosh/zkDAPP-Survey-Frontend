import React, { useMemo } from "react";
import { ActivityIndicator, View, Text, StyleSheet, FlatList, RefreshControl } from "react-native";
import CompletedSurveyCard from "@/components/completedSurveyCard";
import { palette } from "@/theme/palette";

import { ParticipatedSurveySummary } from "@/domain/models";

type Props = {
    surveys: ParticipatedSurveySummary[];
    isRefreshing?: boolean;
    isLoading?: boolean;
    onRefresh?: () => void;
    onResults?: (id: string) => void;
};

export default function ParticipatedSurveys({
    surveys,
    isRefreshing = false,
    isLoading = false,
    onRefresh,
    onResults,
}: Props) {
    const votedCount = useMemo(() => surveys.length, [surveys]);

    return (
        <View style={styles.container}>
            <View style={styles.statsRow}>
                <View style={[styles.statCard, styles.votedCard]}>
                    <Text style={[styles.statValue, styles.votedValue]}>
                        {votedCount}
                    </Text>
                    <Text style={styles.statLabel}>Voted</Text>
                </View>

                <View style={[styles.statCard, styles.recordedCard]}>
                    <Text style={[styles.statValue, styles.recordedValue]}>
                        {surveys.length > 0 ? "Yes" : "No"}
                    </Text>
                    <Text style={styles.statLabel}>History available</Text>
                </View>
            </View>

            <Text style={styles.sectionTitle}>Vote History</Text>

            {isLoading ? (
                <View style={styles.loadingState}>
                    <ActivityIndicator color={palette.primary} />
                    <Text style={styles.emptyText}>Loading your vote history...</Text>
                </View>
            ) : (
                <FlatList
                    data={surveys}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item }) => (
                        <CompletedSurveyCard
                            id={item.id}
                            title={item.title}
                            category={item.category}
                            date={item.votedAt}
                            actionLabel="View results"
                            onPress={onResults}
                        />
                    )}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={onRefresh}
                            tintColor={palette.primary}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyTitle}>No participated surveys yet</Text>
                            <Text style={styles.emptyText}>
                                Surveys you vote on will appear here. Pull down to refresh.
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: palette.white,
        paddingHorizontal: 16,
        paddingTop: 14,
    },

    statsRow: {
        flexDirection: "row",
        gap: 10,
        marginBottom: 14,
    },
    statCard: {
        flex: 1,
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 12,
    },
    statValue: {
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 12,
        color: palette.textSecondary,
        fontWeight: "500",
    },

    votedCard: { backgroundColor: palette.primaryNegative },
    recordedCard: { backgroundColor: palette.successLight },
    votedValue: { color: palette.primary },
    recordedValue: { color: palette.success },

    sectionTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: palette.primaryDark,
        marginBottom: 10,
        marginTop: 2,
    },

    listContent: {
        paddingBottom: 20,
    },
    emptyState: {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.white,
        paddingHorizontal: 16,
        paddingVertical: 20,
        alignItems: "center",
        gap: 8,
    },
    emptyTitle: {
        color: palette.primaryDark,
        fontSize: 16,
        fontWeight: "700",
    },
    emptyText: {
        color: palette.textSecondary,
        fontSize: 14,
        textAlign: "center",
        lineHeight: 20,
    },
    loadingState: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        paddingHorizontal: 16,
    },
});
