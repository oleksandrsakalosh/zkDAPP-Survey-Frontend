import { Stack } from "expo-router";
import { SurveyDraftProvider } from "./SurveyDraftContext";


export default function Layout() {
  return (
    <SurveyDraftProvider>
      <Stack />
    </SurveyDraftProvider>
  );
}