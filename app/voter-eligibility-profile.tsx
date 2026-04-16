import React, { useEffect, useState } from "react";
import {
    SafeAreaView,
    ScrollView,
    View,
    Text,
    TextInput,
    Pressable,
    StyleSheet,
    Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { palette } from "@/theme/palette";
import { useEligibilityProfile } from "./hooks/useEligibilityProfile";


const EDUCATION_OPTIONS = [
    "No formal education",
    "Primary school",
    "High school",
    "Vocational / Trade school",
    "Bachelor's degree",
    "Master's degree",
    "PhD / Doctorate",
    "Other",
];

export default function VoterEligibilityProfileScreen() {
    const [birthDate, setBirthDate] = useState("");
    const [location, setLocation] = useState("");
    const [education, setEducation] = useState<string | null>(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const { profile, saveProfile } = useEligibilityProfile();

    useEffect(() => {
        if (profile) {
            setBirthDate(profile.birthDate ?? "");
            setLocation(profile.location ?? "");
            setEducation(profile.education ?? null);
        }
    }, [profile]);
    const onSave = async () => {
        console.log("saving profile:", { birthDate, location, education });
        await saveProfile({ birthDate, location, education });
        router.back();
    };

    return (
        <SafeAreaView style={styles.safe}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
                    <Ionicons name="chevron-back" size={22} color="#111827" />
                </Pressable>
                <Text style={styles.headerTitle}>Voter Eligibility Profile</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={styles.sectionLabel}>DEMOGRAPHICS</Text>

                <View style={styles.card}>
                    {/* Date of Birth */}
                    <View style={[styles.fieldWrap, styles.fieldBorder]}>
                        <Text style={styles.fieldLabel}>Date of Birth</Text>
                        <TextInput
                            value={birthDate}
                            onChangeText={setBirthDate}
                            placeholder="DD / MM / YYYY"
                            placeholderTextColor={palette.textMuted}
                            keyboardType="numbers-and-punctuation"
                            style={styles.input}
                        />
                    </View>

                    {/* Location */}
                    <View style={[styles.fieldWrap, styles.fieldBorder]}>
                        <Text style={styles.fieldLabel}>Location</Text>
                        <TextInput
                            value={location}
                            onChangeText={setLocation}
                            placeholder="City, Country"
                            placeholderTextColor={palette.textMuted}
                            style={styles.input}
                        />
                    </View>

                    {/* Education */}
                    <View style={styles.fieldWrap}>
                        <Text style={styles.fieldLabel}>Education Level</Text>
                        <Pressable
                            style={styles.dropdown}
                            onPress={() => setDropdownOpen((p) => !p)}
                        >
                            <Text style={education ? styles.dropdownValue : styles.dropdownPlaceholder}>
                                {education ?? "Select education level"}
                            </Text>
                            <Ionicons
                                name={dropdownOpen ? "chevron-up" : "chevron-down"}
                                size={18}
                                color={palette.textMuted}
                            />
                        </Pressable>

                        {dropdownOpen && (
                            <View style={styles.dropdownList}>
                                {EDUCATION_OPTIONS.map((opt, i) => (
                                    <Pressable
                                        key={opt}
                                        style={[
                                            styles.dropdownItem,
                                            i < EDUCATION_OPTIONS.length - 1 && styles.dropdownItemBorder,
                                            education === opt && styles.dropdownItemActive,
                                        ]}
                                        onPress={() => {
                                            setEducation(opt);
                                            setDropdownOpen(false);
                                        }}
                                    >
                                        <Text
                                            style={[
                                                styles.dropdownItemText,
                                                education === opt && styles.dropdownItemTextActive,
                                            ]}
                                        >
                                            {opt}
                                        </Text>
                                        {education === opt && (
                                            <Ionicons name="checkmark" size={16} color={palette.primary} />
                                        )}
                                    </Pressable>
                                ))}
                            </View>
                        )}
                    </View>
                </View>

                {/* Save Button */}
                <Pressable style={styles.saveBtn} onPress={onSave}>
                    <Text style={styles.saveBtnText}>Save</Text>
                </Pressable>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: palette.primaryNegative,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
        backgroundColor: palette.primaryNegative,
    },
    backBtn: {
        marginRight: 8,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: "700",
        color: palette.primaryDark,
    },
    content: {
        paddingHorizontal: 16,
        paddingTop: 18,
        paddingBottom: 40,
    },
    sectionLabel: {
        color: palette.textMuted,
        fontSize: 12,
        fontWeight: "700",
        marginBottom: 6,
        marginLeft: 2,
    },
    card: {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.white,
        marginBottom: 20,
        overflow: "hidden",
    },
    fieldWrap: {
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    fieldBorder: {
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
    },
    fieldLabel: {
        fontSize: 13,
        fontWeight: "700",
        color: palette.primaryDark,
        marginBottom: 6,
    },
    input: {
        fontSize: 15,
        color: palette.primaryDark,
        paddingVertical: Platform.OS === "ios" ? 4 : 2,
    },
    dropdown: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 4,
    },
    dropdownPlaceholder: {
        fontSize: 15,
        color: palette.textMuted,
    },
    dropdownValue: {
        fontSize: 15,
        color: palette.primaryDark,
        fontWeight: "500",
    },
    dropdownList: {
        marginTop: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: palette.border,
        overflow: "hidden",
    },
    dropdownItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 12,
        paddingVertical: 11,
        backgroundColor: palette.white,
    },
    dropdownItemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
    },
    dropdownItemActive: {
        backgroundColor: "#F0F4FF",
    },
    dropdownItemText: {
        fontSize: 14,
        color: palette.primaryDark,
    },
    dropdownItemTextActive: {
        fontWeight: "700",
        color: palette.primary,
    },
    saveBtn: {
        backgroundColor: palette.primary,
        borderRadius: 14,
        paddingVertical: 15,
        alignItems: "center",
    },
    saveBtnText: {
        color: palette.white,
        fontSize: 16,
        fontWeight: "700",
    },
});
