import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { palette } from "@/theme/palette";

type Props = {
    id: string;
    title: string;
    category: string;
    date: string;
    reward?: number | null;
};

export default function CompletedSurveyCard({
    title,
    category,
    date,
    reward,
}: Props) {
    const isPaid = reward !== null && reward !== undefined && reward > 0;

    const handlePress = () => {};

    return (
        <Pressable
            onPress={handlePress}
            android_ripple={{ color: palette.primaryNegative }}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        >
            <View style={styles.row}>
                <View style={styles.content}>
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.subtitle}>
                        {category} | {date}
                    </Text>

                    {isPaid ? (
                        <View style={styles.paidBadge}>
                            <Text style={styles.paidText}>
                                Reward paid  +${reward.toFixed(2)}
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.unpaidBadge}>
                            <Text style={styles.unpaidText}>
                                Paid cap reached - not paid
                            </Text>
                        </View>
                    )}
                </View>

                <View style={styles.checkCircle}>
                    <MaterialIcons
                        name="check"
                        size={18}
                        color={palette.success}
                    />
                </View>
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: palette.background,
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 18,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: palette.border,
    },
    cardPressed: {
        backgroundColor: palette.primaryNegative,
        borderColor: palette.primaryLight,
        transform: [{ scale: 0.985 }],
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
    },
    content: {
        flex: 1,
    },
    title: {
        fontSize: 16,
        fontWeight: "600",
        color: palette.textPrimary,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 12,
        color: palette.textSecondary,
        marginBottom: 6,
    },
    paidBadge: {
        backgroundColor: palette.successLight,
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 10,
        alignSelf: "flex-start",
    },
    paidText: {
        color: palette.success,
        fontWeight: "500",
        fontSize: 12,
    },
    unpaidBadge: {
        backgroundColor: palette.orangeLight,
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 10,
        alignSelf: "flex-start",
    },
    unpaidText: {
        color: palette.orange,
        fontWeight: "500",
        fontSize: 12,
    },
    checkCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: palette.successLight,
        justifyContent: "center",
        alignItems: "center",
        marginLeft: 12,
    },
});
