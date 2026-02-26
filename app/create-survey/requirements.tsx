import React, { useMemo, useState } from "react";
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TextInput,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSurveyDraft } from "./SurveyDraftContext";

type Requirement = {
    id: string;
    type: string; 
    value: string;
};

const TYPES = ["Age", "Location", "Education level"];

const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const placeholderByType: Record<string, string> = {
    Age: "18–35",
    Location: "United States",
    "Education level": "College+",
};

export default function RequirementsStep() {
    const { draft, setDraft } = useSurveyDraft();
    console.log(draft);
    const progress = useMemo(() => 0.75, []);
    const [requirements, setRequirements] = useState<Requirement[]>(
        draft.requirements?.length
          ? draft.requirements
          : [
              { id: makeId(), type: "Age", value: "" },
              { id: makeId(), type: "Location", value: "" },
              { id: makeId(), type: "Education level", value: "" },
            ]
      );


    const updateReq = (id: string, patch: Partial<Requirement>) => {
        setRequirements((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    };

    const removeReq = (id: string) => setRequirements((prev) => prev.filter((r) => r.id !== id));

    const addReq = () => {
        setRequirements((prev) => [
            ...prev,
            { id: makeId(), type: "", value: "" },
        ]);
    };

    const [submitAttempted, setSubmitAttempted] = useState(false);

    const getReqError = (r: Requirement): string | null => {
        const typeOk = r.type.trim().length > 0;
        if (!typeOk) return null; 
        const valueOk = r.value.trim().length > 0;
        if (!valueOk) return "Value is required for this requirement.";
        return null;
    };

    const allReqsValid = useMemo(
        () => requirements.every((r) => getReqError(r) === null),
        [requirements]
    );
    const onNext = () => {
        setSubmitAttempted(true);
        if (!allReqsValid) return;

        const cleaned = requirements
            .map((r) => ({
                id: r.id,
                type: r.type.trim(),
                value: r.value.trim(),
            }))
            .filter((r) => r.type.length > 0); 

        setDraft((p) => ({ ...p, requirements: cleaned }));

        router.push("/create-survey/review");
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
                <Text style={styles.sectionTitle}>Voter Requirements</Text>
                <View style={styles.divider} />

                <View style={styles.stepsRow}>
                    <View style={styles.stepPill} />
                    <View style={styles.stepPill} />
                    <View style={[styles.stepPill, styles.stepPillActive]} />
                    <View style={styles.stepPill} />
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* Info box */}
                <View style={styles.infoBox}>
                    <View style={styles.infoIconWrap}>
                        <Ionicons name="information" size={16} color="#2F6BFF" />
                    </View>
                    <Text style={styles.infoText}>
                        Set conditions voters must meet before they can participate. Leave empty to allow anyone.
                    </Text>
                </View>

                {/* Requirements list */}
                {requirements.map((r) => {
                    const err = submitAttempted ? getReqError(r) : null;
                    const valueError = !!err;

                    return (
                        <View key={r.id} style={{ marginBottom: 14 }}>
                            <View style={styles.reqRow}>
                                <TextInput
                                    value={r.type}
                                    onChangeText={(t) => updateReq(r.id, { type: t })}
                                    placeholder="Requirement (e.g. Age)"
                                    placeholderTextColor="#9CA3AF"
                                    style={styles.reqTypeInput}
                                />

                                <Pressable onPress={() => removeReq(r.id)} style={styles.trashBtn} hitSlop={10}>
                                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                                </Pressable>
                            </View>

                            <TextInput
                                value={r.value}
                                onChangeText={(t) => updateReq(r.id, { value: t })}
                                placeholder={
                                    r.type.toLowerCase().includes("age")
                                        ? "18–35"
                                        : r.type.toLowerCase().includes("location")
                                            ? "United States"
                                            : r.type.toLowerCase().includes("education")
                                                ? "College+"
                                                : "Enter value"
                                }
                                placeholderTextColor="#9CA3AF"
                                style={[styles.reqInput, valueError && styles.inputError]}
                            />

                            {valueError && <Text style={styles.inlineErrorText}>{err}</Text>}
                        </View>
                    );
                })}

                {/* Add requirement */}
                <Pressable onPress={addReq} style={styles.addReqBtn}>
                    <Text style={styles.addReqPlus}>+</Text>
                    <Text style={styles.addReqText}>Add requirement</Text>
                </Pressable>

                <View style={{ height: 110 }} />
            </ScrollView>

            {/* Bottom Bar */}
            <View style={styles.bottomBar}>
                <Pressable style={styles.draftBtn} onPress={() => console.log("Save draft step3")}>
                    <Text style={styles.draftText}>Save as Draft</Text>
                </Pressable>

                <Pressable style={styles.nextBtn} onPress={onNext}>
                    <Text style={styles.nextText}>Next (3/4)</Text>
                    <Text style={styles.nextArrow}>›</Text>
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

    infoBox: {
        borderWidth: 1,
        borderColor: "#CFE3FF",
        backgroundColor: "#EEF4FF",
        borderRadius: 16,
        padding: 14,
        flexDirection: "row",
        gap: 12,
        marginBottom: 16,
    },
    infoIconWrap: {
        width: 26,
        height: 26,
        borderRadius: 13,
        borderWidth: 1,
        borderColor: "#CFE3FF",
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 2,
    },
    infoText: { flex: 1, color: "#2F6BFF", fontWeight: "700", lineHeight: 20 },

    reqRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    reqSelect: {
        flex: 1,
        height: 54,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        borderRadius: 16,
        paddingHorizontal: 14,
        backgroundColor: "#FFFFFF",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    reqSelectText: { fontSize: 16, fontWeight: "700", color: "#111827" },

    trashBtn: {
        width: 54,
        height: 54,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: "#FECACA",
        backgroundColor: "#FEE2E2",
        alignItems: "center",
        justifyContent: "center",
    },

    reqInput: {
        marginTop: 10,
        height: 54,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        borderRadius: 16,
        paddingHorizontal: 14,
        fontSize: 16,
        color: "#111827",
        backgroundColor: "#FFFFFF",
    },

    addReqBtn: {
        marginTop: 8,
        height: 64,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: "#CFE3FF",
        borderStyle: "dashed",
        backgroundColor: "#EEF4FF",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
    },
    addReqPlus: { fontSize: 20, fontWeight: "900", color: "#111827" },
    addReqText: { fontSize: 16, fontWeight: "900", color: "#2F6BFF" },

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

    nextBtn: {
        flex: 1.4,
        height: 56,
        borderRadius: 16,
        backgroundColor: "#2F6BFF",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
    },
    nextText: { fontSize: 16, fontWeight: "800", color: "#FFFFFF" },
    nextArrow: { color: "#FFFFFF", fontSize: 22, marginLeft: 10, marginTop: -1 },
    reqTypeInput: {
        flex: 1,
        height: 54,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        borderRadius: 16,
        paddingHorizontal: 14,
        fontSize: 16,
        color: "#111827",
        backgroundColor: "#FFFFFF",
    },
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