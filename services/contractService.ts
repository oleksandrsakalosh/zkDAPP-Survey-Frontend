import "react-native-get-random-values";

import { hexlify } from "@ethersproject/bytes";
import { BigNumber } from "@ethersproject/bignumber";
import { keccak256 } from "@ethersproject/keccak256";
import { JsonRpcProvider } from "@ethersproject/providers";
import { toUtf8Bytes, toUtf8String } from "@ethersproject/strings";
import { Wallet } from "@ethersproject/wallet";

import {
  SEPOLIA_CHAIN_ID,
  SURVEY_MANAGER_CONTRACT_ADDRESS,
  SURVEY_MANAGER_DEPLOYMENT_BLOCK,
  SURVEY_MANAGER_RPC_URL,
} from "@/config/contracts";
import {
  ChainElection,
  ContractElectionStatus,
  CreateElectionOnChainInput,
  CreateElectionOnChainResult,
  ElectionEligibilityMetadata,
  ElectionMetadata,
  ElectionUiState,
  Groth16ProofCalldata,
  StartElectionWithVocdoniOptions,
  StartElectionWithVocdoniResult,
  Uint256Like,
} from "@/types/election";
import { hashJson } from "@/utils/hash";
import { getOrCreateDeviceWallet } from "@/utils/vocdoni/wallet";
import { createVocdoniElectionFromTokenCensus } from "@/services/vocdoniService";
import {
  buildElectionMetadataDocument,
  saveElectionMetadata,
} from "@/utils/electionMetadataStore";
import { uploadElectionMetadataDocument } from "@/utils/ipfs";

let sharedProvider: JsonRpcProvider | null = null;

const stripHexPrefix = (value: string) => value.replace(/^0x/i, "");
const padWord = (hexValue: string) => stripHexPrefix(hexValue).padStart(64, "0");
const padDynamicHex = (hexValue: string) => {
  const normalized = stripHexPrefix(hexValue);
  const remainder = normalized.length % 64;
  return remainder === 0 ? normalized : normalized.padEnd(normalized.length + (64 - remainder), "0");
};
const toUint256BigInt = (value: Uint256Like) => {
  const parsed = typeof value === "bigint" ? value : BigInt(value);
  if (parsed < 0n) {
    throw new Error("uint256 values cannot be negative.");
  }
  return parsed;
};
const encodeUint256 = (value: Uint256Like) => padWord(toUint256BigInt(value).toString(16));
const encodeBytes32 = (value: string) => padWord(stripHexPrefix(value));
const encodeAddress = (address: string) => padWord(stripHexPrefix(address).toLowerCase());
const getSelector = (signature: string) => keccak256(toUtf8Bytes(signature)).slice(0, 10);
const readWord = (payload: string, index: number) => payload.slice(index * 64, index * 64 + 64);
const decodeUint256 = (hexWord: string) => BigInt(`0x${stripHexPrefix(hexWord || "0")}`);
const decodeNumber = (hexWord: string) => Number(decodeUint256(hexWord));
const decodeBool = (result: string) => decodeUint256(stripHexPrefix(result)) !== 0n;

const encodeString = (value: string) => {
  const encoded = stripHexPrefix(hexlify(toUtf8Bytes(value)));
  return `${encodeUint256(encoded.length / 2)}${padDynamicHex(encoded)}`;
};

const decodeStringAt = (payload: string, tupleStartBytes: number, offsetBytes: bigint) => {
  const absoluteOffsetBytes = tupleStartBytes + Number(offsetBytes);
  const lengthWordIndex = absoluteOffsetBytes / 32;
  const byteLength = Number(decodeUint256(readWord(payload, lengthWordIndex)));
  const dataStart = (absoluteOffsetBytes + 32) * 2;
  const rawHex = payload.slice(dataStart, dataStart + byteLength * 2);
  return rawHex ? toUtf8String(`0x${rawHex}`) : "";
};

const buildCreateElectionCallData = (
  metadataURI: string,
  metadataHash: string,
  eligibilityHash: string,
  maxVoters: number,
  startDate: number,
  endDate: number
) => {
  const metadataTail = encodeString(metadataURI);

  return `0x${stripHexPrefix(
    getSelector("createElection(string,bytes32,bytes32,uint256,uint256,uint256)")
  )}${encodeUint256(192)}${encodeBytes32(metadataHash)}${encodeBytes32(eligibilityHash)}${encodeUint256(
    maxVoters
  )}${encodeUint256(startDate)}${encodeUint256(endDate)}${metadataTail}`;
};

