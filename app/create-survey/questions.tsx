import React, { useEffect, useMemo, useState } from "react";
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


type QuestionType = "Multiple choice" | "Paragraph";

type Question = {
    id: string;
    title: string;
    type: QuestionType;
    required: boolean;
    options: string[]; 
};

const TYPES: QuestionType[] = ["Multiple choice", "Paragraph"];

const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const makeQuestion = (overrides?: Partial<Question>): Question => ({
    id: makeId(),
    title: "",
    type: "Multiple choice",
    required: true,
    options: ["", "", ""],
    ...overrides,
});

export default function QuestionsStep() {
    const progress = useMemo(() => 0.5, []);
    const { draft, setDraft } = useSurveyDraft();

    useEffect(() => {
        console.log("DRAFT on step 2:", draft);
    }, [draft]);
    const [questions, setQuestions] = useState<Question[]>(
        draft.questions?.length
            ? draft.questions
            : [makeQuestion(), makeQuestion({ type: "Paragraph", required: false, options: [] })]
    );

    const updateQuestion = (id: string, patch: Partial<Question>) => {
        setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
    };

    const addQuestion = () => setQuestions((prev) => [...prev, makeQuestion()]);
    const removeQuestion = (id: string) => setQuestions((prev) => prev.filter((q) => q.id !== id));
    const duplicateQuestion = (id: string) => {
        setQuestions((prev) => {
            const idx = prev.findIndex((q) => q.id === id);
            if (idx === -1) return prev;
            const copy = { ...prev[idx], id: makeId() };
            return [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)];
        });
    };

    const setType = (id: string, type: QuestionType) => {
        setQuestions((prev) =>
            prev.map((q) => {
                if (q.id !== id) return q;
                if (type === "Paragraph") return { ...q, type, options: [] };
                // Multiple choice
                return { ...q, type, options: q.options?.length ? q.options : ["", ""] };
            })
        );
    };

    const updateOption = (qid: string, index: number, value: string) => {
        setQuestions((prev) =>
            prev.map((q) => {
                if (q.id !== qid) return q;
                const options = [...q.options];
                options[index] = value;
                return { ...q, options };
            })
        );
    };

    const addOption = (qid: string) => {
        setQuestions((prev) =>
            prev.map((q) => {
                if (q.id !== qid) return q;
                const next = [...q.options, ""];
                return { ...q, options: next };
            })
        );
    };

    const removeOption = (qid: string, index: number) => {
        setQuestions((prev) =>
            prev.map((q) => {
                if (q.id !== qid) return q;
                if (q.options.length <= 2) return q;

                const next = q.options.filter((_, i) => i !== index);
                return { ...q, options: next };
            })
        );
    }

    type QuestionError =
        | null
        | "TITLE_REQUIRED"
        | "MIN_2_OPTIONS"
        | "OPTIONS_REQUIRED"; 

    const getQuestionError = (q: Question): QuestionError => {
        const titleOk = q.title.trim().length > 0;
        if (!titleOk) return "TITLE_REQUIRED";

        if (q.type === "Paragraph") return null;

        const trimmed = q.options.map((o) => o.trim());
        if (trimmed.length < 2) return "MIN_2_OPTIONS";
        if (!trimmed.every((o) => o.length > 0)) return "OPTIONS_REQUIRED";

        return null;
    };


    const allQuestionsValid = useMemo(
        () => questions.length > 0 && questions.every((q) => getQuestionError(q) === null),
        [questions]
    );

    const [submitAttempted, setSubmitAttempted] = useState(false);
    const showError = submitAttempted && !allQuestionsValid;

    const onNext = () => {
        setSubmitAttempted(true);
        if (!allQuestionsValid) return;

        const cleaned = questions.map((q) => ({
            id: q.id,
            title: q.title.trim(),
            type: q.type,
            required: q.required,
            options: q.type === "Multiple choice" ? q.options.map((o) => o.trim()) : [],
        }));

        setDraft((p) => ({ ...p, questions: cleaned }));
        router.push("/create-survey/requirements");
    };


    return (
        <SafeAreaView style={styles.safe}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
                    <Ionicons name="chevron-back" size={22} color="#111827" />
                </Pressable>
                <Text style={styles.headerTitle}>Create Survey</Text>

                <Pressable onPress={addQuestion} style={styles.addQBtn}>
                    <Text style={styles.addQText}>+ Add</Text>
                </Pressable>
            </View>

            {/* Section title + divider + progress */}
            <View style={styles.sectionTop}>
                <Text style={styles.sectionTitle}>Questions</Text>
                <View style={styles.divider} />

                <View style={styles.stepsRow}>
                    <View style={styles.stepPill} />
                    <View style={[styles.stepPill, styles.stepPillActive]} />
                    <View style={styles.stepPill} />
                    <View style={styles.stepPill} />
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {questions.map((q, idx) => {
                    const err = submitAttempted ? getQuestionError(q) : null;
                    const titleError = err === "TITLE_REQUIRED";
                    const optionsCountError = err === "MIN_2_OPTIONS";
                    const optionsEmptyError = err === "OPTIONS_REQUIRED";

                    return (
                        <View key={q.id} style={[styles.cardOuter, err && styles.cardOuterError]}>
                            <View style={styles.leftAccent} />

                            <View style={styles.cardInner}>
                                <View style={styles.topRow}>
                                    <View style={styles.qBadge}>
                                        <Text style={styles.qBadgeText}>Q{idx + 1}</Text>
                                    </View>

                                    <TextInput
                                        value={q.title}
                                        onChangeText={(t) => updateQuestion(q.id, { title: t })}
                                        placeholder="Question"
                                        placeholderTextColor="#9CA3AF"
                                        style={[styles.qTitleInput, titleError && styles.inputError]}
                                    />

                                    <Pressable
                                        onPress={() => {
                                            const curIndex = TYPES.indexOf(q.type);
                                            const next = TYPES[(curIndex + 1) % TYPES.length];
                                            setType(q.id, next);
                                        }}
                                        style={styles.typePill}
                                    >
                                        <Text style={styles.typeText}>{q.type}</Text>
                                        <Ionicons name="chevron-down" size={16} color="#6B7280" />
                                    </Pressable>
                                </View>

                                {q.type === "Multiple choice" && (
                                    <View style={{ marginTop: 14 }}>
                                        {q.options.map((opt, i) => {
                                            const optIsEmpty =
                                                submitAttempted && q.type === "Multiple choice" && opt.trim().length === 0;

                                            return (
                                                <View key={`${q.id}-opt-${i}`} style={styles.optionRow}>
                                                    <View style={styles.radioDot} />
                                                    <View style={styles.optionBox}>
                                                        <TextInput
                                                            value={opt}
                                                            onChangeText={(t) => updateOption(q.id, i, t)}
                                                            placeholder={`Option ${i + 1}`}
                                                            placeholderTextColor="#9CA3AF"
                                                            style={[
                                                                styles.optionInput,
                                                                (optionsCountError || optionsEmptyError) && optIsEmpty && styles.inputError,
                                                            ]}
                                                        />
                                                    </View>

                                                    <Pressable onPress={() => removeOption(q.id, i)} hitSlop={10}>
                                                        <Ionicons name="close" size={18} color="#9CA3AF" />
                                                    </Pressable>
                                                </View>
                                            );
                                        })}

                                        <Pressable onPress={() => addOption(q.id)} style={styles.addOptionBtn}>
                                            <Text style={styles.addOptionPlus}>+</Text>
                                            <Text style={styles.addOptionText}>Add option</Text>
                                        </Pressable>
                                    </View>
                                )}

                                {q.type === "Paragraph" && (
                                    <View style={[styles.paragraphBox, { marginTop: 14 }]}>
                                        <Text style={styles.paragraphPlaceholder}>
                                            Answer text (long) — no predefined options
                                        </Text>
                                    </View>
                                )}

                                {/* сообщение об ошибке внутри карточки */}
                                {err && (
                                    <Text style={styles.inlineErrorText}>
                                        {err === "TITLE_REQUIRED" && "Question title is required."}
                                        {err === "MIN_2_OPTIONS" && "Add at least 2 options."}
                                        {err === "OPTIONS_REQUIRED" && "Fill all options (no empty options)."}
                                    </Text>
                                )}

                                <View style={styles.hr} />

                                <View style={styles.bottomRow}>
                                    <View style={{ flexDirection: "row", gap: 10 }}>
                                        <Pressable onPress={() => duplicateQuestion(q.id)} style={styles.iconBtn}>
                                            <Ionicons name="copy-outline" size={18} color="#6B7280" />
                                        </Pressable>

                                        <Pressable
                                            onPress={() => removeQuestion(q.id)}
                                            style={[styles.iconBtn, styles.iconBtnDanger]}
                                        >
                                            <Ionicons name="trash-outline" size={18} color="#EF4444" />
                                        </Pressable>
                                    </View>

                                    <View style={styles.requiredRow}>
                                        <Text style={styles.requiredText}>Required</Text>
                                        <Switch
                                            value={q.required}
                                            onValueChange={(v) => updateQuestion(q.id, { required: v })}
                                            trackColor={{ false: "#E5E7EB", true: "#2F6BFF" }}
                                            thumbColor="#FFFFFF"
                                        />
                                    </View>
                                </View>
                            </View>
                        </View>
                    );
                })}
                {showError && (
                    <Text style={styles.errorText}>
                        Fill all questions. For multiple choice, the question and all options must be filled.
                    </Text>
                )}
                <View style={{ height: 110 }} />

            </ScrollView>

            {/* Bottom bar (как у вас) */}
            <View style={styles.bottomBar}>
                <Pressable style={styles.draftBtn} onPress={() => console.log("Save draft questions")}>
                    <Text style={styles.draftText}>Save as Draft</Text>
                </Pressable>

                <Pressable style={styles.nextBtn} onPress={onNext}>
                    <Text style={styles.nextText}>Next (2/4)</Text>
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
    headerTitle: { fontSize: 26, fontWeight: "800", color: "#111827", flex: 1 },

    addQBtn: {
        height: 36,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
    },
    addQText: { fontWeight: "800", color: "#2F6BFF" },

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

    content: { paddingHorizontal: 16, paddingTop: 10 },

    cardOuter: {
        position: "relative",
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        backgroundColor: "#F9FAFB",
        overflow: "hidden",
        marginBottom: 14,
    },
    leftAccent: {
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
        backgroundColor: "#CFE3FF",
    },
    cardInner: { padding: 14, paddingLeft: 18 },

    topRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },

    qBadge: {
        width: 34,
        height: 34,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        backgroundColor: "#F3F4F6",
        alignItems: "center",
        justifyContent: "center",
    },
    qBadgeText: { fontWeight: "800", color: "#6B7280" },

    qTitleInput: {
        flex: 1,
        height: 44,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        borderRadius: 14,
        paddingHorizontal: 12,
        fontSize: 16,
        color: "#111827",
        backgroundColor: "#FFFFFF",
    },

    typePill: {
        height: 44,
        paddingHorizontal: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        backgroundColor: "#FFFFFF",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    typeText: { fontSize: 14, fontWeight: "800", color: "#111827" },

    optionRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
    radioDot: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        borderColor: "#E5E7EB",
        backgroundColor: "#FFFFFF",
    },
    optionBox: { flex: 1 },
    optionInput: {
        height: 44,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        borderRadius: 14,
        paddingHorizontal: 12,
        fontSize: 16,
        color: "#111827",
        backgroundColor: "#FFFFFF",
    },

    addOptionBtn: {
        alignSelf: "flex-start",
        marginLeft: 30,
        marginTop: 4,
        borderWidth: 1.5,
        borderColor: "#CFE3FF",
        borderStyle: "dashed",
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: "#FFFFFF",
    },
    addOptionPlus: { color: "#2F6BFF", fontSize: 18, fontWeight: "900" },
    addOptionText: { color: "#2F6BFF", fontSize: 14, fontWeight: "900" },

    paragraphBox: {
        borderWidth: 1,
        borderColor: "#E5E7EB",
        borderRadius: 14,
        backgroundColor: "#EEF2F7",
        padding: 14,
    },
    paragraphPlaceholder: { color: "#6B7280", fontStyle: "italic" },

    hr: { height: 1, backgroundColor: "#E5E7EB", marginTop: 14, marginBottom: 12 },

    bottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

    iconBtn: {
        width: 42,
        height: 42,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
    },
    iconBtnDanger: {
        backgroundColor: "#FEE2E2",
        borderColor: "#FECACA",
    },

    requiredRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    requiredText: { color: "#6B7280", fontWeight: "800" },

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
    // 1) styles.errorText (добавь в StyleSheet.create)
    errorText: {
        color: "#EF4444",
        fontSize: 12,
        fontWeight: "700",
        paddingHorizontal: 16,
        paddingBottom: 6,
    },
    cardOuterError: {
        borderColor: "#EF4444",
        borderWidth: 1.5,
    },

    inputError: {
        borderColor: "#EF4444",
        borderWidth: 1.5,
        backgroundColor: "#FEF2F2",
    },

    inlineErrorText: {
        marginTop: 10,
        color: "#EF4444",
        fontSize: 12,
        fontWeight: "700",
    },
});