import 'react-native-get-random-values';

import { createVocdoniClient } from '@/utils/vocdoni/sdk';
import { getOrCreateDeviceWallet } from '@/utils/vocdoni/wallet';

// The SDK is loaded lazily to match the existing Vocdoni helpers in this app.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const getVocdoniSdk = () => require('@vocdoni/sdk');

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

  const isAbleToVote = await client.isAbleToVote();
  if (!isAbleToVote) {
    throw new Error(
      'Current device wallet is not eligible to vote in this survey. Use the same device that created the test survey.'
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
