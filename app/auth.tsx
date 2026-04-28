import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Pressable, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

type JwtHeaderPayload = {
  header: Record<string, unknown> | null;
  payload: Record<string, unknown> | null;
  signature: string;
};

type ParsedCircuitInput = {
  requestedAttributes: string[];
  voteHashHex: string;
  issuerSignature: string;
  issuerPublicKey: string;
  issuerAlg: string;
  holderSignature: HolderSignatureCoordinates | null;
  holderPublicKey: HolderPublicKeyCoordinates | null;
  holderAlg: string;
  requestedDisclosedClaims: Record<string, unknown>;
};

type HolderPublicKeyCoordinates = {
  x: string;
  y: string;
};

type HolderSignatureCoordinates = {
  R: {
    x: string;
    y: string;
  };
  S: string;
};

type CircuitInput = null;

type CallbackData = {
  status: string;
  requestId: string;
  receivedAt: string;
  rawSdJwtPresentation: string;
  parsedCircuitInput: ParsedCircuitInput;
  circuitInput: CircuitInput;
  errorCode?: string;
  errorMessage?: string;
};

function splitHolderPublicKey(rawPublicKey: string): HolderPublicKeyCoordinates | null {
  if (!rawPublicKey) return null;
  const parts = rawPublicKey.split('|').map((part) => part.trim());
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { x: parts[0], y: parts[1] };
}

function splitHolderSignature(rawSignature: string): HolderSignatureCoordinates | null {
  if (!rawSignature) return null;

  const pipeParts = rawSignature.split('|').map((part) => part.trim());
  if (pipeParts.length === 3 && pipeParts.every((part) => part.length > 0)) {
    return {
      R: {
        x: pipeParts[0],
        y: pipeParts[1],
      },
      S: pipeParts[2],
    };
  }

  const compact = rawSignature.trim();
  const normalized = compact.startsWith('0x') ? compact.slice(2) : compact;
  const expectedHexChars = 192; // 96-byte signature: Rx(32) || Ry(32) || S(32)
  if (!/^[0-9a-fA-F]+$/.test(normalized) || normalized.length < expectedHexChars) {
    return null;
  }

  const rx = normalized.slice(0, 64);
  const ry = normalized.slice(64, 128);
  const s = normalized.slice(128, 192);

  return {
    R: {
      x: rx,
      y: ry,
    },
    S: s,
  };
}

type LogLevel = 'log' | 'warn' | 'error';

function emitTerminalLog(level: LogLevel, message: string) {
  if (level === 'error') {
    console.error(message);
  } else if (level === 'warn') {
    console.warn(message);
  } else {
    console.log(message);
  }

  const globalWithNativeLog = globalThis as typeof globalThis & {
    nativeLoggingHook?: (msg: string, level?: number) => void;
  };
  const levelCode = level === 'error' ? 2 : level === 'warn' ? 1 : 0;
  try {
    globalWithNativeLog.nativeLoggingHook?.(message, levelCode);
  } catch {
    // Keep logging best-effort only.
  }
}

function logJsonToTerminal(label: string, payload: unknown) {
  const pretty = JSON.stringify(payload, null, 2);
  const singleLine = JSON.stringify(payload);
  if (!pretty) {
    emitTerminalLog('log', `[AuthCallback] ${label}: <empty>`);
    emitTerminalLog('warn', `[AuthCallback][WARN] ${label}: <empty>`);
    return;
  }

  const chunkSize = 1800;
  const chunks = Math.ceil(pretty.length / chunkSize);
  emitTerminalLog('warn', `[AuthCallback][WARN] ${label} available; length=${pretty.length}; chunks=${chunks}`);
  if (singleLine) {
    const maxSingleLine = 3500;
    const clipped = singleLine.length > maxSingleLine
      ? `${singleLine.slice(0, maxSingleLine)}...<truncated>`
      : singleLine;
    // Single-line fallback helps when multiline logs are folded by terminal tooling.
    emitTerminalLog('warn', `[AuthCallback][WARN][${label}] ${clipped}`);
  }
  emitTerminalLog('log', `[AuthCallback] ===== ${label} START =====`);
  for (let i = 0; i < chunks; i += 1) {
    const start = i * chunkSize;
    const part = pretty.slice(start, start + chunkSize);
    emitTerminalLog('log', `[AuthCallback] ${label} (${i + 1}/${chunks})\n${part}`);
  }
  emitTerminalLog('log', `[AuthCallback] ===== ${label} END =====`);
}

