import React, { useEffect } from "react";
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

import { SurveyDetail } from "@/domain/models";
import { palette } from "@/theme/palette";
import { useVoting } from "@/utils/VotingContext";

// ─── Mock survey detail data ──────────────────────────────────────────────────

const SURVEY_DETAILS: Record<string, SurveyDetail> = {
  "1": {
    id: "1",
    title: "Fitness App Usage Habits",
    description:
      "How often do you use fitness apps and what features matter most? This 5-question study helps shape the future of digital health and fitness experiences. Your responses are anonymous and securely processed.",
    status: "active",
    categories: [
      { id: "health", label: "Health" },
      { id: "lifestyle", label: "Lifestyle" },
    ],
    budget: { rewardPerVoter: { amount: 2, currency: "USD" } },
    progress: { responseCount: 88, targetResponses: 200 },
    estimatedMinutes: 5,
    timeInfo: {
      closesAt: "2026-03-20T23:59:00Z",
      daysRemaining: 4,
      isOpen: true,
      displayLabel: "Mar 16 – Mar 20, 2026",
    },
    requirements: [{ id: "r1", type: "Age", value: "18+" }],
    canParticipate: true,
    hasVoted: false,
    questions: [
      {
        id: "q1", order: 1, type: "single_choice", isRequired: true,
        title: "How often do you use fitness apps?",
        options: [
          { id: "o1", label: "Daily", order: 1 },
          { id: "o2", label: "3–5 times per week", order: 2 },
          { id: "o3", label: "Once a week", order: 3 },
          { id: "o4", label: "Rarely", order: 4 },
          { id: "o5", label: "Never", order: 5 },
        ],
      },
      {
        id: "q2", order: 2, type: "multiple_choice", isRequired: true,
        title: "Which features do you use most? (Select all that apply)",
        options: [
          { id: "o1", label: "Workout tracking", order: 1 },
          { id: "o2", label: "Nutrition logging", order: 2 },
          { id: "o3", label: "Sleep tracking", order: 3 },
          { id: "o4", label: "Heart rate monitoring", order: 4 },
          { id: "o5", label: "Social challenges", order: 5 },
        ],
      },
      {
        id: "q3", order: 3, type: "single_choice", isRequired: true,
        title: "How satisfied are you with your current fitness app?",
        options: [
          { id: "o1", label: "Very Satisfied", order: 1 },
          { id: "o2", label: "Satisfied", order: 2 },
          { id: "o3", label: "Neutral", order: 3 },
          { id: "o4", label: "Dissatisfied", order: 4 },
          { id: "o5", label: "Very Dissatisfied", order: 5 },
        ],
      },
      {
        id: "q4", order: 4, type: "single_choice", isRequired: true,
        title: "Would you recommend your fitness app to others?",
        options: [
          { id: "o1", label: "Definitely yes", order: 1 },
          { id: "o2", label: "Probably yes", order: 2 },
          { id: "o3", label: "Not sure", order: 3 },
          { id: "o4", label: "Probably no", order: 4 },
          { id: "o5", label: "Definitely no", order: 5 },
        ],
      },
      {
        id: "q5", order: 5, type: "textarea", isRequired: false,
        title: "What improvements would you like to see in fitness apps?",
      },
    ],
  },
  "2": {
    id: "2",
    title: "Prescription Drug Affordability",
    description:
      "Share your experience with prescription costs and insurance coverage. This anonymous survey helps policymakers better understand the real-world impact of drug pricing on everyday people.",
    status: "active",
    categories: [
      { id: "health", label: "Health" },
      { id: "finance", label: "Finance" },
    ],
    budget: { rewardPerVoter: { amount: 3.5, currency: "USD" } },
    progress: { responseCount: 203, targetResponses: 400 },
    estimatedMinutes: 8,
    timeInfo: {
      closesAt: "2026-04-01T23:59:00Z",
      daysRemaining: 16,
      isOpen: true,
      displayLabel: "Mar 16 – Apr 1, 2026",
    },
    requirements: [
      { id: "r1", type: "Age", value: "25+" },
      { id: "r2", type: "Location", value: "US" },
    ],
    canParticipate: true,
    hasVoted: false,
    questions: [
      {
        id: "q1", order: 1, type: "single_choice", isRequired: true,
        title: "How often do you struggle to afford prescription medications?",
        options: [
          { id: "o1", label: "Never", order: 1 },
          { id: "o2", label: "Rarely", order: 2 },
          { id: "o3", label: "Sometimes", order: 3 },
          { id: "o4", label: "Often", order: 4 },
          { id: "o5", label: "Always", order: 5 },
        ],
      },
      {
        id: "q2", order: 2, type: "multiple_choice", isRequired: true,
        title: "Which factors affect your ability to afford medications? (Select all that apply)",
        options: [
          { id: "o1", label: "High copays", order: 1 },
          { id: "o2", label: "No insurance", order: 2 },
          { id: "o3", label: "Insurance gaps", order: 3 },
          { id: "o4", label: "High out-of-pocket costs", order: 4 },
        ],
      },
      {
        id: "q3", order: 3, type: "single_choice", isRequired: true,
        title: "Have you ever skipped a prescription due to cost?",
        options: [
          { id: "o1", label: "Yes, frequently", order: 1 },
          { id: "o2", label: "Yes, occasionally", order: 2 },
          { id: "o3", label: "No", order: 3 },
        ],
      },
      {
        id: "q4", order: 4, type: "textarea", isRequired: false,
        title: "What would most help you manage prescription drug costs?",
      },
    ],
  },
  "3": {
    id: "3",
    title: "Remote Work Tool Preferences",
    description:
      "Help us compare productivity tools used by distributed teams across different industries. Your insights will help build better remote-work solutions for teams worldwide.",
    status: "active",
    categories: [
      { id: "tech", label: "Tech" },
      { id: "productivity", label: "Productivity" },
    ],
    budget: { rewardPerVoter: { amount: 1.25, currency: "USD" } },
    progress: { responseCount: 52, targetResponses: 180 },
    estimatedMinutes: 6,
    timeInfo: {
      closesAt: "2026-03-30T23:59:00Z",
      daysRemaining: 14,
      isOpen: true,
      displayLabel: "Mar 16 – Mar 30, 2026",
    },
    requirements: [{ id: "r1", type: "Age", value: "18+" }],
    canParticipate: true,
    hasVoted: false,
    questions: [
      {
        id: "q1", order: 1, type: "single_choice", isRequired: true,
        title: "How many days per week do you work remotely?",
        options: [
          { id: "o1", label: "Full-time (5 days)", order: 1 },
          { id: "o2", label: "4 days", order: 2 },
          { id: "o3", label: "3 days", order: 3 },
          { id: "o4", label: "1–2 days", order: 4 },
          { id: "o5", label: "I don't work remotely", order: 5 },
        ],
      },
      {
        id: "q2", order: 2, type: "multiple_choice", isRequired: true,
        title: "Which collaboration tools does your team use? (Select all that apply)",
        options: [
          { id: "o1", label: "Slack / Teams", order: 1 },
          { id: "o2", label: "Zoom / Meet", order: 2 },
          { id: "o3", label: "Notion / Confluence", order: 3 },
          { id: "o4", label: "Jira / Asana", order: 4 },
          { id: "o5", label: "GitHub / GitLab", order: 5 },
        ],
      },
      {
        id: "q3", order: 3, type: "single_choice", isRequired: true,
        title: "Overall, how productive do you feel working remotely?",
        options: [
          { id: "o1", label: "Much more productive", order: 1 },
          { id: "o2", label: "Slightly more productive", order: 2 },
          { id: "o3", label: "About the same", order: 3 },
          { id: "o4", label: "Less productive", order: 4 },
        ],
      },
      {
        id: "q4", order: 4, type: "textarea", isRequired: false,
        title: "What's the biggest challenge you face while working remotely?",
      },
    ],
  },
  "4": {
    id: "4",
    title: "Personal Banking Mobile UX",
    description:
      "Tell us what works and what does not in your banking app experience over the last 3 months. Your feedback helps banks improve their mobile products for everyone.",
    status: "active",
    categories: [
      { id: "finance", label: "Finance" },
      { id: "tech", label: "Tech" },
    ],
    budget: { rewardPerVoter: { amount: 2.75, currency: "USD" } },
    progress: { responseCount: 119, targetResponses: 250 },
    estimatedMinutes: 7,
    timeInfo: {
      closesAt: "2026-04-10T23:59:00Z",
      daysRemaining: 25,
      isOpen: true,
      displayLabel: "Mar 16 – Apr 10, 2026",
    },
    requirements: [
      { id: "r1", type: "Age", value: "21+" },
    ],
    canParticipate: true,
    hasVoted: false,
    questions: [
      {
        id: "q1", order: 1, type: "single_choice", isRequired: true,
        title: "How often do you use your bank's mobile app?",
        options: [
          { id: "o1", label: "Multiple times a day", order: 1 },
          { id: "o2", label: "Daily", order: 2 },
          { id: "o3", label: "A few times a week", order: 3 },
          { id: "o4", label: "Once a week", order: 4 },
          { id: "o5", label: "Rarely", order: 5 },
        ],
      },
      {
        id: "q2", order: 2, type: "multiple_choice", isRequired: true,
        title: "Which features do you use most in your banking app? (Select all that apply)",
        options: [
          { id: "o1", label: "Balance / transactions", order: 1 },
          { id: "o2", label: "Money transfers", order: 2 },
          { id: "o3", label: "Bill payments", order: 3 },
          { id: "o4", label: "Card management", order: 4 },
          { id: "o5", label: "Savings / investments", order: 5 },
        ],
      },
      {
        id: "q3", order: 3, type: "single_choice", isRequired: true,
        title: "How satisfied are you with your banking app overall?",
        options: [
          { id: "o1", label: "Very Satisfied", order: 1 },
          { id: "o2", label: "Satisfied", order: 2 },
          { id: "o3", label: "Neutral", order: 3 },
          { id: "o4", label: "Dissatisfied", order: 4 },
          { id: "o5", label: "Very Dissatisfied", order: 5 },
        ],
      },
      {
        id: "q4", order: 4, type: "single_choice", isRequired: true,
        title: "Have you experienced technical issues with your banking app in the past month?",
        options: [
          { id: "o1", label: "Yes, frequently", order: 1 },
          { id: "o2", label: "Yes, occasionally", order: 2 },
          { id: "o3", label: "No issues", order: 3 },
        ],
      },
      {
        id: "q5", order: 5, type: "textarea", isRequired: false,
        title: "What feature would most improve your banking app experience?",
      },
    ],
  },
};

