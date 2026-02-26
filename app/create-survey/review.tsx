import React, { useMemo, useState } from "react";
import {
    View,
    Text,
    TextInput,
    Pressable,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    Switch,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSurveyDraft } from "./SurveyDraftContext";

function money(n: number) {
    // 1050 -> "1,050.00"
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SurveyBudgetStep() {
    const progress = useMemo(() => 1, []); // 4/4
    const { draft, setDraft } = useSurveyDraft();

    const [rewardPerVoterText, setRewardPerVoterText] = useState(
        draft.rewardPerVoter != null ? String(draft.rewardPerVoter) : ""
    );
    const [voterCapText, setVoterCapText] = useState(
        draft.voterCap != null ? String(draft.voterCap) : ""
    );
    const [submitAttempted, setSubmitAttempted] = useState(false);

    const parseMoney = (s: string) => {
        const t = s.trim().replace(",", ".");
        if (t === "") return null;
        const n = Number(t);
        return Number.isFinite(n) && n >= 0 ? n : NaN;
    };

    const parseIntCap = (s: string) => {
        const t = s.trim();
        if (t === "") return null;
        const n = Number(t);
        return Number.isFinite(n) && n >= 0 && Number.isInteger(n) ? n : NaN;
    };

    const rewardN = parseMoney(rewardPerVoterText);
    const capN = parseIntCap(voterCapText);

    const [anonymity, setAnonymity] = useState(true);

    const reward = rewardN && !Number.isNaN(rewardN) ? rewardN : 0;
    const cap = capN && !Number.isNaN(capN) ? capN : 0;

    const rewardPool = reward * cap;
    const platformFee = rewardPool * 0.05;
    const total = rewardPool + platformFee;

    const rewardProvided = rewardPerVoterText.trim().length > 0;
    const capProvided = voterCapText.trim().length > 0;

    const rewardInvalid = rewardProvided && Number.isNaN(rewardN);
    const capInvalid = capProvided && Number.isNaN(capN);

    const rewardMissing = capProvided && !rewardProvided;
    const capMissing = rewardProvided && !capProvided;

    const rewardError =
        submitAttempted && (rewardMissing || rewardInvalid)
            ? rewardMissing
                ? "Reward per Voter is required when Voter Cap is set."
                : "Reward per Voter must be a valid non-negative number."
            : null;

    const capError =
        submitAttempted && (capMissing || capInvalid)
            ? capMissing
                ? "Voter Cap is required when Reward per Voter is set."
                : "Voter Cap must be a whole number (0, 1, 2, ...)."
            : null;

    const isValid = !rewardError && !capError;

    const onPublish = () => {
        setSubmitAttempted(true);
        if (!isValid) return;
      
        setDraft((p) => {
            const next = {
              ...p,
              rewardPerVoter: rewardN === null ? null : rewardN,
              voterCap: capN === null ? null : capN,
            };
            console.log("NEXT DRAFT:", next);
            return next;
          });
      };
    return (
        <SafeAreaView style={styles.safe}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
                    <Ionicons name="chevron-back" size={22} color="#111827" />
                </Pressable>
                <Text style={styles.headerTitle}>Create Survey</Text>
            </View>

            {/* Section title + divider + progress */}
            <View style={styles.sectionTop}>
                <Text style={styles.sectionTitle}>Survey Budget</Text>
                <View style={styles.divider} />

                <View style={styles.stepsRow}>
                    <View style={styles.stepPill} />
                    <View style={styles.stepPill} />
                    <View style={styles.stepPill} />
                    <View style={[styles.stepPill, styles.stepPillActive]} />
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* Reward per Voter */}
                <Text style={styles.label}>Reward per Voter</Text>
                <Text style={styles.helper}>
                    Voters receive this after proving eligibility and casting a vote.
                </Text>
                <TextInput
                    value={rewardPerVoterText}
                    onChangeText={setRewardPerVoterText}
                    placeholder="0.00 (optional)"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                    style={[styles.input, rewardError && styles.inputError]}
                />
                {rewardError && <Text style={styles.inlineErrorText}>{rewardError}</Text>}

                {/* Voter Cap */}
                <Text style={[styles.label, { marginTop: 18 }]}>Voter Cap</Text>
                <Text style={styles.helper}>Maximum number of rewarded voters.</Text>
                <TextInput
                    value={voterCapText}
                    onChangeText={setVoterCapText}
                    placeholder="Maximum rewarded users"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    style={[styles.input, capError && styles.inputError]}
                />
                {capError && <Text style={styles.inlineErrorText}>{capError}</Text>}

                {/* Reward Pool */}
                <Text style={[styles.label, { marginTop: 18 }]}>Reward Pool</Text>
                <Text style={styles.helper}>Total funds locked for voter rewards.</Text>

                <View style={styles.lockedInput}>
                    <Ionicons name="briefcase-outline" size={18} color="#6B7280" />
                    <Text style={styles.lockedText}>Reward per voter × Max voters</Text>
                </View>

                <View style={[styles.lockedInput, { marginTop: 10 }]}>
                    <Ionicons name="briefcase-outline" size={18} color="#6B7280" />
                    <Text style={styles.lockedText}>Required rewards pool</Text>
                </View>

                {/* Estimate */}
                <Pressable style={styles.estimateBtn} onPress={() => { }}>
                    <Ionicons name="create-outline" size={18} color="#111827" />
                    <Text style={styles.estimateText}>Estimate Costs</Text>
                </Pressable>

                {/* Cost breakdown card */}
                <View style={styles.costCard}>
                    <Text style={styles.costTitle}>Cost Breakdown</Text>

                    <View style={styles.costRow}>
                        <Text style={styles.costLeft}>Reward per voter</Text>
                        <Text style={styles.costRight}>${money(reward)}</Text>
                    </View>

                    <View style={styles.costRow}>
                        <Text style={styles.costLeft}>Voter cap</Text>
                        <Text style={styles.costRight}>{cap ? `${cap.toLocaleString("en-US")} voters` : "0 voters"}</Text>
                    </View>

                    <View style={styles.costRow}>
                        <Text style={styles.costLeft}>Reward pool</Text>
                        <Text style={styles.costRight}>${money(rewardPool)}</Text>
                    </View>

                    <View style={styles.costRow}>
                        <Text style={styles.costLeft}>Platform fee (5%)</Text>
                        <Text style={styles.costRight}>${money(platformFee)}</Text>
                    </View>

                    <View style={styles.costHr} />

                    <View style={styles.costRow}>
                        <Text style={styles.totalLeft}>Total cost</Text>
                        <Text style={styles.totalRight}>${money(total)}</Text>
                    </View>
                </View>

                {/* Anonymity mode */}
                <View style={styles.anonCard}>
                    <View style={styles.anonTop}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.anonTitle}>Anonymity Mode</Text>
                            <Text style={styles.anonSub}>Hides your identity from survey participants.</Text>
                            <Text style={styles.anonLink}>How does it work →</Text>
                        </View>

                        <Switch
                            value={anonymity}
                            onValueChange={setAnonymity}
                            trackColor={{ false: "#E5E7EB", true: "#2F6BFF" }}
                            thumbColor="#FFFFFF"
                        />
                    </View>
                </View>

                <View style={{ height: 110 }} />
            </ScrollView>

            {/* Bottom Bar */}
            <View style={styles.bottomBar}>
                <Pressable style={styles.draftBtn} onPress={() => console.log("Save draft step4")}>
                    <Text style={styles.draftText}>Save as Draft</Text>
                </Pressable>

                <Pressable style={styles.publishBtn} onPress={onPublish}>
                    <Text style={styles.publishText}>Publish</Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#FFFFFF" },

    header: {
        paddingHorizontal: 16,
        paddingTop: 6,
        paddingBottom: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FFFFFF",
    },
    headerTitle: { fontSize: 26, fontWeight: "800", color: "#111827" },

    sectionTop: { paddingHorizontal: 16, paddingBottom: 10 },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
    divider: { height: 2, backgroundColor: "#111827", marginTop: 8, borderRadius: 2 },

    progressRow: {
        height: 3,
        backgroundColor: "#E5E7EB",
        borderRadius: 999,
        marginTop: 10,
        overflow: "hidden",
    },
    progressActive: { height: 3, backgroundColor: "#2F6BFF" },

    stepsRow: { flexDirection: "row", gap: 10, marginTop: 10 },
    stepPill: { flex: 1, height: 4, borderRadius: 999, backgroundColor: "#E5E7EB" },
    stepPillActive: { backgroundColor: "#2F6BFF" },

    content: { paddingHorizontal: 16, paddingTop: 14 },

    label: { fontSize: 16, fontWeight: "800", color: "#111827" },
    helper: { marginTop: 6, color: "#6B7280", lineHeight: 18, marginBottom: 10 },

    input: {
        height: 54,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        borderRadius: 16,
        paddingHorizontal: 14,
        fontSize: 16,
        color: "#111827",
        backgroundColor: "#FFFFFF",
    },

    lockedInput: {
        height: 48,
        borderRadius: 12,
        backgroundColor: "#EEF2F7",
        borderWidth: 1,
        borderColor: "#E5E7EB",
        paddingHorizontal: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    lockedText: { color: "#6B7280", fontWeight: "700" },

    estimateBtn: {
        marginTop: 14,
        height: 54,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 10,
    },
    estimateText: { fontSize: 16, fontWeight: "800", color: "#111827" },

    costCard: {
        marginTop: 14,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "#CFE3FF",
        backgroundColor: "#EEF4FF",
        padding: 14,
    },
    costTitle: { fontSize: 13, fontWeight: "900", color: "#2F6BFF", marginBottom: 10 },

    costRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
    costLeft: { color: "#6B7280", fontWeight: "700" },
    costRight: { color: "#111827", fontWeight: "800" },

    costHr: { height: 1, backgroundColor: "#CFE3FF", marginVertical: 10 },

    totalLeft: { color: "#111827", fontWeight: "900" },
    totalRight: { color: "#2F6BFF", fontWeight: "900" },

    anonCard: {
        marginTop: 14,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        backgroundColor: "#FFFFFF",
        padding: 14,
    },
    anonTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    anonTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
    anonSub: { marginTop: 6, color: "#6B7280", fontWeight: "600" },
    anonLink: { marginTop: 8, color: "#2F6BFF", fontWeight: "800" },

    bottomBar: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        borderTopWidth: 1,
        borderTopColor: "#E5E7EB",
        backgroundColor: "#FFFFFF",
        paddingHorizontal: 16,
        paddingVertical: 14,
        flexDirection: "row",
        gap: 12,
    },
    draftBtn: {
        flex: 1,
        height: 56,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: "#E5E7EB",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FFFFFF",
    },
    draftText: { fontSize: 16, fontWeight: "700", color: "#6B7280" },

    publishBtn: {
        flex: 1.4,
        height: 56,
        borderRadius: 16,
        backgroundColor: "#2F6BFF",
        alignItems: "center",
        justifyContent: "center",
    },
    publishText: { fontSize: 16, fontWeight: "900", color: "#FFFFFF" },
    inputError: {
        borderColor: "#EF4444",
        borderWidth: 1.5,
        backgroundColor: "#FEF2F2",
    },
    inlineErrorText: {
        marginTop: 6,
        color: "#EF4444",
        fontSize: 12,
        fontWeight: "700",
    },
});