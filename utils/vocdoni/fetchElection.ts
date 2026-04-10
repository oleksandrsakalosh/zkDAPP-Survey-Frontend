import 'react-native-get-random-values';

import { createVocdoniClient } from '@/utils/vocdoni/sdk';
import { getOrCreateDeviceWallet } from '@/utils/vocdoni/wallet';
import { SurveyDetail, SurveyQuestion, SurveyQuestionOption } from '@/domain/models';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const getVocdoniSdk = () => require('@vocdoni/sdk');

/**
 * Маппит один вопрос из формата Vocdoni PublishedElection в SurveyQuestion.
 *
 * Vocdoni хранит вопросы как:
 *   election.questions[i] = {
 *     title: { default: "Question text" },
 *     description: { default: "..." },
 *     choices: [
 *       { title: { default: "Option A" }, value: 0 },
 *       { title: { default: "Option B" }, value: 1 },
 *     ]
 *   }
 */
const mapVocdoniQuestion = (
  vocdoniQuestion: any,
  questionIndex: number
): SurveyQuestion => {
  const rawTitle =
    typeof vocdoniQuestion.title === 'string'
      ? vocdoniQuestion.title
      : vocdoniQuestion.title?.default ?? `Question ${questionIndex + 1}`;

  const choices: any[] = vocdoniQuestion.choices ?? [];

  // Если вариантов нет или единственный "Submitted response" — это textarea-вопрос
  const isTextarea =
    choices.length === 0 ||
    (choices.length === 1 &&
      (choices[0].title?.default ?? choices[0].title ?? '')
        .toLowerCase()
        .includes('submitted response'));

  const options: SurveyQuestionOption[] = isTextarea
    ? []
    : choices.map((choice: any, choiceIndex: number) => {
        const choiceLabel =
          typeof choice.title === 'string'
            ? choice.title
            : choice.title?.default ?? `Option ${choiceIndex + 1}`;
        return {
          id: `q${questionIndex}-o${choiceIndex}`,
          label: choiceLabel,
          order: choiceIndex,
          value: String(choice.value ?? choiceIndex),
        };
      });

  return {
    id: `vocdoni-q${questionIndex}`,
    order: questionIndex + 1,
    type: isTextarea ? 'textarea' : 'single_choice',
    title: rawTitle,
    isRequired: true,
    options: isTextarea ? undefined : options,
  };
};

/**
 * Получает election с Vocdoni по electionId и маппит его в SurveyDetail.
 * Это единственный источник данных — никакой локальной информации не используется.
 */
export const fetchElectionAsSurveyDetail = async (
  electionId: string
): Promise<SurveyDetail> => {
  console.log('[fetchElection] start', { electionId });

  const wallet = await getOrCreateDeviceWallet();
  const client = await createVocdoniClient(wallet);

  console.log('[fetchElection] client:ready', {
    walletAddress: wallet.address,
    apiUrl: client.url,
  });

  let election: any;
  try {
    election = await client.fetchElection(electionId);
  } catch (err) {
    console.error('[fetchElection] fetchElection:error', {
      electionId,
      error: err instanceof Error ? err.message : err,
    });
    throw err;
  }

  console.log('[fetchElection] raw:received', {
    electionId,
    status: election.status,
    title: election.title?.default ?? election.title,
    questionCount: election.questions?.length ?? 0,
    startDate: election.startDate,
    endDate: election.endDate,
    voteCount: election.voteCount,
  });

  // ── Маппинг полей ──────────────────────────────────────────────────────────

  const title =
    typeof election.title === 'string'
      ? election.title
      : election.title?.default ?? 'Untitled Survey';

  const description =
    typeof election.description === 'string'
      ? election.description
      : election.description?.default ?? '';

  const questions: SurveyQuestion[] = (election.questions ?? []).map(
    (q: any, i: number) => mapVocdoniQuestion(q, i)
  );

  console.log('[fetchElection] mapped:questions', {
    electionId,
    count: questions.length,
    titles: questions.map((q) => q.title),
    types: questions.map((q) => q.type),
  });

  const endDate: Date | undefined = election.endDate
    ? new Date(election.endDate)
    : undefined;

  const now = new Date();
  const daysRemaining =
    endDate != null
      ? Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / 86_400_000))
      : undefined;

  const surveyDetail: SurveyDetail = {
    id: electionId,
    title,
    description,
    status: 'active',
    categories: [{ id: 'vocdoni', label: 'Vocdoni' }],
    budget: { rewardPerVoter: { amount: 0, currency: 'USD' } },
    progress: {
      responseCount: election.voteCount ?? 0,
      targetResponses: election.maxCensusSize ?? undefined,
    },
    estimatedMinutes: Math.max(1, Math.ceil((questions.length * 30) / 60)),
    timeInfo: endDate
      ? {
          closesAt: endDate.toISOString(),
          isOpen: election.status === 'ONGOING',
          daysRemaining,
          displayLabel: `Closes ${endDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}`,
        }
      : undefined,
    requirements: [],
    canParticipate: true,
    hasVoted: false,
    questions,
  };

  console.log('[fetchElection] surveyDetail:ready', {
    electionId,
    title: surveyDetail.title,
    questionCount: surveyDetail.questions?.length ?? 0,
    status: surveyDetail.status,
    daysRemaining,
  });

  return surveyDetail;
};
