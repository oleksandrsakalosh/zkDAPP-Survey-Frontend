import React, { createContext, useContext, useMemo, useState } from "react";

export type QuestionType = "Multiple choice" | "Paragraph";

export type SurveyQuestion = {
  id: string;
  title: string;
  type: QuestionType;
  required: boolean;
  options: string[];
};

export type SurveyDraft = {
  
  name: string;
  description: string;
  startDate: string | null; // ISO string
  endDate: string | null; // ISO string
  tags: string[];
  category: string;
  questions: SurveyQuestion[];
  requirements: SurveyRequirement[];
  rewardPerVoter: number | null;
  voterCap: number | null;
};

export type SurveyRequirement = {
  id: string;
  type: string;
  value: string;
};

const defaultDraft: SurveyDraft = {
  name: "",
  description: "",
  startDate: null,
  endDate: null,
  tags: [],
  category: "",
  questions: [],
  requirements: [],
  rewardPerVoter: null,
  voterCap: null,
};

type Ctx = {
  draft: SurveyDraft;
  setDraft: React.Dispatch<React.SetStateAction<SurveyDraft>>;
  resetDraft: () => void;
};

const SurveyDraftContext = createContext<Ctx | null>(null);

export function SurveyDraftProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<SurveyDraft>(defaultDraft);

  const value = useMemo(
    () => ({
      draft,
      setDraft,
      resetDraft: () => setDraft(defaultDraft),
    }),
    [draft]
  );

  return <SurveyDraftContext.Provider value={value}>{children}</SurveyDraftContext.Provider>;
}

export function useSurveyDraft() {
  const ctx = useContext(SurveyDraftContext);
  if (!ctx) throw new Error("useSurveyDraft must be used inside SurveyDraftProvider");
  return ctx;
}