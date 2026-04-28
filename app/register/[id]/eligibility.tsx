import Feather from "@expo/vector-icons/Feather";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import {
  getElection,
  isUserRegistered,
  registerForElection,
  verifyEligibilityProofOnChain,
} from "@/services/contractService";
import { RequirementType } from "@/domain/models";
import { palette } from "@/theme/palette";
import { ChainElection, ContractElectionStatus, Groth16ProofCalldata } from "@/types/election";
import { loadOrFetchElectionMetadata, StoredElectionMetadata } from "@/utils/electionMetadataStore";
import { showAlert } from "@/utils/platformAlert";
import {
  extractNumericValue,
  getAttributeCandidatesForRequirement,
} from "@/utils/requirementAttributeMap";
import { buildEligibilityCircuitInputFromToken } from "@/utils/sdjwt/eligibilityInput";
import { getOrCreateDeviceWallet } from "@/utils/vocdoni/wallet";
import {
  CREDENTIAL_TYPES,
  CredentialType,
  getCredentialTypeConfig,
} from "@/utils/credentialConfig";
import { getUtcPlus2YyyyMmDd } from "@/utils/zk/proofChecks";

type Step =
  | "loading"
  | "request-credential"
  | "waiting-wallet"
  | "generating"
  | "confirmed"
  | "error";

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

type ProofServiceResponse = {
  ok?: boolean;
  error?: string;
  inputPath?: string;
  calldata?: Groth16ProofCalldata;
};

const REGISTER_SURVEY_CACHE_KEY_PREFIX = "register-survey:";

function getFirstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function getRegisterSurveyCacheKey(electionId: number): string {
  return `${REGISTER_SURVEY_CACHE_KEY_PREFIX}${electionId}`;
}

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

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 20_000,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Proof service request timed out after ${timeoutMs / 1000}s.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function resolveProofServiceUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_PROOF_SERVICE_URL;
  if (fromEnv?.trim()) {
    return fromEnv.trim();
  }

  if (Platform.OS === "android") {
    return "http://10.0.2.2:8787";
  }

  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(":")[0];
  return host ? `http://${host}:8787` : "http://localhost:8787";
}

function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function getRequestedClaimsForCredential(
  credentialType: CredentialType,
  requirements: { type: RequirementType }[],
): string[] {
  const config = getCredentialTypeConfig(credentialType);
  if (!config) return [];

  const candidates = new Set(
    requirements.flatMap((requirement) => getAttributeCandidatesForRequirement(requirement.type)),
  );

  return config.attributes
    .map((attribute) => attribute.id)
    .filter((attributeId) => candidates.has(attributeId) || attributeId === "expiry_date");
}

function resolveAgeRequirement(requirements: { type: string; value: string }[]) {
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

function isElectionExpired(election: ChainElection) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return election.endDate > 0 && election.endDate <= nowSeconds;
}

function isUint256Value(value: unknown): value is string | number | bigint {
  if (typeof value === "bigint") {
    return value >= 0n;
  }
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 0;
  }
  return typeof value === "string" && /^(0x[0-9a-fA-F]+|\d+)$/.test(value);
}

function isProofCalldata(value: unknown): value is Groth16ProofCalldata {
  const proof = value as Groth16ProofCalldata | undefined;
  return Boolean(
    proof &&
      Array.isArray(proof.pi_a) &&
      proof.pi_a.length === 2 &&
      proof.pi_a.every(isUint256Value) &&
      Array.isArray(proof.pi_b) &&
      proof.pi_b.length === 2 &&
      proof.pi_b.every((row) => Array.isArray(row) && row.length === 2 && row.every(isUint256Value)) &&
      Array.isArray(proof.pi_c) &&
      proof.pi_c.length === 2 &&
      proof.pi_c.every(isUint256Value) &&
      Array.isArray(proof.pubInputs) &&
      proof.pubInputs.length >= 2 &&
      proof.pubInputs.every(isUint256Value)
  );
}

