export interface ParsedDisclosure {
    index: number;
    encoded: string;
    decodedUtf8: string;
    parsedJson: unknown;
    salt?: string;
    claimName?: string;
    claimValue?: unknown;
}

export interface ParsedIssuerJwt {
    encodedHeader: string;
    encodedPayload: string;
    encodedSignature: string;
    decodedHeaderUtf8: string;
    decodedPayloadUtf8: string;
    headerJson: unknown;
    payloadJson: unknown;
    signatureHex: string;
    signingInput: string;
}

export interface ParsedSdJwtResult {
    rawToken: string;
    issuerJwt: ParsedIssuerJwt;
    keyBindingJwt?: string;
    disclosures: ParsedDisclosure[];
    attributes: Record<string, unknown>;
    warnings: string[];
}

function normalizeBase64Url(input: string): string {
    const replaced = input.replace(/-/g, "+").replace(/_/g, "/");
    const mod = replaced.length % 4;
    if (mod === 0) return replaced;
    return replaced + "=".repeat(4 - mod);
}

function base64ToByteArray(base64: string): Uint8Array {
    const binary = globalThis.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function bytesToUtf8(bytes: Uint8Array): string {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

function base64UrlToByteArray(input: string): Uint8Array {
    return base64ToByteArray(normalizeBase64Url(input));
}

function base64UrlToUtf8(input: string): string {
    return bytesToUtf8(base64UrlToByteArray(input));
}

function base64UrlToHex(input: string): string {
    return bytesToHex(base64UrlToByteArray(input));
}

function safeJsonParse(input: string): unknown {
    try {
        return JSON.parse(input);
    } catch {
        return null;
    }
}

function decodeJwtPart(part: string): {
    encodedHeader: string;
    encodedPayload: string;
    encodedSignature: string;
    decodedHeaderUtf8: string;
    decodedPayloadUtf8: string;
    headerJson: unknown;
    payloadJson: unknown;
    signatureHex: string;
    signingInput: string;
} {
    const parts = part.split(".");
    if (parts.length !== 3) {
        throw new Error("Invalid issuer JWT format (must contain header.payload.signature).");
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const decodedHeaderUtf8 = base64UrlToUtf8(encodedHeader);
    const decodedPayloadUtf8 = base64UrlToUtf8(encodedPayload);
    const signatureHex = base64UrlToHex(encodedSignature);

    return {
        encodedHeader,
        encodedPayload,
        encodedSignature,
        decodedHeaderUtf8,
        decodedPayloadUtf8,
        headerJson: safeJsonParse(decodedHeaderUtf8),
        payloadJson: safeJsonParse(decodedPayloadUtf8),
        signatureHex,
        signingInput: `${encodedHeader}.${encodedPayload}`,
    };
}

function isLikelyJwt(value: string): boolean {
    const parts = value.split(".");
    return parts.length === 3;
}

function parseDisclosures(rawDisclosures: string[], warnings: string[]): ParsedDisclosure[] {
    return rawDisclosures.map((encoded, index) => {
        let decodedUtf8 = "";
        let parsedJson: unknown = null;
        let salt: string | undefined;
        let claimName: string | undefined;
        let claimValue: unknown;

        try {
            decodedUtf8 = base64UrlToUtf8(encoded);
            parsedJson = safeJsonParse(decodedUtf8);

            if (Array.isArray(parsedJson) && parsedJson.length >= 3) {
                salt = typeof parsedJson[0] === "string" ? parsedJson[0] : undefined;
                claimName = typeof parsedJson[1] === "string" ? parsedJson[1] : undefined;
                claimValue = parsedJson[2];
            } else {
                warnings.push(`Disclosure #${index + 1} is not a standard disclosure array.`);
            }
        } catch {
            warnings.push(`Disclosure #${index + 1} could not be decoded from base64url.`);
        }

        return {
            index,
            encoded,
            decodedUtf8,
            parsedJson,
            salt,
            claimName,
            claimValue,
        };
    });
}

export function parseSdJwt(rawToken: string): ParsedSdJwtResult {
    const trimmed = rawToken.trim();
    if (!trimmed) {
        throw new Error("SD-JWT token is empty.");
    }

    const warnings: string[] = [];
    const parts = trimmed.split("~");
    const issuerJwtPart = parts[0];
    const trailing = parts.slice(1).filter((part) => part.length > 0);

    let keyBindingJwt: string | undefined;
    let disclosureParts = trailing;

    if (trailing.length > 0) {
        const maybeKb = trailing[trailing.length - 1];
        if (isLikelyJwt(maybeKb)) {
            keyBindingJwt = maybeKb;
            disclosureParts = trailing.slice(0, -1);
        }
    }

    const issuerJwt = decodeJwtPart(issuerJwtPart);
    const disclosures = parseDisclosures(disclosureParts, warnings);

    const attributes: Record<string, unknown> = {};
    disclosures.forEach((disclosure) => {
        if (disclosure.claimName) {
            attributes[disclosure.claimName] = disclosure.claimValue;
        }
    });

    if (!keyBindingJwt) {
        warnings.push("Key-binding JWT missing.");
    }

    const payloadObj = issuerJwt.payloadJson as Record<string, unknown> | null;
    const maybeCnf = payloadObj && typeof payloadObj === "object" ? payloadObj.cnf : undefined;
    if (!maybeCnf) {
        warnings.push("cnf/jwk missing.");
    }

    return {
        rawToken: trimmed,
        issuerJwt,
        keyBindingJwt,
        disclosures,
        attributes,
        warnings,
    };
}
