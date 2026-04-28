import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";


import { palette } from "@/theme/palette";
import { useVoting } from "@/utils/VotingContext";
import { SD_JWT_MOCK_TOKENS } from "@/utils/sdjwt/mockTookens";
import { buildEligibilityCircuitInputFromToken, EligibilityCircuitInput } from "@/utils/sdjwt/eligibilityInput";
import { extractNumericValue } from "@/utils/requirementAttributeMap";
import { getUtcPlus2YyyyMmDd } from "@/utils/zk/proofChecks";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "select-mock" | "generating" | "confirmed" | "error";

type RequirementCheckResult = {
  requirementId: string;
  requirementType: string;
  requirementValue: string;
  status: "pending" | "generating" | "ok" | "failed";
  message: string;
  attributeValue?: string;
  minValue?: number;
  inputPath?: string;
};

// ─── Utility Functions ─────────────────────────────────────────────────────────

function normalizeYyyyMmDd(value: unknown, label: string): string {
  const asString = String(value ?? "").trim();
  if (!/^\d{8}$/.test(asString)) {
    throw new Error(`${label} must be in yyyymmdd format.`);
  }
  return asString;
}

async function getZkeyPath(): Promise<string> {
  const RNFS = (await import("react-native-fs")).default;
  const filename = "eligibility.zkey";
  const destPath = RNFS.DocumentDirectoryPath + "/" + filename;
  if (!(await RNFS.exists(destPath))) {
    await RNFS.copyFileAssets("custom/" + filename, destPath);
  }
  return destPath;
}

function toMoproInputs(input: EligibilityCircuitInput): Record<string, string[]> {
  return {
    pubKey: [...input.pubKey],
    signatureR8: [...input.signatureR8],
    signatureS: [input.signatureS],
    merkleRoot: [input.merkleRoot],
    leaves: [...input.leaves],
    numLeaves: [input.numLeaves],
    dobSalt: [input.dobSalt],
    dobKey: [input.dobKey],
    dobValue: [input.dobValue],
    expSalt: [input.expSalt],
    expKey: [input.expKey],
    expValue: [input.expValue],
    currentDate: [input.currentDate],
    minAge: [input.minAge],
    enableAgeCheck: [input.enableAgeCheck],
  };
}

