// hooks/useEligibilityProfile.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect } from "react";

export interface EligibilityProfile {
    birthDate: string;   // DD/MM/YYYY
    location: string;
    education: string | null;
}

const KEY = "eligibility_profile";

export function useEligibilityProfile() {
    const [profile, setProfile] = useState<EligibilityProfile | null>(null);

    useEffect(() => {
        AsyncStorage.getItem(KEY).then((val) => {
            console.log("loaded from storage:", val);
            if (val) setProfile(JSON.parse(val));
        });
    }, []);

    const saveProfile = async (p: EligibilityProfile) => {
        setProfile(p);
        await AsyncStorage.setItem(KEY, JSON.stringify(p));
    };

    return { profile, saveProfile };
}