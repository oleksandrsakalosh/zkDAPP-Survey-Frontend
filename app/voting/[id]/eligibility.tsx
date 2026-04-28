import React from "react";
import { Redirect, useLocalSearchParams } from "expo-router";

export default function VotingEligibilityRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/voting/${id}/questions` as any} />;
}