const encodeGroth16Proof = (proof: Groth16ProofCalldata) =>
  `${encodeUint256(proof.pi_a[0])}${encodeUint256(proof.pi_a[1])}${encodeUint256(
    proof.pi_b[0][0]
  )}${encodeUint256(proof.pi_b[0][1])}${encodeUint256(proof.pi_b[1][0])}${encodeUint256(
    proof.pi_b[1][1]
  )}${encodeUint256(proof.pi_c[0])}${encodeUint256(proof.pi_c[1])}${encodeUint256(
    proof.pubInputs[0]
  )}${encodeUint256(proof.pubInputs[1])}`;

const buildRegisterForElectionCallData = (electionId: number, proof: Groth16ProofCalldata) =>
  `0x${stripHexPrefix(
    getSelector("registerForElection(uint256,uint256[2],uint256[2][2],uint256[2],uint256[2])")
  )}${encodeUint256(electionId)}${encodeGroth16Proof(proof)}`;

const buildVerifyProofViewCallData = (proof: Groth16ProofCalldata) =>
  `0x${stripHexPrefix(
    getSelector("verifyProofView(uint256[2],uint256[2][2],uint256[2],uint256[2])")
  )}${encodeGroth16Proof(proof)}`;

const buildStartElectionCallData = (
  electionId: number,
  vocdoniElectionId: string,
  vocdoniSpecHash: string
) => {
  const stringTail = encodeString(vocdoniElectionId);
  return `0x${stripHexPrefix(getSelector("startElection(uint256,string,bytes32)"))}${encodeUint256(
    electionId
  )}${encodeUint256(96)}${encodeBytes32(vocdoniSpecHash)}${stringTail}`;
};

const buildGetElectionCallData = (electionId: number) =>
  `0x${stripHexPrefix(getSelector("getElection(uint256)"))}${encodeUint256(electionId)}`;

const buildGetCreatorElectionsCallData = (creator: string) =>
  `0x${stripHexPrefix(getSelector("getCreatorElections(address)"))}${encodeAddress(creator)}`;

const buildGetVoterElectionsCallData = (voter: string) =>
  `0x${stripHexPrefix(getSelector("getVoterElections(address)"))}${encodeAddress(voter)}`;

const buildIsRegisteredCallData = (electionId: number, voter: string) =>
  `0x${stripHexPrefix(getSelector("isRegistered(uint256,address)"))}${encodeUint256(
    electionId
  )}${encodeAddress(voter)}`;

const buildBalanceOfCallData = (voter: string, tokenId: number) =>
  `0x${stripHexPrefix(getSelector("balanceOf(address,uint256)"))}${encodeAddress(voter)}${encodeUint256(
    tokenId
  )}`;

const buildNextElectionIdCallData = () => getSelector("nextElectionId()");
const ELECTION_CREATED_TOPIC = keccak256(
  toUtf8Bytes("ElectionCreated(uint256,address,uint256,string,bytes32,bytes32,uint256,uint256,uint256)")
).toLowerCase();
const TRANSFER_SINGLE_TOPIC = keccak256(
  toUtf8Bytes("TransferSingle(address,address,address,uint256,uint256)")
).toLowerCase();
const ZERO_ADDRESS_TOPIC = `0x${"0".repeat(64)}`;

const decodeUint256Array = (result: string) => {
  const payload = stripHexPrefix(result);
  const offset = Number(decodeUint256(readWord(payload, 0)) / 32n);
  const length = Number(decodeUint256(readWord(payload, offset)));
  return Array.from({ length }, (_, index) => Number(decodeUint256(readWord(payload, offset + 1 + index))));
};

const decodeElection = (result: string): ChainElection => {
  const payload = stripHexPrefix(result);
  const startsWithTupleOffset = decodeUint256(readWord(payload, 0)) === 32n;
  const tupleStartWord = startsWithTupleOffset ? 1 : 0;
  const tupleStartBytes = tupleStartWord * 32;
  const word = (index: number) => readWord(payload, tupleStartWord + index);

  return {
    id: decodeNumber(word(0)),
    creator: `0x${word(1).slice(24)}`,
    tokenId: decodeNumber(word(2)),
    metadataURI: decodeStringAt(payload, tupleStartBytes, decodeUint256(word(3))),
    metadataHash: `0x${word(4)}`,
    eligibilityHash: `0x${word(5)}`,
    maxVoters: decodeNumber(word(6)),
    startDate: decodeNumber(word(7)),
    endDate: decodeNumber(word(8)),
    registeredVoters: decodeNumber(word(9)),
    status: decodeNumber(word(10)) as ContractElectionStatus,
    vocdoniElectionId: decodeStringAt(payload, tupleStartBytes, decodeUint256(word(11))),
    vocdoniSpecHash: `0x${word(12)}`,
    createdAt: decodeNumber(word(13)),
    startedAt: decodeNumber(word(14)),
  };
};

