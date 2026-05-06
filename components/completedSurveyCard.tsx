import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { palette } from "@/theme/palette";

type Props = {
    id: string;
    title: string;
    category: string;
    date: string;
    actionLabel?: string;
    onPress?: (id: string) => void;
};

export default function CompletedSurveyCard({
    id,
    title,
    category,
    date,
    actionLabel = "Vote recorded on Vocdoni",
    onPress,
}: Props) {
    const handlePress = () => {
        onPress?.(id);
    };

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

                    <View style={styles.recordedBadge}>
                        <Text style={styles.recordedText}>
                            {actionLabel}
                        </Text>
                    </View>
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
    recordedBadge: {
        backgroundColor: palette.primaryNegative,
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 10,
        alignSelf: "flex-start",
    },
    recordedText: {
        color: palette.primary,
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
