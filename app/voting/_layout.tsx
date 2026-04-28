import * as React from "react";
import { Stack } from "expo-router";
import { VotingProvider } from "@/utils/VotingContext";

export default function VotingLayout() {
  return (
    <VotingProvider>
      <Stack screenOptions={{ headerShown: false, animation: "none" }} />
    </VotingProvider>
  );
}
