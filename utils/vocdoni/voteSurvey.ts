import 'react-native-get-random-values';

import {
  SEPOLIA_CHAIN_ID,
  SURVEY_MANAGER_CONTRACT_ADDRESS,
} from '@/config/contracts';
import { VOCDONI_CENSUS3_API_URL } from '@/config/vocdoni';
import {
  getEligibilityTokenBalance,
  getStartedElections,
  isUserRegistered,
} from '@/services/contractService';
import { createVocdoniClient } from '@/utils/vocdoni/sdk';
import { getOrCreateDeviceWallet } from '@/utils/vocdoni/wallet';

// The SDK is loaded lazily to match the existing Vocdoni helpers in this app.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const getVocdoniSdk = () => require('@vocdoni/sdk');

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const describeError = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return 'unknown error';
  }
};

const waitForElectionOngoing = async (client: any, electionId: string) => {
  const { ElectionStatus } = getVocdoniSdk();

  let latestStatus = 'unknown';

  for (let attempt = 1; attempt <= 12; attempt += 1) {
    const election = await client.fetchElection(electionId);
    latestStatus = election.status;

    console.log('[voteSurvey] electionStatus', {
      electionId,
      attempt,
      status: latestStatus,
    });

    if (latestStatus === ElectionStatus.ONGOING) {
      return latestStatus;
    }

    await delay(5000);
  }

  return latestStatus;
};

const resolveContractElectionForVocdoniId = async (vocdoniElectionId: string) => {
  const elections = await getStartedElections();
  return elections.find((election) => election.vocdoniElectionId === vocdoniElectionId) ?? null;
};

const census3Url = () => VOCDONI_CENSUS3_API_URL.replace(/\/$/, '');

const normalizeProofPayload = (payload: any, fallbackRoot: string) => {
  const proof = payload?.proof ?? payload?.censusProof;
  const value = payload?.value ?? payload?.weight;
  const root = payload?.root ?? payload?.censusRoot ?? fallbackRoot;
  const siblings = payload?.siblings ?? payload?.censusSiblings ?? null;

  if (typeof proof !== 'string' || !proof) {
    throw new Error('Census3 proof response is missing proof.');
  }

  if (typeof value !== 'string' || !value) {
    throw new Error('Census3 proof response is missing value.');
  }

  return {
    type: payload?.type ?? 'weighted',
    weight: String(payload?.weight ?? value),
    root,
    proof,
    value,
    siblings,
  };
};