const normalizeTxError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return new Error("Contract transaction failed.");
  }

  const message = error.message.toLowerCase();
  if (message.includes("user rejected") || message.includes("denied")) {
    return new Error("Transaction rejected.");
  }
  if (message.includes("insufficient funds")) {
    return new Error("Wallet needs Sepolia ETH for gas.");
  }
  if (message.includes("already registered")) {
    return new Error("Already registered for this election.");
  }
  if (message.includes("max voters reached")) {
    return new Error("Max voters reached.");
  }
  if (message.includes("cannot start yet")) {
    return new Error("Election cannot start yet.");
  }
  if (message.includes("eligibility check failed") || message.includes("invalid zk proof")) {
    return new Error("Eligibility proof failed.");
  }
  if (message.includes("input out of range")) {
    return new Error("Eligibility proof public input is out of range.");
  }

  return error;
};

const ensureSepolia = async (provider: JsonRpcProvider) => {
  const network = await (provider as any).detectNetwork();
  if (network.chainId !== SEPOLIA_CHAIN_ID) {
    throw new Error(`Wrong network. Expected Sepolia (${SEPOLIA_CHAIN_ID}), got ${network.chainId}.`);
  }
};

const getProvider = () => {
  if (!sharedProvider) {
    sharedProvider = new JsonRpcProvider(SURVEY_MANAGER_RPC_URL);
  }

  return sharedProvider;
};

const getSigner = async (wallet?: Wallet) => {
  const provider = getProvider();
  await ensureSepolia(provider);
  const baseWallet = wallet ?? (await getOrCreateDeviceWallet());
  return baseWallet.connect(provider);
};

const readContract = (data: string) =>
  getProvider().call({
    to: SURVEY_MANAGER_CONTRACT_ADDRESS,
    data,
  });

const buildMetadata = (draft: CreateElectionOnChainInput): ElectionMetadata => ({
  title: draft.name.trim(),
  description: draft.description.trim(),
  category: draft.category.trim() || "General",
  tags: draft.tags.map((tag) => tag.trim()).filter(Boolean),
  questions: draft.questions,
  rewardPerVoter: draft.rewardPerVoter,
  voterCap: draft.voterCap,
  anonymity: draft.anonymity,
  startDate: draft.startDate,
  endDate: draft.endDate,
});

const buildEligibility = (draft: CreateElectionOnChainInput): ElectionEligibilityMetadata => ({
  requirements: draft.requirements,
});

const toUnixSeconds = (dateValue: string | null) => {
  if (!dateValue) {
    return 0;
  }

  const parsed = new Date(dateValue).getTime();
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : 0;
};

export const resolveElectionUiStates = ({
  election,
  isRegistered,
  eligible = true,
  nowSeconds = Math.floor(Date.now() / 1000),
}: {
  election: ChainElection;
  isRegistered?: boolean;
  eligible?: boolean;
  nowSeconds?: number;
}): ElectionUiState[] => {
  const states: ElectionUiState[] = [];

  if (!eligible) {
    states.push("Not eligible");
  }
  if (isRegistered) {
    states.push("Registered by current user");
  }
  if (election.status === ContractElectionStatus.Cancelled) {
    return [...states, "Cancelled"];
  }
  if (election.status === ContractElectionStatus.Started) {
    return [...states, "Started"];
  }

  states.push("Created");

  const maxReached = election.maxVoters > 0 && election.registeredVoters >= election.maxVoters;
  const startReached = election.startDate === 0 || nowSeconds >= election.startDate;

  if (maxReached) {
    states.push("Max voters reached", "Ready to start");
  } else if (startReached) {
    states.push("Ready to start");
  } else {
    states.push("Registration open");
  }

  return states;
};

