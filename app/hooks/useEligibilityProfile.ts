// hooks/useEligibilityProfile.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";

export interface EligibilityProfile {
    birthDate: string;   // DD/MM/YYYY
    location: string;
    education: string | null;
}

const KEY = "eligibility_profile";

export function useEligibilityProfile() {
    const [profile, setProfile] = useState<EligibilityProfile | null>(null);

    const loadProfile = useCallback(async () => {
        const val = await AsyncStorage.getItem(KEY);
            console.log("loaded from storage:", val);
            setProfile(val ? JSON.parse(val) : null);
    }, []);

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    useFocusEffect(
        useCallback(() => {
            loadProfile();
        }, [loadProfile])
    );

    const saveProfile = async (p: EligibilityProfile) => {
        setProfile(p);
        await AsyncStorage.setItem(KEY, JSON.stringify(p));
    };

    return { profile, saveProfile, reloadProfile: loadProfile };
}
