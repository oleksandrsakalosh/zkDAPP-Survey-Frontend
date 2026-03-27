import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React, { useState } from "react";
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    View,
} from "react-native";

import { palette } from "@/theme/palette";
import RequestBuilder from "@/components/RequestBuilder";
import { useDeviceWallet } from "@/utils/vocdoni/WalletProvider";
import { formatWalletAddress } from "@/utils/vocdoni/wallet";

export default function Profile() {
    const [newSurveysEnabled, setNewSurveysEnabled] = useState(true);
    const [rewardUpdatesEnabled, setRewardUpdatesEnabled] = useState(true);
    const [activityEnabled, setActivityEnabled] = useState(false);
    const [showRequestBuilder, setShowRequestBuilder] = useState(false);
    const { walletAddress, isLoading, error } = useDeviceWallet();
    const walletDisplay = walletAddress ? formatWalletAddress(walletAddress) : "Wallet unavailable";
    const walletSubtitle = isLoading
        ? "Creating your device wallet..."
        : error
            ? "Wallet initialization failed"
            : walletAddress ?? "Wallet unavailable";

    return (
            <ScrollView
                style={styles.screen}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                contentInsetAdjustmentBehavior="never"
            >
                <View style={styles.profileCard}>
                    <Text style={styles.profileName}>Tralalela Tralala</Text>
                    <View style={styles.walletRow}>
                        <Text style={styles.walletText}>
                            {isLoading ? "Preparing wallet..." : walletDisplay}
                        </Text>
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
                        subtitle={walletSubtitle}
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

                <Text style={styles.sectionLabel}>Test Tools</Text>
                <View style={styles.card}>
                    <Pressable
                        style={[styles.row, styles.testToolRow]}
                        onPress={() => setShowRequestBuilder(true)}
                    >
                        <Text style={styles.testToolText}>Open Request Builder</Text>
                        <MaterialIcons name="chevron-right" size={20} color={palette.textMuted} />
                    </Pressable>
                </View>

                <Modal
                    visible={showRequestBuilder}
                    animationType="slide"
                    presentationStyle="formSheet"
                    onRequestClose={() => setShowRequestBuilder(false)}
                >
                    <RequestBuilder onClose={() => setShowRequestBuilder(false)} />
                </Modal>
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
    testToolRow: {
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    testToolText: {
        color: palette.primaryDark,
        fontSize: 15,
        fontWeight: '600',
    },
});
