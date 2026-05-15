import * as React from "react";
import {
    View,
    Text,
    Modal,
    Pressable,
    StyleSheet,
    FlatList,
    SafeAreaView,
    Platform,
    StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { palette } from "@/theme/palette";

type PickerMode = "single" | "multi";

export interface LocationModalPickerProps {
    visible: boolean;
    title: string;
    options: string[];
    selectedValue?: string | string[];
    mode?: PickerMode;
    maxSelections?: number;
    onConfirm: (value: string | string[]) => void;
    onCancel: () => void;
}

export const LocationModalPicker = ({
    visible,
    title,
    options,
    selectedValue,
    mode = "single",
    maxSelections,
    onConfirm,
    onCancel,
}: LocationModalPickerProps) => {
    const [localSelected, setLocalSelected] = React.useState<Set<string>>(
        mode === "multi" && Array.isArray(selectedValue)
            ? new Set(selectedValue)
            : mode === "single" && typeof selectedValue === "string"
                ? new Set([selectedValue])
                : new Set()
    );

    React.useEffect(() => {
        setLocalSelected(
            mode === "multi" && Array.isArray(selectedValue)
                ? new Set(selectedValue)
                : mode === "single" && typeof selectedValue === "string"
                    ? new Set([selectedValue])
                    : new Set()
        );
    }, [mode, selectedValue, visible]);

    const isSelectionLimited =
        mode === "multi" && typeof maxSelections === "number" && localSelected.size >= maxSelections;

    const handleToggle = (option: string) => {
        const newSelected = new Set(localSelected);
        if (newSelected.has(option)) {
            newSelected.delete(option);
        } else {
            if (isSelectionLimited) {
                return;
            }
            if (mode === "single") {
                newSelected.clear();
            }
            newSelected.add(option);
        }
        setLocalSelected(newSelected);
    };

    const handleConfirm = () => {
        if (mode === "multi") {
            onConfirm(Array.from(localSelected));
        } else {
            onConfirm(Array.from(localSelected)[0] ?? "");
        }
    };

    const renderOption = (option: string) => {
        const isSelected = localSelected.has(option);
        const isDisabled = mode === "multi" && isSelectionLimited && !isSelected;
        return (
            <Pressable
                style={[
                    styles.optionRow,
                    isSelected && styles.optionRowSelected,
                    isDisabled && styles.optionRowDisabled,
                ]}
                onPress={() => handleToggle(option)}
                disabled={isDisabled}
            >
                <View style={[styles.checkboxBox, isSelected && styles.checkboxBoxSelected]}>
                    {isSelected && (
                        <Ionicons name="checkmark" size={14} color={palette.white} />
                    )}
                </View>
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                    {option}
                </Text>
            </Pressable>
        );
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onCancel}
        >
            <SafeAreaView style={styles.container}>
                <View style={styles.headerContainer}>
                    <View style={styles.header}>
                        <Pressable onPress={onCancel} hitSlop={15}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </Pressable>
                        <Text style={styles.title}>{title}</Text>
                        <Pressable onPress={handleConfirm} hitSlop={15}>
                            <Text style={styles.confirmText}>Done</Text>
                        </Pressable>
                    </View>
                </View>

                <FlatList
                    data={options}
                    keyExtractor={(item) => item}
                    renderItem={({ item }) => renderOption(item)}
                    scrollEnabled
                    showsVerticalScrollIndicator
                    style={styles.listContainer}
                    contentContainerStyle={styles.listContent}
                />
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0,
        backgroundColor: palette.white,
    },
    headerContainer: {
        backgroundColor: palette.white,
        borderBottomWidth: 1,
        borderBottomColor: "#E5E7EB",
    },
    header: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        minHeight: 50,
    },
    title: {
        fontSize: 16,
        fontWeight: "700",
        color: "#111827",
        flex: 1,
        textAlign: "center",
    },
    cancelText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#6B7280",
        paddingHorizontal: 8,
        paddingVertical: 8,
    },
    confirmText: {
        fontSize: 16,
        fontWeight: "600",
        color: palette.primary,
        paddingHorizontal: 8,
        paddingVertical: 8,
    },
    listContainer: {
        flex: 1,
    },
    listContent: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    optionRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 14,
        marginVertical: 4,
        borderRadius: 12,
        backgroundColor: "#F9FAFB",
    },
    optionRowSelected: {
        backgroundColor: "#EEF4FF",
        borderWidth: 1.5,
        borderColor: palette.primary,
    },
    optionRowDisabled: {
        opacity: 0.45,
    },
    checkboxBox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 1.5,
        borderColor: "#D1D5DB",
        backgroundColor: palette.white,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    checkboxBoxSelected: {
        backgroundColor: palette.primary,
        borderColor: palette.primary,
    },
    optionText: {
        fontSize: 15,
        fontWeight: "500",
        color: "#111827",
        flex: 1,
    },
    optionTextSelected: {
        fontWeight: "700",
        color: palette.primary,
    },
});
