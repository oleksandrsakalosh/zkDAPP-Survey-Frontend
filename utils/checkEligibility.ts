// utils/checkEligibility.ts

import { EligibilityProfile } from "@/app/hooks/useEligibilityProfile";
import { EligibilityCheckResult, SurveyRequirement } from "@/domain/models";

const EDUCATION_RANK: Record<string, number> = {
    "No formal education": 0,
    "Primary school": 1,
    "High school": 2,
    "Vocational / Trade school": 3,
    "Bachelor's degree": 4,
    "Master's degree": 5,
    "PhD / Doctorate": 6,
    "Other": 7,
};

function getAge(birthDate: string): number {
    const [day, month, year] = birthDate.split("/").map(Number);
    const birth = new Date(year, month - 1, day);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    if (
        now.getMonth() < birth.getMonth() ||
        (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
    ) age--;
    return age;
}

export function checkEligibility(
    requirements: SurveyRequirement[],
    profile: EligibilityProfile | null
): EligibilityCheckResult {
    if (!profile || requirements.length === 0) {
        return { decision: "qualify", matchedRequirements: [], failedRequirements: [] };
    }

    const matched: string[] = [];
    const failed: string[] = [];

    for (const req of requirements) {
        let pass = false;

        if (req.type === "Age") {
            // value например "18+" или "18-35"
            const age = getAge(profile.birthDate);
            if (req.value.endsWith("+")) {
                pass = age >= parseInt(req.value);
            } else if (req.value.includes("-")) {
                const [min, max] = req.value.split("-").map(Number);
                pass = age >= min && age <= max;
            }
        } else if (req.type === "Location" || req.type === "Country" || req.type === "Region" || req.type === "District") {
            pass = profile.location.toLowerCase().includes(req.value.toLowerCase());
        } else if (req.type === "Education level") {
            const userRank = EDUCATION_RANK[profile.education ?? ""] ?? -1;
            const reqRank = EDUCATION_RANK[req.value] ?? -1;
            pass = userRank >= reqRank;
        }

        if (pass) matched.push(req.id);
        else failed.push(req.id);
    }

    return {
        decision: failed.length === 0 ? "qualify" : "not_qualified",
        matchedRequirements: matched,
        failedRequirements: failed,
        checkedAt: new Date().toISOString(),
    };
}
