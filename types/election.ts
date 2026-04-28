import { SurveyDraft, SurveyQuestion, SurveyRequirement } from "@/domain/models";

export enum ContractElectionStatus {
  Created = 0,
  Started = 1,
  Cancelled = 2,
}

export type ElectionUiState =
  | "Created"
  | "Registration open"
  | "Max voters reached"
  | "Ready to start"
  | "Started"
  | "Cancelled"
  | "Registered by current user"
  | "Not eligible";

export type ChainElection = {
  id: number;
  creator: string;
  tokenId: number;
  metadataURI: string;
  metadataHash: string;
  eligibilityHash: string;
  maxVoters: number;
  startDate: number;
  endDate: number;
  registeredVoters: number;
  status: ContractElectionStatus;
  vocdoniElectionId: string;
  vocdoniSpecHash: string;
  createdAt: number;
  startedAt: number;
  createdBlockNumber?: number;
  eligibilityMintHolders?: string[];
  eligibilityMintCount?: number;
};

export type ElectionMetadata = {
  title: string;
  description: string;
  category: string;
  tags: string[];
  questions: SurveyQuestion[];
  rewardPerVoter: number | null;
  voterCap: number | null;
  anonymity: boolean | null;
  startDate: string | null;
  endDate: string | null;
};

export type ElectionEligibilityMetadata = {
  requirements: SurveyRequirement[];
};

export type ElectionMetadataDocument = {
  version: 1;
  metadata: ElectionMetadata;
  eligibility: ElectionEligibilityMetadata;
};

export type Uint256Like = string | number | bigint;

export type Groth16ProofCalldata = {
  pi_a: [Uint256Like, Uint256Like];
  pi_b: [[Uint256Like, Uint256Like], [Uint256Like, Uint256Like]];
  pi_c: [Uint256Like, Uint256Like];
  pubInputs: Uint256Like[];
};

export type CreateElectionOnChainInput = SurveyDraft;

export type CreateElectionOnChainResult = {
  electionId: number;
  tokenId: number;
  txHash: string;
  blockNumber: number | null;
  metadataURI: string;
  metadataHash: string;
  eligibilityHash: string;
  metadata: ElectionMetadata;
  eligibility: ElectionEligibilityMetadata;
};

export type VocdoniTokenCensusConfig = {
  tokenAddress: string;
  tokenId: number;
  chainId: number;
  dynamicCensus: false;
};

export type VocdoniElectionSpec = {
  title: string;
  description: string;
  questions: ElectionMetadata["questions"];
  census: VocdoniTokenCensusConfig;
  electionType: {
    dynamicCensus: false;
    anonymous: boolean;
  };
  voteType: {
    maxCount: number;
  };
  endDate: number;
};

export type StartElectionWithVocdoniOptions = {
  metadata?: ElectionMetadata;
};

export type StartElectionWithVocdoniResult = {
  electionId: number;
  vocdoniElectionId: string;
  vocdoniSpecHash: string;
  txHash: string;
  blockNumber: number | null;
  config: VocdoniElectionSpec;
};
