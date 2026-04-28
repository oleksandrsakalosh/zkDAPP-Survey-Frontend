import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  ElectionEligibilityMetadata,
  ElectionMetadata,
  ElectionMetadataDocument,
} from "@/types/election";
import { hashJson } from "@/utils/hash";
import { fetchElectionMetadataDocument } from "@/utils/ipfs";

const STORE_PREFIX = "surveyElection.metadata.";

export type StoredElectionMetadata = {
  electionId: number;
  metadataHash: string;
  eligibilityHash: string;
  metadataURI?: string;
  metadata: ElectionMetadata;
  eligibility: ElectionEligibilityMetadata;
  savedAt: string;
};

const keyForElection = (electionId: number) => `${STORE_PREFIX}${electionId}`;

export const saveElectionMetadata = async (record: Omit<StoredElectionMetadata, "savedAt">) => {
  await AsyncStorage.setItem(
    keyForElection(record.electionId),
    JSON.stringify({
      ...record,
      savedAt: new Date().toISOString(),
    })
  );
};

export const loadElectionMetadata = async (
  electionId: number
): Promise<StoredElectionMetadata | null> => {
  const raw = await AsyncStorage.getItem(keyForElection(electionId));

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredElectionMetadata;
  } catch {
    return null;
  }
};

export const loadElectionMetadataMap = async (electionIds: number[]) => {
  const entries = await Promise.all(
    electionIds.map(async (electionId) => [electionId, await loadElectionMetadata(electionId)] as const)
  );

  return entries.reduce<Record<number, StoredElectionMetadata>>((acc, [electionId, metadata]) => {
    if (metadata) {
      acc[electionId] = metadata;
    }

    return acc;
  }, {});
};

export const buildElectionMetadataDocument = (
  metadata: ElectionMetadata,
  eligibility: ElectionEligibilityMetadata
): ElectionMetadataDocument => ({
  version: 1,
  metadata,
  eligibility,
});

export const loadOrFetchElectionMetadata = async ({
  electionId,
  metadataURI,
  metadataHash,
  eligibilityHash,
}: {
  electionId: number;
  metadataURI: string;
  metadataHash: string;
  eligibilityHash: string;
}) => {
  const local = await loadElectionMetadata(electionId);
  if (
    local &&
    local.metadataHash.toLowerCase() === metadataHash.toLowerCase() &&
    local.eligibilityHash.toLowerCase() === eligibilityHash.toLowerCase()
  ) {
    return local;
  }

  if (!metadataURI) {
    return null;
  }

  const document = await fetchElectionMetadataDocument(metadataURI);
  const fetchedMetadataHash = hashJson(document.metadata);
  const fetchedEligibilityHash = hashJson(document.eligibility);

  if (fetchedMetadataHash.toLowerCase() !== metadataHash.toLowerCase()) {
    throw new Error(`Metadata hash mismatch for election ${electionId}.`);
  }

  if (fetchedEligibilityHash.toLowerCase() !== eligibilityHash.toLowerCase()) {
    throw new Error(`Eligibility hash mismatch for election ${electionId}.`);
  }

  const record: Omit<StoredElectionMetadata, "savedAt"> = {
    electionId,
    metadataURI,
    metadataHash,
    eligibilityHash,
    metadata: document.metadata,
    eligibility: document.eligibility,
  };

  await saveElectionMetadata(record);
  return loadElectionMetadata(electionId);
};

export const loadOrFetchElectionMetadataMap = async (
  elections: {
    id: number;
    metadataURI: string;
    metadataHash: string;
    eligibilityHash: string;
  }[]
) => {
  const entries = await Promise.all(
    elections.map(async (election) => {
      try {
        return [election.id, await loadOrFetchElectionMetadata({
          electionId: election.id,
          metadataURI: election.metadataURI,
          metadataHash: election.metadataHash,
          eligibilityHash: election.eligibilityHash,
        })] as const;
      } catch (error) {
        console.warn("[election-metadata] failed to hydrate", {
          electionId: election.id,
          error: error instanceof Error ? error.message : error,
        });
        return [election.id, null] as const;
      }
    })
  );

  return entries.reduce<Record<number, StoredElectionMetadata>>((acc, [electionId, metadata]) => {
    if (metadata) {
      acc[electionId] = metadata;
    }

    return acc;
  }, {});
};