function parseStringArray(value?: string | null): string[] {
  if (!value) return [];
  const parsed = tryParseJson(value);
  if (Array.isArray(parsed)) {
    return parsed.map((entry) => String(entry)).filter((entry) => entry.trim().length > 0);
  }
  return [];
}

function decodeBase64Url(base64Url: string): string | null {
  try {
    const normalized = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    if (typeof atob !== 'function') return null;
    return atob(padded);
  } catch {
    return null;
  }
}

function tryDecodeJsonSegment(segment: string): Record<string, unknown> | null {
  const decoded = decodeBase64Url(segment);
  if (!decoded) return null;
  try {
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseJwt(jwt?: string | null): JwtHeaderPayload | null {
  if (!jwt) return null;
  const parts = jwt.split('.');
  if (parts.length !== 3) return null;

  return {
    header: tryDecodeJsonSegment(parts[0]),
    payload: tryDecodeJsonSegment(parts[1]),
    signature: parts[2],
  };
}

function toPublicKeyReference(parsedJwt: JwtHeaderPayload | null): string {
  if (!parsedJwt) return '';

  const header = parsedJwt.header ?? {};
  const payload = parsedJwt.payload ?? {};

  const jwkInHeader = header.jwk;
  if (jwkInHeader && typeof jwkInHeader === 'object' && !Array.isArray(jwkInHeader)) {
    return JSON.stringify(jwkInHeader);
  }

  const cnf = asObject(payload.cnf);
  const jwkInCnf = cnf?.jwk;
  if (jwkInCnf && typeof jwkInCnf === 'object' && !Array.isArray(jwkInCnf)) {
    return JSON.stringify(jwkInCnf);
  }

  const kid = header.kid;
  if (typeof kid === 'string' && kid.length > 0) {
    return kid;
  }

  return '';
}

function toAlg(parsedJwt: JwtHeaderPayload | null): string {
  const alg = parsedJwt?.header?.alg;
  return typeof alg === 'string' ? alg : '';
}

function parseSdJwtPresentation(presentationRaw?: string | null): {
  issuerJwt: string | null;
  kbJwt: string | null;
  disclosures: string[];
} {
  if (!presentationRaw || typeof presentationRaw !== 'string') {
    return { issuerJwt: null, kbJwt: null, disclosures: [] };
  }

  const parts = presentationRaw.split('~').filter((part) => part.length > 0);
  if (parts.length === 0) return { issuerJwt: null, kbJwt: null, disclosures: [] };

  const issuerJwt = parts[0] || null;
  const last = parts[parts.length - 1];
  const looksLikeJwt = (last.match(/\./g) || []).length === 2;
  const kbJwt = parts.length > 1 && looksLikeJwt ? last : null;
  const disclosures = parts.slice(1, kbJwt ? -1 : undefined);

  return { issuerJwt, kbJwt, disclosures };
}

function decodeDisclosure(disclosure: string): { claimName: string | null; claimValue: unknown } {
  const decoded = decodeBase64Url(disclosure);
  if (!decoded) return { claimName: null, claimValue: null };

  try {
    const parsed = JSON.parse(decoded);
    if (!Array.isArray(parsed)) return { claimName: null, claimValue: parsed };

    const claimName = typeof parsed[1] === 'string' ? parsed[1] : null;
    const claimValue = parsed.length >= 3 ? parsed[2] : parsed[1];
    return { claimName, claimValue };
  } catch {
    return { claimName: null, claimValue: decoded };
  }
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function firstDefined<T>(values: (T | undefined | null)[]): T | undefined {
  for (const value of values) {
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function looksLikeDigestPlaceholder(value: unknown): boolean {
  const obj = asObject(value);
  if (!obj) return false;
  const entries = Object.entries(obj);
  if (entries.length !== 1) return false;
  const [k, v] = entries[0];
  return /^[A-Za-z0-9_-]{8,}$/.test(k) && typeof v === 'string' && /^[A-Za-z0-9_-]{8,}$/.test(v);
}

function parseJsonArrayString(value: string): unknown[] | null {
  const trimmed = value.trim();
  if (!(trimmed.startsWith('[') && trimmed.endsWith(']'))) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function extractFirstUsefulValue(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  if (looksLikeDigestPlaceholder(value)) return undefined;

  if (typeof value === 'string') {
    const parsedArray = parseJsonArrayString(value);
    if (parsedArray && parsedArray.length > 0) {
      const nested = extractFirstUsefulValue(parsedArray[0]);
      if (nested !== undefined && nested !== null) return nested;
    }
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = extractFirstUsefulValue(item);
      if (nested !== undefined && nested !== null) return nested;
    }
    return undefined;
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const preferredKeys = ['value', 'code', 'country', 'region', 'state', 'locality', 'formatted'];
    for (const key of preferredKeys) {
      const nested = extractFirstUsefulValue(obj[key]);
      if (nested !== undefined && nested !== null) return nested;
    }
    return undefined;
  }

  return value;
}

function getRequestedClaimValue(
  requestedAttribute: string,
  disclosedClaims: Record<string, unknown>,
  issuerPayload: Record<string, unknown> | null,
): unknown {
  const address =
    asObject(disclosedClaims.address)
    ?? asObject(disclosedClaims.resident_address)
    ?? asObject(disclosedClaims.main_address);
  const issuerAddress =
    asObject(issuerPayload?.address)
    ?? asObject(issuerPayload?.resident_address)
    ?? asObject(issuerPayload?.main_address);

  switch (requestedAttribute) {
    case 'family_name':
      return firstDefined([
        disclosedClaims.family_name,
        disclosedClaims.surname,
        issuerPayload?.family_name,
        issuerPayload?.surname,
      ]);

    case 'given_name':
      return firstDefined([
        disclosedClaims.given_name,
        disclosedClaims.forename,
        issuerPayload?.given_name,
        issuerPayload?.forename,
      ]);

    case 'birth_date':
      return firstDefined([
        disclosedClaims.birth_date,
        disclosedClaims.date_of_birth,
        disclosedClaims.birthdate,
        disclosedClaims.dob,
        issuerPayload?.birth_date,
        issuerPayload?.date_of_birth,
      ]);

    case 'issue_date':
      return firstDefined([
        disclosedClaims.issue_date,
        disclosedClaims.issuance_date,
        disclosedClaims.iat,
        issuerPayload?.issue_date,
        issuerPayload?.issuance_date,
        issuerPayload?.iat,
      ]);

    case 'expiry_date':
      return firstDefined([
        disclosedClaims.expiry_date,
        disclosedClaims.expiration_date,
        disclosedClaims.exp,
        issuerPayload?.expiry_date,
        issuerPayload?.expiration_date,
        issuerPayload?.exp,
      ]);

    case 'gender':
      return firstDefined([
        disclosedClaims.gender,
        disclosedClaims.sex,
        issuerPayload?.gender,
        issuerPayload?.sex,
      ]);

    case 'nationality': {
      const singularNationality = firstDefined([
        disclosedClaims.nationality,
        issuerPayload?.nationality,
      ]);
      const normalizedSingular = extractFirstUsefulValue(singularNationality);
      if (normalizedSingular !== undefined && normalizedSingular !== null) {
        return normalizedSingular;
      }

      const nationalities = firstDefined([
        disclosedClaims.nationalities,
        issuerPayload?.nationalities,
      ]);
      const normalizedPlural = extractFirstUsefulValue(nationalities);
      if (normalizedPlural !== undefined && normalizedPlural !== null) {
        return normalizedPlural;
      }

      return undefined;
    }

    case 'issuing_authority':
      return firstDefined([
        disclosedClaims.issuing_authority,
        disclosedClaims.issuer,
        issuerPayload?.issuing_authority,
        issuerPayload?.issuer,
      ]);

    case 'issuing_country':
      return firstDefined([
        disclosedClaims.issuing_country,
        issuerPayload?.issuing_country,
      ]);

    case 'resident_country':
      return firstDefined([
        disclosedClaims.resident_country,
        disclosedClaims.country,
        address?.country,
        address?.country_code,
        issuerPayload?.resident_country,
        issuerPayload?.country,
        issuerAddress?.country,
        issuerAddress?.country_code,
      ]);

    case 'resident_city':
      return firstDefined([
        disclosedClaims.resident_city,
        disclosedClaims.locality,
        address?.locality,
        address?.city,
        address?.town,
        issuerPayload?.resident_city,
        issuerPayload?.locality,
        issuerAddress?.locality,
        issuerAddress?.city,
        issuerAddress?.town,
      ]);

    case 'resident_postal_code':
      return firstDefined([
        disclosedClaims.resident_postal_code,
        disclosedClaims.postal_code,
        address?.postal_code,
        address?.postalCode,
        address?.zip,
        issuerPayload?.resident_postal_code,
        issuerPayload?.postal_code,
        issuerAddress?.postal_code,
        issuerAddress?.postalCode,
        issuerAddress?.zip,
      ]);

    case 'resident_state':
      return firstDefined([
        disclosedClaims.resident_state,
        disclosedClaims.region,
        disclosedClaims.state,
        disclosedClaims.province,
        address?.region,
        address?.state,
        address?.province,
        address?.subdivision,
        address?.administrative_area,
        issuerPayload?.resident_state,
        issuerPayload?.region,
        issuerPayload?.state,
        issuerPayload?.province,
        issuerAddress?.region,
        issuerAddress?.state,
        issuerAddress?.province,
        issuerAddress?.subdivision,
        issuerAddress?.administrative_area,
      ]);

    case 'resident_street':
      return firstDefined([
        disclosedClaims.resident_street,
        address?.street_address,
        address?.street,
        address?.road,
        issuerPayload?.resident_street,
        issuerAddress?.street_address,
        issuerAddress?.street,
        issuerAddress?.road,
      ]);

    case 'resident_house_number':
      return firstDefined([
        disclosedClaims.resident_house_number,
        address?.house_number,
        issuerPayload?.resident_house_number,
        issuerAddress?.house_number,
      ]);

    case 'resident_address':
      return firstDefined([
        disclosedClaims.resident_address,
        address?.formatted,
        address?.full_address,
        issuerPayload?.resident_address,
        issuerAddress?.formatted,
        issuerAddress?.full_address,
      ]);

    default:
      return firstDefined([
        disclosedClaims[requestedAttribute],
        issuerPayload?.[requestedAttribute],
      ]);
  }
}

function tryParseJson(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const processedCallbackRef = useRef<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);
  const [callbackData, setCallbackData] = useState<CallbackData | null>(null);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const hasCallbackParams = Boolean(
    params.status || params.requestId || params.presentation || params.errorCode || params.credential,
  );

  const appendDebugLog = (message: string) => {
    console.log(message);
    setDebugLogs((current) => [...current.slice(-7), `${new Date().toLocaleTimeString()} ${message}`]);
  };

  const sharePayload = async (title: string, payload: unknown) => {
    try {
      await Share.share({
        title,
        message: JSON.stringify(payload, null, 2),
      });
    } catch (error) {
      appendDebugLog(
        `Failed to share ${title}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  };

  // Fires on every render — confirms the screen mounted and received params.
  console.log('[AuthCallback] Screen rendered, requestId:', params.requestId ?? 'none', 'status:', params.status ?? 'none');

  useEffect(() => {
    if (!hasCallbackParams) {
      appendDebugLog('[AuthCallback] Opened without callback params, returning to home');
      router.replace('/(tabs)/home');
    }
  }, [hasCallbackParams, router]);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        if (!hasCallbackParams) {
          return;
        }

        const callbackKey = JSON.stringify({
          requestId: params.requestId,
          presentation: params.presentation,
          errorCode: params.errorCode,
          flow: params.flow,
          surveyId: params.surveyId,
        });
        if (processedCallbackRef.current === callbackKey) {
          return;
        }
        processedCallbackRef.current = callbackKey;

        setIsProcessing(true);

        const status = params.status as string | undefined;
        const requestId = params.requestId as string | undefined;
        const presentation = params.presentation as string | undefined;
        const errorCode = params.errorCode as string | undefined;
        const errorMessage = params.errorMessage as string | undefined;
        const flow = params.flow as string | undefined;
        const surveyId = params.surveyId as string | undefined;
        const voteHash = (params.voteHash as string | undefined) || '';
        const holderSignatureFromResponse = (params.holderSignature as string | undefined) || '';
        const holderPublicKeyFromResponse = (params.holderPublicKey as string | undefined) || '';
        const holderAlgFromResponse = (params.holderAlg as string | undefined) || '';
        const requestedClaimsRaw = params.requestedClaims as string | undefined;
        const requestedAttributes = parseStringArray(requestedClaimsRaw);

        console.log('[AuthCallback] Params received:', {
          flow: flow || 'N/A',
          surveyId: surveyId || 'N/A',
          requestId: requestId || 'N/A',
          hasPresentation: Boolean(presentation),
          presentationLength: typeof presentation === 'string' ? presentation.length : 0,
          requestedClaimsRaw: requestedClaimsRaw || 'N/A',
          errorCode: errorCode || 'N/A',
        });

        const presentationRaw = typeof presentation === 'string' ? presentation : null;
        const parsedSdJwt = parseSdJwtPresentation(presentationRaw);
        const issuerJwtParsed = parseJwt(parsedSdJwt.issuerJwt);
        const issuerPayload = asObject(issuerJwtParsed?.payload ?? null);
        const kbJwtParsed = parseJwt(parsedSdJwt.kbJwt);
        const decodedDisclosures = parsedSdJwt.disclosures.map(decodeDisclosure);
        const disclosedClaims = decodedDisclosures.reduce<Record<string, unknown>>((acc, disclosureItem) => {
          if (disclosureItem.claimName) {
            acc[disclosureItem.claimName] = disclosureItem.claimValue;
          }
          return acc;
        }, {});
        const requestedDisclosedClaims = requestedAttributes.reduce<Record<string, unknown>>((acc, attribute) => {
          const value = getRequestedClaimValue(attribute, disclosedClaims, issuerPayload);
          // Always expose every requested attribute key; unresolved values are explicit null.
          acc[attribute] = value ?? null;
          return acc;
        }, {});

        const holderSignatureRaw = holderSignatureFromResponse || kbJwtParsed?.signature || '';
        const holderPublicKeyRaw = holderPublicKeyFromResponse || toPublicKeyReference(kbJwtParsed);

        const parsedCircuitInput: ParsedCircuitInput = {
          requestedAttributes,
          voteHashHex: voteHash,
          // Signatures are the JWS signature segments from issuer JWT / key-binding JWT.
          issuerSignature: issuerJwtParsed?.signature ?? '',
          issuerPublicKey: toPublicKeyReference(issuerJwtParsed),
          issuerAlg: toAlg(issuerJwtParsed),
          holderSignature: splitHolderSignature(holderSignatureRaw),
          holderPublicKey: splitHolderPublicKey(holderPublicKeyRaw),
          holderAlg: holderAlgFromResponse || toAlg(kbJwtParsed),
          requestedDisclosedClaims,
        };
        const circuitInput: CircuitInput = null;

        appendDebugLog(
          `[AuthCallback] Processing callback params requestId=${requestId || 'N/A'} status=${status || 'unknown'} hasPresentation=${Boolean(presentation)} hasError=${Boolean(errorCode)} attrs=${requestedAttributes.length}`,
        );

        const receivedData: CallbackData = {
          status: status || 'unknown',
          requestId: requestId || 'N/A',
          receivedAt: new Date().toLocaleString(),
          rawSdJwtPresentation: presentationRaw || '',
          parsedCircuitInput,
          circuitInput,
          errorCode: errorCode || undefined,
          errorMessage: errorMessage || undefined,
        };

        appendDebugLog('CALLBACK SUCCESSFULLY RECEIVED FROM VALERA');
        appendDebugLog(`Status=${receivedData.status}`);
        appendDebugLog(`Request ID=${receivedData.requestId}`);
        appendDebugLog(`Resolved requested claims=${Object.keys(requestedDisclosedClaims).length}`);
        appendDebugLog(`Error code=${receivedData.errorCode || 'N/A'}`);

        // Mirror payloads in terminal logs to ease copy/paste and offline inspection.
        logJsonToTerminal('Raw SD-JWT Presentation', receivedData.rawSdJwtPresentation);
        logJsonToTerminal('Raw Response', receivedData.parsedCircuitInput);
        logJsonToTerminal('Circuit Input', receivedData.circuitInput);

        setCallbackData(receivedData);

        if (flow === 'eligibility' && surveyId) {
          console.log('[AuthCallback] Forwarding eligibility presentation to voting flow:', {
            surveyId,
            requestId: requestId || 'N/A',
            hasPresentation: Boolean(presentationRaw),
            presentationLength: presentationRaw?.length ?? 0,
          });

          const query = new URLSearchParams({
            requestId: requestId || '',
            requestedClaims: requestedClaimsRaw || '',
            nonceChallenge: (params.nonceChallenge as string | undefined) || '',
          });

          if (presentationRaw) {
            query.set('presentation', presentationRaw);
          }
          if (errorCode) {
            query.set('errorCode', errorCode);
          }
          if (errorMessage) {
            query.set('errorMessage', errorMessage);
          }

          router.replace(`/voting/${surveyId}/eligibility?${query.toString()}` as any);
          return;
        }

        await new Promise(resolve => setTimeout(resolve, 2000));

        setIsProcessing(false);

      } catch (error) {
        console.error('Error processing authentication callback:', error);
        appendDebugLog(
          `Error processing authentication callback: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        setIsProcessing(false);
      }
    };

    handleAuthCallback();
  }, [
    hasCallbackParams,
    params.status,
    params.requestId,
    params.presentation,
    params.voteHash,
    params.holderSignature,
    params.holderPublicKey,
    params.holderAlg,
    params.nonceChallenge,
    params.requestedClaims,
    params.errorCode,
    params.errorMessage,
    params.flow,
    params.surveyId,
    params.credential,
    params.did,
    params.timestamp,
    router,
  ]);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {isProcessing ? (
          <>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.text}>Processing authentication...</Text>
            <Text style={styles.subtext}>Receiving data from Valera wallet</Text>
          </>
        ) : (
          <>
            <Text style={[styles.successText, callbackData?.status === 'error' && styles.errorText]}>✓</Text>
            <Text style={styles.text}>
              {callbackData?.status === 'error' ? 'Callback Error Received!' : 'Presentation Received!'}
            </Text>
            <Text style={styles.subtext}>Review the response and press OK to continue.</Text>

            {callbackData && (
              <View style={styles.dataContainer}>
                <Text style={styles.dataTitle}>📋 Received Data:</Text>

                <View style={styles.dataRow}>
                  <Text style={styles.dataLabel}>Status:</Text>
                  <Text style={styles.dataValue}>{callbackData.status}</Text>
                </View>

                <View style={styles.dataRow}>
                  <Text style={styles.dataLabel}>Request ID:</Text>
                  <Text style={styles.dataValue}>{callbackData.requestId}</Text>
                </View>

                <View style={styles.dataRow}>
                  <Text style={styles.dataLabel}>Received At:</Text>
                  <Text style={styles.dataValue}>{callbackData.receivedAt}</Text>
                </View>

                <Text style={styles.dataTitle}>Raw SD-JWT from Valera</Text>
                <View style={styles.credentialBox}>
                  <Text style={styles.credentialText}>
                    {callbackData.rawSdJwtPresentation || 'No presentation parameter received.'}
                  </Text>
                </View>
                <View style={styles.actionsRow}>
                  <Pressable
                    style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}
                    onPress={() => sharePayload('Raw SD-JWT from Valera', callbackData.rawSdJwtPresentation)}
                  >
                    <Text style={styles.secondaryButtonText}>Share Raw SD-JWT</Text>
                  </Pressable>
                </View>

                <Text style={styles.dataTitle}>Raw Response</Text>
                <View style={styles.credentialBox}>
                  <Text style={styles.credentialText}>
                    {JSON.stringify(callbackData.parsedCircuitInput, null, 2)}
                  </Text>
                </View>
                <View style={styles.actionsRow}>
                  <Pressable
                    style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}
                    onPress={() => sharePayload('Raw Response', callbackData.parsedCircuitInput)}
                  >
                    <Text style={styles.secondaryButtonText}>Share Raw Response</Text>
                  </Pressable>
                </View>

                <Text style={styles.dataTitle}>Circuit Input</Text>
                <View style={styles.credentialBox}>
                  <Text style={styles.credentialText}>{''}</Text>
                </View>

                {callbackData.errorCode && (
                  <View style={styles.dataRow}>
                    <Text style={styles.dataLabel}>Error Code:</Text>
                    <Text style={styles.dataValue}>{callbackData.errorCode}</Text>
                  </View>
                )}

                {callbackData.errorMessage && (
                  <View style={styles.dataRow}>
                    <Text style={styles.dataLabel}>Error Message:</Text>
                    <Text style={styles.dataValue}>{callbackData.errorMessage}</Text>
                  </View>
                )}
              </View>
            )}

            {debugLogs.length > 0 && (
              <View style={styles.dataContainer}>
                <Text style={styles.dataTitle}>Debug Events</Text>
                <View style={styles.credentialBox}>
                  {debugLogs.map((entry, index) => (
                    <Text key={`${index}-${entry}`} style={styles.credentialText}>
                      {entry}
                    </Text>
                  ))}
                </View>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [styles.okButton, pressed && styles.okButtonPressed]}
              onPress={() => router.replace('/(tabs)/home')}
            >
              <Text style={styles.okButtonText}>OK</Text>
            </Pressable>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
  },
  text: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  subtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  successText: {
    fontSize: 64,
    color: '#4CAF50',
  },
  errorText: {
    color: '#D32F2F',
  },
  dataContainer: {
    width: '100%',
    marginTop: 24,
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  dataTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 12,
    marginBottom: 12,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  dataLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    flex: 1,
  },
  dataValue: {
    fontSize: 14,
    color: '#333',
    flex: 2,
    textAlign: 'right',
  },
  credentialBox: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    marginBottom: 12,
  },
  credentialText: {
    fontSize: 11,
    color: '#333',
    fontFamily: 'monospace',
  },
  actionsRow: {
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  secondaryButton: {
    backgroundColor: '#EEF5FF',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#B7D4FF',
  },
  secondaryButtonPressed: {
    opacity: 0.85,
  },
  secondaryButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0A4FB5',
  },
  okButton: {
    marginTop: 20,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  okButtonPressed: {
    opacity: 0.85,
  },
  okButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
