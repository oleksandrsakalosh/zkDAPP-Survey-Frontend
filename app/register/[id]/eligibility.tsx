import Feather from "@expo/vector-icons/Feather";
import { Picker } from "@react-native-picker/picker";
import Constants from "expo-constants";
import { router, useLocalSearchParams } from "expo-router";
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import {
  getElection,
  isUserRegistered,
  registerForElection,
  verifyEligibilityProofOnChain,
} from "@/services/contractService";
import { palette } from "@/theme/palette";
import { ChainElection, ContractElectionStatus, Groth16ProofCalldata } from "@/types/election";
import { loadOrFetchElectionMetadata, StoredElectionMetadata } from "@/utils/electionMetadataStore";
import { getCircuitKeyForRequirement, isRequirementSupported } from "@/utils/circuitMap";
import {
  extractNumericValue,
  getAttributeCandidatesForRequirement,
} from "@/utils/requirementAttributeMap";
import { SD_JWT_MOCK_TOKENS } from "@/utils/sdjwt/mockTokens";
import { parseSdJwt, ParsedSdJwtResult } from "@/utils/sdjwt/parser";
import { getProofCheckByKey, getUtcPlus2YyyyMmDd } from "@/utils/zk/proofChecks";
import { getOrCreateDeviceWallet } from "@/utils/vocdoni/wallet";
import { showAlert } from "@/utils/platformAlert";

type Step = "loading" | "select-mock" | "generating" | "confirmed" | "error";

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

type ProofServiceResponse = {
  ok?: boolean;
  error?: string;
  inputPath?: string;
  calldata?: Groth16ProofCalldata;
};

const normalizeYyyyMmDd = (value: unknown, label: string): string => {
  const asString = String(value ?? "").trim();
  if (!/^\d{8}$/.test(asString)) {
    throw new Error(`${label} must be in yyyymmdd format.`);
  }
  return asString;
};

const resolveProofServiceUrl = () => {
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
};

const extractAttributeFromSdJwt = (
  candidates: string[],
  parsed: ParsedSdJwtResult
): unknown => {
  for (const candidate of candidates) {
    const value = parsed.attributes[candidate];
    if (value != null && String(value).trim() !== "") {
      return value;
    }
  }
  return undefined;
};

const isElectionExpired = (election: ChainElection) => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return election.endDate > 0 && election.endDate <= nowSeconds;
};

const isUint256Value = (value: unknown): value is string | number => {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 0;
  }
  return typeof value === "string" && /^(0x[0-9a-fA-F]+|\d+)$/.test(value);
};

const isProofCalldata = (value: unknown): value is Groth16ProofCalldata => {
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
      proof.pubInputs.length === 2 &&
      proof.pubInputs.every(isUint256Value)
  );
};

const assertAgeRequirementSatisfied = (
  currentDate: string | number | undefined,
  dobValue: string | number | undefined,
  minAge: number,
  requirementValue: string
) => {
  const current = Number(currentDate);
  const dob = Number(dobValue);
  if (!Number.isFinite(current) || !Number.isFinite(dob)) {
    return;
  }

  if (current - dob < minAge * 10000) {
    throw new Error(`Not eligible: selected credential does not satisfy Age ${requirementValue}.`);
  }
};

