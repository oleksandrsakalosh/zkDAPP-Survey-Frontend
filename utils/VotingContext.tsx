import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { SurveyDetail, QuestionType } from "@/domain/models";

export interface VotingAnswer {
  questionId: string;
  type: QuestionType;
  selectedOptions: string[]; // option IDs for single/multiple choice
  textValue: string;         // for textarea
}

interface VotingState {
  survey: SurveyDetail | null;
  answers: VotingAnswer[];
  /** Vocdoni election ID — присваивается когда голосование запускается для реального election */
  electionId: string | null;
}

type VotingCtx = {
  state: VotingState;
  setSurvey: (survey: SurveyDetail) => void;
  setAnswer: (answer: VotingAnswer) => void;
  setElectionId: (electionId: string) => void;
  reset: () => void;
};

const defaultState: VotingState = { survey: null, answers: [], electionId: null };

const VotingContext = createContext<VotingCtx | null>(null);

export function VotingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<VotingState>(defaultState);

  const setSurvey = useCallback((survey: SurveyDetail) => {
    setState((prev) => ({
      ...prev,
      survey,
      answers: (survey.questions ?? []).map((q) => ({
        questionId: q.id,
        type: q.type,
        selectedOptions: [],
        textValue: "",
      })),
    }));
  }, []);

  const setAnswer = useCallback((answer: VotingAnswer) => {
    setState((prev) => ({
      ...prev,
      answers: prev.answers.map((a) =>
        a.questionId === answer.questionId ? answer : a
      ),
    }));
  }, []);

  const setElectionId = useCallback((electionId: string) => {
    setState((prev) => ({ ...prev, electionId }));
  }, []);

  const reset = useCallback(() => setState(defaultState), []);

  const value = useMemo(
    () => ({ state, setSurvey, setAnswer, setElectionId, reset }),
    [state, setSurvey, setAnswer, setElectionId, reset]
  );

  return (
    <VotingContext.Provider value={value}>{children}</VotingContext.Provider>
  );
}

export function useVoting() {
  const ctx = useContext(VotingContext);
  if (!ctx) throw new Error("useVoting must be used inside VotingProvider");
  return ctx;
}

