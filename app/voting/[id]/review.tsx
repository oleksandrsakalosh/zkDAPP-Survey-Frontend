import React, { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

import { palette } from "@/theme/palette";
import { useVoting } from "@/utils/VotingContext";
import { voteSurvey } from "@/utils/vocdoni/voteSurvey";
import { showAlert } from "@/utils/platformAlert";

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useVoting();
  const insets = useSafeAreaInsets();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const questions = state.survey?.questions ?? [];
  const answers = state.answers;

  const getAnswerLabel = (questionId: string): string => {
    const question = questions.find((q) => q.id === questionId);
    const answer = answers.find((a) => a.questionId === questionId);
    if (!question || !answer) return "—";


    if (answer.selectedOptions.length === 0) return "—";

    const selectedLabels = (question.options ?? [])
      .filter((opt) => answer.selectedOptions.includes(opt.id))
      .map((opt) => opt.label);

    return selectedLabels.join(", ") || "—";
  };

  const answeredCount = answers.filter((a) => {
    const q = questions.find((q) => q.id === a.questionId);
    if (!q) return false;
    return a.selectedOptions.length > 0;
  }).length;
  const requiredQuestionsAnswered = questions.every((question) => {
    if (!question.isRequired) {
      return true;
    }

    const answer = answers.find((item) => item.questionId === question.id);
    return (answer?.selectedOptions ?? []).length > 0;
  });
  const canSubmit = questions.length > 0 && requiredQuestionsAnswered && !isSubmitting;

  const buildVoteChoices = () => {
    return questions.flatMap((question) => {
      const answer = answers.find((item) => item.questionId === question.id);
      const selectedOptions = answer?.selectedOptions ?? [];

      if (question.isRequired && selectedOptions.length === 0) {
        throw new Error(`Question "${question.title}" has not been answered.`);
      }

      return selectedOptions.map((optionId) => {
        const optionIndex = (question.options ?? []).findIndex((option) => option.id === optionId);
        if (optionIndex < 0) {
          throw new Error(`Selected answer for "${question.title}" is no longer available.`);
        }

        return optionIndex;
      });
    });
  };

  const handleSubmit = async () => {
    if (!id || isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);
      const choices = buildVoteChoices();
      if (choices.length === 0) {
        throw new Error("No vote choices selected.");
      }

      const result = await voteSurvey(id, choices);
      console.log("[ReviewScreen] vote submitted", {
        electionId: id,
        voteId: result.voteId,
        alreadyVoted: result.alreadyVoted,
      });
      router.replace(`/voting/${id}/success` as any);
    } catch (error) {
      showAlert(
        "Vote failed",
        error instanceof Error ? error.message : "Unable to submit your vote to Vocdoni."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={20} color={palette.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review & Submit</Text>
      </View>

      {/* ── Content ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Top summary */}
        <View style={styles.summaryBox}>
          <View style={[styles.iconCircle, styles.iconCircleBlue]}>
            <Feather name="check-circle" size={32} color={palette.primary} />
          </View>
          <Text style={styles.summaryTitle}>Ready to Submit?</Text>
          <Text style={styles.summaryText}>
            You&apos;ve answered {answeredCount} of {questions.length} questions.
            Your responses will be securely submitted and verified.
          </Text>
        </View>

        {/* Answered questions grid */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Questions Answered</Text>
          <View style={styles.qGrid}>
            {questions.map((q, i) => {
              const ans = answers.find((a) => a.questionId === q.id);
              const isAnswered = (ans?.selectedOptions ?? []).length > 0;
              return (
                <View
                  key={q.id}
                  style={[
                    styles.qGridItem,
                    isAnswered ? styles.qGridItemDone : styles.qGridItemEmpty,
                  ]}
                >
                  <Text
                    style={[
                      styles.qGridLabel,
                      isAnswered ? styles.qGridLabelDone : styles.qGridLabelEmpty,
                    ]}
                  >
                    Q{i + 1}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Per-question answer review */}
        {questions.map((q, i) => (
          <View key={q.id} style={styles.answerCard}>
            <View style={styles.answerHeader}>
              <Text style={styles.answerIndex}>Q{i + 1}</Text>
              <Text style={styles.answerQuestion}>{q.title}</Text>
            </View>
            <View style={styles.answerDivider} />
            <Text style={styles.answerValue}>{getAnswerLabel(q.id)}</Text>
          </View>
        ))}
      </ScrollView>

      {/* ── Action Bar ── */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={palette.white} />
          ) : (
            <Feather name="check" size={16} color={palette.white} />
          )}
          <Text style={styles.submitBtnText}>
            {isSubmitting ? "Submitting..." : "Confirm & Submit"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
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
  summaryBox: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: palette.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  iconCircleBlue: {
    backgroundColor: palette.primaryNegative,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: palette.primaryDark,
    marginBottom: 8,
    textAlign: "center",
  },
  summaryText: {
    fontSize: 14,
    color: palette.textSecondary,
    lineHeight: 21,
    textAlign: "center",
    maxWidth: 280,
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
    marginBottom: 14,
  },
  qGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  qGridItem: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  qGridItemDone: {
    backgroundColor: palette.primaryNegative,
    borderColor: palette.primary,
  },
  qGridItemEmpty: {
    backgroundColor: palette.surfaceMuted,
    borderColor: palette.border,
  },
  qGridLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  qGridLabelDone: {
    color: palette.primary,
  },
  qGridLabelEmpty: {
    color: palette.textSecondary,
  },
  answerCard: {
    backgroundColor: palette.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
  },
  answerHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  answerIndex: {
    fontSize: 12,
    fontWeight: "700",
    color: palette.white,
    backgroundColor: palette.primary,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    overflow: "hidden",
    marginTop: 1,
  },
  answerQuestion: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: palette.primaryDark,
    lineHeight: 20,
  },
  answerDivider: {
    height: 1,
    backgroundColor: palette.border,
    marginBottom: 10,
  },
  answerValue: {
    fontSize: 14,
    color: palette.textSecondary,
    lineHeight: 20,
  },
  actionBar: {
    backgroundColor: palette.white,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 10,
  },
  submitBtn: {
    backgroundColor: palette.primary,
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  submitBtnDisabled: {
    opacity: 0.45,
  },
  submitBtnText: {
    color: palette.white,
    fontSize: 15,
    fontWeight: "700",
  },
});


