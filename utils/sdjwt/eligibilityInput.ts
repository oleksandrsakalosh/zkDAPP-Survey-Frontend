import { parseSdJwt, ParsedDisclosure, ParsedSdJwtResult } from "@/utils/sdjwt/parser";
import { getUtcPlus2YyyyMmDd } from "@/utils/zk/proofChecks";

export interface EligibilityCircuitInput {
    pubKey: [string, string];
    signatureR8: [string, string];
    signatureS: string;
    merkleRoot: string;
    leaves: [string, string, string, string, string, string, string, string, string, string];
    dobSalt: string;
    dobKey: string;
    dobValue: string;
    expSalt: string;
    expKey: string;
    expValue: string;
    countrySalt: string;
    countryKey: string;
    countryValue: string;
    regionSalt: string;
    regionKey: string;
    regionValue: string;
    districtSalt: string;
    districtKey: string;
    districtValue: string;
    currentDate: string;
    minAge: string;
    enableAgeCheck: string;
    // v2 public inputs
    requiredCountry: string;
    allowedRegions: [string, string, string, string, string];
    allowedDistricts: [string, string, string, string, string];
    enableCountryCheck: string;
    enableRegionCheck: string;
    enableDistrictCheck: string;
}

export interface EligibilityCircuitInputOptions {
    currentDate?: string;
    minAge?: string | number;
    enableAgeCheck?: string | number | boolean;
    requiredCountry?: string | number;
    allowedRegions?: Array<string | number>;
    allowedDistricts?: Array<string | number>;
    enableCountryCheck?: string | number | boolean;
    enableRegionCheck?: string | number | boolean;
    enableDistrictCheck?: string | number | boolean;
}

const AGE_ATTRIBUTE_KEYS = ["birth_date", "date_of_birth", "dob", "dobValue"];
const EXPIRY_ATTRIBUTE_KEYS = ["expiry_date", "expiration", "expiration_date", "exp"];
const COUNTRY_ATTRIBUTE_KEYS = ["country_code", "country", "issuing_country", "resident_country"];
const REGION_ATTRIBUTE_KEYS = ["region", "state", "resident_state", "province"];
const DISTRICT_ATTRIBUTE_KEYS = ["district", "county", "municipality", "city", "resident_district"];

function stringToBigInt(value: string): string {
    const snarkField = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
    let result = 0n;

    for (let index = 0; index < value.length; index += 1) {
        result = ((result << 8n) | BigInt(value.charCodeAt(index))) % snarkField;
    }

    return result.toString();
}

function toTrimmedString(value: unknown): string {
    return String(value ?? "").trim();
}

function normalizeToYyyyMmDd(value: string): string | null {
    const asString = String(value ?? "").trim();
    if (!asString) return null;
    if (/^\d{8}$/.test(asString)) return asString;
    const isoMatch = asString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) return `${isoMatch[1]}${isoMatch[2]}${isoMatch[3]}`;
    const europeanMatch = asString.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);
    if (europeanMatch) return `${europeanMatch[3]}${europeanMatch[2]}${europeanMatch[1]}`;
    return null;
}

export function parseValueForCircuit(value: string): string {
    const asTrimmed = String(value ?? "").trim();
    if (asTrimmed === "") return "0";

    // If it's a plain integer (e.g., country codes, numeric dates already), keep as-is
    if (/^\d+$/.test(asTrimmed)) {
        return asTrimmed;
    }

    // If it looks like a date, normalize to yyyymmdd
    const normalizedDate = normalizeToYyyyMmDd(asTrimmed);
    if (normalizedDate) {
        return normalizedDate;
    }

    // Fallback: encode arbitrary strings to field-compatible bigint using stringToBigInt
    return stringToBigInt(asTrimmed);
}

function toStringOrZero(value: unknown): string {
    const asString = toTrimmedString(value);
    return asString ? asString : "0";
}

function toTenElementTuple(values: string[]): EligibilityCircuitInput["leaves"] {
    const padded = values.slice(0, 10);
    while (padded.length < 10) {
        padded.push("0");
    }

    return padded as EligibilityCircuitInput["leaves"];
}

function toFiveElementTuple(values: Array<string | number> | undefined): [string, string, string, string, string] {
    const padded = (values ?? []).map((value) => toStringOrZero(value)).slice(0, 5);
    while (padded.length < 5) {
        padded.push("0");
    }

    return padded as [string, string, string, string, string];
}

function toCircuitFlag(value: unknown, defaultValue: string): string {
    if (typeof value === "boolean") {
        return value ? "1" : "0";
    }

    const asString = toTrimmedString(value);
    if (!asString) {
        return defaultValue;
    }

    return asString === "0" || asString.toLowerCase() === "false" ? "0" : "1";
}

function getRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function getDisclosureByKeys(parsed: ParsedSdJwtResult, keys: string[]): ParsedDisclosure | undefined {
    return parsed.disclosures.find((disclosure) => {
        const claimName = (disclosure.claimName ?? "").trim().toLowerCase();
        return keys.includes(claimName);
    });
}