const fetchJson = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status}`);
  }

  return response.json();
};

const resolveLocalCensusIds = async ({
  root,
  tokenId,
}: {
  root: string;
  tokenId: number;
}) => {
  const candidates = new Set<string>([root]);

  try {
    const token = await fetchJson(
      `${census3Url()}/tokens/${SURVEY_MANAGER_CONTRACT_ADDRESS}?chainID=${SEPOLIA_CHAIN_ID}&externalID=${tokenId}`
    );
    const strategyId = token?.defaultStrategy;

    if (strategyId != null) {
      const list = await fetchJson(`${census3Url()}/censuses/strategy/${strategyId}`);
      const censuses = Array.isArray(list?.censuses) ? list.censuses : [];

      censuses
        .filter((census: any) => String(census?.merkleRoot ?? '').toLowerCase() === root.toLowerCase())
        .forEach((census: any) => {
          if (census?.ID != null) {
            candidates.add(String(census.ID));
          }
        });
    }
  } catch (error) {
    console.log('[voteSurvey] localCensusIds:resolveFailed', {
      root,
      tokenId,
      error: describeError(error),
    });
  }

  return [...candidates];
};

const fetchLocalCensusProof = async ({
  censusRoot,
  tokenId,
  walletAddress,
}: {
  censusRoot: string;
  tokenId: number;
  walletAddress: string;
}) => {
  const censusIds = await resolveLocalCensusIds({
    root: censusRoot,
    tokenId,
  });
  const addressCandidates = Array.from(new Set([
    walletAddress,
    walletAddress.toLowerCase(),
    walletAddress.replace(/^0x/i, ''),
    walletAddress.toLowerCase().replace(/^0x/i, ''),
  ]));
  let lastError: unknown = null;

  for (const censusId of censusIds) {
    for (const address of addressCandidates) {
      const url = `${census3Url()}/censuses/${censusId}/proof/${address}`;
      try {
        const payload = await fetchJson(url);
        const proof = normalizeProofPayload(payload, censusRoot);
        console.log('[voteSurvey] localCensusProof:found', {
          censusId,
          address,
          root: proof.root,
        });
        return proof;
      } catch (error) {
        lastError = error;
        console.log('[voteSurvey] localCensusProof:miss', {
          censusId,
          address,
          error: describeError(error),
        });
      }
    }
  }

  throw new Error(`Local Census3 proof lookup failed. Last error: ${describeError(lastError)}`);
};

const fetchCensusProofForWallet = async ({
  client,
  censusId,
  tokenId,
  walletAddress,
  contractElectionId,
  registeredVoters,
}: {
  client: any;
  censusId: string;
  tokenId: number;
  walletAddress: string;
  contractElectionId: number;
  registeredVoters: number;
}) => {
  try {
    return await fetchLocalCensusProof({
      censusRoot: censusId,
      tokenId,
      walletAddress,
    });
  } catch (error) {
    console.log('[voteSurvey] localCensusProof:fallbackToVocdoniApi', {
      censusId,
      tokenId,
      walletAddress,
      error: describeError(error),
    });
  }

  const candidates = Array.from(new Set([
    walletAddress,
    walletAddress.toLowerCase(),
  ]));
  let lastError: unknown = null;

  for (const key of candidates) {
    try {
      const proof = await client.fetchProof(censusId, key);
      console.log('[voteSurvey] censusProof:found', {
        censusId,
        requestedKey: key,
        walletAddress,
      });
      return proof;
    } catch (error) {
      lastError = error;
      console.log('[voteSurvey] censusProof:miss', {
        censusId,
        requestedKey: key,
        error: describeError(error),
      });
    }
  }

  throw new Error(
    `Vocdoni cannot produce a vote proof for wallet ${walletAddress}. The wallet owns ERC1155 tokenId ${tokenId} for contract election ${contractElectionId}, but the fixed Census3 snapshot attached to this Vocdoni election does not contain that wallet or cannot return its proof. Census root/id: ${censusId}. Contract registered voters now: ${registeredVoters}. If this wallet registered after the creator started the Vocdoni election, it cannot vote in that fixed census; recreate/start a new Vocdoni election after Census3 indexes all registered voters. Last proof error: ${describeError(lastError)}`
  );
};

export const voteSurvey = async (electionId: string, choices: (number | bigint)[] = [0]) => {
  const { Vote, ElectionStatus } = getVocdoniSdk();
  const wallet = await getOrCreateDeviceWallet();
  const client = await createVocdoniClient(wallet);

  client.setElectionId(electionId);

  console.log('[voteSurvey] start', {
    electionId,
    walletAddress: wallet.address,
    choices,
  });

  const contractElection = await resolveContractElectionForVocdoniId(electionId);
  if (!contractElection) {
    throw new Error('This Vocdoni election is not linked to a started smart-contract survey.');
  }

  const [registered, tokenBalance] = await Promise.all([
    isUserRegistered(contractElection.id, wallet.address),
    getEligibilityTokenBalance(contractElection.id, wallet.address),
  ]);

  console.log('[voteSurvey] contractEligibility', {
    contractElectionId: contractElection.id,
    tokenId: contractElection.tokenId,
    walletAddress: wallet.address,
    registered,
    tokenBalance,
  });

  if (!registered || tokenBalance <= 0) {
    throw new Error(
      'Current device wallet does not hold the smart-contract eligibility token for this survey.'
    );
  }

  const currentStatus = await waitForElectionOngoing(client, electionId);

  if (currentStatus !== ElectionStatus.ONGOING) {
    throw new Error(
      `Election ${electionId} is not ready for voting yet. Current status: ${currentStatus}.`
    );
  }

  const existingVoteId = await client.hasAlreadyVoted();
  if (existingVoteId) {
    console.log('[voteSurvey] alreadyVoted', {
      electionId,
      voteId: existingVoteId,
    });

    return {
      alreadyVoted: true,
      voteId: existingVoteId,
      explorerUrl: `${client.explorerUrl}/processes/show/#/${electionId}`,
      walletAddress: wallet.address,
    };
  }

  const election = await client.fetchElection(electionId);
  const maxCount = Number(election?.voteType?.maxCount ?? 0);

  console.log('[voteSurvey] vocdoniVoteType', {
    electionId,
    maxCount,
    maxValue: election?.voteType?.maxValue,
    choiceCount: choices.length,
    choices,
  });

  if (maxCount > 0 && choices.length > maxCount) {
    throw new Error(
      `This Vocdoni election was started with maxCount=${maxCount}, but this survey requires ${choices.length} selected answer${choices.length === 1 ? '' : 's'}. Start a new Vocdoni election after updating the app so maxCount matches the number of survey answers.`
    );
  }

  const censusProof = await fetchCensusProofForWallet({
    client,
    censusId: election.census.censusId,
    tokenId: contractElection.tokenId,
    walletAddress: wallet.address,
    contractElectionId: contractElection.id,
    registeredVoters: contractElection.registeredVoters,
  });

  client.fetchProofForWallet = async () => censusProof;

  const isAbleToVote = await client.isAbleToVote();
  if (!isAbleToVote) {
    throw new Error(
      'Current device wallet has the contract token, but Vocdoni reports no vote weight left for this election.'
    );
  }

  const vote = new Vote(choices);
  const voteId = await client.submitVote(vote);

  console.log('[voteSurvey] success', {
    electionId,
    voteId,
  });

  return {
    alreadyVoted: false,
    voteId,
    explorerUrl: `${client.explorerUrl}/processes/show/#/${electionId}`,
    walletAddress: wallet.address,
  };
};
