import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { palette } from "@/theme/palette";
import { useVoting } from "@/utils/VotingContext";
import { buildEligibilityCircuitInputFromToken, EligibilityCircuitInput } from "@/utils/sdjwt/eligibilityInput";
import {
  CREDENTIAL_TYPES,
  CredentialType,
  getCredentialTypeConfig,
} from "@/utils/credentialConfig";
import { getUtcPlus2YyyyMmDd } from "@/utils/zk/proofChecks";
import {
  getAttributeCandidatesForRequirement,
  extractNumericValue,
} from "@/utils/requirementAttributeMap";
import { RequirementType, SurveyDetail } from "@/domain/models";
import { loadRegisteredSurveyDetail } from "@/utils/registry/feed";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "request-credential" | "waiting-wallet" | "generating" | "confirmed" | "error";

type RequirementCheckResult = {
  requirementId: string;
  requirementType: string;
  requirementValue: string;
  status: "pending" | "generating" | "ok" | "failed";
  message: string;
  attributeValue?: string;
  normalizedAttributeValue?: string;
  currentDate?: string;
  minValue?: number;
  inputPath?: string;
};

const VOTING_SURVEY_CACHE_KEY_PREFIX = "voting-survey:";

// ─── Utility Functions ─────────────────────────────────────────────────────────

