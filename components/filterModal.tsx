import React from "react";
import {
    Modal,
    Pressable,
    StyleSheet,
    Switch,
    Text,
    View,
    ScrollView
} from "react-native";
import { CATEGORIES } from "@/constants/surveyFilters";
import { palette } from "@/theme/palette"; 

const TIME_OPTIONS = ["Under 5 min", "5–10 min", "10–20 min"];
const overlayColor = `${palette.black}40`;

type FilterModalProps = {
    visible: boolean;
    onClose: () => void;
    onReset: () => void;
    onApply: () => void;

    draftCategories: string[];
    setDraftCategories: React.Dispatch<React.SetStateAction<string[]>>;

    draftOpenOnly: boolean;
    setDraftOpenOnly: React.Dispatch<React.SetStateAction<boolean>>;

    draftTime: string;
    setDraftTime: React.Dispatch<React.SetStateAction<string>>;

    draftQualifiedOnly: boolean;
    setDraftQualifiedOnly: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function FilterModal({
    visible,
    onClose,
    onReset,
    onApply,
    draftCategories,
    setDraftCategories,
    draftOpenOnly,
    setDraftOpenOnly,
    draftTime,
    setDraftTime,
    draftQualifiedOnly,
    setDraftQualifiedOnly,
}: FilterModalProps) {
    const toggleCategory = (category: string) => {
        if (category === "All") {
            setDraftCategories(["All"]);
            return;
        }

        if (draftCategories.includes(category)) {
            const updated = draftCategories.filter(
                (item) => item !== category && item !== "All"
            );

            setDraftCategories(updated.length > 0 ? updated : ["All"]);
        } else {
            setDraftCategories((prev) => [
                ...prev.filter((item) => item !== "All"),
                category,
            ]);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <Pressable style={styles.modalBackdrop} onPress={onClose} />

                <View style={styles.modalCard}>
                    <View style={styles.dragHandle} />

                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Filter</Text>
                        <Pressable onPress={onReset} style={styles.resetButton}>
                            <Text style={styles.resetText}>Reset</Text>
                        </Pressable>
                    </View>

                    <ScrollView
                        style={styles.modalBody}
                        contentContainerStyle={styles.modalBodyContent}
                        showsVerticalScrollIndicator
                    >
                        <Text style={styles.sectionTitle}>Categories</Text>
                        <View style={styles.chipsWrap}>
                            {CATEGORIES.map((category) => {
                                const active = draftCategories.includes(category);

                                return (
                                    <Pressable
                                        key={category}
                                        style={[
                                            styles.modalChip,
                                            active && styles.modalChipActive,
                                        ]}
                                        onPress={() => toggleCategory(category)}
                                    >
                                        <Text
                                            style={[
                                                styles.modalChipText,
                                                active && styles.modalChipTextActive,
                                            ]}
                                        >
                                            {category}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        <Text style={styles.sectionTitle}>Availability</Text>
                        <View style={styles.toggleRow}>
                            <Text style={styles.toggleText}>Open surveys only</Text>
                            <Switch
                                value={draftOpenOnly}
                                onValueChange={setDraftOpenOnly}
                                trackColor={{
                                    false: palette.border,
                                    true: palette.primaryLight,
                                }}
                                thumbColor={
                                    draftOpenOnly ? palette.primary : palette.white
                                }
                                ios_backgroundColor={palette.border}
                            />
                        </View>

                        <Text style={styles.sectionTitle}>Estimated time</Text>
                        <View style={styles.chipsWrap}>
                            {TIME_OPTIONS.map((item) => {
                                const active = draftTime === item;

                                return (
                                    <Pressable
                                        key={item}
                                        style={[
                                            styles.modalChip,
                                            active && styles.modalChipActive,
                                        ]}
                                        onPress={() => setDraftTime(item)}
                                    >
                                        <Text
                                            style={[
                                                styles.modalChipText,
                                                active && styles.modalChipTextActive,
                                            ]}
                                        >
                                            {item}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        <Text style={styles.sectionTitle}>Qualification</Text>
                        <View style={styles.toggleRow}>
                            <Text style={styles.toggleText}>
                                Show only surveys I qualify for
                            </Text>
                            <Switch
                                value={draftQualifiedOnly}
                                onValueChange={setDraftQualifiedOnly}
                                trackColor={{
                                    false: palette.border,
                                    true: palette.primaryLight,
                                }}
                                thumbColor={
                                    draftQualifiedOnly ? palette.primary : palette.white
                                }
                                ios_backgroundColor={palette.border}
                            />
                        </View>
                    </ScrollView>

                    <View style={styles.footer}>
                        <Pressable
                            style={[styles.actionButton, styles.cancelButton]}
                            onPress={onClose}
                        >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </Pressable>

                        <Pressable
                            style={[styles.actionButton, styles.applyButton]}
                            onPress={onApply}
                        >
                            <Text style={styles.applyButtonText}>Apply Filters</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: "flex-end",
        backgroundColor: overlayColor,
    },

    modalBackdrop: {
        ...StyleSheet.absoluteFillObject,
    },

    modalCard: {
        backgroundColor: palette.white,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingTop: 12,
        maxHeight: "88%",
        minHeight: "70%",
    },

    dragHandle: {
        alignSelf: "center",
        width: 54,
        height: 6,
        borderRadius: 999,
        backgroundColor: palette.border,
        marginBottom: 18,
    },

    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 22,
        paddingBottom: 14,
    },

    modalTitle: {
        fontSize: 22,
        fontWeight: "700",
        color: palette.primaryDark,
    },

    resetButton: {
        paddingVertical: 4,
    },

    resetText: {
        fontSize: 16,
        fontWeight: "600",
        color: palette.primary,
    },

    modalBody: {
        flex: 1,
    },

    modalBodyContent: {
        paddingHorizontal: 22,
        paddingBottom: 24,
    },

    footer: {
        flexDirection: "row",
        gap: 12,
        paddingHorizontal: 22,
        paddingTop: 14,
        paddingBottom: 24,
        borderTopWidth: 1,
        borderTopColor: palette.border,
        backgroundColor: palette.white,
    },

    sectionTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: palette.primaryDark,
        marginBottom: 12,
        marginTop: 12,
    },

    chipsWrap: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
    },

    modalChip: {
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.white,
    },

    modalChipActive: {
        backgroundColor: palette.primary,
        borderColor: palette.primary,
    },

    modalChipText: {
        color: palette.textSecondary,
        fontSize: 15,
        fontWeight: "500",
    },

    modalChipTextActive: {
        color: palette.white,
    },

    toggleRow: {
        minHeight: 56,
        borderWidth: 1,
        borderColor: palette.border,
        borderRadius: 18,
        paddingHorizontal: 18,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: palette.white,
    },

    toggleText: {
        flex: 1,
        fontSize: 16,
        color: palette.primaryDarkText,
        paddingRight: 12,
    },

    actionButton: {
        flex: 1,
        height: 58,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
    },

    cancelButton: {
        backgroundColor: palette.surfaceMuted,
    },

    applyButton: {
        backgroundColor: palette.primary,
    },

    cancelButtonText: {
        fontSize: 18,
        fontWeight: "600",
        color: palette.primaryDarkText,
    },

    applyButtonText: {
        fontSize: 18,
        fontWeight: "700",
        color: palette.white,
    },
});
