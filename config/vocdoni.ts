export const VOCDONI_CENSUS3_API_URL =
  process.env.EXPO_PUBLIC_CENSUS3_API_URL?.trim() || "http://127.0.0.1:7788/api";

const numberFromEnv = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const VOCDONI_CENSUS3_SYNC_ATTEMPTS = numberFromEnv(
  process.env.EXPO_PUBLIC_CENSUS3_SYNC_ATTEMPTS,
  30
);

export const VOCDONI_CENSUS3_SYNC_RETRY_MS = Math.min(
  numberFromEnv(process.env.EXPO_PUBLIC_CENSUS3_SYNC_RETRY_MS, 3000),
  30000
);
