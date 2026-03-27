import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { palette } from "@/theme/palette";
import { useVoting } from "@/utils/VotingContext";

// ─── Component ────────────────────────────────────────────────────────────────

export default function SuccessScreen() {
  const { state, reset } = useVoting();
  const insets = useSafeAreaInsets();

  const handleBackToHome = () => {
    reset();
    router.replace("/(tabs)/explore");
  };

  const submittedAt = new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const reward = state.survey?.budget?.rewardPerVoter;
  const surveyTitle = state.survey?.title ?? "Survey";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Vote Submitted</Text>
      </View>

      {/* ── Content ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.centeredBox}>
          <View style={[styles.iconCircle, styles.iconCircleGreen]}>
            <Feather name="check" size={32} color={palette.success} />
          </View>
          <Text style={styles.centeredTitle}>Thank You!</Text>
          <Text style={styles.centeredText}>
            Your vote has been successfully recorded. Thank you for
            participating in "{surveyTitle}".
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Vote Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailKey}>Survey</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {surveyTitle}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailKey}>Submitted</Text>
            <Text style={styles.detailValue}>{submittedAt}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailKey}>Status</Text>
            <View style={styles.statusPill}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Verified</Text>
            </View>
          </View>
        </View>

        <View style={styles.infoBox}>
          <View style={styles.infoIconWrap}>
            <Feather name="shield" size={16} color={palette.primary} />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoText}>
              <Text style={styles.infoStrong}>Your privacy is protected. </Text>
              We verify eligibility without revealing your identity.
            </Text>
          </View>
        </View>

        {reward && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Reward</Text>
            <View style={styles.rewardBadge}>
              <Feather name="award" size={16} color={palette.success} />
              <Text style={styles.rewardText}>
                {reward.amount} {reward.currency}
              </Text>
            </View>
            <Text style={styles.rewardNote}>
              Reward will be distributed after the survey closes.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={styles.homeBtn} onPress={handleBackToHome}>
            <MaterialIcons name="search" size={16} color={palette.white} />
          <Text style={styles.homeBtnText}>Back to Explore</Text>
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
    backgroundColor: palette.white,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: palette.primaryDark,
    textAlign: "left",
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
  centeredBox: {
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
  iconCircleGreen: {
    backgroundColor: palette.successLight,
  },
  centeredTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: palette.primaryDark,
    marginBottom: 10,
    textAlign: "center",
  },
  centeredText: {
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
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: palette.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 10,
    marginBottom: 6,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  detailKey: {
    fontSize: 13,
    color: palette.textSecondary,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "600",
    color: palette.primaryDark,
    maxWidth: "60%",
    textAlign: "right",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.success,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
    color: palette.success,
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
    marginVertical: 8,
  },
  rewardText: {
    fontSize: 15,
    fontWeight: "700",
    color: palette.success,
  },
  rewardNote: {
    fontSize: 12,
    color: palette.textSecondary,
    lineHeight: 18,
    marginBottom: 10,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: palette.primaryNegative,
    borderRadius: 10,
    padding: 14,
  },
  infoText: {
    fontSize: 13,
    color: palette.primary,
    lineHeight: 19,
  },
  infoIconWrap: {
    width: 16,
    alignItems: "center",
  },
  infoContent: {
    flex: 1,
  },
  infoStrong: {
    fontWeight: "700",
  },
  actionBar: {
    backgroundColor: palette.white,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  homeBtn: {
    backgroundColor: palette.primary,
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  homeBtnText: {
    color: palette.white,
    fontSize: 15,
    fontWeight: "700",
  },
});