export default function RegisterEligibilityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>("loading");
  const [election, setElection] = useState<ChainElection | null>(null);
  const [storedMetadata, setStoredMetadata] = useState<StoredElectionMetadata | null>(null);
  const [selectedMockId, setSelectedMockId] = useState<string>(SD_JWT_MOCK_TOKENS[0]?.id ?? "");
  const [requirementChecks, setRequirementChecks] = useState<RequirementCheckResult[]>([]);
  const [eligibilityProof, setEligibilityProof] = useState<Groth16ProofCalldata | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  const electionId = Number(id);
  const requirements = useMemo(
    () => storedMetadata?.eligibility.requirements ?? [],
    [storedMetadata?.eligibility.requirements]
  );
  const selectedMock = SD_JWT_MOCK_TOKENS.find((mock) => mock.id === selectedMockId);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        if (!Number.isInteger(electionId) || electionId <= 0) {
          throw new Error("Invalid election id.");
        }

        setStep("loading");
        setErrorMessage("");
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

        if (!isMounted) {
          return;
        }

        setElection(nextElection);
        setStoredMetadata(metadata);
        setRequirementChecks(
          (metadata?.eligibility.requirements ?? []).map((requirement) => ({
            requirementId: requirement.id,
            requirementType: requirement.type,
            requirementValue: requirement.value,
            status: "pending",
            message: "",
          }))
        );
        setStep("select-mock");
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : "Unable to load registration.");
        setStep("error");
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [electionId]);

  const logProof = (message: string) => {
    console.log(`[RegisterEligibility] ${message}`);
  };

  const handleStartVerification = async () => {
    if (!selectedMock?.token && requirements.length > 0) {
      setErrorMessage("No mock SD-JWT selected.");
      return;
    }

    if (requirements.length === 0) {
      setErrorMessage("This contract requires a ZK eligibility proof. Add a supported requirement before publishing surveys.");
      setStep("error");
      return;
    }

    try {
      setStep("generating");
      setErrorMessage("");
      setEligibilityProof(null);
      const token = selectedMock?.token;
      if (!token) {
        throw new Error("No mock SD-JWT selected.");
      }

      const parsed = parseSdJwt(token);
      const results: RequirementCheckResult[] = [];

      for (const requirement of requirements) {
        const result: RequirementCheckResult = {
          requirementId: requirement.id,
          requirementType: requirement.type,
          requirementValue: requirement.value,
          status: "pending",
          message: "",
        };

        try {
          if (!isRequirementSupported(requirement.type)) {
            throw new Error(`Requirement type "${requirement.type}" is not supported yet.`);
          }

          const circuitKey = getCircuitKeyForRequirement(requirement.type);
          const minValue = extractNumericValue(requirement.value);
          const checkDef = getProofCheckByKey(circuitKey);
          const candidates = getAttributeCandidatesForRequirement(requirement.type);

          if (!circuitKey || !checkDef) {
            throw new Error(`No circuit configured for "${requirement.type}".`);
          }
          if (minValue === null) {
            throw new Error(`Could not extract numeric value from "${requirement.value}".`);
          }

          const attributeValue = extractAttributeFromSdJwt(candidates, parsed);
          if (attributeValue === undefined) {
            throw new Error(`Required attribute(s) [${candidates.join(", ")}] not found.`);
          }

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
              input[field.key] = minValue;
            }
          }

          if (circuitKey === "age") {
            assertAgeRequirementSatisfied(
              input.currentDate,
              input.dobValue,
              minValue,
              requirement.value
            );
          }

          result.status = "generating";
          result.message = "Generating proof...";
          result.minValue = minValue;
          result.attributeValue = String(attributeValue);
          results.push(result);
          setRequirementChecks([...results]);

          const baseUrl = resolveProofServiceUrl();
          logProof(`Requesting proof from ${baseUrl}/proof/${circuitKey}/generate.`);
          const response = await fetch(`${baseUrl}/proof/${circuitKey}/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          });
          const payload = (await response.json()) as ProofServiceResponse;

          if (!response.ok || !payload.ok) {
            throw new Error(payload.error || "Proof generation failed.");
          }
          if (!isProofCalldata(payload.calldata)) {
            throw new Error("Proof service did not return Solidity proof calldata. Restart the updated proof service.");
          }

          const verifiedOnChain = await verifyEligibilityProofOnChain(payload.calldata);
          if (!verifiedOnChain) {
            throw new Error("Proof verification failed on the smart contract.");
          }

          result.status = "ok";
          result.message = "Proof verified on contract";
          result.inputPath = payload.inputPath;
          setEligibilityProof(payload.calldata);
        } catch (error) {
          result.status = "failed";
          result.message = error instanceof Error ? error.message : "Not ok";
          logProof(`[${requirement.type}] ${result.message}`);
        }

        const index = results.findIndex((check) => check.requirementId === result.requirementId);
        if (index >= 0) {
          results[index] = result;
        } else {
          results.push(result);
        }
        setRequirementChecks([...results]);
      }

      const allPassed = results.length > 0 && results.every((result) => result.status === "ok");
      setStep(allPassed ? "confirmed" : "error");
      if (!allPassed) {
        setErrorMessage("At least one eligibility proof check failed.");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unexpected eligibility error.");
      setStep("error");
    }
  };

  const handleRegister = async () => {
    if (!election) {
      return;
    }
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
        [{ text: "OK", onPress: () => router.replace("/(tabs)/explore") }]
      );
    } catch (error) {
      showAlert(
        "Registration failed",
        error instanceof Error ? error.message : "Unable to register for this election."
      );
    } finally {
      setIsRegistering(false);
    }
  };

  const title = storedMetadata?.metadata.title ?? (election ? `Election #${election.id}` : "Register");

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
            Eligibility is checked before the ERC1155 registration token is minted.
          </Text>
        </View>

        {step === "loading" && (
          <View style={styles.centerCard}>
            <ActivityIndicator color={palette.primary} />
            <Text style={styles.mutedText}>Loading registration data...</Text>
          </View>
        )}

        {step !== "loading" && requirements.length === 0 && (
          <View style={styles.section}>
            <View style={styles.requirementCard}>
              <Text style={styles.requirementType}>No eligibility requirements</Text>
              <Text style={styles.requirementValue}>
                The current contract requires a valid ZK proof before registration.
              </Text>
            </View>
          </View>
        )}

        {step === "select-mock" && requirements.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Identity Credential</Text>
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

        {requirements.length > 0 && (
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

        {requirementChecks.length > 0 && step !== "select-mock" && step !== "loading" && (
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
        {step === "select-mock" && (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleStartVerification}
            disabled={requirements.length > 0 && !selectedMock?.token}
          >
            <Text style={styles.primaryBtnText}>
              {requirements.length > 0 ? "Verify Eligibility" : "Continue"}
            </Text>
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
            onPress={() => {
              setStep("select-mock");
              setErrorMessage("");
              setEligibilityProof(null);
              setRequirementChecks(
                requirements.map((requirement) => ({
                  requirementId: requirement.id,
                  requirementType: requirement.type,
                  requirementValue: requirement.value,
                  status: "pending",
                  message: "",
                }))
              );
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
  pickerWrap: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: palette.white,
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
