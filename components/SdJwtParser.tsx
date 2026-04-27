import React, { useMemo, useState } from "react";
import {
    Clipboard,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { MaterialIcons } from "@expo/vector-icons";

import { palette } from "@/theme/palette";
import { SD_JWT_MOCK_TOKENS } from "@/utils/sdjwt/mockTookens";
import { parseSdJwt } from "@/utils/sdjwt/parser";

interface SdJwtParserProps {
    onClose?: () => void;
}

interface ParsedField {
    label: string;
    value: string;
}

function prettyJson(value: unknown): string {
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

export default function SdJwtParser({ onClose }: SdJwtParserProps) {
    const [selectedMockId, setSelectedMockId] = useState<string>(SD_JWT_MOCK_TOKENS[0]?.id ?? "");
    const [copiedField, setCopiedField] = useState<string>("");

    const selectedMock = useMemo(
        () => SD_JWT_MOCK_TOKENS.find((mock) => mock.id === selectedMockId),
        [selectedMockId],
    );

    const parseResult = useMemo(() => {
        if (!selectedMock?.token?.trim()) {
            return {
                fields: [] as ParsedField[],
                warnings: [
                    "This mock token is empty. Paste your custom SD-JWT into the matching mock file first.",
                ],
                error: "",
            };
        }

        try {
            const parsed = parseSdJwt(selectedMock.token);
            const fields: ParsedField[] = [
                {
                    label: "Issuer JWT Header",
                    value: prettyJson(parsed.issuerJwt.headerJson),
                },
                {
                    label: "Issuer JWT Payload",
                    value: prettyJson(parsed.issuerJwt.payloadJson),
                },
                {
                    label: "Issuer Signature (base64url)",
                    value: parsed.issuerJwt.encodedSignature,
                },
                {
                    label: "Issuer Signature (hex)",
                    value: parsed.issuerJwt.signatureHex,
                },
                {
                    label: "Signing Input (header.payload)",
                    value: parsed.issuerJwt.signingInput,
                },
                {
                    label: "Key-Binding JWT",
                    value: parsed.keyBindingJwt ?? "Missing (current custom format)",
                },
                {
                    label: "Attributes (from disclosures)",
                    value: prettyJson(parsed.attributes),
                },
                {
                    label: "Disclosures (decoded)",
                    value: prettyJson(parsed.disclosures),
                },
            ];

            return {
                fields,
                warnings: parsed.warnings,
                error: "",
            };
        } catch (error) {
            return {
                fields: [] as ParsedField[],
                warnings: [] as string[],
                error:
                    error instanceof Error
                        ? error.message
                        : "Unable to parse this SD-JWT.",
            };
        }
    }, [selectedMock]);

    const copyFieldToClipboard = (label: string, value: string) => {
        Clipboard.setString(`${label}\n${value}`);
        setCopiedField(label);
        setTimeout(() => {
            setCopiedField((prev) => (prev === label ? "" : prev));
        }, 1200);
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>SD-JWT Parser</Text>
                <Pressable
                    onPress={onClose}
                    style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
                >
                    <MaterialIcons name="close" size={24} color={palette.primary} />
                </Pressable>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.pickerCard}>
                    <Text style={styles.pickerLabel}>Select mocked SD-JWT</Text>
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

                {parseResult.error ? (
                    <View style={styles.errorCard}>
                        <Text style={styles.errorTitle}>Parse error</Text>
                        <Text selectable style={styles.errorText}>
                            {parseResult.error}
                        </Text>
                    </View>
                ) : null}

                {parseResult.warnings.length > 0 ? (
                    <View style={styles.warningCard}>
                        <Text style={styles.warningTitle}>Warnings</Text>
                        {parseResult.warnings.map((warning, index) => (
                            <Text key={`${warning}-${index}`} selectable style={styles.warningText}>
                                • {warning}
                            </Text>
                        ))}
                    </View>
                ) : null}

                {parseResult.fields.map((field) => (
                    <View key={field.label} style={styles.fieldCard}>
                        <View style={styles.fieldHeader}>
                            <Text style={styles.fieldLabel}>{field.label}</Text>
                            <Pressable
                                onPress={() => copyFieldToClipboard(field.label, field.value)}
                                style={({ pressed }) => [styles.copyButton, pressed && styles.copyButtonPressed]}
                            >
                                <MaterialIcons
                                    name={copiedField === field.label ? "check" : "content-copy"}
                                    size={16}
                                    color={copiedField === field.label ? "#237804" : palette.textMuted}
                                />
                                <Text
                                    style={[
                                        styles.copyButtonText,
                                        copiedField === field.label && styles.copyButtonTextCopied,
                                    ]}
                                >
                                    {copiedField === field.label ? "Copied" : "Copy"}
                                </Text>
                            </Pressable>
                        </View>
                        <Text selectable style={styles.fieldValue}>
                            {field.value}
                        </Text>
                    </View>
                ))}
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
    pickerCard: {
        backgroundColor: palette.white,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: palette.border,
        padding: 10,
        marginBottom: 10,
    },
    pickerLabel: {
        color: palette.primaryDark,
        fontWeight: "600",
        marginBottom: 6,
    },
    pickerWrap: {
        borderWidth: 1,
        borderColor: palette.border,
        borderRadius: 10,
        overflow: "hidden",
    },
    warningCard: {
        backgroundColor: "#fff8e6",
        borderColor: "#f3d58a",
        borderWidth: 1,
        borderRadius: 12,
        padding: 10,
        marginBottom: 10,
    },
    warningTitle: {
        color: "#8a5a00",
        fontWeight: "700",
        marginBottom: 6,
    },
    warningText: {
        color: "#8a5a00",
        fontSize: 12,
        lineHeight: 16,
        marginBottom: 2,
    },
    errorCard: {
        backgroundColor: "#fff1f0",
        borderColor: "#ffccc7",
        borderWidth: 1,
        borderRadius: 12,
        padding: 10,
        marginBottom: 10,
    },
    errorTitle: {
        color: "#a8071a",
        fontWeight: "700",
        marginBottom: 6,
    },
    errorText: {
        color: "#a8071a",
        fontSize: 12,
        lineHeight: 16,
    },
    fieldCard: {
        backgroundColor: palette.white,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: palette.border,
        padding: 10,
        marginBottom: 10,
    },
    fieldHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 6,
        gap: 8,
    },
    fieldLabel: {
        color: palette.primaryDark,
        fontSize: 13,
        fontWeight: "700",
        flex: 1,
    },
    copyButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.primaryNegative,
    },
    copyButtonPressed: {
        opacity: 0.75,
    },
    copyButtonText: {
        fontSize: 11,
        fontWeight: "700",
        color: palette.textMuted,
    },
    copyButtonTextCopied: {
        color: "#237804",
    },
    fieldValue: {
        color: palette.primaryDark,
        fontSize: 12,
        lineHeight: 17,
        fontFamily: "monospace",
    },
});
