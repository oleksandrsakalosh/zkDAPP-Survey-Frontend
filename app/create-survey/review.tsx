import * as React from "react";
import { useState } from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { createElectionOnChain } from "@/services/contractService";
import { palette } from "@/theme/palette";
import { showAlert } from "@/utils/platformAlert";
import { useSurveyDraft } from "@/utils/SurveyDraftContext";

export default function SurveyReviewStep() {
    const { draft, setDraft, resetDraft } = useSurveyDraft();
    const [anonymity, setAnonymity] = useState(draft.anonymity ?? true);
    const [isPublishing, setIsPublishing] = useState(false);

    const onPublish = async () => {
        const nextDraft = {
            ...draft,
            rewardPerVoter: null,
            voterCap: null,
            anonymity,
        };

        setDraft(nextDraft);

        try {
            setIsPublishing(true);
            const createdElection = await createElectionOnChain(nextDraft);
            resetDraft();

            showAlert(
                "Survey registered",
                `Election ${createdElection.electionId} was created on Sepolia.\n\nEligibility tokenId: ${createdElection.tokenId}\nTx: ${createdElection.txHash}\n\nStart the election after the start date to create the Vocdoni process with the ERC1155 token census.`
            );

            router.replace("/(tabs)/mySurveys");
        } catch (error) {
            showAlert(
                "Registration failed",
                error instanceof Error ? error.message : "Unable to register survey on-chain."
            );
        } finally {
            setIsPublishing(false);
        }
    };

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
                    <Ionicons name="chevron-back" size={22} color="#111827" />
                </Pressable>
                <Text style={styles.headerTitle}>Create Survey</Text>
            </View>

            <View style={styles.sectionTop}>
                <Text style={styles.sectionTitle}>Review & Publish</Text>
                <View style={styles.divider} />

                <View style={styles.stepsRow}>
                    <View style={styles.stepPill} />
                    <View style={styles.stepPill} />
                    <View style={[styles.stepPill, styles.stepPillActive]} />
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>{draft.name || "Untitled survey"}</Text>
                    <Text style={styles.cardBody}>{draft.description || "No description provided."}</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardLabel}>Timeline</Text>
                    <Text style={styles.cardValue}>
                        {draft.startDate ? new Date(draft.startDate).toLocaleString() : "No start date"}
                    </Text>
                    <Text style={styles.cardValue}>
                        {draft.endDate ? new Date(draft.endDate).toLocaleString() : "No end date"}
                    </Text>
                </View>

                <View style={styles.metricsRow}>
                    <View style={styles.metricCard}>
                        <Text style={styles.metricValue}>{draft.questions.length}</Text>
                        <Text style={styles.metricLabel}>Questions</Text>
                    </View>
                    <View style={styles.metricCard}>
                        <Text style={styles.metricValue}>{draft.requirements.length}</Text>
                        <Text style={styles.metricLabel}>Requirements</Text>
                    </View>
                    <View style={styles.metricCard}>
                        <Text style={styles.metricValue}>{draft.category || "-"}</Text>
                        <Text style={styles.metricLabel}>Category</Text>
                    </View>
                </View>

                <View style={styles.card}>
                    <View style={styles.anonRow}>
                        <View style={styles.anonCopy}>
                            <Text style={styles.anonTitle}>Anonymity Mode</Text>
                            <Text style={styles.anonText}>Hides your identity from survey participants.</Text>
                        </View>
                        <Switch
                            value={anonymity}
                            onValueChange={(value) => {
                                setAnonymity(value);
                                setDraft({ ...draft, anonymity: value });
                            }}
                            trackColor={{ false: "#E5E7EB", true: palette.primary }}
                            thumbColor={palette.white}
                        />
                    </View>
                </View>

                <View style={{ height: 110 }} />
            </ScrollView>

            <View style={styles.bottomBar}>
                <Pressable style={styles.draftBtn} onPress={() => console.log("Save draft review")}>
                    <Text style={styles.draftText}>Save as Draft</Text>
                </Pressable>

                <Pressable
                    style={[styles.publishBtn, isPublishing && styles.publishBtnDisabled]}
                    onPress={onPublish}
                    disabled={isPublishing}
                >
                    <Text style={styles.publishText}>{isPublishing ? "Publishing..." : "Publish"}</Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.white },
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
        backgroundColor: palette.white,
    },
    headerTitle: { fontSize: 26, fontWeight: "800", color: "#111827" },
    sectionTop: { paddingHorizontal: 16, paddingBottom: 10 },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
    divider: { height: 2, backgroundColor: "#111827", marginTop: 8, borderRadius: 2 },
    stepsRow: { flexDirection: "row", gap: 10, marginTop: 10 },
    stepPill: { flex: 1, height: 4, borderRadius: 999, backgroundColor: "#E5E7EB" },
    stepPillActive: { backgroundColor: palette.primary },
    content: { paddingHorizontal: 16, paddingTop: 14 },
    card: {
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        backgroundColor: palette.white,
        padding: 16,
        gap: 8,
        marginBottom: 14,
    },
    cardTitle: { fontSize: 18, fontWeight: "800", color: "#111827" },
    cardBody: { color: "#6B7280", lineHeight: 20 },
    cardLabel: { fontSize: 12, fontWeight: "800", color: "#6B7280", textTransform: "uppercase" },
    cardValue: { fontSize: 15, fontWeight: "600", color: "#111827" },
    metricsRow: { flexDirection: "row", gap: 12, marginBottom: 14 },
    metricCard: {
        flex: 1,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        backgroundColor: "#F8FAFC",
        padding: 14,
    },
    metricValue: { fontSize: 18, fontWeight: "800", color: "#111827" },
    metricLabel: { marginTop: 4, fontSize: 12, fontWeight: "700", color: "#6B7280" },
    anonRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    anonCopy: { flex: 1 },
    anonTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
    anonText: { marginTop: 6, color: "#6B7280", fontWeight: "600" },
    bottomBar: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        borderTopWidth: 1,
        borderTopColor: "#E5E7EB",
        backgroundColor: palette.white,
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
        backgroundColor: palette.white,
    },
    draftText: { fontSize: 16, fontWeight: "700", color: "#6B7280" },
    publishBtn: {
        flex: 1.4,
        height: 56,
        borderRadius: 16,
        backgroundColor: palette.primary,
        alignItems: "center",
        justifyContent: "center",
    },
    publishBtnDisabled: { opacity: 0.7 },
    publishText: { fontSize: 16, fontWeight: "900", color: palette.white },
});
