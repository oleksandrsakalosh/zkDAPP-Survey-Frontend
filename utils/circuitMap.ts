import { RequirementType } from "@/domain/models";

/**
 * Maps requirement types to their corresponding circuit check keys.
 * These keys correspond to the checks defined in utils/zk/proofChecks.ts
 *
 * Example: Age requirement uses "age" check which corresponds to age_check.circom
 */
export const REQUIREMENT_CIRCUIT_MAP: Record<RequirementType, string> = {
  Age: "eligibility",
  Location: "location", // Future: to be implemented
  "Education level": "education", // Future: to be implemented
  "": "",
};

/**
 * Given a requirement type, returns the circuit check key to use for proof generation.
 */
export function getCircuitKeyForRequirement(requirementType: RequirementType): string {
  return REQUIREMENT_CIRCUIT_MAP[requirementType] ?? "";
}

/**
 * Returns all implemented circuit keys (currently only "age" is supported).
 */
export function getSupportedCircuitKeys(): string[] {
  return ["eligibility"];
}

/**
 * Checks if a requirement type has a corresponding implemented circuit.
 */
export function isRequirementSupported(requirementType: RequirementType): boolean {
  const key = getCircuitKeyForRequirement(requirementType);
  return getSupportedCircuitKeys().includes(key);
}
