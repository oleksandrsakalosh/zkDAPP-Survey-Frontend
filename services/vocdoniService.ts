import "react-native-get-random-values";

import { SURVEY_MANAGER_CONTRACT_ADDRESS, SEPOLIA_CHAIN_ID } from "@/config/contracts";
import {
  VOCDONI_CENSUS3_API_URL,
  VOCDONI_CENSUS3_SYNC_ATTEMPTS,
  VOCDONI_CENSUS3_SYNC_RETRY_MS,
} from "@/config/vocdoni";
import { hashJson } from "@/utils/hash";
import { ensureVocdoniAccount } from "@/utils/vocdoni/sdk";
import { getOrCreateDeviceWallet } from "@/utils/vocdoni/wallet";
import {
  ChainElection,
  ElectionMetadata,
  VocdoniElectionSpec,
} from "@/types/election";

// The SDK is loaded lazily to match the existing React Native runtime pattern.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const getVocdoniSdk = () => require("@vocdoni/sdk");

const describeUnknownError = (error: unknown) => {
  if (error instanceof Error && typeof error.message === "string") {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "unknown error";
  }
};

const normalizeVocdoniError = (error: unknown, context: string) => {
  const message = describeUnknownError(error);

  if (message.includes("Cannot read property 'includes' of undefined")) {
    return new Error(
      `${context} failed because the Vocdoni SDK received an empty API error response. This usually means Census3 rejected the request before returning a typed error. Check that Census3 DEV supports chain ${SEPOLIA_CHAIN_ID}, token type erc1155, and external token id.`
    );
  }

  if (message.includes("Token is not yet synced")) {
    return new Error(
      `${context} failed because Census3 has not synced this ERC1155 token yet. Wait for Census3 indexing and try again.`
    );
  }

  return error instanceof Error ? error : new Error(`${context} failed: ${message}`);
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const asRecord = (value: unknown): Record<string, any> | null =>
  value && typeof value === "object" ? (value as Record<string, any>) : null;

const extractCensusPayload = (queuePayload: unknown) => {
  const payload = asRecord(queuePayload);
  const data = asRecord(payload?.data);
  const response = asRecord(payload?.response);

  return (
    asRecord(payload?.census) ??
    asRecord(data?.census) ??
    data ??
    asRecord(response?.census) ??
    null
  );
};

const normalizeCensusPayload = (rawCensus: Record<string, any> | null) => {
  if (!rawCensus) {
    return null;
  }

  const merkleRoot =
    rawCensus.merkleRoot ?? rawCensus.root ?? rawCensus.censusRoot ?? rawCensus.censusID;
  const uri = rawCensus.uri ?? rawCensus.URI ?? rawCensus.censusURI ?? rawCensus.censusURL;
  const size = Number(rawCensus.size ?? rawCensus.holders ?? 0);
  const weight = rawCensus.weight ?? rawCensus.totalWeight ?? size;

  return {
    ...rawCensus,
    merkleRoot,
    uri,
    size: Number.isFinite(size) ? size : 0,
    weight,
  };
};

const waitForTokenSynced = async ({
  census3Client,
  tokenAddress,
  chainId,
  externalId,
  expectedHolders,
}: {
  census3Client: any;
  tokenAddress: string;
  chainId: number;
  externalId: string;
  expectedHolders?: number;
}) => {
  let latestToken: any = null;

  for (let attempt = 1; attempt <= VOCDONI_CENSUS3_SYNC_ATTEMPTS; attempt += 1) {
    latestToken = await census3Client.getToken(tokenAddress, chainId, externalId);
    const status = latestToken?.status;
    const holderCount = Number(latestToken?.size ?? 0);
    const hasExpectedHolders =
      expectedHolders == null || holderCount >= expectedHolders;

    console.log("[census3] token status", {
      tokenAddress,
      chainId,
      externalId,
      attempt,
      synced: status?.synced,
      progress: status?.progress,
      atBlock: status?.atBlock,
      holders: holderCount,
      expectedHolders,
    });

    if (status?.synced && hasExpectedHolders) {
      return latestToken;
    }

    if (attempt < VOCDONI_CENSUS3_SYNC_ATTEMPTS) {
      await delay(VOCDONI_CENSUS3_SYNC_RETRY_MS);
    }
  }

  const progress = latestToken?.status?.progress;
  const atBlock = latestToken?.status?.atBlock;
  const holders = Number(latestToken?.size ?? 0);
  if (expectedHolders != null && holders < expectedHolders) {
    throw new Error(
      `Census3 synced token ${tokenAddress} tokenId ${externalId}, but only indexed ${holders} holder${
        holders === 1 ? "" : "s"
      } while the contract has ${expectedHolders} registered voter${
        expectedHolders === 1 ? "" : "s"
      }. Wait for Census3 to index the latest ERC1155 mints before starting the election. If this does not change after several minutes, Census3 is missing at least one TransferSingle mint log for this tokenId and must be rescanned from the election creation block.`
    );
  }

  throw new Error(
    `Census3 has not finished syncing token ${tokenAddress} tokenId ${externalId}. Current progress: ${
      progress == null ? "unknown" : `${progress}%`
    }, indexed block: ${atBlock ?? "unknown"}. Wait for synced=true in Census3 and try again.`
  );
};

const census3Url = () => VOCDONI_CENSUS3_API_URL.replace(/\/$/, "");

const createCensusFromStrategy = async ({
  strategyId,
  anonymous,
}: {
  strategyId: number;
  anonymous: boolean;
}) => {
  const createResponse = await fetch(`${census3Url()}/censuses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      strategyID: strategyId,
      anonymous,
    }),
  });

  if (!createResponse.ok) {
    throw new Error(`Census3 census creation request failed (${createResponse.status}).`);
  }

  const createPayload = await createResponse.json();
  const queueId = createPayload?.queueID;

  if (!queueId || typeof queueId !== "string") {
    throw new Error("Census3 census creation did not return a queueID.");
  }

  for (let attempt = 1; attempt <= VOCDONI_CENSUS3_SYNC_ATTEMPTS; attempt += 1) {
    const queueResponse = await fetch(`${census3Url()}/censuses/queue/${queueId}`);

    if (!queueResponse.ok) {
      throw new Error(`Census3 census queue request failed (${queueResponse.status}).`);
    }

    const queuePayload = await queueResponse.json();
    const rawCensus = extractCensusPayload(queuePayload);
    const census = normalizeCensusPayload(rawCensus);

    console.log("[census3] census queue status", {
      queueId,
      attempt,
      done: queuePayload?.done,
      progress: queuePayload?.progress,
      hasCensus: Boolean(census),
      censusKeys: rawCensus ? Object.keys(rawCensus).slice(0, 12) : [],
      retryMs: VOCDONI_CENSUS3_SYNC_RETRY_MS,
      error: queuePayload?.error ?? null,
    });

    if (queuePayload?.error) {
      throw new Error(
        typeof queuePayload.error === "string"
          ? queuePayload.error
          : queuePayload.error.error || "Census3 failed to create the census."
      );
    }

    if (typeof census?.merkleRoot === "string" && census.merkleRoot && typeof census.uri === "string" && census.uri) {
      if ((census as Record<string, any>).allowProofGeneration === false) {
        throw new Error(
          "Census3 returned a census with allowProofGeneration=false. This census can be attached to a Vocdoni election, but voters cannot generate the Merkle proof needed to vote. Reconfigure Census3 to create proof-enabled censuses before starting this election."
        );
      }

      if (!queuePayload?.done) {
        console.warn("[census3] using census before queue marked done", {
          queueId,
          progress: queuePayload?.progress,
          merkleRoot: census.merkleRoot,
          uri: census.uri,
        });
      }

      return census;
    }

    if (attempt < VOCDONI_CENSUS3_SYNC_ATTEMPTS) {
      await delay(VOCDONI_CENSUS3_SYNC_RETRY_MS);
    }
  }

  throw new Error(`Census3 census queue ${queueId} did not finish in time.`);
};

const registerErc1155Token = async ({
  tokenAddress,
  chainId,
  externalId,
  startBlock,
}: {
  tokenAddress: string;
  chainId: number;
  externalId: string;
  startBlock?: number;
}) => {
  const response = await fetch(`${census3Url()}/tokens`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ID: tokenAddress,
      type: "erc1155",
      chainID: chainId,
      externalID: externalId,
      tags: "zkdapp-survey",
      ...(startBlock != null ? { startBlock } : {}),
    }),
  });

  if (response.ok) {
    return;
  }

  let message = `Census3 token registration failed (${response.status}).`;
  try {
    const payload = await response.json();
    message = payload?.error || payload?.message || message;
  } catch {
    try {
      message = (await response.text()) || message;
    } catch {
      // Keep the status-based message.
    }
  }

  if (!message.toLowerCase().includes("already")) {
    throw new Error(message);
  }
};

const sanitizeChoices = (question: ElectionMetadata["questions"][number]) =>
  (question.options ?? []).map((option, index) => ({
    title: option.label.trim(),
    value: index,
  }));

const resolveMaxCount = (metadata: ElectionMetadata) =>
  metadata.questions.reduce((total, question) => {
    if (question.type === "multiple_choice") {
      return total + Math.max(1, question.options?.length ?? 1);
    }

    return total + 1;
  }, 0);

const resolveEndDateMs = (metadata?: ElectionMetadata) => {
  if (metadata?.endDate) {
    const parsed = new Date(metadata.endDate).getTime();
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return Date.now() + 10 * 60 * 60 * 1000;
};

export const buildVocdoniTokenCensusSpec = (
  election: ChainElection,
  metadata?: ElectionMetadata
): VocdoniElectionSpec => ({
  title: metadata?.title?.trim() || `Survey ${election.id}`,
  description:
    metadata?.description?.trim() ||
    "Contract-backed survey using the election ERC1155 eligibility token as the census source.",
  questions: metadata?.questions ?? [],
  census: {
    tokenAddress: SURVEY_MANAGER_CONTRACT_ADDRESS,
    tokenId: election.tokenId,
    chainId: SEPOLIA_CHAIN_ID,
    dynamicCensus: false,
  },
  electionType: {
    dynamicCensus: false,
    anonymous: Boolean(metadata?.anonymity),
  },
  voteType: {
    maxCount: metadata ? resolveMaxCount(metadata) : 1,
  },
  endDate: resolveEndDateMs(metadata),
});

export const computeVocdoniSpecHash = (config: VocdoniElectionSpec) => hashJson(config);

export const createVocdoniElectionFromTokenCensus = async ({
  election,
  metadata,
}: {
  election: ChainElection;
  metadata?: ElectionMetadata;
}) => {
  const wallet = await getOrCreateDeviceWallet();
  const { client } = await ensureVocdoniAccount(wallet);
  const sdk = getVocdoniSdk();
  const { Election, TokenCensus, VocdoniCensus3Client, EnvOptions } = sdk;

  const config = buildVocdoniTokenCensusSpec(election, metadata);
  const census3Client = new VocdoniCensus3Client({
    env: EnvOptions.DEV,
    api_url: VOCDONI_CENSUS3_API_URL,
  });

  try {
    const [supportedChains, supportedTypes] = await Promise.all([
      census3Client.getSupportedChains(),
      census3Client.getSupportedTypes(),
    ]);
    const supportsChain = supportedChains.some((chain: { chainID: number }) => chain.chainID === SEPOLIA_CHAIN_ID);
    const supportsErc1155 = supportedTypes.includes("erc1155");

    if (!supportsChain) {
      throw new Error(`Vocdoni Census3 DEV does not list Sepolia (${SEPOLIA_CHAIN_ID}) as a supported chain.`);
    }

    if (!supportsErc1155) {
      throw new Error(
        `Vocdoni Census3${VOCDONI_CENSUS3_API_URL ? ` at ${VOCDONI_CENSUS3_API_URL}` : " DEV"} does not list erc1155 as a supported token type. Supported types: ${supportedTypes.join(", ") || "none"}.`
      );
    }

    await registerErc1155Token({
      tokenAddress: SURVEY_MANAGER_CONTRACT_ADDRESS,
      chainId: SEPOLIA_CHAIN_ID,
      externalId: String(election.tokenId),
      startBlock: election.createdBlockNumber,
    });
  } catch (error) {
    const message = describeUnknownError(error);
    if (!message.toLowerCase().includes("already")) {
      throw normalizeVocdoniError(error, "Census3 token registration");
    }
  }

  const token = await waitForTokenSynced({
    census3Client,
    tokenAddress: SURVEY_MANAGER_CONTRACT_ADDRESS,
    chainId: SEPOLIA_CHAIN_ID,
    externalId: String(election.tokenId),
    expectedHolders: election.registeredVoters,
  });

  console.log("[census3] token holder comparison", {
    tokenAddress: SURVEY_MANAGER_CONTRACT_ADDRESS,
    chainId: SEPOLIA_CHAIN_ID,
    externalId: String(election.tokenId),
    census3Holders: Number(token?.size ?? 0),
    contractRegisteredVoters: election.registeredVoters,
    contractMintCount: election.eligibilityMintCount,
    contractMintHolders: election.eligibilityMintHolders,
    startBlock: election.createdBlockNumber,
  });

  let census;
  try {
    const censusData = await createCensusFromStrategy({
      strategyId: token.defaultStrategy,
      anonymous: false,
    });
    census = new TokenCensus(
      censusData.merkleRoot,
      censusData.uri,
      false,
      token,
      censusData.size,
      BigInt(censusData.weight)
    );
  } catch (error) {
    throw normalizeVocdoniError(error, "Census3 token census creation");
  }

  const vocdoniElection = Election.from({
    title: config.title,
    description: config.description,
    meta: {
      contractBacked: true,
      surveyManager: SURVEY_MANAGER_CONTRACT_ADDRESS,
      chainId: SEPOLIA_CHAIN_ID,
      electionId: election.id,
      tokenId: election.tokenId,
      vocdoniSpecHash: computeVocdoniSpecHash(config),
    },
    endDate: config.endDate,
    census,
    electionType: config.electionType,
    voteType: config.voteType,
  });

  config.questions.forEach((question) => {
    vocdoniElection.addQuestion(
      question.title.trim(),
      config.description,
      sanitizeChoices(question)
    );
  });

  let vocdoniElectionId: string;
  try {
    vocdoniElectionId = await client.createElection(vocdoniElection);
  } catch (error) {
    throw normalizeVocdoniError(error, "Vocdoni election creation");
  }

  return {
    vocdoniElectionId,
    config,
    vocdoniSpecHash: computeVocdoniSpecHash(config),
  };
};

export const verifyVocdoniElectionAgainstContract = (
  election: ChainElection,
  config: VocdoniElectionSpec
) => {
  if (config.census.tokenAddress.toLowerCase() !== SURVEY_MANAGER_CONTRACT_ADDRESS.toLowerCase()) {
    throw new Error("Vocdoni election mismatch: census token address differs from the contract.");
  }

  if (config.census.tokenId !== election.tokenId) {
    throw new Error("Vocdoni election mismatch: census tokenId differs from the contract.");
  }

  if (config.census.dynamicCensus !== false || config.electionType.dynamicCensus !== false) {
    throw new Error("Vocdoni election mismatch: dynamic census detected.");
  }

  const computedHash = computeVocdoniSpecHash(config);
  if (computedHash.toLowerCase() !== election.vocdoniSpecHash.toLowerCase()) {
    throw new Error("Vocdoni election mismatch: config hash differs from the contract.");
  }

  return true;
};
