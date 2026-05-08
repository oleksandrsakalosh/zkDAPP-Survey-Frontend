import { parseSdJwt, ParsedDisclosure, ParsedSdJwtResult } from "@/utils/sdjwt/parser";
import { getUtcPlus2YyyyMmDd } from "@/utils/zk/proofChecks";

export interface EligibilityCircuitInput {
    pubKey: [string, string];
    signatureR8: [string, string];
    signatureS: string;
    merkleRoot: string;
    leaves: [string, string, string, string, string, string, string, string, string, string, string];
    numLeaves: string;
    dobSalt: string;
    dobKey: string;
    dobValue: string;
    expSalt: string;
    expKey: string;
    expValue: string;
    currentDate: string;
    minAge: string;
    enableAgeCheck: string;
}

export interface EligibilityCircuitInputOptions {
    currentDate?: string;
    minAge?: string | number;
    enableAgeCheck?: string | number | boolean;
}

const AGE_ATTRIBUTE_KEYS = ["birth_date", "date_of_birth", "dob", "dobValue"];
const EXPIRY_ATTRIBUTE_KEYS = ["expiry_date", "expiration", "expiration_date", "exp"];

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

function toStringOrZero(value: unknown): string {
    const asString = toTrimmedString(value);
    return asString ? asString : "0";
}

function toElevenElementTuple(values: string[]): EligibilityCircuitInput["leaves"] {
    const padded = values.slice(0, 11);
    while (padded.length < 11) {
        padded.push("0");
    }

    return padded as EligibilityCircuitInput["leaves"];
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
        leaves: toElevenElementTuple(leaves.map((leaf) => toStringOrZero(leaf))),
        numLeaves: String(Math.min(leaves.length, 11)),
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
    const claimValue = toStringOrZero(disclosure.claimValue ?? parsedJson[2]);

    if (!claimName) {
        throw new Error(`Disclosure for ${label} is missing a claim name.`);
    }

    return {
        salt,
        key: stringToBigInt(claimName.toLowerCase()),
        value: claimValue,
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

    return {
        ...identity,
        dobSalt: dob.salt,
        dobKey: dob.key,
        dobValue: dob.value,
        expSalt: expiry.salt,
        expKey: expiry.key,
        expValue: expiry.value,
        currentDate,
        minAge: minAge || "0",
        enableAgeCheck: enableAgeCheck || "1",
    };
}

export function buildEligibilityCircuitInputFromToken(
    token: string,
    options: EligibilityCircuitInputOptions = {}
): EligibilityCircuitInput {
    return buildEligibilityCircuitInput(parseSdJwt(token), options);
}