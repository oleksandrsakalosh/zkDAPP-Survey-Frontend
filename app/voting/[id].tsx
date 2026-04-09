import Feather from "@expo/vector-icons/Feather";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { SurveyDetail } from "@/domain/models";
import { palette } from "@/theme/palette";
import { loadRegisteredSurveyDetail } from "@/utils/registry/feed";
import { useVoting } from "@/utils/VotingContext";

const CAT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Health: { bg: palette.successLight, text: palette.success, border: palette.success },
  Finance: { bg: palette.primaryNegative, text: palette.primary, border: palette.primary },
  Tech: { bg: palette.primaryNegative, text: palette.primary, border: palette.primary },
  Productivity: { bg: palette.surfaceMuted, text: palette.textSecondary, border: palette.border },
  Lifestyle: { bg: palette.orangeLight, text: palette.orange, border: palette.orange },
};

export default function SurveyDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { setSurvey } = useVoting();
  const insets = useSafeAreaInsets();

  const [survey, setLoadedSurvey] = useState<SurveyDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadSurvey = async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        if (!id) {
          throw new Error("Missing survey id.");
        }

        const registryItem = await loadRegisteredSurveyDetail(id);

        if (!registryItem) {
          throw new Error("Survey not found in the public registry.");
        }

        if (!isMounted) {
          return;
        }

        setLoadedSurvey(registryItem.detail);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setLoadedSurvey(null);
        setErrorMessage(error instanceof Error ? error.message : "Unable to load survey details.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadSurvey();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.centerBox}>
          <ActivityIndicator color={palette.primary} />
          <Text style={styles.loadingText}>Loading survey details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!survey) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.centerBox}>
          <Text style={styles.errorTitle}>Survey unavailable</Text>
          <Text style={styles.errorText}>{errorMessage ?? "Unable to load this survey."}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
            <Text style={styles.retryButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleStart = () => {
    setSurvey(survey);
    router.push(`/voting/${id}/eligibility` as any);
  };

  const questionCount = survey.questions?.length ?? 0;
  const responseCount = survey.progress?.responseCount ?? 0;
  const estimatedTime = survey.estimatedMinutes ?? 5;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={20} color={palette.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {survey.title}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Survey Info</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{questionCount}</Text>
              <Text style={styles.statLabel}>Questions</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{estimatedTime} min</Text>
              <Text style={styles.statLabel}>Est. Time</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{responseCount.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Responses</Text>
            </View>
          </View>
        </View>

        {survey.timeInfo && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Timeline</Text>
            <View style={styles.timelineRow}>
              <Feather name="calendar" size={15} color={palette.textSecondary} />
              <Text style={styles.timelineText}>{survey.timeInfo.displayLabel}</Text>
            </View>
            {survey.timeInfo.daysRemaining != null && (
              <Text style={styles.daysRemaining}>
                {survey.timeInfo.daysRemaining} days remaining
              </Text>
            )}
          </View>
        )}

        {survey.categories.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Categories</Text>
            <View style={styles.tagsRow}>
              {survey.categories.map((cat) => {
                const colors = CAT_COLORS[cat.label] ?? {
                  bg: palette.surfaceMuted,
                  text: palette.textSecondary,
                  border: palette.border,
                };
                return (
                  <View
                    key={cat.id}
                    style={[
                      styles.tag,
                      { backgroundColor: colors.bg, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.tagText, { color: colors.text }]}>{cat.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {survey.budget?.rewardPerVoter && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Reward</Text>
            <View style={styles.rewardBadge}>
              <Feather name="award" size={16} color={palette.success} />
              <Text style={styles.rewardText}>
                {survey.budget.rewardPerVoter.amount} {survey.budget.rewardPerVoter.currency} upon completion
              </Text>
            </View>
          </View>
        )}

        {survey.requirements && survey.requirements.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Requirements</Text>
            {survey.requirements.map((req) => (
              <View key={req.id} style={styles.requirementRow}>
                <Feather name="check-circle" size={14} color={palette.primary} />
                <Text style={styles.requirementText}>
                  {req.type}: {req.value}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Description</Text>
          <Text style={styles.description}>{survey.description}</Text>
        </View>
      </ScrollView>

      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={styles.startBtn} onPress={handleStart}>
          <Text style={styles.startBtnText}>Start Voting</Text>
          <Feather name="chevron-right" size={16} color={palette.white} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 10,
  },
  loadingText: {
    color: palette.textSecondary,
    fontSize: 14,
  },
  errorTitle: {
    color: palette.primaryDark,
    fontSize: 18,
    fontWeight: "700",
  },
  errorText: {
    color: palette.textSecondary,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
  },
  retryButton: {
    marginTop: 8,
    backgroundColor: palette.primary,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  retryButtonText: {
    color: palette.white,
    fontWeight: "700",
    fontSize: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: palette.white,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: palette.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: palette.primaryDark,
  },
  scroll: {
    flex: 1,
    backgroundColor: palette.surfaceSoft,
  },
  content: {
    padding: 16,
    paddingBottom: 8,
    gap: 12,
  },
  card: {
    backgroundColor: palette.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 18,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: palette.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: palette.border,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "700",
    color: palette.primaryDark,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: palette.textSecondary,
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  timelineText: {
    fontSize: 15,
    fontWeight: "600",
    color: palette.primaryDark,
  },
  daysRemaining: {
    fontSize: 13,
    fontWeight: "600",
    color: palette.orange,
    marginTop: 2,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  tagText: {
    fontSize: 12,
    fontWeight: "600",
  },
  rewardBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: palette.successLight,
    borderWidth: 1.5,
    borderColor: palette.success,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: "flex-start",
  },
  rewardText: {
    fontSize: 14,
    fontWeight: "700",
    color: palette.success,
  },
  requirementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  requirementText: {
    fontSize: 14,
    color: palette.primaryDark,
    fontWeight: "500",
  },
  description: {
    fontSize: 14,
    color: palette.textSecondary,
    lineHeight: 22,
  },
  actionBar: {
    backgroundColor: palette.white,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  startBtn: {
    backgroundColor: palette.primary,
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  startBtnText: {
    color: palette.white,
    fontSize: 15,
    fontWeight: "700",
  },
});