// ─── Category tag colors ──────────────────────────────────────────────────────

const CAT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Health:       { bg: palette.successLight, text: palette.success, border: palette.success },
  Finance:      { bg: palette.primaryNegative, text: palette.primary, border: palette.primary },
  Tech:         { bg: palette.primaryNegative, text: palette.primary, border: palette.primary },
  Productivity: { bg: palette.surfaceMuted, text: palette.textSecondary, border: palette.border },
  Lifestyle:    { bg: palette.orangeLight, text: palette.orange, border: palette.orange },
  Gaming:       { bg: palette.primaryNegative, text: palette.primary, border: palette.primary },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function SurveyDetailsScreen() {
  const { id, surveyJson, electionId } = useLocalSearchParams<{
    id: string;
    surveyJson?: string;
    electionId?: string;
  }>();
  const { setSurvey, setElectionId } = useVoting();
  const insets = useSafeAreaInsets();

  // Если передан surveyJson — используем его (реальный published election).
  // Иначе — берём из статичного словаря (dummy surveys из Explore).
  let survey: SurveyDetail | null = null;

  if (surveyJson) {
    try {
      survey = JSON.parse(surveyJson) as SurveyDetail;
    } catch {
      survey = null;
    }
  } else {
    survey = id ? (SURVEY_DETAILS[id] ?? null) : null;
  }

  if (!survey) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.centerBox}>
          <ActivityIndicator color={palette.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const handleStart = () => {
    setSurvey(survey!);
    // Если это реальный Vocdoni election — сохраняем electionId в контексте
    if (electionId) {
      setElectionId(electionId);
    }
    router.push(`/voting/${id}/eligibility` as any);
  };

  const questionCount = survey.questions?.length ?? 0;
  const responseCount = survey.progress?.responseCount ?? 0;
  const estimatedTime = survey.estimatedMinutes ?? 5;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={20} color={palette.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {survey.title}
        </Text>
      </View>

      {/* ── Scrollable Content ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Survey Stats */}
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

        {/* Timeline */}
        {survey.timeInfo && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Timeline</Text>
            <View style={styles.timelineRow}>
              <Feather name="calendar" size={15} color={palette.textSecondary} />
              <Text style={styles.timelineText}>{survey.timeInfo.displayLabel}</Text>
            </View>
            {survey.timeInfo.daysRemaining != null && (
              <Text style={styles.daysRemaining}>
                ⏱ {survey.timeInfo.daysRemaining} days remaining
              </Text>
            )}
          </View>
        )}

        {/* Categories */}
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

        {/* Reward */}
        {survey.budget?.rewardPerVoter && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Reward</Text>
            <View style={styles.rewardBadge}>
              <Feather name="award" size={16} color={palette.success} />
              <Text style={styles.rewardText}>
                {survey.budget.rewardPerVoter.amount}{" "}
                {survey.budget.rewardPerVoter.currency} upon completion
              </Text>
            </View>
          </View>
        )}

        {/* Requirements */}
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

        {/* Description */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Description</Text>
          <Text style={styles.description}>{survey.description}</Text>
        </View>

        {/* Vocdoni badge — показываем только для реальных elections */}
        {electionId && (
          <View style={styles.vocdoniCard}>
            <Feather name="shield" size={14} color={palette.primary} />
            <Text style={styles.vocdoniText}>
              Live Vocdoni election · your vote will be recorded on-chain
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ── Action Bar ── */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={styles.startBtn} onPress={handleStart}>
          <Text style={styles.startBtnText}>Start Voting</Text>
          <Feather name="chevron-right" size={16} color={palette.white} />
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
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
  vocdoniCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: palette.primaryNegative,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  vocdoniText: {
    flex: 1,
    fontSize: 13,
    color: palette.primary,
    fontWeight: "600",
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
