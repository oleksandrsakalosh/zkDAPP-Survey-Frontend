import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React, { useState } from "react";
import {
    Alert,
    Linking,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    View,
} from "react-native";

import { palette } from "@/theme/palette";

export default function Profile() {
    const [newSurveysEnabled, setNewSurveysEnabled] = useState(true);
    const [rewardUpdatesEnabled, setRewardUpdatesEnabled] = useState(true);
    const [activityEnabled, setActivityEnabled] = useState(false);

    const requestCredentialFromValera = async () => {
        try {
            const callbackUrl = 'zkdappsurveyfrontend://auth';
            const valeraUrl = `asitplus-wallet://share?action=share&callback=${encodeURIComponent(callbackUrl)}&type=AgeVerification`;
            
            console.log('Attempting to open Valera with URL:', valeraUrl);
            
            await Linking.openURL(valeraUrl);
            
        } catch (error: any) {
            console.error('Error requesting credential from Valera:', error);
            
            if (error?.message?.includes('No Activity found')) {
                Alert.alert(
                    'Valera Not Found',
                    'The Valera wallet app is not installed on the emulator. Please install and run Valera first.',
                    [{ text: 'OK' }]
                );
            } else {
                Alert.alert('Error', 'Failed to open Valera wallet: ' + error?.message);
            }
        }
    };

    return (
            <ScrollView
                style={styles.screen}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                contentInsetAdjustmentBehavior="never"
            >
                <View style={styles.profileCard}>
                    <Text style={styles.profileName}>Tralalela</Text>
                    <View style={styles.walletRow}>
                        <Text style={styles.walletText}>0x3f4...e91c</Text>
                        <MaterialIcons name="content-copy" size={14} color={palette.white50} />
                    </View>

                    <View style={styles.badgesRow}>
                        <View style={styles.badgePrimary}>
                            <Text style={styles.badgePrimaryText}>Voter</Text>
                        </View>
                        <View style={styles.badgeSecondary}>
                            <Text style={styles.badgeSecondaryText}>Survey Creator</Text>
                        </View>
                    </View>
                </View>

                <Pressable style={styles.valeraButton} onPress={requestCredentialFromValera}>
                    <Text style={styles.valeraButtonText}>Request Credential from Valera</Text>
                </Pressable>

                <Text style={styles.sectionLabel}>Account</Text>
                <View style={styles.card}>
                    <SettingRow
                        title="Edit Nickname"
                        subtitle="Set a display name"
                        withBorder
                    />
                    <SettingRow
                        title="Voter Eligibility Profile"
                        subtitle="Age, location, demographics"
                        withBorder
                    />
                    <SettingRow
                        title="Connected Wallet"
                        subtitle="0x3f4a...e91c"
                    />
                </View>

                <Text style={styles.sectionLabel}>Notifications</Text>
                <View style={styles.card}>
                    <ToggleRow
                        title="New Surveys for Me"
                        subtitle="When matching surveys appear"
                        value={newSurveysEnabled}
                        onValueChange={setNewSurveysEnabled}
                        withBorder
                    />
                    <ToggleRow
                        title="Reward Updates"
                        subtitle="Payouts and confirmations"
                        value={rewardUpdatesEnabled}
                        onValueChange={setRewardUpdatesEnabled}
                        withBorder
                    />
                    <ToggleRow
                        title="My Survey Activity"
                        subtitle="New responses, milestones"
                        value={activityEnabled}
                        onValueChange={setActivityEnabled}
                    />
                </View>

                <Text style={styles.sectionLabel}>Support</Text>
                <View style={styles.card}>
                    <SettingRow title="Help Center" withBorder />
                    <SettingRow title="Rate the App" />
                </View>
            </ScrollView>
    );
}

function SettingRow({
    title,
    subtitle,
    withBorder = false,
}: {
    title: string;
    subtitle?: string;
    withBorder?: boolean;
}) {
    return (
        <Pressable style={[styles.row, withBorder && styles.rowBorder]}>
            <View style={styles.rowTextWrap}>
                <Text style={styles.rowTitle}>{title}</Text>
                {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
            </View>
            <MaterialIcons name="chevron-right" size={20} color={palette.textMuted} />
        </Pressable>
    );
}

function ToggleRow({
    title,
    subtitle,
    value,
    onValueChange,
    withBorder = false,
}: {
    title: string;
    subtitle: string;
    value: boolean;
    onValueChange: (next: boolean) => void;
    withBorder?: boolean;
}) {
    return (
        <View style={[styles.row, withBorder && styles.rowBorder]}>
            <View style={styles.rowTextWrap}>
                <Text style={styles.rowTitle}>{title}</Text>
                <Text style={styles.rowSubtitle}>{subtitle}</Text>
            </View>
            <Switch
                value={value}
                onValueChange={onValueChange}
                thumbColor={palette.white}
                trackColor={{ false: palette.border, true: palette.primary }}
                ios_backgroundColor={palette.border}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: palette.primaryNegative,
    },
    screen: {
        flex: 1,
        backgroundColor: palette.primaryNegative,
    },
    content: {
        paddingHorizontal: 16,
        paddingTop: 18,
        paddingBottom: 12,
    },
    profileCard: {
        borderRadius: 18,
        paddingHorizontal: 16,
        paddingVertical: 14,
        marginBottom: 12,
        backgroundColor: palette.primaryDark,
    },
    profileName: {
        color: palette.white,
        fontSize: 34 / 2,
        fontWeight: "700",
        marginBottom: 5,
    },
    walletRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginBottom: 10,
    },
    walletText: {
        color: palette.white50,
        fontSize: 12,
        fontWeight: "600",
    },
    badgesRow: {
        flexDirection: "row",
        gap: 8,
    },
    badgePrimary: {
        backgroundColor: palette.white,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 4,
    },
    badgePrimaryText: {
        color: palette.primary,
        fontSize: 11,
        fontWeight: "700",
    },
    badgeSecondary: {
        backgroundColor: palette.primaryNegative,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 4,
    },
    badgeSecondaryText: {
        color: palette.primary,
        fontSize: 11,
        fontWeight: "700",
    },
    valeraButton: {
        backgroundColor: palette.primary,
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: "center",
        marginBottom: 14,
    },
    valeraButtonText: {
        color: palette.white,
        fontSize: 13,
        fontWeight: "700",
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
        marginBottom: 14,
        overflow: "hidden",
    },
    row: {
        minHeight: 66,
        paddingHorizontal: 14,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
    },
    rowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
    },
    rowTextWrap: {
        flex: 1,
    },
    rowTitle: {
        color: palette.primaryDark,
        fontSize: 31 / 2,
        fontWeight: "700",
    },
    rowSubtitle: {
        marginTop: 2,
        color: palette.textMuted,
        fontSize: 12,
        fontWeight: "500",
    },
});
