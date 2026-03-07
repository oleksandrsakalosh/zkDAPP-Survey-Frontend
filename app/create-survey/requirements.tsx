import * as React from "react";
import { useMemo, useState } from "react";
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    ScrollView,
    TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { palette } from "@/theme/palette";
import { useSurveyDraft } from "@/utils/SurveyDraftContext";

type RequirementType = "Age" | "Location" | "Education level" | "";

type Requirement = {
    id: string;
    type: RequirementType;
    value: string;
};

const TYPES: RequirementType[] = ["Age", "Location", "Education level"];

const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const placeholderByType: Record<Exclude<RequirementType, "">, string> = {
    Age: "18–35",
    Location: "United States",
    "Education level": "College+",
};

const isRequirementType = (value: string): value is Exclude<RequirementType, ""> => {
    return TYPES.includes(value as Exclude<RequirementType, "">);
};

const normalizeRequirementType = (value: string): RequirementType => {
    return isRequirementType(value) ? value : "";
};

type RequirementDropdownProps = {
    value: RequirementType;
    options: RequirementType[];
    placeholder?: string;
    isOpen: boolean;
    onOpen: () => void;
    onClose: () => void;
    onSelect: (value: RequirementType) => void;
};

function RequirementDropdown({
    value,
    options,
    placeholder = "Select requirement",
    isOpen,
    onOpen,
    onClose,
    onSelect,
}: RequirementDropdownProps) {
    const handleSelect = (nextValue: RequirementType) => {
        onSelect(nextValue);
        onClose();
    };

    return (
        <View style={styles.dropdownWrap}>
            <Pressable style={styles.dropdownField} onPress={isOpen ? onClose : onOpen}>
                <Text style={[styles.dropdownText, !value && styles.dropdownPlaceholder]}>
                    {value || placeholder}
                </Text>
                <Ionicons
                    name={isOpen ? "chevron-up" : "chevron-down"}
                    size={18}
                    color="#6B7280"
                />
            </Pressable>

            {isOpen && (
                <View style={styles.dropdownMenu}>
                    {!!value && (
                        <Pressable
                            style={styles.dropdownItem}
                            onPress={() => handleSelect("")}
                        >
                            <Text style={[styles.dropdownItemText, styles.clearOptionText]}>
                                Clear selection
                            </Text>
                        </Pressable>
                    )}

                    {options.map((option) => {
                        const active = value === option;

                        return (
                            <Pressable
                                key={option}
                                style={[
                                    styles.dropdownItem,
                                    active && styles.dropdownItemActive,
                                ]}
                                onPress={() => handleSelect(option)}
                            >
                                <Text
                                    style={[
                                        styles.dropdownItemText,
                                        active && styles.dropdownItemTextActive,
                                    ]}
                                >
                                    {option}
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
    );
}

export default function RequirementsStep() {
    const { draft, setDraft } = useSurveyDraft();

    const initialRequirements = useMemo<Requirement[]>(() => {
        if (draft.requirements?.length) {
            return draft.requirements.map((r) => ({
                id: r.id,
                type: normalizeRequirementType(r.type),
                value: r.value ?? "",
            }));
        }

        return [
            { id: makeId(), type: "Age", value: "" },
            { id: makeId(), type: "Location", value: "" },
            { id: makeId(), type: "Education level", value: "" },
        ];
    }, [draft.requirements]);

    const [requirements, setRequirements] = useState<Requirement[]>(initialRequirements);
    const [submitAttempted, setSubmitAttempted] = useState(false);
    const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

    const selectedTypes = useMemo(
        () => requirements.map((r) => r.type).filter(Boolean) as Exclude<RequirementType, "">[],
        [requirements]
    );

    const getAvailableTypes = (currentId: string): RequirementType[] => {
        const current = requirements.find((r) => r.id === currentId);

        return TYPES.filter((type) => {
            if (type === current?.type) return true;
            return !selectedTypes.includes(type as Exclude<RequirementType, "">);
        });
    };

    const updateReq = (id: string, patch: Partial<Requirement>) => {
        setRequirements((prev) =>
            prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
        );
    };

    const removeReq = (id: string) => {
        setRequirements((prev) => prev.filter((r) => r.id !== id));
        setOpenDropdownId((prev) => (prev === id ? null : prev));
    };

    const addReq = () => {
        const unusedType = TYPES.find(
            (type) => !selectedTypes.includes(type as Exclude<RequirementType, "">)
        );

        setRequirements((prev) => [
            ...prev,
            { id: makeId(), type: unusedType ?? "", value: "" },
        ]);
    };

    const getReqError = (r: Requirement): string | null => {
        if (!r.type.trim()) return "Requirement is required.";
        if (!r.value.trim()) return "Value is required for this requirement.";
        return null;
    };

    const allReqsValid = useMemo(
        () => requirements.every((r) => getReqError(r) === null),
        [requirements]
    );

    const canAddMore = requirements.length < TYPES.length;

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
            <Pressable style={{ flex: 1 }} onPress={() => setOpenDropdownId(null)}>
                <View style={styles.header}>
                    <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
                        <Ionicons name="chevron-back" size={22} color="#111827" />
                    </Pressable>
                    <Text style={styles.headerTitle}>Create Survey</Text>
                </View>

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

                <ScrollView
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.infoBox}>
                        <View style={styles.infoIconWrap}>
                            <Ionicons name="information" size={16} color={palette.primary} />
                        </View>
                        <Text style={styles.infoText}>
                            Set conditions voters must meet before they can participate. Leave empty to
                            allow anyone.
                        </Text>
                    </View>

                    {requirements.map((r) => {
                        const err = submitAttempted ? getReqError(r) : null;
                        const valueError = submitAttempted && !!r.type && !r.value.trim();
                        const typeError = submitAttempted && !r.type.trim();
                        const availableTypes = getAvailableTypes(r.id);
                        const placeholder = r.type ? placeholderByType[r.type] : "Enter value";

                        return (
                            <View
                                key={r.id}
                                style={[styles.reqBlock, openDropdownId === r.id && styles.reqBlockOpen]}
                            >
                                <Pressable onPress={() => setOpenDropdownId(null)}>
                                    <View style={styles.reqRow}>
                                        <View style={{ flex: 1 }}>
                                            <RequirementDropdown
                                                value={r.type}
                                                options={availableTypes}
                                                isOpen={openDropdownId === r.id}
                                                onOpen={() => setOpenDropdownId(r.id)}
                                                onClose={() => setOpenDropdownId(null)}
                                                onSelect={(value) =>
                                                    updateReq(r.id, {
                                                        type: value,
                                                        value: "",
                                                    })
                                                }
                                            />
                                            {typeError && (
                                                <Text style={styles.inlineErrorText}>
                                                    Requirement is required.
                                                </Text>
                                            )}
                                        </View>

                                        <Pressable
                                            onPress={() => removeReq(r.id)}
                                            style={styles.trashBtn}
                                            hitSlop={10}
                                        >
                                            <Ionicons name="trash-outline" size={18} color="#EF4444" />
                                        </Pressable>
                                    </View>

                                    <TextInput
                                        value={r.value}
                                        onChangeText={(t) => updateReq(r.id, { value: t })}
                                        placeholder={placeholder}
                                        placeholderTextColor="#9CA3AF"
                                        style={[styles.reqInput, valueError && styles.inputError]}
                                    />

                                    {valueError && <Text style={styles.inlineErrorText}>{err}</Text>}
                                </Pressable>
                            </View>
                        );
                    })}

                    <Pressable
                        onPress={addReq}
                        style={[styles.addReqBtn, !canAddMore && styles.addReqBtnDisabled]}
                        disabled={!canAddMore}
                    >
                        <Text style={styles.addReqPlus}>+</Text>
                        <Text style={[styles.addReqText, !canAddMore && styles.addReqTextDisabled]}>
                            Add requirement
                        </Text>
                    </Pressable>

                    {!canAddMore && (
                        <Text style={styles.helperText}>
                            All available requirements have already been added.
                        </Text>
                    )}

                    <View style={{ height: 110 }} />
                </ScrollView>

                <View style={styles.bottomBar}>
                    <Pressable style={styles.draftBtn} onPress={() => console.log("Save draft step3")}>
                        <Text style={styles.draftText}>Save as Draft</Text>
                    </Pressable>

                    <Pressable style={styles.nextBtn} onPress={onNext}>
                        <Text style={styles.nextText}>Next (3/4)</Text>
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
    headerTitle: { fontSize: 26, fontWeight: "800", color: "#111827" },

    sectionTop: { paddingHorizontal: 16, paddingBottom: 10 },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
    divider: { height: 2, backgroundColor: "#111827", marginTop: 8, borderRadius: 2 },

    stepsRow: { flexDirection: "row", gap: 10, marginTop: 10 },
    stepPill: { flex: 1, height: 4, borderRadius: 999, backgroundColor: "#E5E7EB" },
    stepPillActive: { backgroundColor: palette.primary },

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
        backgroundColor: palette.white,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 2,
    },
    infoText: { flex: 1, color: palette.primary, fontWeight: "700", lineHeight: 20 },

    reqBlock: {
        marginBottom: 14,
        overflow: "visible",
    },
    reqBlockOpen: {
        zIndex: 30,
    },

    reqRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
        zIndex: 20,
    },

    dropdownWrap: {
        position: "relative",
        zIndex: 50,
    },

    dropdownField: {
        height: 54,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        borderRadius: 16,
        paddingHorizontal: 14,
        backgroundColor: palette.white,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    dropdownText: {
        fontSize: 16,
        color: "#111827",
        fontWeight: "500",
    },
    dropdownPlaceholder: {
        color: "#9CA3AF",
        fontWeight: "400",
    },

    dropdownMenu: {
        position: "absolute",
        top: 58,
        left: 0,
        right: 0,
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

    clearOptionText: {
        color: "#6B7280",
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
        backgroundColor: palette.white,
    },

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
    addReqBtnDisabled: {
        opacity: 0.5,
    },
    addReqPlus: { fontSize: 20, fontWeight: "900", color: "#111827" },
    addReqText: { fontSize: 16, fontWeight: "900", color: palette.primary },
    addReqTextDisabled: { color: "#94A3B8" },

    helperText: {
        marginTop: 8,
        fontSize: 12,
        color: "#6B7280",
        fontWeight: "600",
    },

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
});