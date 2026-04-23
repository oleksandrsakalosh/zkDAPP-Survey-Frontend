import React, { createContext, useContext, useMemo, useState } from "react";
import { SurveyDraft } from "@/domain/models";

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
  anonymity: false
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