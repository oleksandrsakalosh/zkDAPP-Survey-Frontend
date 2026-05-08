import { RequirementType } from "@/domain/models";

//Maps requirement types to the SD-JWT attributes that satisfy them.
export const REQUIREMENT_ATTRIBUTE_MAP: Record<RequirementType, string[]> = {
  Age: ["birth_date", "date_of_birth", "dob", "birthdate"],
  Country: ["resident_country", "country_code", "country", "nationality"],
  Region: ["resident_state", "state", "region", "province"],
  District: ["resident_district", "district", "county", "municipality", "city"],
  Location: ["resident_country", "country_code", "country", "nationality"],
  "Education level": ["education_level", "qualification"],
  "": [],
};

//Extracts numeric value from requirement value string.

export function extractNumericValue(value: string): number | null {
  const match = value.match(/\d+/);
  if (!match) return null;
  return parseInt(match[0], 10);
}

/**
 * Given a requirement type, returns the candidate SD-JWT attribute keys.
 */
export function getAttributeCandidatesForRequirement(requirementType: RequirementType): string[] {
  return REQUIREMENT_ATTRIBUTE_MAP[requirementType] ?? [];
}
