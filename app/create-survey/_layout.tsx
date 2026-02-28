import * as React from 'react';
import { Stack } from "expo-router";
import { SurveyDraftProvider } from "../../utils/SurveyDraftContext";


export default function Layout() {
  return (
    <SurveyDraftProvider>
      <Stack />
    </SurveyDraftProvider>
  );
}