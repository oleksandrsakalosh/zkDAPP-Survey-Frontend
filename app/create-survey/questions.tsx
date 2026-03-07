import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import {
    View,
    Text,
    TextInput,
    Pressable,
    StyleSheet,
    ScrollView,
    Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { palette } from "@/theme/palette";
import { useSurveyDraft } from "@/utils/SurveyDraftContext";

type QuestionType = "Single choice" | "Multiple choice" | "Paragraph";

type Question = {
    id: string;
    title: string;
    type: QuestionType;
    required: boolean;
    options: string[];
};

const TYPES: QuestionType[] = ["Single choice", "Multiple choice", "Paragraph"];

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
    const { draft, setDraft } = useSurveyDraft();

    useEffect(() => {
        console.log("DRAFT on step 2:", draft);
    }, [draft]);

    const [questions, setQuestions] = useState<Question[]>(
        draft.questions?.length
            ? draft.questions
            : [
                makeQuestion(),
                makeQuestion({ type: "Paragraph", required: false, options: [] }),
            ]
    );

    const [openTypeMenuId, setOpenTypeMenuId] = useState<string | null>(null);

    const isChoiceType = (type: QuestionType) =>
        type === "Single choice" || type === "Multiple choice";

    const updateQuestion = (id: string, patch: Partial<Question>) => {
        setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
    };

    const addQuestion = () => setQuestions((prev) => [...prev, makeQuestion()]);

    const removeQuestion = (id: string) =>
        setQuestions((prev) => prev.filter((q) => q.id !== id));

    const duplicateQuestion = (id: string) => {
        setQuestions((prev) => {
            const idx = prev.findIndex((q) => q.id === id);
            if (idx === -1) return prev;
            const copy = {
                ...prev[idx],
                id: makeId(),
                options: [...prev[idx].options],
            };
            return [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)];
        });
    };

    const setType = (id: string, type: QuestionType) => {
        setQuestions((prev) =>
            prev.map((q) => {
                if (q.id !== id) return q;

                if (type === "Paragraph") {
                    return { ...q, type, options: [] };
                }

                return {
                    ...q,
                    type,
                    options: q.options?.length ? q.options : ["", ""],
                };
            })
        );
        setOpenTypeMenuId(null);
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
                return { ...q, options: [...q.options, ""] };
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
    };

    type QuestionError =
        | null
        | "TITLE_REQUIRED"
        | "MIN_2_OPTIONS"
        | "OPTIONS_REQUIRED";

    const getQuestionError = (q: Question): QuestionError => {
        const titleOk = q.title.trim().length > 0;
        if (!titleOk) return "TITLE_REQUIRED";

        if (!isChoiceType(q.type)) return null;

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
            options: isChoiceType(q.type) ? q.options.map((o) => o.trim()) : [],
        }));

        setDraft((p) => ({ ...p, questions: cleaned }));
        router.push("/create-survey/requirements");
    };

    return (
        <SafeAreaView style={styles.safe}>
            <Pressable style={{ flex: 1 }} onPress={() => setOpenTypeMenuId(null)}>
                <View style={styles.header}>
                    <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
                        <Ionicons name="chevron-back" size={22} color="#111827" />
                    </Pressable>
                    <Text style={styles.headerTitle}>Create Survey</Text>
                </View>

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

                <ScrollView
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {questions.map((q, idx) => {
                        const err = submitAttempted ? getQuestionError(q) : null;
                        const titleError = err === "TITLE_REQUIRED";
                        const optionsCountError = err === "MIN_2_OPTIONS";
                        const optionsEmptyError = err === "OPTIONS_REQUIRED";

                        return (
                            <View
                                key={q.id}
                                style={[styles.cardOuter, err && styles.cardOuterError]}
                            >
                                <View style={styles.leftAccent} />

                                <Pressable style={styles.cardInner} onPress={() => setOpenTypeMenuId(null)}>
                                    <View style={styles.topRow}>
                                        <View style={styles.qBadge}>
                                            <Text style={styles.qBadgeText}>Q{idx + 1}</Text>
                                        </View>

                                        <TextInput
                                            value={q.title}
                                            onChangeText={(t) => updateQuestion(q.id, { title: t })}
                                            placeholder="Question"
                                            placeholderTextColor="#9CA3AF"
                                            style={[
                                                styles.qTitleInput,
                                                titleError && styles.inputError,
                                            ]}
                                        />

                                        <View style={styles.typeMenuWrap}>
                                            <Pressable
                                                onPress={(e) => {
                                                    e.stopPropagation();
                                                    setOpenTypeMenuId((prev) =>
                                                        prev === q.id ? null : q.id
                                                    );
                                                }}
                                                style={styles.typePill}
                                            >
                                                <Text style={styles.typeText}>{q.type}</Text>
                                                <Ionicons
                                                    name={
                                                        openTypeMenuId === q.id
                                                            ? "chevron-up"
                                                            : "chevron-down"
                                                    }
                                                    size={16}
                                                    color="#6B7280"
                                                />
                                            </Pressable>

                                            {openTypeMenuId === q.id && (
                                                <View style={styles.dropdownMenu}>
                                                    {TYPES.map((type) => {
                                                        const active = q.type === type;

                                                        return (
                                                            <Pressable
                                                                key={type}
                                                                onPress={(e) => {
                                                                    e.stopPropagation();
                                                                    setType(q.id, type);
                                                                }}
                                                                style={[
                                                                    styles.dropdownItem,
                                                                    active && styles.dropdownItemActive,
                                                                ]}
                                                            >
                                                                <Text
                                                                    style={[
                                                                        styles.dropdownItemText,
                                                                        active &&
                                                                        styles.dropdownItemTextActive,
                                                                    ]}
                                                                >
                                                                    {type}
                                                                </Text>

                                                                {active && (
                                                                    <Ionicons
                                                                        name="checkmark"
                                                                        size={16}
                                                                        color={palette.primary}
                                                                    />
                                                                )}
                                                            </Pressable>
                                                        );
                                                    })}
                                                </View>
                                            )}
                                        </View>
                                    </View>

                                    {isChoiceType(q.type) && (
                                        <View style={{ marginTop: 14 }}>
                                            {q.options.map((opt, i) => {
                                                const optIsEmpty =
                                                    submitAttempted &&
                                                    isChoiceType(q.type) &&
                                                    opt.trim().length === 0;

                                                return (
                                                    <View
                                                        key={`${q.id}-opt-${i}`}
                                                        style={styles.optionRow}
                                                    >
                                                        {q.type === "Single choice" ? (
                                                            <View style={styles.radioDot} />
                                                        ) : (
                                                            <View style={styles.checkboxBox} />
                                                        )}

                                                        <View style={styles.optionBox}>
                                                            <TextInput
                                                                value={opt}
                                                                onChangeText={(t) =>
                                                                    updateOption(q.id, i, t)
                                                                }
                                                                placeholder={`Option ${i + 1}`}
                                                                placeholderTextColor="#9CA3AF"
                                                                style={[
                                                                    styles.optionInput,
                                                                    (optionsCountError ||
                                                                        optionsEmptyError) &&
                                                                    optIsEmpty &&
                                                                    styles.inputError,
                                                                ]}
                                                            />
                                                        </View>

                                                        <Pressable
                                                            onPress={() => removeOption(q.id, i)}
                                                            hitSlop={10}
                                                        >
                                                            <Ionicons
                                                                name="close"
                                                                size={18}
                                                                color="#9CA3AF"
                                                            />
                                                        </Pressable>
                                                    </View>
                                                );
                                            })}

                                            <Pressable
                                                onPress={() => addOption(q.id)}
                                                style={styles.addOptionBtn}
                                            >
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

                                    {err && (
                                        <Text style={styles.inlineErrorText}>
                                            {err === "TITLE_REQUIRED" &&
                                                "Question title is required."}
                                            {err === "MIN_2_OPTIONS" && "Add at least 2 options."}
                                            {err === "OPTIONS_REQUIRED" &&
                                                "Fill all options (no empty options)."}
                                        </Text>
                                    )}

                                    <View style={styles.hr} />

                                    <View style={styles.bottomRow}>
                                        <View style={{ flexDirection: "row", gap: 10 }}>
                                            <Pressable
                                                onPress={() => duplicateQuestion(q.id)}
                                                style={styles.iconBtn}
                                            >
                                                <Ionicons
                                                    name="copy-outline"
                                                    size={18}
                                                    color="#6B7280"
                                                />
                                            </Pressable>

                                            <Pressable
                                                onPress={() => removeQuestion(q.id)}
                                                style={[styles.iconBtn, styles.iconBtnDanger]}
                                            >
                                                <Ionicons
                                                    name="trash-outline"
                                                    size={18}
                                                    color="#EF4444"
                                                />
                                            </Pressable>
                                        </View>

                                        <View style={styles.requiredRow}>
                                            <Text style={styles.requiredText}>Required</Text>
                                            <Switch
                                                value={q.required}
                                                onValueChange={(v) =>
                                                    updateQuestion(q.id, { required: v })
                                                }
                                                trackColor={{
                                                    false: "#E5E7EB",
                                                    true: palette.primary,
                                                }}
                                                thumbColor={palette.white}
                                            />
                                        </View>
                                    </View>
                                </Pressable>
                            </View>
                        );
                    })}

                    {showError && (
                        <Text style={styles.errorText}>
                            Fill all questions. For choice questions, the question and all options
                            must be filled.
                        </Text>
                    )}

                    <Pressable onPress={addQuestion} style={styles.addQuestionBtn}>
                        <Text style={styles.addQuestionPlus}>+</Text>
                        <Text style={styles.addQuestionText}>Add question</Text>
                    </Pressable>
                    <View style={{ height: 110 }} />


                </ScrollView>

                <View style={styles.bottomBar}>
                    <Pressable
                        style={styles.draftBtn}
                        onPress={() => console.log("Save draft questions")}
                    >
                        <Text style={styles.draftText}>Save as Draft</Text>
                    </Pressable>

                    <Pressable style={styles.nextBtn} onPress={onNext}>
                        <Text style={styles.nextText}>Next (2/4)</Text>
                        <Text style={styles.nextArrow}>›</Text>
                    </Pressable>
                </View>
            </Pressable>
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
    headerTitle: { fontSize: 26, fontWeight: "800", color: "#111827", flex: 1 },

    sectionTop: { paddingHorizontal: 16, paddingBottom: 10 },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
    divider: { height: 2, backgroundColor: "#111827", marginTop: 8, borderRadius: 2 },

    stepsRow: { flexDirection: "row", gap: 10, marginTop: 10 },
    stepPill: { flex: 1, height: 4, borderRadius: 999, backgroundColor: "#E5E7EB" },
    stepPillActive: { backgroundColor: palette.primary },

    content: { paddingHorizontal: 16, paddingTop: 10 },

    cardOuter: {
        position: "relative",
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        backgroundColor: "#F9FAFB",
        overflow: "visible",
        marginBottom: 14,
    },
    leftAccent: {
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
        backgroundColor: "#CFE3FF",
        borderTopLeftRadius: 18,
        borderBottomLeftRadius: 18,
    },
    cardInner: { padding: 14, paddingLeft: 18 },

    topRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
        zIndex: 20,
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
        marginTop: 5,
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
        backgroundColor: palette.white,
    },

    typeMenuWrap: {
        position: "relative",
        minWidth: 160,
        zIndex: 50,
    },

    typePill: {
        height: 44,
        paddingHorizontal: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        backgroundColor: palette.white,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
    },
    typeText: { fontSize: 14, fontWeight: "800", color: "#111827" },

    dropdownMenu: {
        position: "absolute",
        top: 48,
        right: 0,
        minWidth: 180,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        backgroundColor: palette.white,
        paddingVertical: 6,
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 8,
        zIndex: 999,
    },

    dropdownItem: {
        minHeight: 42,
        paddingHorizontal: 12,
        paddingVertical: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },

    dropdownItemActive: {
        backgroundColor: "#F3F7FF",
    },

    dropdownItemText: {
        fontSize: 14,
        fontWeight: "600",
        color: "#111827",
    },

    dropdownItemTextActive: {
        color: palette.primary,
        fontWeight: "800",
    },

    optionRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },

    radioDot: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        borderColor: "#E5E7EB",
        backgroundColor: palette.white,
    },

    checkboxBox: {
        width: 18,
        height: 18,
        borderRadius: 5,
        borderWidth: 2,
        borderColor: "#E5E7EB",
        backgroundColor: palette.white,
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
        backgroundColor: palette.white,
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
        backgroundColor: palette.white,
    },
    addOptionPlus: { color: palette.primary, fontSize: 18, fontWeight: "900" },
    addOptionText: { color: palette.primary, fontSize: 14, fontWeight: "900" },

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
        backgroundColor: palette.white,
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

    nextBtn: {
        flex: 1.4,
        height: 56,
        borderRadius: 16,
        backgroundColor: palette.primary,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
    },
    nextText: { fontSize: 16, fontWeight: "800", color: palette.white },
    nextArrow: { color: palette.white, fontSize: 22, marginLeft: 10, marginTop: -1 },

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
    addQuestionBtn: {
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
    addQuestionPlus: {
        fontSize: 20,
        fontWeight: "900",
        color: "#111827",
    },
    addQuestionText: {
        fontSize: 16,
        fontWeight: "900",
        color: palette.primary,
    },

});