export default function RegisterEligibilityScreen() {
  const params = useLocalSearchParams<{
    id: string;
    presentation?: string;
    requestedClaims?: string;
    requestId?: string;
    status?: string;
    errorCode?: string;
    errorMessage?: string;
  }>();
  const insets = useSafeAreaInsets();
  const processedPresentationRef = useRef<string | null>(null);

  const electionId = Number(getFirstParam(params.id));
  const hasReturnedPresentation = Boolean(getFirstParam(params.presentation));

  const [step, setStep] = useState<Step>("loading");
  const [selectedCredentialType, setSelectedCredentialType] = useState<CredentialType>("passport");
  const [election, setElection] = useState<ChainElection | null>(null);
  const [storedMetadata, setStoredMetadata] = useState<StoredElectionMetadata | null>(null);
  const [requirementChecks, setRequirementChecks] = useState<RequirementCheckResult[]>([]);
  const [eligibilityProof, setEligibilityProof] = useState<Groth16ProofCalldata | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  const requirements = useMemo(
    () => storedMetadata?.eligibility.requirements ?? [],
    [storedMetadata?.eligibility.requirements],
  );
  const selectedCredentialConfig = getCredentialTypeConfig(selectedCredentialType);
  const requestedClaims = useMemo(
    () => getRequestedClaimsForCredential(selectedCredentialType, requirements),
    [requirements, selectedCredentialType],
  );
  const title = storedMetadata?.metadata.title ?? (election ? `Election #${election.id}` : "Register");
  const isPreparingReturnedPresentation =
    hasReturnedPresentation && !errorMessage && (step === "loading" || step === "request-credential" || step === "waiting-wallet");

  const logProof = useCallback((message: string) => {
    console.log(`[RegisterEligibility] ${message}`);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        if (!Number.isInteger(electionId) || electionId <= 0) {
          throw new Error("Invalid election id.");
        }

        setStep("loading");
        setErrorMessage("");
        setEligibilityProof(null);

        const nextElection = await getElection(electionId);
        if (nextElection.status !== ContractElectionStatus.Created) {
          throw new Error("This election is not open for registration.");
        }
        if (isElectionExpired(nextElection)) {
          throw new Error("This election registration window has ended.");
        }

        const wallet = await getOrCreateDeviceWallet();
        const alreadyRegistered = await isUserRegistered(electionId, wallet.address);
        if (alreadyRegistered) {
          throw new Error("This wallet is already registered for the election.");
        }

        const metadata = await loadOrFetchElectionMetadata({
          electionId,
          metadataURI: nextElection.metadataURI,
          metadataHash: nextElection.metadataHash,
          eligibilityHash: nextElection.eligibilityHash,
        });

        if (!metadata) {
          throw new Error("Unable to load election metadata.");
        }

        await AsyncStorage.setItem(getRegisterSurveyCacheKey(electionId), JSON.stringify(metadata));

        if (!isMounted) return;

        setElection(nextElection);
        setStoredMetadata(metadata);
        setRequirementChecks(
          metadata.eligibility.requirements.map((requirement) => ({
            requirementId: requirement.id,
            requirementType: requirement.type,
            requirementValue: requirement.value,
            status: "pending",
            message: "",
          })),
        );
        setStep(hasReturnedPresentation ? "waiting-wallet" : "request-credential");
      } catch (error) {
        if (!isMounted) return;
        setErrorMessage(error instanceof Error ? error.message : "Unable to load registration.");
        setStep("error");
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [electionId, hasReturnedPresentation]);

  const handleRequestCredential = async () => {
    if (!Number.isInteger(electionId) || electionId <= 0) {
      setErrorMessage("Invalid election id.");
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
      setEligibilityProof(null);

      const requestId = `reg_elig_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
      const nonce = `register_eligibility_nonce_${fnv1aHex(
        `${requestId}|${electionId}|${[...requestedClaims].sort().join(",")}`,
      )}`;
      const callbackUrl = `zkdappsurveyfrontend://auth?flow=registerEligibility&surveyId=${encodeURIComponent(
        String(electionId),
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

      logProof(`Requesting ${credentialConfig.label} from Valera. Claims: ${requestedClaims.join(", ")}`);
      await Linking.openURL(valeraUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to open Valera.";
      setErrorMessage(message);
      setStep("request-credential");
      showAlert("Error", message);
    }
  };

  const handleStartVerification = useCallback(async (sdJwtToken: string, sourceLabel: string) => {
    if (!sdJwtToken.trim()) {
      setErrorMessage("No SD-JWT presentation received from Valera.");
      setStep("error");
      return;
    }

    try {
      setStep("generating");
      setErrorMessage("");
      setEligibilityProof(null);

      const eligibilitySettings = resolveAgeRequirement(requirements);
      logProof(`Using SD-JWT from ${sourceLabel}.`);
      logProof(
        `Survey requirements: ${
          requirements.length
            ? requirements.map((requirement) => `${requirement.type} ${requirement.value}`).join(", ")
            : "none"
        }`,
      );

      const proofInput = buildEligibilityCircuitInputFromToken(sdJwtToken, {
        currentDate: normalizeYyyyMmDd(getUtcPlus2YyyyMmDd(), "Current date"),
        minAge: eligibilitySettings.minAge,
        enableAgeCheck: eligibilitySettings.enableAgeCheck,
      });
      const normalizedDobValue =
        eligibilitySettings.enableAgeCheck === "1"
          ? normalizeYyyyMmDd(proofInput.dobValue, "Birth date")
          : proofInput.dobValue;
      const normalizedExpValue = normalizeYyyyMmDd(proofInput.expValue, "Expiry date");
      const finalProofInput = {
        ...proofInput,
        dobValue: normalizedDobValue,
        expValue: normalizedExpValue,
      };

      const result: RequirementCheckResult = {
        requirementId: String(electionId),
        requirementType: "Eligibility",
        requirementValue:
          eligibilitySettings.enableAgeCheck === "1"
            ? `Age ${eligibilitySettings.minAge}+`
            : "Credential validity",
        status: "generating",
        message: "Generating proof...",
        minValue: Number(eligibilitySettings.minAge),
        attributeValue: proofInput.dobValue,
        normalizedAttributeValue: normalizedDobValue,
        currentDate: finalProofInput.currentDate,
      };
      setRequirementChecks([result]);

      const baseUrl = resolveProofServiceUrl();
      const response = await fetchWithTimeout(`${baseUrl}/proof/eligibility/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...finalProofInput,
          surveyId: String(electionId),
        }),
      });

      const payload = (await response.json()) as ProofServiceResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Proof generation failed.");
      }
      if (!isProofCalldata(payload.calldata)) {
        throw new Error("Proof service did not return Solidity proof calldata. Restart the updated proof service.");
      }

      logProof(`Eligibility proof generation succeeded. inputPath=${payload.inputPath ?? "N/A"}`);

      const verifyResponse = await fetchWithTimeout(`${baseUrl}/proof/eligibility/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const verifyPayload = await verifyResponse.json();
      if (!verifyResponse.ok) {
        throw new Error(verifyPayload.error || "Verification request failed.");
      }
      if (!verifyPayload.ok) {
        throw new Error("Proof verification failed locally.");
      }

      const verifiedOnChain = await verifyEligibilityProofOnChain(payload.calldata);
      if (!verifiedOnChain) {
        throw new Error("Proof verification failed on the smart contract.");
      }

      result.status = "ok";
      result.message = "Proof verified on contract";
      result.inputPath = payload.inputPath;
      setRequirementChecks([result]);
      setEligibilityProof(payload.calldata);
      setStep("confirmed");
      logProof("Eligibility proof verification succeeded.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected eligibility error.";
      setErrorMessage(message);
      setStep("error");
      setRequirementChecks([
        {
          requirementId: String(electionId || "election"),
          requirementType: "Eligibility",
          requirementValue: "",
          status: "failed",
          message,
        },
      ]);
      logProof(message);
    }
  }, [electionId, logProof, requirements]);

  useEffect(() => {
    const presentation = getFirstParam(params.presentation);
    const errorCode = getFirstParam(params.errorCode);
    const errorMessageFromWallet = getFirstParam(params.errorMessage);

    if (errorCode) {
      setStep("error");
      setErrorMessage(errorMessageFromWallet || `Valera returned error: ${errorCode}`);
      return;
    }

    if (!storedMetadata || !presentation || presentation === processedPresentationRef.current) {
      return;
    }

    processedPresentationRef.current = presentation;
    handleStartVerification(presentation, "Valera");
  }, [
    handleStartVerification,
    params.errorCode,
    params.errorMessage,
    params.presentation,
    storedMetadata,
  ]);

  const handleRegister = async () => {
    if (!election) return;
    if (!eligibilityProof) {
      showAlert("Registration failed", "Generate and verify the eligibility proof first.");
      return;
    }

    try {
      setIsRegistering(true);
      const result = await registerForElection(election.id, eligibilityProof);
      showAlert(
        result.registered ? "Registered" : "Registration submitted",
        `Election ${election.id}\nTx: ${result.txHash}`,
        [{ text: "OK", onPress: () => router.replace("/(tabs)/explore") }],
      );
    } catch (error) {
      showAlert(
        "Registration failed",
        error instanceof Error ? error.message : "Unable to register for this election.",
      );
    } finally {
      setIsRegistering(false);
    }
  };

  const handleRetry = () => {
    processedPresentationRef.current = null;
    setErrorMessage("");
    setEligibilityProof(null);
    setRequirementChecks(
      requirements.map((requirement) => ({
        requirementId: requirement.id,
        requirementType: requirement.type,
        requirementValue: requirement.value,
        status: "pending",
        message: "",
      })),
    );

    const presentation = getFirstParam(params.presentation);
    if (presentation) {
      handleStartVerification(presentation, "Valera");
      return;
    }

    setStep("request-credential");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={20} color={palette.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Verify Eligibility</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.eyebrow}>Registration</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>
            Share a real credential from Valera, generate the eligibility proof, then register on-chain.
          </Text>
        </View>

        {(step === "loading" || isPreparingReturnedPresentation) && (
          <View style={styles.centerCard}>
            <ActivityIndicator color={palette.primary} />
            <Text style={styles.mutedText}>
              {isPreparingReturnedPresentation ? "Preparing verification..." : "Loading registration data..."}
            </Text>
          </View>
        )}

        {step === "request-credential" && !hasReturnedPresentation && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Identity Credential</Text>
            {CREDENTIAL_TYPES.map((credential) => {
              const claimsForCredential = getRequestedClaimsForCredential(credential.id, requirements);
              const isSelected = selectedCredentialType === credential.id;

              return (
                <TouchableOpacity
                  key={credential.id}
                  style={[styles.credentialCard, isSelected && styles.credentialCardSelected]}
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
                  {isSelected && <Feather name="check" size={18} color={palette.primary} />}
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
                Complete credential sharing in Valera. Proof generation will start when the wallet returns.
              </Text>
            </View>
          </View>
        )}

        {requirements.length > 0 && !isPreparingReturnedPresentation && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Survey Requirements</Text>
            {requirements.map((requirement) => (
              <View key={requirement.id} style={styles.requirementCard}>
                <Text style={styles.requirementType}>{requirement.type}</Text>
                <Text style={styles.requirementValue}>Requirement: {requirement.value}</Text>
              </View>
            ))}
          </View>
        )}

        {requirements.length === 0 && step !== "loading" && !isPreparingReturnedPresentation && (
          <View style={styles.section}>
            <View style={styles.requirementCard}>
              <Text style={styles.requirementType}>Credential validity</Text>
              <Text style={styles.requirementValue}>
                No age rule is configured, but the contract still expects a valid eligibility proof.
              </Text>
            </View>
          </View>
        )}

        {requirementChecks.length > 0 && step !== "request-credential" && step !== "waiting-wallet" && !isPreparingReturnedPresentation && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Verification Results</Text>
            {requirementChecks.map((check) => (
              <View key={check.requirementId} style={styles.resultCard}>
                <View style={styles.resultHeader}>
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

        {errorMessage.length > 0 && (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={20} color={palette.warning} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 12 }]}>
        {step === "request-credential" && !hasReturnedPresentation && (
          <TouchableOpacity style={styles.primaryBtn} onPress={handleRequestCredential}>
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
            onPress={handleRegister}
            disabled={isRegistering}
          >
            {isRegistering ? (
              <ActivityIndicator size="small" color={palette.white} />
            ) : (
              <Feather name="check" size={16} color={palette.white} />
            )}
            <Text style={styles.primaryBtnText}>
              {isRegistering ? "Registering..." : "Register on contract"}
            </Text>
          </TouchableOpacity>
        )}

        {step === "error" && (
          <TouchableOpacity
            style={[styles.primaryBtn, styles.primaryBtnRetry]}
            onPress={handleRetry}
          >
            <Feather name="refresh-cw" size={16} color={palette.white} />
            <Text style={styles.primaryBtnText}>Try Again</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

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
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: palette.primaryDark,
  },
  content: {
    flex: 1,
    backgroundColor: palette.surfaceSoft,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    color: palette.textSecondary,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: palette.primaryDark,
  },
  description: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: palette.textSecondary,
  },
  centerCard: {
    margin: 16,
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.white,
    alignItems: "center",
    gap: 10,
  },
  mutedText: {
    color: palette.textSecondary,
    fontSize: 14,
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
    borderColor: palette.border,
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
    fontWeight: "700",
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
    borderColor: palette.border,
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
    borderColor: palette.border,
    marginBottom: 8,
  },
  requirementType: {
    fontSize: 14,
    fontWeight: "700",
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
    borderColor: palette.border,
    marginBottom: 8,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
    fontWeight: "700",
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
    margin: 16,
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
    borderTopColor: palette.border,
    backgroundColor: palette.white,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
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
    fontWeight: "700",
    color: palette.white,
  },
});