function resolveZkpPayload(parsed: ParsedSdJwtResult): Record<string, unknown> {
    const payload = getRecord(parsed.issuerJwt.payloadJson);
    const zkp = getRecord(payload?.zkp);
    if (!zkp) {
        throw new Error("SD-JWT payload is missing zkp metadata.");
    }
    return zkp;
}

function resolveCircuitIdentity(parsed: ParsedSdJwtResult) {
    const zkp = resolveZkpPayload(parsed);

    const publicKey = Array.isArray(zkp.publicKey) ? zkp.publicKey : [];
    const signature = getRecord(zkp.signature);
    const r8 = Array.isArray(signature?.r8) ? signature.r8 : [];
    const leaves = Array.isArray(zkp.leaves) ? zkp.leaves : [];

    if (publicKey.length < 2) {
        throw new Error("SD-JWT payload is missing issuer public key data.");
    }
    if (r8.length < 2) {
        throw new Error("SD-JWT payload is missing signature R8 data.");
    }
    if (signature == null || signature.s == null) {
        throw new Error("SD-JWT payload is missing signature S data.");
    }
    if (zkp.merkleRoot == null) {
        throw new Error("SD-JWT payload is missing merkle root data.");
    }

    return {
        pubKey: [toStringOrZero(publicKey[0]), toStringOrZero(publicKey[1])] as [string, string],
        signatureR8: [toStringOrZero(r8[0]), toStringOrZero(r8[1])] as [string, string],
        signatureS: toStringOrZero(signature.s),
        merkleRoot: toStringOrZero(zkp.merkleRoot),
        leaves: toTenElementTuple(leaves.map((leaf) => toStringOrZero(leaf))),
    };
}

function resolveDisclosureTuple(
    parsed: ParsedSdJwtResult,
    keys: string[],
    label: string,
    allowMissing: boolean,
) {
    const disclosure = getDisclosureByKeys(parsed, keys);
    if (!disclosure) {
        if (!allowMissing) {
            throw new Error(`SD-JWT is missing a required ${label} disclosure.`);
        }

        return {
            salt: "0",
            key: "0",
            value: "0",
        };
    }

    const parsedJson = Array.isArray(disclosure.parsedJson) ? disclosure.parsedJson : [];
    const salt = toStringOrZero(parsedJson[0]);
    const claimName = toTrimmedString(disclosure.claimName || parsedJson[1]);
    const claimValueRaw = toTrimmedString(disclosure.claimValue ?? parsedJson[2]);

    if (!claimName) {
        throw new Error(`Disclosure for ${label} is missing a claim name.`);
    }

    return {
        salt,
        key: stringToBigInt(claimName.toLowerCase()),
        value: parseValueForCircuit(claimValueRaw),
    };
}

export function buildEligibilityCircuitInput(
    parsed: ParsedSdJwtResult,
    options: EligibilityCircuitInputOptions = {}
): EligibilityCircuitInput {
    const currentDate = toTrimmedString(options.currentDate) || getUtcPlus2YyyyMmDd();
    const enableAgeCheck = toTrimmedString(options.enableAgeCheck);
    const minAge = toTrimmedString(options.minAge);
    const identity = resolveCircuitIdentity(parsed);

    const dob = resolveDisclosureTuple(parsed, AGE_ATTRIBUTE_KEYS, "birth date", true);
    const expiry = resolveDisclosureTuple(parsed, EXPIRY_ATTRIBUTE_KEYS, "expiry date", false);
    const country = resolveDisclosureTuple(parsed, COUNTRY_ATTRIBUTE_KEYS, "country", true);
    const region = resolveDisclosureTuple(parsed, REGION_ATTRIBUTE_KEYS, "region", true);
    const district = resolveDisclosureTuple(parsed, DISTRICT_ATTRIBUTE_KEYS, "district", true);

    return {
        ...identity,
        dobSalt: dob.salt,
        dobKey: dob.key,
        dobValue: dob.value,
        expSalt: expiry.salt,
        expKey: expiry.key,
        expValue: expiry.value,
        countrySalt: country.salt,
        countryKey: country.key,
        countryValue: country.value,
        regionSalt: region.salt,
        regionKey: region.key,
        regionValue: region.value,
        districtSalt: district.salt,
        districtKey: district.key,
        districtValue: district.value,
        currentDate,
        minAge: minAge || "0",
        enableAgeCheck: enableAgeCheck || "1",
        requiredCountry: toStringOrZero(options.requiredCountry),
        allowedRegions: toFiveElementTuple(options.allowedRegions),
        allowedDistricts: toFiveElementTuple(options.allowedDistricts),
        enableCountryCheck: toCircuitFlag(options.enableCountryCheck, "0"),
        enableRegionCheck: toCircuitFlag(options.enableRegionCheck, "0"),
        enableDistrictCheck: toCircuitFlag(options.enableDistrictCheck, "0"),
    };
}

export function buildEligibilityCircuitInputFromToken(
    token: string,
    options: EligibilityCircuitInputOptions = {}
): EligibilityCircuitInput {
    return buildEligibilityCircuitInput(parseSdJwt(token), options);
}