export const createElectionOnChain = async (
  formData: CreateElectionOnChainInput
): Promise<CreateElectionOnChainResult> => {
  const metadata = buildMetadata(formData);
  const eligibility = buildEligibility(formData);
  const metadataHash = hashJson(metadata);
  const eligibilityHash = hashJson(eligibility);
  const metadataURI = await uploadElectionMetadataDocument(
    buildElectionMetadataDocument(metadata, eligibility)
  );
  const maxVoters = formData.voterCap ?? 0;
  const startDate = toUnixSeconds(formData.startDate);
  const endDate = toUnixSeconds(formData.endDate);
  const signer = await getSigner();

  try {
    const transaction = await signer.sendTransaction({
      to: SURVEY_MANAGER_CONTRACT_ADDRESS,
      data: buildCreateElectionCallData(
        metadataURI,
        metadataHash,
        eligibilityHash,
        maxVoters,
        startDate,
        endDate
      ),
    });
    const receipt = (await transaction.wait()) as any;

    const eventLog = receipt?.logs?.find(
      (log: any) =>
        log.address.toLowerCase() === SURVEY_MANAGER_CONTRACT_ADDRESS.toLowerCase() &&
        log.topics[0]?.toLowerCase() === ELECTION_CREATED_TOPIC
    );

    const electionId = eventLog ? BigNumber.from(eventLog.topics[1]).toNumber() : 0;
    const tokenId = eventLog ? BigNumber.from(eventLog.topics[3]).toNumber() : electionId;

    if (!electionId) {
      throw new Error("ElectionCreated event was not found in the transaction receipt.");
    }

    await saveElectionMetadata({
      electionId,
      metadataURI,
      metadataHash,
      eligibilityHash,
      metadata,
      eligibility,
    });

    return {
      electionId,
      tokenId,
      txHash: transaction.hash,
      blockNumber: receipt?.blockNumber ?? null,
      metadataURI,
      metadataHash,
      eligibilityHash,
      metadata,
      eligibility,
    };
  } catch (error) {
    throw normalizeTxError(error);
  }
};

export const verifyEligibilityProofOnChain = async (proof: Groth16ProofCalldata) => {
  try {
    const response = await readContract(buildVerifyProofViewCallData(proof));
    return decodeBool(response);
  } catch (error) {
    throw normalizeTxError(error);
  }
};

export const registerForElection = async (electionId: number, proof: Groth16ProofCalldata) => {
  const signer = await getSigner();

  try {
    const transaction = await signer.sendTransaction({
      to: SURVEY_MANAGER_CONTRACT_ADDRESS,
      data: buildRegisterForElectionCallData(electionId, proof),
    });
    const receipt = await transaction.wait();
    const registered = await isUserRegistered(electionId, signer.address);

    return {
      txHash: transaction.hash,
      blockNumber: receipt?.blockNumber ?? null,
      registered,
      walletAddress: signer.address,
    };
  } catch (error) {
    throw normalizeTxError(error);
  }
};

export const startElectionWithVocdoni = async (
  electionId: number,
  options: StartElectionWithVocdoniOptions = {}
): Promise<StartElectionWithVocdoniResult> => {
  const baseElection = await getElection(electionId);
  const createdBlockNumber = await getElectionCreatedBlock(electionId);
  const eligibilityMintHolders = await getElectionEligibilityMintHolders(
    electionId,
    createdBlockNumber
  );
  const election = {
    ...baseElection,
    createdBlockNumber,
    eligibilityMintHolders,
    eligibilityMintCount: eligibilityMintHolders.length,
  };

  console.log("[contract] eligibility mint holders", {
    electionId,
    tokenId: election.tokenId,
    registeredVoters: election.registeredVoters,
    mintCount: eligibilityMintHolders.length,
    holders: eligibilityMintHolders,
    fromBlock: createdBlockNumber ?? SURVEY_MANAGER_DEPLOYMENT_BLOCK,
  });

  if (election.registeredVoters > eligibilityMintHolders.length) {
    throw new Error(
      `Smart contract reports ${election.registeredVoters} registered voters for election ${electionId}, but only ${eligibilityMintHolders.length} ERC1155 mint log${eligibilityMintHolders.length === 1 ? "" : "s"} for tokenId ${election.tokenId} were found on Sepolia. Do not start this election until the registration transactions are confirmed and visible in TransferSingle logs.`
    );
  }

  const { vocdoniElectionId, vocdoniSpecHash, config } = await createVocdoniElectionFromTokenCensus({
    election,
    metadata: options.metadata,
  });
  const signer = await getSigner();

  try {
    const transaction = await signer.sendTransaction({
      to: SURVEY_MANAGER_CONTRACT_ADDRESS,
      data: buildStartElectionCallData(electionId, vocdoniElectionId, vocdoniSpecHash),
    });
    const receipt = await transaction.wait();

    return {
      electionId,
      vocdoniElectionId,
      vocdoniSpecHash,
      txHash: transaction.hash,
      blockNumber: receipt?.blockNumber ?? null,
      config,
    };
  } catch (error) {
    throw normalizeTxError(error);
  }
};

