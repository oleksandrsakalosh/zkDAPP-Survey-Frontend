import 'react-native-get-random-values';

import { createVocdoniClient } from '@/utils/vocdoni/sdk';
import { getOrCreateDeviceWallet } from '@/utils/vocdoni/wallet';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const getVocdoniSdk = () => require('@vocdoni/sdk');

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForElectionOngoing = async (client: any, electionId: string) => {
  const { ElectionStatus } = getVocdoniSdk();

  let latestStatus = 'unknown';

  console.log('[voteSurvey] waitForOngoing:start', { electionId, maxAttempts: 12 });

  for (let attempt = 1; attempt <= 12; attempt += 1) {
    console.log('[voteSurvey] waitForOngoing:polling', { electionId, attempt });

    const election = await client.fetchElection(electionId);
    latestStatus = election.status;

    console.log('[voteSurvey] waitForOngoing:status', {
      electionId,
      attempt,
      status: latestStatus,
      isOngoing: latestStatus === ElectionStatus.ONGOING,
    });

    if (latestStatus === ElectionStatus.ONGOING) {
      console.log('[voteSurvey] waitForOngoing:ready', { electionId, attempt });
      return latestStatus;
    }

    if (attempt < 12) {
      console.log('[voteSurvey] waitForOngoing:sleeping', { electionId, sleepMs: 5000 });
      await delay(5000);
    }
  }

  console.warn('[voteSurvey] waitForOngoing:timeout', { electionId, lastStatus: latestStatus });
  return latestStatus;
};

export const voteSurvey = async (electionId: string, choices: (number | bigint)[] = [0]) => {
  const { Vote, ElectionStatus } = getVocdoniSdk();

  console.log('[voteSurvey] start', { electionId, choices });

  // ── 1. Wallet ──────────────────────────────────────────────────────────────
  console.log('[voteSurvey] step:1 — resolving device wallet');
  const wallet = await getOrCreateDeviceWallet();
  console.log('[voteSurvey] wallet:ready', { address: wallet.address });

  // ── 2. Client ──────────────────────────────────────────────────────────────
  console.log('[voteSurvey] step:2 — creating Vocdoni client');
  const client = await createVocdoniClient(wallet);
  client.setElectionId(electionId);
  console.log('[voteSurvey] client:ready', { apiUrl: client.url, electionId });

  // ── 3. Wait for ONGOING ────────────────────────────────────────────────────
  console.log('[voteSurvey] step:3 — waiting for election to be ONGOING');
  const currentStatus = await waitForElectionOngoing(client, electionId);

  if (currentStatus !== ElectionStatus.ONGOING) {
    console.error('[voteSurvey] step:3:failed — election not ONGOING', {
      electionId,
      status: currentStatus,
    });
    throw new Error(
      `Election ${electionId} is not ready for voting yet. Current status: ${currentStatus}.`
    );
  }

  // ── 4. Already voted? ──────────────────────────────────────────────────────
  console.log('[voteSurvey] step:4 — checking if wallet already voted');
  const existingVoteId = await client.hasAlreadyVoted();

  if (existingVoteId) {
    console.log('[voteSurvey] step:4:alreadyVoted', { electionId, voteId: existingVoteId });
    return {
      alreadyVoted: true,
      voteId: existingVoteId,
      explorerUrl: `${client.explorerUrl}/processes/show/#/${electionId}`,
      walletAddress: wallet.address,
    };
  }

  console.log('[voteSurvey] step:4:notVotedYet', { electionId });

  // ── 5. Eligible? ───────────────────────────────────────────────────────────
  console.log('[voteSurvey] step:5 — checking eligibility (isAbleToVote)');
  const isAbleToVote = await client.isAbleToVote();

  if (!isAbleToVote) {
    console.error('[voteSurvey] step:5:notEligible', { electionId, walletAddress: wallet.address });
    throw new Error(
      'Current device wallet is not eligible to vote in this survey. Use the same device that created the test survey.'
    );
  }

  console.log('[voteSurvey] step:5:eligible', { electionId });

  // ── 6. Submit vote ─────────────────────────────────────────────────────────
  console.log('[voteSurvey] step:6 — submitting vote', { electionId, choices });
  const vote = new Vote(choices);
  const voteId = await client.submitVote(vote);

  console.log('[voteSurvey] step:6:success', {
    electionId,
    voteId,
    choices,
    explorerUrl: `${client.explorerUrl}/processes/show/#/${electionId}`,
  });

  return {
    alreadyVoted: false,
    voteId,
    explorerUrl: `${client.explorerUrl}/processes/show/#/${electionId}`,
    walletAddress: wallet.address,
  };
};
