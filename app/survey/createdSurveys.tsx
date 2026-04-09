import React, { useMemo } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import CreatedSurveyCard from "@/components/createdSurveyCard";
import { CreatedSurveyCardData } from "@/domain/models";
import { palette } from "@/theme/palette";

type Props = {
    surveys: CreatedSurveyCardData[];
    onCreateNew: () => void;
    onQuickPublishTest: () => void;
    isQuickPublishing?: boolean;
    onQuickVoteTest: () => void;
    canQuickVoteTest?: boolean;
    isQuickVoting?: boolean;
    isRefreshing?: boolean;
    onRefresh?: () => void;
    onManage: (id: string) => void;
    onEdit: (id: string) => void;
    onResults: (id: string) => void;
};

export default function CreatedSurveys({
    surveys,
    onCreateNew,
    onQuickPublishTest,
    isQuickPublishing = false,
    onQuickVoteTest,
    canQuickVoteTest = false,
    isQuickVoting = false,
    isRefreshing = false,
    onRefresh,
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
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={onRefresh}
                        tintColor={palette.primary}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyTitle}>No created surveys yet</Text>
                        <Text style={styles.emptyText}>
                            Create a survey or pull down to refresh your registry-backed list.
                        </Text>
                    </View>
                }
            />

            <View style={styles.stickyWrap}>
                <Pressable
                    onPress={onQuickPublishTest}
                    disabled={isQuickPublishing}
                    android_ripple={{ color: palette.primaryLight }}
                    style={({ pressed }) => [
                        styles.stickyBtn,
                        pressed && !isQuickPublishing && styles.stickyBtnPressed,
                        isQuickPublishing && { opacity: 0.7 },
                    ]}
                >
                    <MaterialIcons
                        name="bolt"
                        size={18}
                        color={palette.white}
                        style={styles.stickyIcon}
                    />
                    <Text style={styles.stickyText}>
                        {isQuickPublishing ? "Publishing to Vocdoni..." : "Create Test Survey on Vocdoni"}
                    </Text>
                </Pressable>

                <Pressable
                    onPress={onQuickVoteTest}
                    disabled={!canQuickVoteTest || isQuickVoting}
                    android_ripple={{ color: palette.primaryLight }}
                    style={({ pressed }) => [
                        styles.secondaryBtn,
                        pressed && canQuickVoteTest && !isQuickVoting && styles.secondaryBtnPressed,
                        (!canQuickVoteTest || isQuickVoting) && styles.secondaryBtnDisabled,
                    ]}
                >
                    <MaterialIcons
                        name="how-to-vote"
                        size={18}
                        color={canQuickVoteTest ? palette.primary : palette.textMuted}
                        style={styles.stickyIcon}
                    />
                    <Text
                        style={[
                            styles.secondaryText,
                            !canQuickVoteTest && styles.secondaryTextDisabled,
                        ]}
                    >
                        {isQuickVoting
                            ? "Submitting Test Vote..."
                            : canQuickVoteTest
                                ? "Vote Latest Test Survey"
                                : "Create Test Survey First"}
                    </Text>
                </Pressable>
                <Pressable
                    onPress={onCreateNew}
                    android_ripple={{ color: palette.primaryLight }}
                    style={({ pressed }) => [
                        styles.secondaryBtn,
                        pressed && styles.secondaryBtnPressed,
                    ]}
                >
                    <MaterialIcons
                        name="add"
                        size={18}
                        color={palette.primary}
                        style={styles.stickyIcon}
                    />
                    <Text style={styles.secondaryText}>Open Survey Builder</Text>
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
        paddingBottom: 226,
    },
    sectionHeader: {
        marginTop: 6,
        marginBottom: 10,
        color: palette.textSecondary,
        fontWeight: "700",
        fontSize: 13,
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
    stickyWrap: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 18,
        gap: 10,
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
    secondaryBtn: {
        height: 50,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.white,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    secondaryBtnPressed: {
        backgroundColor: palette.primaryNegative,
    },
    secondaryBtnDisabled: {
        opacity: 0.7,
    },
    secondaryText: {
        color: palette.primaryDark,
        fontSize: 15,
        fontWeight: "700",
    },
    secondaryTextDisabled: {
        color: palette.textMuted,
    },
});