function resolveAgeRequirement(requirements: Array<{ type: string; value: string }>): { enableAgeCheck: string; minAge: string } {
  const ageRequirement = requirements.find((requirement) => requirement.type === "Age");
  if (!ageRequirement) {
    return { enableAgeCheck: "0", minAge: "0" };
  }

  const minAge = extractNumericValue(ageRequirement.value);
  if (minAge == null) {
    throw new Error(`Could not extract an age value from "${ageRequirement.value}".`);
  }

  return { enableAgeCheck: "1", minAge: String(minAge) };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EligibilityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { state } = useVoting();

  const [step, setStep] = useState<Step>("select-mock");
  const [selectedMockId, setSelectedMockId] = useState<string>(SD_JWT_MOCK_TOKENS[0]?.id ?? "");
  const [requirementChecks, setRequirementChecks] = useState<RequirementCheckResult[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const survey = state.survey;
  const requirements = useMemo(() => survey?.requirements ?? [], [survey?.requirements]);

  const logProof = (message: string) => {
    console.log(`[Eligibility] ${message}`);
  };

  // Initialize requirement checks
  useEffect(() => {
    const checks: RequirementCheckResult[] = (requirements ?? []).map((req) => ({
      requirementId: req.id,
      requirementType: req.type,
      requirementValue: req.value,
      status: "pending",
      message: "",
    }));
    setRequirementChecks(checks);
  }, [requirements]);

  // Defensive fallback: if this screen is opened for a survey without requirements,
  // skip verification and continue directly to questions.
  useEffect(() => {
    if (!survey || !id) return;
    if (requirements.length === 0) {
      logProof("Survey has no eligibility requirements. Skipping verification.");
      router.replace(`/voting/${id}/questions` as any);
    }
  }, [id, requirements.length, survey]);

  const selectedMock = SD_JWT_MOCK_TOKENS.find((m) => m.id === selectedMockId);

  // ── Phase 1: Parse SD-JWT and start verification ──
  const handleStartVerification = async () => {
    if (!selectedMock?.token) {
      setErrorMessage("No mock SD-JWT selected.");
      return;
    }

    if (!requirements.length) {
      logProof("No survey requirements were found. Skipping verification.");
      router.replace(`/voting/${id}/questions` as any);
      return;
    }

    try {
      setStep("generating");
      setErrorMessage("");
      logProof(`Selected mock: ${selectedMock.label}`);
      logProof(`Survey requirements: ${requirements.map((req) => `${req.type} ${req.value}`).join(", ")}`);
      const eligibilitySettings = resolveAgeRequirement(requirements);
      const proofInput = buildEligibilityCircuitInputFromToken(selectedMock.token, {
        currentDate: normalizeYyyyMmDd(getUtcPlus2YyyyMmDd(), "Current date"),
        minAge: eligibilitySettings.minAge,
        enableAgeCheck: eligibilitySettings.enableAgeCheck,
      });

      const surveyId = String(survey?.id ?? id ?? "survey");
      const result: RequirementCheckResult = {
        requirementId: surveyId,
        requirementType: "Eligibility",
        requirementValue: eligibilitySettings.enableAgeCheck === "1" ? `Age ${eligibilitySettings.minAge}+` : "No age check",
        status: "generating",
        message: "Generating proof...",
      };

      setRequirementChecks([result]);
      logProof(`Prepared eligibility proof for survey ${surveyId}. enableAgeCheck=${eligibilitySettings.enableAgeCheck}, minAge=${eligibilitySettings.minAge}`);

      const zkeyPath = await getZkeyPath();
      logProof(`Using zkey at: ${zkeyPath}`);

      const { generateCircomProof, verifyCircomProof, ProofLib } = await import("mopro-ffi");
      const proofResult = generateCircomProof(
        zkeyPath,
        JSON.stringify(toMoproInputs(proofInput)),
        ProofLib.Arkworks,
      );
      logProof("Proof generated. Verifying...");

      const isValid = verifyCircomProof(zkeyPath, proofResult, ProofLib.Arkworks);
      if (!isValid) {
        throw new Error("Proof verification failed.");
      }

      result.status = "ok";
      result.message = "Proof generation OK";
      setRequirementChecks([result]);
      setStep("confirmed");
      logProof("Eligibility proof verification succeeded.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unexpected error.");
      setStep("error");
      setRequirementChecks([
        {
          requirementId: String(survey?.id ?? id ?? "survey"),
          requirementType: "Eligibility",
          requirementValue: "",
          status: "failed",
          message: "Not ok",
        },
      ]);
      logProof(error instanceof Error ? error.message : "Unexpected error.");
    }
  };

  const handleProceed = () => {
    router.push(`/voting/${id}/questions` as any);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={20} color={palette.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verify Eligibility</Text>
      </View>

      {/* ── Main Content ── */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Step 1: Select Mock SD-JWT */}
        {(step === "select-mock") && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Step 1: Select Identity Credential</Text>

            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={selectedMockId}
                onValueChange={(value) => setSelectedMockId(String(value))}
              >
                {SD_JWT_MOCK_TOKENS.map((mock) => (
                  <Picker.Item key={mock.id} label={mock.label} value={mock.id} />
                ))}
              </Picker>
            </View>
          </View>
        )}

        {/* Step 2: Survey Requirements */}
        {requirements.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Step 2: Survey Requirements</Text>
            {requirements.map((req) => (
              <View key={req.id} style={styles.requirementCard}>
                <Text style={styles.requirementType}>{req.type}</Text>
                <Text style={styles.requirementValue}>Requirement: {req.value}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Results */}
        {requirementChecks.length > 0 && step !== "select-mock" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Verification Results</Text>
            {requirementChecks.map((check) => (
              <View key={check.requirementId} style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <View style={styles.resultStatus}>
                    {check.status === "ok" && (
                      <View style={[styles.statusIcon, styles.statusOk]}>
                        <Feather name="check" size={16} color={palette.white} />
                      </View>
                    )}
                    {check.status === "failed" && (
                      <View style={[styles.statusIcon, styles.statusFailed]}>
                        <Feather name="x" size={16} color={palette.white} />
                      </View>
                    )}
                    {(check.status === "generating" || check.status === "pending") && (
                      <ActivityIndicator size="small" color={palette.primary} />
                    )}
                  </View>
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultType}>{check.requirementType}</Text>
                    <Text style={styles.resultMessage}>{check.message}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Error message */}
        {errorMessage && (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={20} color={palette.warning} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}
      </ScrollView>

      {/* ── Action Bar ── */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 12 }]}>
        {step === "select-mock" && (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleStartVerification}
            disabled={!selectedMock?.token}
          >
            <Text style={styles.primaryBtnText}>Verify Eligibility</Text>
            <Feather name="arrow-right" size={16} color={palette.white} />
          </TouchableOpacity>
        )}

        {step === "generating" && (
          <View style={styles.primaryBtn}>
            <ActivityIndicator size="small" color={palette.white} />
            <Text style={styles.primaryBtnText}>Verifying...</Text>
          </View>
        )}

        {step === "confirmed" && (
          <TouchableOpacity
            style={[styles.primaryBtn, styles.primaryBtnSuccess]}
            onPress={handleProceed}
          >
            <Feather name="check" size={16} color={palette.white} />
            <Text style={styles.primaryBtnText}>Proceed to Vote</Text>
          </TouchableOpacity>
        )}

        {step === "error" && (
          <TouchableOpacity
            style={[styles.primaryBtn, styles.primaryBtnRetry]}
            onPress={() => {
              setStep("select-mock");
              setErrorMessage("");
              setRequirementChecks([]);
            }}
          >
            <Feather name="refresh-cw" size={16} color={palette.white} />
            <Text style={styles.primaryBtnText}>Try Again</Text>
          </TouchableOpacity>
        )}
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
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    marginLeft: 8,
    fontSize: 18,
    fontWeight: "600",
    color: palette.textPrimary,
  },
  content: {
    flex: 1,
    paddingTop: 16,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: palette.textPrimary,
    marginBottom: 8,
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 12,
    backgroundColor: palette.white,
  },
  requirementCard: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: "#f0f0f0",
    marginBottom: 8,
  },
  requirementType: {
    fontSize: 14,
    fontWeight: "600",
    color: palette.textPrimary,
  },
  requirementValue: {
    fontSize: 12,
    color: palette.textSecondary,
    marginTop: 4,
  },
  resultCard: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: "#f0f0f0",
    marginBottom: 8,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  resultStatus: {
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  statusIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  statusOk: {
    backgroundColor: palette.success,
  },
  statusFailed: {
    backgroundColor: palette.warning,
  },
  resultInfo: {
    flex: 1,
  },
  resultType: {
    fontSize: 14,
    fontWeight: "600",
    color: palette.textPrimary,
  },
  resultMessage: {
    fontSize: 12,
    color: palette.textSecondary,
    marginTop: 4,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#ffe6e6",
    borderLeftWidth: 3,
    borderLeftColor: palette.warning,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: palette.warning,
    lineHeight: 18,
  },
  actionBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    backgroundColor: palette.white,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: palette.primary,
  },
  primaryBtnSuccess: {
    backgroundColor: palette.success,
  },
  primaryBtnRetry: {
    backgroundColor: palette.warning,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: palette.white,
  },
});


