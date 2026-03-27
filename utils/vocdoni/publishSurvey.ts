import 'react-native-get-random-values';

import { Wallet } from '@ethersproject/wallet';

import { SurveyDraft, SurveyQuestion } from '@/domain/models';
import { createVocdoniClient } from '@/utils/vocdoni/sdk';
import { getOrCreateDeviceWallet } from '@/utils/vocdoni/wallet';

const DEFAULT_DYNAMIC_CENSUS_SIZE = 25;
const MAX_DYNAMIC_CENSUS_SIZE = 500;

const sanitizeQuestionChoices = (question: SurveyQuestion) => {
  if (question.type === 'textarea') {
    return [
      {
        title: 'Submitted response',
        value: 0,
      },
    ];
  }

  return (question.options ?? []).map((option, index) => ({
    title: option.label.trim(),
    value: index,
  }));
};

const resolveDynamicCensusSize = (draft: SurveyDraft) => {
  const requested = draft.voterCap ?? DEFAULT_DYNAMIC_CENSUS_SIZE;
  return Math.min(Math.max(requested, 1), MAX_DYNAMIC_CENSUS_SIZE);
};

const buildDynamicCensusAddresses = async (creatorAddress: string, size: number) => {
  const addresses = new Set<string>([creatorAddress]);

  while (addresses.size < size) {
    addresses.add(Wallet.createRandom().address);
  }

  return [...addresses];
};

const buildElectionDescription = (draft: SurveyDraft) => {
  const requirementSummary = draft.requirements.length
    ? `Eligibility: ${draft.requirements.map((item) => `${item.type}: ${item.value}`).join(', ')}`
    : 'Eligibility: Open to all voters in the generated census.';

  return `${draft.description}\n\n${requirementSummary}`.trim();
};

const resolveElectionEndDate = (draft: SurveyDraft) => {
  if (draft.endDate) {
    return new Date(draft.endDate);
  }

  const endDate = new Date();
  endDate.setHours(endDate.getHours() + 10);
  return endDate;
};

// The SDK is loaded lazily to match the React Native runtime constraints in this app.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const getVocdoniSdk = () => require('@vocdoni/sdk');

const formatPublishError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return error;
  }

  const timeoutMatch = error.message.match(/Time out waiting for transaction: (\w+)/i);
  if (!timeoutMatch) {
    return error;
  }

  const [, txHash] = timeoutMatch;
  return new Error(
    `Vocdoni DEV did not confirm transaction ${txHash} within the client wait window. This usually means the DEV network is slow, not that the survey payload is invalid. Wait a bit and retry publishing.`
  );
};

const describeError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    value: error,
  };
};

export const publishSurveyDraft = async (draft: SurveyDraft) => {
  try {
    const publishStartedAt = Date.now();

    console.log('[publishSurvey] start', {
      name: draft.name,
      questionCount: draft.questions.length,
      requirementCount: draft.requirements.length,
      voterCap: draft.voterCap,
    });

    const wallet = await getOrCreateDeviceWallet();
    const client = await createVocdoniClient(wallet);
    const sdk = getVocdoniSdk();
    const { Election, ElectionStatus, PlainCensus } = sdk;

    console.log('[publishSurvey] walletReady', {
      address: wallet.address,
      clientApiUrl: client.url,
      explorerUrl: client.explorerUrl,
    });

    const dynamicCensusSize = resolveDynamicCensusSize(draft);
    const censusAddresses = await buildDynamicCensusAddresses(wallet.address, dynamicCensusSize);
    const census = new PlainCensus();
    censusAddresses.forEach((address: string) => {
      census.add(address);
    });

    console.log('[publishSurvey] censusBuilt', {
      dynamicCensusSize,
      firstAddress: censusAddresses[0],
      lastAddress: censusAddresses[censusAddresses.length - 1],
    });

    const endDate = resolveElectionEndDate(draft);
    const election = Election.from({
      title: draft.name.trim(),
      description: buildElectionDescription(draft),
      endDate: endDate.getTime(),
      census,
      electionType: {
        dynamicCensus: true,
      },
    });

    draft.questions.forEach((question) => {
      const choices = sanitizeQuestionChoices(question);
      election.addQuestion(question.title.trim(), draft.description.trim() || question.title.trim(), choices);
    });

    console.log('[publishSurvey] electionPrepared', {
      title: draft.name.trim(),
      questionCount: draft.questions.length,
      endDate,
    });

    const accountStartedAt = Date.now();
    console.log('[publishSurvey] account:create:start', {
      address: wallet.address,
      startedAt: new Date(accountStartedAt).toISOString(),
    });
    const accountInfo = await client.createAccount();
    console.log('[publishSurvey] accountReady', {
      address: wallet.address,
      balance: accountInfo.balance,
      durationMs: Date.now() - accountStartedAt,
    });

    const electionStartedAt = Date.now();
    console.log('[publishSurvey] election:create:start', {
      startedAt: new Date(electionStartedAt).toISOString(),
      txWaitConfigured: 'sdk-default',
    });

    const electionId = await client.createElection(election);

    client.setElectionId(electionId);
    console.log('[publishSurvey] electionCreated', {
      electionId,
      explorerUrl: `${client.explorerUrl}/processes/show/#/${electionId}`,
      durationMs: Date.now() - electionStartedAt,
    });

    let electionStatus = 'unknown';

    for (let attempt = 1; attempt <= 24; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      console.log('[publishSurvey] electionStatus:fetch:start', {
        electionId,
        attempt,
      });

      let publishedElection;
      try {
        publishedElection = await client.fetchElection(electionId);
      } catch (fetchError) {
        console.error('[publishSurvey] electionStatus:fetch:error', {
          electionId,
          attempt,
          error: describeError(fetchError),
        });
        throw fetchError;
      }

      electionStatus = publishedElection.status;

      console.log('[publishSurvey] electionStatus', {
        electionId,
        attempt,
        status: electionStatus,
        elapsedMs: Date.now() - electionStartedAt,
      });

      if (publishedElection.status === ElectionStatus.ONGOING) {
        break;
      }
    }

    return {
      electionId,
      explorerUrl: `${client.explorerUrl}/processes/show/#/${electionId}`,
      censusSize: dynamicCensusSize,
      walletAddress: wallet.address,
      status: electionStatus,
      durationMs: Date.now() - publishStartedAt,
    };
  } catch (error) {
    console.error('[publishSurvey] failed', {
      error: describeError(error),
    });
    throw formatPublishError(error);
  }
};
