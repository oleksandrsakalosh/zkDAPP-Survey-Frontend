import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { MaterialIcons } from "@expo/vector-icons";
import Constants from "expo-constants";

import { palette } from "@/theme/palette";
import { SD_JWT_MOCK_TOKENS } from "@/utils/sdjwt/mockTookens";
import { buildEligibilityCircuitInputFromToken } from "@/utils/sdjwt/eligibilityInput";
import {
  PROOF_CHECKS,
  ProofCheckDefinition,
  getProofCheckByKey,
  getUtcPlus2YyyyMmDd,
} from "@/utils/zk/proofChecks";

interface ProofGeneratorProps {
  onClose?: () => void;
}

interface GenerationResult {
  status: "idle" | "running-generate" | "generated" | "running-verify" | "ok" | "error";
  message: string;
}

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

export default function ProofGenerator({ onClose }: ProofGeneratorProps) {
  const [selectedMockId, setSelectedMockId] = useState<string>(SD_JWT_MOCK_TOKENS[0]?.id ?? "");
  const [selectedCheckKey, setSelectedCheckKey] = useState<string>(PROOF_CHECKS[0]?.key ?? "eligibility");
  const [userValues, setUserValues] = useState<Record<string, string>>({ minAge: "18", enableAgeCheck: "1" });
  const [result, setResult] = useState<GenerationResult>({
    status: "idle",
    message: "Choose token/check and generate proof.",
  });
  const [isProofGenerated, setIsProofGenerated] = useState(false);

  const selectedMock = useMemo(
    () => SD_JWT_MOCK_TOKENS.find((token) => token.id === selectedMockId),
    [selectedMockId],
  );

  const selectedCheck = useMemo<ProofCheckDefinition | undefined>(
    () => getProofCheckByKey(selectedCheckKey),
    [selectedCheckKey],
  );

  const userInputs = useMemo(
    () => selectedCheck?.inputs.filter((field) => field.source === "user") ?? [],
    [selectedCheck],
  );

  const setUserValue = (key: string, value: string) => {
    setUserValues((prev) => ({ ...prev, [key]: value }));
  };

  const generateProof = async () => {
    if (!selectedMock?.token?.trim()) {
      setResult({
        status: "error",
        message: "Selected mock SD-JWT is empty.",
      });
      return;
    }

    if (!selectedCheck) {
      setResult({
        status: "error",
        message: "No proof check selected.",
      });
      return;
    }

    try {
      setResult({ status: "running-generate", message: "Generating witness and proof..." });
      setIsProofGenerated(false);

      const input = buildEligibilityCircuitInputFromToken(selectedMock.token, {
        currentDate: normalizeYyyyMmDd(getUtcPlus2YyyyMmDd(), "Current date"),
        minAge: userValues.minAge,
        enableAgeCheck: userValues.enableAgeCheck ?? "1",
      });

      const baseUrl = resolveProofServiceUrl();
      const response = await fetch(`${baseUrl}/proof/${selectedCheck.key}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...input,
          surveyId: "proof-generator",
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Proof generation failed.");
      }

      setResult({
        status: "generated",
        message: `Proof generated. Input file: ${payload.inputPath}`,
      });
      setIsProofGenerated(true);
    } catch (error) {
      setResult({
        status: "error",
        message: error instanceof Error ? error.message : "Unable to prepare proof generation.",
      });
      setIsProofGenerated(false);
    }
  };

  const verifyProof = async () => {
    try {
      setResult({ status: "running-verify", message: "Verifying proof..." });

      const baseUrl = resolveProofServiceUrl();
      const response = await fetch(`${baseUrl}/proof/${selectedCheckKey}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Verification request failed.");
      }

      if (payload.ok) {
        setResult({ status: "ok", message: "Proof verification is ok." });
      } else {
        setResult({ status: "error", message: "Proof verification is not ok." });
      }
    } catch (error) {
      setResult({
        status: "error",
        message: error instanceof Error ? error.message : "Unable to verify proof.",
      });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Proof Generator</Text>
        <Pressable onPress={onClose} style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}>
          <MaterialIcons name="close" size={24} color={palette.primary} />
        </Pressable>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.label}>Select mocked SD-JWT</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={selectedMockId} onValueChange={(value) => setSelectedMockId(String(value))}>
              {SD_JWT_MOCK_TOKENS.map((mock) => (
                <Picker.Item key={mock.id} label={mock.label} value={mock.id} />
              ))}
            </Picker>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Select check</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={selectedCheckKey}
              onValueChange={(value) => {
                setSelectedCheckKey(String(value));
                setIsProofGenerated(false);
                setResult({
                  status: "idle",
                  message: "Choose token/check and generate proof.",
                });
              }}
            >
              {PROOF_CHECKS.map((check) => (
                <Picker.Item key={check.key} label={check.label} value={check.key} />
              ))}
            </Picker>
          </View>
          <Text style={styles.help}>{selectedCheck?.description}</Text>
        </View>

        {userInputs.map((field) => (
          <View key={field.key} style={styles.card}>
            <Text style={styles.label}>{field.label}</Text>
            <TextInput
              value={userValues[field.key] ?? ""}
              onChangeText={(value) => setUserValue(field.key, value)}
              placeholder="Enter value"
              placeholderTextColor={palette.textMuted}
              keyboardType="number-pad"
              style={styles.input}
            />
          </View>
        ))}

        <Pressable
          onPress={generateProof}
          disabled={result.status === "running-generate" || result.status === "running-verify"}
          style={({ pressed }) => [
            styles.button,
            (pressed || result.status === "running-generate" || result.status === "running-verify") && styles.buttonPressed,
          ]}
        >
          {result.status === "running-generate" ? (
            <ActivityIndicator color={palette.white} />
          ) : (
            <Text style={styles.buttonText}>Generate Proof</Text>
          )}
        </Pressable>

        {isProofGenerated ? (
          <Pressable
            onPress={verifyProof}
            disabled={result.status === "running-verify" || result.status === "running-generate"}
            style={({ pressed }) => [
              styles.buttonSecondary,
              (pressed || result.status === "running-verify" || result.status === "running-generate") && styles.buttonSecondaryPressed,
            ]}
          >
            {result.status === "running-verify" ? (
              <ActivityIndicator color={palette.primary} />
            ) : (
              <Text style={styles.buttonSecondaryText}>Verify Proof</Text>
            )}
          </Pressable>
        ) : null}

        <View
          style={[
            styles.card,
            result.status === "error" ? styles.errorCard : result.status === "ok" ? styles.successCard : undefined,
          ]}
        >
          <Text style={[styles.resultTitle, result.status === "error" ? styles.errorText : styles.successText]}>
            {result.status === "error"
              ? "Not ok"
              : result.status === "ok"
                ? "Ok"
                : result.status === "running-generate" || result.status === "running-verify"
                  ? "Running"
                  : result.status === "generated"
                    ? "Generated"
                  : "Idle"}
          </Text>
          <Text style={styles.help}>{result.message}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.primaryNegative,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.white,
  },
  title: {
    color: palette.primaryDark,
    fontSize: 18,
    fontWeight: "700",
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonPressed: {
    opacity: 0.7,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  card: {
    backgroundColor: palette.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 10,
    marginBottom: 10,
  },
  label: {
    color: palette.primaryDark,
    fontWeight: "700",
    marginBottom: 6,
  },
  help: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 6,
  },
  input: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    color: palette.primaryDark,
    marginBottom: 6,
  },
  button: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  buttonSecondary: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: palette.primaryNegative,
    borderWidth: 1,
    borderColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  buttonSecondaryPressed: {
    opacity: 0.8,
  },
  buttonSecondaryText: {
    color: palette.primary,
    fontWeight: "700",
  },
  buttonPressed: {
    backgroundColor: palette.primaryPressed,
  },
  buttonText: {
    color: palette.white,
    fontWeight: "700",
  },
  resultTitle: {
    fontWeight: "700",
    marginBottom: 4,
  },
  successText: {
    color: palette.success,
  },
  errorText: {
    color: palette.warning,
  },
  successCard: {
    borderColor: palette.successLight,
  },
  errorCard: {
    borderColor: palette.warningLight,
  },
});
