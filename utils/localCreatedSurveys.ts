import * as SecureStore from "expo-secure-store";

import { CreatedSurveyCardData } from "@/domain/models";

const CREATED_SURVEYS_STORAGE_KEY = "created-surveys.v1";

const canUseBrowserStorage = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const readStorageValue = async () => {
  if (canUseBrowserStorage()) {
    return window.localStorage.getItem(CREATED_SURVEYS_STORAGE_KEY);
  }

  return SecureStore.getItemAsync(CREATED_SURVEYS_STORAGE_KEY);
};

const writeStorageValue = async (value: string) => {
  if (canUseBrowserStorage()) {
    window.localStorage.setItem(CREATED_SURVEYS_STORAGE_KEY, value);
    return;
  }

  await SecureStore.setItemAsync(CREATED_SURVEYS_STORAGE_KEY, value);
};

export const loadStoredCreatedSurveys = async (): Promise<CreatedSurveyCardData[]> => {
  const rawValue = await readStorageValue();

  if (!rawValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(rawValue);
    return Array.isArray(parsedValue) ? (parsedValue as CreatedSurveyCardData[]) : [];
  } catch {
    return [];
  }
};

export const saveStoredCreatedSurveys = async (surveys: CreatedSurveyCardData[]) => {
  await writeStorageValue(JSON.stringify(surveys));
};

export const upsertStoredCreatedSurvey = async (survey: CreatedSurveyCardData) => {
  const currentSurveys = await loadStoredCreatedSurveys();
  const nextSurveys = [survey, ...currentSurveys.filter((item) => item.id !== survey.id)];
  await saveStoredCreatedSurveys(nextSurveys);
};