function normalizeYyyyMmDd(value: unknown, label: string): string {
  const asString = String(value ?? "").trim();
  if (/^\d{8}$/.test(asString)) {
    return asString;
  }

  const isoMatch = asString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[1]}${isoMatch[2]}${isoMatch[3]}`;
  }

  const europeanMatch = asString.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);
  if (europeanMatch) {
    return `${europeanMatch[3]}${europeanMatch[2]}${europeanMatch[1]}`;
  }

  throw new Error(`${label} must be a date like yyyymmdd, yyyy-mm-dd, or dd.mm.yyyy.`);
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

function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function getFirstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function getVotingSurveyCacheKey(surveyId: string): string {
  return `${VOTING_SURVEY_CACHE_KEY_PREFIX}${surveyId}`;
}

function getRequestedClaimsForCredential(
  credentialType: CredentialType,
  requirements: { type: RequirementType }[],
): string[] {
  const config = getCredentialTypeConfig(credentialType);
  if (!config) return [];

  const candidates = new Set(
    requirements.flatMap((requirement) =>
      getAttributeCandidatesForRequirement(requirement.type),
    ),
  );

  return config.attributes
    .map((attribute) => attribute.id)
    .filter((attributeId) => candidates.has(attributeId) || attributeId === "expiry_date");
}

function resolveAgeRequirement(requirements: { type: string; value: string }[]): { enableAgeCheck: string; minAge: string } {
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
  const params = useLocalSearchParams<{
    id: string;
    presentation?: string;
    requestedClaims?: string;
    requestId?: string;
    status?: string;
    errorCode?: string;
    errorMessage?: string;
  }>();
  const id = getFirstParam(params.id);
  const insets = useSafeAreaInsets();
  const { state, setSurvey } = useVoting();
  const processedPresentationRef = useRef<string | null>(null);

  const [step, setStep] = useState<Step>("request-credential");
  const [selectedCredentialType, setSelectedCredentialType] = useState<CredentialType>("passport");
  const [requirementChecks, setRequirementChecks] = useState<RequirementCheckResult[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [processedPresentation, setProcessedPresentation] = useState<string>("");
  const [isLoadingSurvey, setIsLoadingSurvey] = useState(false);

  const survey = state.survey;
  const requirements = useMemo(() => survey?.requirements ?? [], [survey?.requirements]);
  const hasReturnedPresentation = Boolean(getFirstParam(params.presentation));
  const isPreparingReturnedPresentation =
    hasReturnedPresentation
    && !errorMessage
    && (step === "request-credential" || step === "waiting-wallet");
  const selectedCredentialConfig = getCredentialTypeConfig(selectedCredentialType);
  const requestedClaims = useMemo(
    () => getRequestedClaimsForCredential(selectedCredentialType, requirements),
    [requirements, selectedCredentialType],
  );

  const logProof = useCallback((message: string) => {
    console.log(`[Eligibility] ${message}`);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const hydrateSurvey = async () => {
      if (survey || !id) return;

      try {
        setIsLoadingSurvey(!hasReturnedPresentation);
        const cachedSurvey = await AsyncStorage.getItem(getVotingSurveyCacheKey(id));
        if (cachedSurvey) {
          const parsedSurvey = JSON.parse(cachedSurvey) as SurveyDetail;
          if (isMounted) {
            setSurvey(parsedSurvey);
            setIsLoadingSurvey(false);
          }
          return;
        }

        const registryItem = await loadRegisteredSurveyDetail(id);
        if (!registryItem) {
          throw new Error("Survey not found in the public registry.");
        }
        if (isMounted && registryItem) {
          setSurvey(registryItem.detail);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load survey details.");
          setStep("error");
        }
      } finally {
        if (isMounted) {
          setIsLoadingSurvey(false);
        }
      }
    };

    hydrateSurvey();

    return () => {
      isMounted = false;
    };
  }, [hasReturnedPresentation, id, setSurvey, survey]);

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
  }, [id, logProof, requirements.length, survey]);

  const handleRequestCredential = async () => {
    if (!id) {
      setErrorMessage("Missing survey id.");
      return;
    }

    if (!requirements.length) {
      logProof("No survey requirements were found. Skipping verification.");
      router.replace(`/voting/${id}/questions` as any);
      return;
    }

    const credentialConfig = getCredentialTypeConfig(selectedCredentialType);
    if (!credentialConfig) {
      setErrorMessage("Invalid credential type.");
      return;
    }

    if (requestedClaims.length === 0) {
      setErrorMessage(
        `No matching claims for ${credentialConfig.label}. Choose another credential or check the survey requirements.`,
      );
      return;
    }

    try {
      setStep("waiting-wallet");
      setErrorMessage("");
      setRequirementChecks([]);
      if (survey) {
        await AsyncStorage.setItem(getVotingSurveyCacheKey(id), JSON.stringify(survey));
      }

      const requestId = `elig_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
      const nonce = `eligibility_nonce_${fnv1aHex(`${requestId}|${id}|${[...requestedClaims].sort().join(",")}`)}`;
      const callbackUrl = `zkdappsurveyfrontend://auth?flow=eligibility&surveyId=${encodeURIComponent(
        id,
      )}&requestId=${encodeURIComponent(requestId)}&requestedClaims=${encodeURIComponent(
        JSON.stringify(requestedClaims),
      )}&nonceChallenge=${encodeURIComponent(nonce)}`;

      const requestPayload = {
        version: "1.0",
        requestId,
        presentationType: "sd-jwt",
        aud: "zkdapp-survey-frontend",
        nonce,
        callbackUrl,
        ...(credentialConfig.credentialTypes
          ? { credentialTypes: credentialConfig.credentialTypes }
          : {}),
        credentialQuery: {
          vct: credentialConfig.vct,
          requestedClaims,
        },
        options: {
          allowUserSelectSubset: true,
        },
      };

      const valeraUrl = `asitplus-wallet://share?action=share&callback=${encodeURIComponent(
        callbackUrl,
      )}&type=${encodeURIComponent(credentialConfig.vct)}&requestId=${encodeURIComponent(
        requestId,
      )}&requestedClaims=${encodeURIComponent(JSON.stringify(requestedClaims))}&request=${encodeURIComponent(
        JSON.stringify(requestPayload),
      )}`;

      logProof(
        `Requesting ${credentialConfig.label} from Valera. Claims: ${requestedClaims.join(", ")}`,
      );
      console.log("[Eligibility] Opening Valera URL:", valeraUrl);

      await Linking.openURL(valeraUrl);
    } catch (error) {
      setStep("request-credential");
      const message = error instanceof Error ? error.message : "Failed to open Valera.";
      setErrorMessage(message);
      Alert.alert("Error", message, [{ text: "OK" }]);
    }
  };

  // ── Phase 1: Parse SD-JWT and start verification ──
  const handleStartVerification = useCallback(async (sdJwtToken: string, sourceLabel: string) => {
    if (!sdJwtToken.trim()) {
      setErrorMessage("No SD-JWT presentation received from Valera.");
      setStep("error");
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
      logProof(`Using SD-JWT from ${sourceLabel}.`);
      logProof(`Survey requirements: ${requirements.map((req) => `${req.type} ${req.value}`).join(", ")}`);
      const eligibilitySettings = resolveAgeRequirement(requirements);
      const proofInput = buildEligibilityCircuitInputFromToken(sdJwtToken, {
        currentDate: normalizeYyyyMmDd(getUtcPlus2YyyyMmDd(), "Current date"),
        minAge: eligibilitySettings.minAge,
        enableAgeCheck: eligibilitySettings.enableAgeCheck,
      });
      const normalizedDobValue = normalizeYyyyMmDd(proofInput.dobValue, "Birth date");
      const normalizedExpValue = normalizeYyyyMmDd(proofInput.expValue, "Expiry date");
      const finalProofInput: EligibilityCircuitInput = {
        ...proofInput,
        dobValue: normalizedDobValue,
        expValue: normalizedExpValue,
      };

      const surveyId = String(survey?.id ?? id ?? "survey");
      const result: RequirementCheckResult = {
        requirementId: surveyId,
        requirementType: "Eligibility",
        requirementValue: eligibilitySettings.enableAgeCheck === "1" ? `Age ${eligibilitySettings.minAge}+` : "No age check",
        status: "generating",
        message: "Generating proof...",
        minValue: Number(eligibilitySettings.minAge),
        attributeValue: proofInput.dobValue,
        normalizedAttributeValue: normalizedDobValue,
        currentDate: finalProofInput.currentDate,
      };

      setRequirementChecks([result]);
      logProof(`Prepared eligibility proof for survey ${surveyId}. enableAgeCheck=${eligibilitySettings.enableAgeCheck}, minAge=${eligibilitySettings.minAge}`);

      const zkeyPath = await getZkeyPath();
      logProof(`Using zkey at: ${zkeyPath}`);

      const { generateCircomProof, verifyCircomProof, ProofLib } = await import("mopro-ffi");
      const proofResult = generateCircomProof(
        zkeyPath,
        JSON.stringify(toMoproInputs(finalProofInput)),
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
      const message = error instanceof Error ? error.message : "Unexpected error.";
      setErrorMessage(message);
      setStep("error");
      setRequirementChecks([
        {
          requirementId: String(survey?.id ?? id ?? "survey"),
          requirementType: "Eligibility",
          requirementValue: "",
          status: "failed",
          message,
        },
      ]);
      logProof(message);
    }
  }, [id, logProof, requirements, survey]);

  const handleProceed = () => {
    router.replace(`/voting/${id}/questions` as any);
  };

  useEffect(() => {
    const presentation = getFirstParam(params.presentation);
    const errorCode = getFirstParam(params.errorCode);
    const errorMessageFromWallet = getFirstParam(params.errorMessage);

    if (errorCode) {
      setStep("error");
      setErrorMessage(errorMessageFromWallet || `Valera returned error: ${errorCode}`);
      return;
    }

    if (!survey || !presentation || presentation === processedPresentationRef.current) {
      return;
    }

    processedPresentationRef.current = presentation;
    setProcessedPresentation(presentation);
    handleStartVerification(presentation, "Valera");
  }, [
    params.presentation,
    params.errorCode,
    params.errorMessage,
    processedPresentation,
    handleStartVerification,
    survey,
  ]);

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
        {isPreparingReturnedPresentation && (
          <View style={styles.section}>
            <View style={styles.waitingCard}>
              <ActivityIndicator size="small" color={palette.primary} />
              <Text style={styles.waitingText}>Preparing verification...</Text>
            </View>
          </View>
        )}

        {isLoadingSurvey && !hasReturnedPresentation && (
          <View style={styles.section}>
            <View style={styles.waitingCard}>
              <ActivityIndicator size="small" color={palette.primary} />
              <Text style={styles.waitingText}>Loading survey details...</Text>
            </View>
          </View>
        )}

        {/* Step 1: Request real SD-JWT from Valera */}
        {step === "request-credential" && !isLoadingSurvey && !hasReturnedPresentation && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Step 1: Request Identity Credential</Text>

            {CREDENTIAL_TYPES.map((credential) => {
              const claimsForCredential = getRequestedClaimsForCredential(credential.id, requirements);
              const isSelected = selectedCredentialType === credential.id;

              return (
                <TouchableOpacity
                  key={credential.id}
                  style={[
                    styles.credentialCard,
                    isSelected && styles.credentialCardSelected,
                  ]}
                  onPress={() => setSelectedCredentialType(credential.id)}
                >
                  <View style={styles.credentialInfo}>
                    <Text style={styles.credentialLabel}>{credential.label}</Text>
                    <Text style={styles.credentialDescription}>
                      {claimsForCredential.length > 0
                        ? `Will request: ${claimsForCredential.join(", ")}`
                        : "No matching claims for this survey"}
                    </Text>
                  </View>
                  {isSelected && (
                    <Feather name="check" size={18} color={palette.primary} />
                  )}
                </TouchableOpacity>
              );
            })}

            {selectedCredentialConfig && requestedClaims.length > 0 && (
              <View style={styles.claimsBox}>
                <Text style={styles.claimsText}>
                  {selectedCredentialConfig.label}: {requestedClaims.join(", ")}
                </Text>
              </View>
            )}
          </View>
        )}

        {step === "waiting-wallet" && !hasReturnedPresentation && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Waiting for Valera</Text>
            <View style={styles.waitingCard}>
              <ActivityIndicator size="small" color={palette.primary} />
              <Text style={styles.waitingText}>
                Complete credential sharing in Valera. Verification will start when the wallet returns.
              </Text>
            </View>
          </View>
        )}

        {/* Step 2: Survey Requirements */}
        {requirements.length > 0 && !isPreparingReturnedPresentation && (
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
        {requirementChecks.length > 0 && !isPreparingReturnedPresentation && step !== "request-credential" && step !== "waiting-wallet" && (
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
                    {(check.currentDate || check.normalizedAttributeValue || check.minValue != null) && (
                      <Text style={styles.resultDebugText}>
                        currentDate={check.currentDate || "N/A"} dobValue={check.normalizedAttributeValue || "N/A"} minAge={check.minValue ?? "N/A"}
                      </Text>
                    )}
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
        {step === "request-credential" && !hasReturnedPresentation && (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleRequestCredential}
          >
            <Text style={styles.primaryBtnText}>Request from Valera</Text>
            <Feather name="arrow-right" size={16} color={palette.white} />
          </TouchableOpacity>
        )}

        {step === "waiting-wallet" && !hasReturnedPresentation && (
          <View style={styles.primaryBtn}>
            <ActivityIndicator size="small" color={palette.white} />
            <Text style={styles.primaryBtnText}>Waiting for Valera...</Text>
          </View>
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
              setStep("request-credential");
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
  credentialCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    backgroundColor: palette.white,
  },
  credentialCardSelected: {
    borderColor: palette.primary,
    backgroundColor: palette.primaryNegative,
  },
  credentialInfo: {
    flex: 1,
  },
  credentialLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: palette.textPrimary,
  },
  credentialDescription: {
    fontSize: 12,
    color: palette.textSecondary,
    marginTop: 4,
    lineHeight: 17,
  },
  claimsBox: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: palette.surfaceMuted,
    borderWidth: 1,
    borderColor: palette.border,
  },
  claimsText: {
    fontSize: 12,
    color: palette.textSecondary,
    lineHeight: 18,
  },
  waitingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  waitingText: {
    flex: 1,
    fontSize: 13,
    color: palette.textSecondary,
    lineHeight: 19,
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
  resultDebugText: {
    fontSize: 10,
    color: palette.textSecondary,
    fontFamily: "monospace",
    marginTop: 6,
    lineHeight: 15,
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
