import React, { useMemo } from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import CompletedSurveyCard from "@/components/completedSurveyCard";
import { palette } from "@/theme/palette";

export type Survey = {
    id: string;
    title: string;
    category: string;
    date: string;
    reward?: number | null;
};

type Props = {
    surveys: Survey[];
};

function formatMoney(amount: number) {
    return `$${amount.toFixed(2)}`;
}

export default function ParticipatedSurveys({ surveys }: Props) {
    const { totalEarned, votedCount, unpaidCount } = useMemo(() => {
        let earned = 0;
        let unpaid = 0;

        for (const s of surveys) {
            const r = s.reward;
            const isPaid = r !== null && r !== undefined && r > 0;

            if (isPaid) earned += r as number;
            else unpaid += 1;
        }

        return {
            totalEarned: earned,
            votedCount: surveys.length,
            unpaidCount: unpaid,
        };
    }, [surveys]);

    return (
        <View style={styles.container}>
            <View style={styles.statsRow}>
                <View style={[styles.statCard, styles.earnedCard]}>
                    <Text style={[styles.statValue, styles.earnedValue]}>
                        {formatMoney(totalEarned)}
                    </Text>
                    <Text style={styles.statLabel}>Earned</Text>
                </View>

                <View style={[styles.statCard, styles.votedCard]}>
                    <Text style={[styles.statValue, styles.votedValue]}>
                        {votedCount}
                    </Text>
                    <Text style={styles.statLabel}>Voted</Text>
                </View>

                <View style={[styles.statCard, styles.unpaidCard]}>
                    <Text style={[styles.statValue, styles.unpaidValue]}>
                        {unpaidCount}
                    </Text>
                    <Text style={styles.statLabel}>Unpaid votes</Text>
                </View>
            </View>

            <Text style={styles.sectionTitle}>Vote History</Text>

            <FlatList
                data={surveys}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                    <CompletedSurveyCard
                        id={item.id}
                        title={item.title}
                        category={item.category}
                        date={item.date}
                        reward={item.reward}
                    />
                )}
                showsVerticalScrollIndicator={false}
            />
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

    earnedCard: { backgroundColor: palette.successLight },
    votedCard: { backgroundColor: palette.primaryNegative },
    unpaidCard: { backgroundColor: palette.orangeLight },

    earnedValue: { color: palette.success },
    votedValue: { color: palette.primary },
    unpaidValue: { color: palette.orange },

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
});
