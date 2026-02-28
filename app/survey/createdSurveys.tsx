import React, { useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import CreatedSurveyCard, { CreatedSurveyCardData } from "@/components/createdSurveyCard";
import { palette } from "@/theme/palette";

type Props = {
    surveys: CreatedSurveyCardData[];
    onCreateNew: () => void;
    onManage: (id: string) => void;
    onEdit: (id: string) => void;
    onResults: (id: string) => void;
};

export default function CreatedSurveys({
    surveys,
    onCreateNew,
    onManage,
    onEdit,
    onResults,
}: Props) {
    const { activeDraft, completed } = useMemo(() => {
        const active: CreatedSurveyCardData[] = [];
        const done: CreatedSurveyCardData[] = [];

        for (const survey of surveys) {
            if (survey.status === "results") done.push(survey);
            else active.push(survey);
        }

        return { activeDraft: active, completed: done };
    }, [surveys]);

    const listData = useMemo(() => {
        const data: (
            | { type: "card"; survey: CreatedSurveyCardData }
            | { type: "header"; title: string }
        )[] = [];

        for (const survey of activeDraft) {
            data.push({ type: "card", survey });
        }

        if (completed.length > 0) {
            data.push({ type: "header", title: "Completed" });
            for (const survey of completed) {
                data.push({ type: "card", survey });
            }
        }

        return data;
    }, [activeDraft, completed]);

    return (
        <View style={styles.container}>
            <FlatList
                data={listData}
                keyExtractor={(item, idx) =>
                    item.type === "card" ? `card-${item.survey.id}` : `header-${idx}`
                }
                renderItem={({ item }) => {
                    if (item.type === "header") {
                        return <Text style={styles.sectionHeader}>{item.title}</Text>;
                    }

                    return (
                        <CreatedSurveyCard
                            survey={item.survey}
                            onManage={onManage}
                            onEdit={onEdit}
                            onResults={onResults}
                        />
                    );
                }}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />

            <View style={styles.stickyWrap}>
                <Pressable
                    onPress={onCreateNew}
                    android_ripple={{ color: palette.primaryLight }}
                    style={({ pressed }) => [
                        styles.stickyBtn,
                        pressed && styles.stickyBtnPressed,
                    ]}
                >
                    <MaterialIcons
                        name="add"
                        size={18}
                        color={palette.white}
                        style={styles.stickyIcon}
                    />
                    <Text style={styles.stickyText}>Create New Survey</Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: palette.background,
    },
    listContent: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 110,
    },
    sectionHeader: {
        marginTop: 6,
        marginBottom: 10,
        color: palette.textSecondary,
        fontWeight: "700",
        fontSize: 13,
    },
    stickyWrap: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 18,
        backgroundColor: palette.background,
        borderTopWidth: 1,
        borderTopColor: palette.border,
    },
    stickyBtn: {
        height: 54,
        borderRadius: 16,
        backgroundColor: palette.primary,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    stickyBtnPressed: {
        backgroundColor: "#1D4ED8",
        transform: [{ scale: 0.985 }],
    },
    stickyIcon: {
        fontWeight: "800",
    },
    stickyText: {
        color: palette.white,
        fontSize: 16,
        fontWeight: "800",
    },
});
