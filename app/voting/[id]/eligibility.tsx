import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
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
import Constants from "expo-constants";

import { palette } from "@/theme/palette";
import { useVoting } from "@/utils/VotingContext";
import { SD_JWT_MOCK_TOKENS } from "@/utils/sdjwt/mockTokens";
import { parseSdJwt, ParsedSdJwtResult } from "@/utils/sdjwt/parser";
import {
  getProofCheckByKey,
  getUtcPlus2YyyyMmDd,
} from "@/utils/zk/proofChecks";
import {
  getAttributeCandidatesForRequirement,
  extractNumericValue,
} from "@/utils/requirementAttributeMap";
import { getCircuitKeyForRequirement, isRequirementSupported } from "@/utils/circuitMap";

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

function resolveProofServiceUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_PROOF_SERVICE_URL;
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.trim();
  }

  if (Platform.OS === "android") {
    return "http://10.0.2.2:8787";
  }

  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(":")[0];
    if (host) {
      return `http://${host}:8787`;
    }
  }

  return "http://localhost:8787";
}

/**
 * Extracts an attribute value from parsed SD-JWT using candidate attribute names.
 */
function extractAttributeFromSdJwt(
  candidates: string[],
  parsed: ParsedSdJwtResult
): unknown {
  for (const candidate of candidates) {
    const value = parsed.attributes[candidate];
    if (value != null && String(value).trim() !== "") {
      return value;
    }
  }
  return undefined;
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

      // Parse the selected mock
      const parsed = parseSdJwt(selectedMock.token);
      logProof(`SD-JWT parsed successfully. Available attributes: ${Object.keys(parsed.attributes).join(", ")}`);

      // Process each requirement
      const results: RequirementCheckResult[] = [];

      for (const req of requirements) {
        const result: RequirementCheckResult = {
          requirementId: req.id,
          requirementType: req.type,
          requirementValue: req.value,
          status: "pending",
          message: "",
        };

        // Check if requirement type is supported
        if (!isRequirementSupported(req.type)) {
          result.status = "failed";
          result.message = `Requirement type "${req.type}" not yet supported.`;
          results.push(result);
          setRequirementChecks([...results]);
          logProof(`[${req.type}] ${result.message}`);
          continue;
        }

        // Get circuit key for this requirement
        const circuitKey = getCircuitKeyForRequirement(req.type);
        if (!circuitKey) {
          result.status = "failed";
          result.message = `No circuit configured for "${req.type}".`;
          results.push(result);
          setRequirementChecks([...results]);
          logProof(`[${req.type}] ${result.message}`);
          continue;
        }

        try {
          // Extract minimum value from requirement (e.g., "18+" → 18)
          const minValue = extractNumericValue(req.value);
          if (minValue === null) {
            throw new Error(`Could not extract numeric value from "${req.value}".`);
          }

          // Get the check definition to understand what attributes we need
          const checkDef = getProofCheckByKey(circuitKey);
          if (!checkDef) {
            throw new Error(`No check definition found for circuit "${circuitKey}".`);
          }

          // Extract required attributes from SD-JWT
          const candidates = getAttributeCandidatesForRequirement(req.type);
          if (candidates.length === 0) {
            throw new Error(`No attribute candidates defined for "${req.type}".`);
          }

          const attributeValue = extractAttributeFromSdJwt(candidates, parsed);
          if (attributeValue === undefined) {
            throw new Error(
              `Required attribute(s) [${candidates.join(", ")}] not found in the selected SD-JWT.`
            );
          }

          logProof(
            `[${req.type}] Using attribute ${candidates.find((candidate) => parsed.attributes[candidate] != null && String(parsed.attributes[candidate]).trim() !== "") ?? candidates[0]} = ${String(attributeValue)}`,
          );

          // Prepare proof input
          const input: Record<string, string | number> = {};

          for (const field of checkDef.inputs) {
            if (field.source === "computed") {
              if (field.computedBy !== "utcPlus2CurrentDate") {
                throw new Error(`Unsupported computed source for ${field.key}.`);
              }
              input[field.key] = normalizeYyyyMmDd(getUtcPlus2YyyyMmDd(), field.label);
            } else if (field.source === "sd-jwt") {
              input[field.key] = normalizeYyyyMmDd(attributeValue, field.label);
            } else if (field.key === "minAge") {
              // Use the extracted minimum value from survey requirement
              input[field.key] = minValue;
            }
          }

          result.status = "generating";
          result.message = "Generating proof...";
          result.minValue = minValue;
          result.attributeValue = String(attributeValue);
          results.push(result);
          setRequirementChecks([...results]);
          logProof(
            `[${req.type}] Generating proof for circuit "${circuitKey}" with minAge=${minValue}, currentDate=${String(input.currentDate)}, dobValue=${String(input.dobValue)}`,
          );

          // Call proof service to generate proof
          const baseUrl = resolveProofServiceUrl();
          const response = await fetch(`${baseUrl}/proof/${circuitKey}/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              currentDate: String(input.currentDate),
              dobValue: String(input.dobValue),
              minAge: input.minAge,
            }),
          });

          const payload = await response.json();
          if (!response.ok || !payload.ok) {
            throw new Error(payload.error || "Proof generation failed.");
          }

          logProof(`[${req.type}] Proof generation succeeded. inputPath=${payload.inputPath}`);

          // Verify the proof
          const verifyResponse = await fetch(`${baseUrl}/proof/${circuitKey}/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });

          const verifyPayload = await verifyResponse.json();
          if (!verifyResponse.ok) {
            throw new Error(verifyPayload.error || "Verification request failed.");
          }

          if (!verifyPayload.ok) {
            throw new Error("Proof verification failed.");
          }

          logProof(`[${req.type}] Proof verification succeeded.`);

          // Success!
          result.status = "ok";
          result.message = "Proof generation OK";
          result.inputPath = String(payload.inputPath ?? "");
        } catch (error) {
          result.status = "failed";
          result.message = "Not ok";
          logProof(`[${req.type}] ${error instanceof Error ? error.message : "Unknown error during verification."}`);
        }

        const existingIndex = results.findIndex((check) => check.requirementId === result.requirementId);
        if (existingIndex >= 0) {
          results[existingIndex] = result;
        } else {
          results.push(result);
        }
        setRequirementChecks([...results]);
      }

      // All checks done
      const allChecksPassed = results.length > 0 && results.every((r) => r.status === "ok");
      setStep(allChecksPassed ? "confirmed" : "error");
      setRequirementChecks(results);
      logProof(allChecksPassed ? "All proof checks passed." : "At least one proof check failed.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unexpected error.");
      setStep("error");
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


