import React, { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

import { SurveyQuestion } from "@/domain/models";
import { palette } from "@/theme/palette";
import { useVoting } from "@/utils/VotingContext";

// ─── Component ────────────────────────────────────────────────────────────────

export default function QuestionsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, setAnswer } = useVoting();
  const insets = useSafeAreaInsets();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [textAreaHeight, setTextAreaHeight] = useState(130);

  const questions = state.survey?.questions ?? [];
  const totalQuestions = questions.length;
  const question = questions[currentIndex] as SurveyQuestion | undefined;
  const answer = state.answers.find((a) => a.questionId === question?.id);

  // Keep hooks unconditional across renders to avoid hook-order mismatch.
  useEffect(() => {
    setTextAreaHeight(130);
  }, [question?.id]);

  if (!question) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>No questions found.</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.linkText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Answer helpers ──

  const toggleSingleOption = (optionId: string) => {
    setAnswer({
      questionId: question.id,
      type: question.type,
      selectedOptions: [optionId],
      textValue: "",
    });
  };

  const toggleMultiOption = (optionId: string) => {
    const current = answer?.selectedOptions ?? [];
    const next = current.includes(optionId)
      ? current.filter((o) => o !== optionId)
      : [...current, optionId];
    setAnswer({
      questionId: question.id,
      type: question.type,
      selectedOptions: next,
      textValue: "",
    });
  };

  const handleTextChange = (text: string) => {
    setAnswer({
      questionId: question.id,
      type: question.type,
      selectedOptions: [],
      textValue: text,
    });
  };

  // ── Navigation ──

  const canGoNext = !question.isRequired || (answer && (answer.selectedOptions.length > 0 || answer.textValue));

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      router.push(`/voting/${id}/review` as any);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  };

  const isLast = currentIndex === totalQuestions - 1;
  const isFirst = currentIndex === 0;


  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={20} color={palette.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {state.survey?.title ?? "Survey"}
        </Text>
      </View>

      {/* ── Progress bar ── */}
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            { width: `${((currentIndex + 1) / totalQuestions) * 100}%` },
          ]}
        />
      </View>

      {/* ── Content ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.counter}>
          QUESTION {currentIndex + 1} OF {totalQuestions}
        </Text>

        <Text style={styles.questionTitle}>{question.title}</Text>

        {/* ── Single choice ── */}
        {question.type === "single_choice" &&
          (question.options ?? []).map((opt) => {
            const selected = answer?.selectedOptions.includes(opt.id);
            return (
              <TouchableOpacity
                key={opt.id}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => toggleSingleOption(opt.id)}
                activeOpacity={0.75}
              >
                <View style={[styles.radio, selected && styles.radioSelected]}>
                  {selected && <View style={styles.radioDot} />}
                </View>
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}

        {/* ── Multiple choice ── */}
        {question.type === "multiple_choice" &&
          (question.options ?? []).map((opt) => {
            const selected = answer?.selectedOptions.includes(opt.id);
            return (
              <TouchableOpacity
                key={opt.id}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => toggleMultiOption(opt.id)}
                activeOpacity={0.75}
              >
                <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                  {selected && (
                    <Feather name="check" size={12} color={palette.white} />
                  )}
                </View>
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}

      
        {/* ── Progress dots ── */}
        <View style={styles.dots}>
          {questions.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i < currentIndex && styles.dotDone,
                i === currentIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>
      </ScrollView>

      {/* ── Action Bar ── */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.btnRow}>
          {!isFirst && (
            <TouchableOpacity style={styles.secondaryBtn} onPress={handlePrev}>
              <Feather name="chevron-left" size={16} color={palette.textSecondary} />
              <Text style={styles.secondaryBtnText}>Previous</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              !isFirst && styles.primaryBtnFlex,
              !canGoNext && styles.primaryBtnDisabled,
            ]}
            onPress={handleNext}
            disabled={!canGoNext}
          >
            <Text style={styles.primaryBtnText}>
              {isLast ? "Review Answers" : "Next"}
            </Text>
            <Feather name="chevron-right" size={16} color={palette.white} />
          </TouchableOpacity>
        </View>
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
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  errorText: {
    fontSize: 15,
    color: palette.textSecondary,
  },
  linkText: {
    fontSize: 15,
    color: palette.primary,
    fontWeight: "600",
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
  progressBar: {
    height: 3,
    backgroundColor: palette.primaryLight,
  },
  progressFill: {
    height: "100%",
    backgroundColor: palette.primary,
  },
  scroll: {
    flex: 1,
    backgroundColor: palette.surfaceSoft,
  },
  content: {
    padding: 24,
    paddingBottom: 12,
  },
  counter: {
    fontSize: 12,
    fontWeight: "700",
    color: palette.textSecondary,
    letterSpacing: 0.8,
    fontVariant: ["tabular-nums"],
    marginBottom: 20,
    textAlign: "center",
  },
  questionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: palette.primaryDark,
    lineHeight: 28,
    marginBottom: 28,
    textAlign: "center",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: palette.white,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: palette.border,
    padding: 16,
    marginBottom: 10,
  },
  optionSelected: {
    borderColor: palette.primary,
    borderWidth: 2,
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: palette.primaryDark,
  },
  optionTextSelected: {
    color: palette.primary,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: palette.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: palette.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.primary,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: palette.border,
    backgroundColor: palette.white,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  textArea: {
    backgroundColor: palette.white,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: palette.border,
    padding: 16,
    fontSize: 15,
    color: palette.primaryDark,
    minHeight: 130,
    lineHeight: 22,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 7,
    marginTop: 36,
    marginBottom: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.border,
  },
  dotActive: {
    backgroundColor: palette.primary,
  },
  dotDone: {
    backgroundColor: palette.primaryLight,
  },
  actionBar: {
    backgroundColor: palette.white,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: palette.border,
    paddingVertical: 14,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: palette.textSecondary,
  },
  primaryBtn: {
    flex: 2,
    backgroundColor: palette.primary,
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  primaryBtnFlex: {
    flex: 1,
  },
  primaryBtnDisabled: {
    opacity: 0.45,
  },
  primaryBtnText: {
    color: palette.white,
    fontSize: 15,
    fontWeight: "700",
  },
});