export const getElection = async (electionId: number): Promise<ChainElection> => {
  const response = await readContract(buildGetElectionCallData(electionId));
  return decodeElection(response);
};

export const getElectionCreatedBlock = async (electionId: number) => {
  try {
    const logs = await (getProvider() as any).send("eth_getLogs", [
      {
        address: SURVEY_MANAGER_CONTRACT_ADDRESS,
        fromBlock: `0x${Math.max(0, SURVEY_MANAGER_DEPLOYMENT_BLOCK).toString(16)}`,
        toBlock: "latest",
        topics: [
          ELECTION_CREATED_TOPIC,
          `0x${encodeUint256(electionId)}`,
        ],
      },
    ]);

    const blockHex = logs?.[0]?.blockNumber;
    if (!blockHex || typeof blockHex !== "string") {
      return undefined;
    }

    return Number(BigInt(blockHex));
  } catch (error) {
    console.warn("[contract] failed to resolve election creation block", {
      electionId,
      error: error instanceof Error ? error.message : error,
    });
    return undefined;
  }
};

export const getElectionEligibilityMintHolders = async (
  electionId: number,
  fromBlock?: number
) => {
  const election = await getElection(electionId);
  const logs = await (getProvider() as any).send("eth_getLogs", [
    {
      address: SURVEY_MANAGER_CONTRACT_ADDRESS,
      fromBlock: `0x${Math.max(0, fromBlock ?? SURVEY_MANAGER_DEPLOYMENT_BLOCK).toString(16)}`,
      toBlock: "latest",
      topics: [TRANSFER_SINGLE_TOPIC, null, ZERO_ADDRESS_TOPIC],
    },
  ]);

  const holders = new Set<string>();

  for (const log of logs ?? []) {
    const data = stripHexPrefix(String(log?.data ?? ""));
    const tokenId = decodeNumber(readWord(data, 0));
    const value = decodeNumber(readWord(data, 1));
    const toTopic = String(log?.topics?.[3] ?? "");

    if (tokenId === election.tokenId && value > 0 && /^0x[0-9a-fA-F]{64}$/.test(toTopic)) {
      holders.add(`0x${toTopic.slice(-40)}`.toLowerCase());
    }
  }

  return [...holders];
};

export const getElectionTokenId = async (electionId: number) => {
  const election = await getElection(electionId);
  return election.tokenId;
};

export const getElectionCountUpperBound = async () => {
  const response = await readContract(buildNextElectionIdCallData());
  return Math.max(0, decodeNumber(stripHexPrefix(response)) - 1);
};

export const getAvailableElections = async () => {
  const count = await getElectionCountUpperBound();
  const elections = await Promise.all(Array.from({ length: count }, (_, index) => getElection(index + 1)));
  const nowSeconds = Math.floor(Date.now() / 1000);

  return elections.filter(
    (election) =>
      election.status === ContractElectionStatus.Created &&
      (election.maxVoters === 0 || election.registeredVoters < election.maxVoters) &&
      (election.startDate === 0 || nowSeconds < election.startDate)
  );
};

export const getUnstartedContractElections = async () => {
  const count = await getElectionCountUpperBound();
  const elections = await Promise.all(Array.from({ length: count }, (_, index) => getElection(index + 1)));
  return elections.filter((election) => election.status === ContractElectionStatus.Created);
};

export const getStartedElections = async () => {
  const count = await getElectionCountUpperBound();
  const elections = await Promise.all(Array.from({ length: count }, (_, index) => getElection(index + 1)));
  return elections.filter((election) => election.status === ContractElectionStatus.Started);
};

export const getMyCreatedElections = async () => {
  const wallet = await getOrCreateDeviceWallet();
  const response = await readContract(buildGetCreatorElectionsCallData(wallet.address));
  const ids = decodeUint256Array(response);
  return Promise.all(ids.map((id) => getElection(id)));
};

export const getMyRegisteredElections = async () => {
  const wallet = await getOrCreateDeviceWallet();
  const response = await readContract(buildGetVoterElectionsCallData(wallet.address));
  const ids = decodeUint256Array(response);
  return Promise.all(ids.map((id) => getElection(id)));
};

export const isUserRegistered = async (electionId: number, userAddress: string) => {
  const response = await readContract(buildIsRegisteredCallData(electionId, userAddress));
  return decodeBool(response);
};

export const getEligibilityTokenBalance = async (electionId: number, userAddress: string) => {
  const tokenId = await getElectionTokenId(electionId);
  const response = await readContract(buildBalanceOfCallData(userAddress, tokenId));
  return decodeNumber(stripHexPrefix(response));
};
