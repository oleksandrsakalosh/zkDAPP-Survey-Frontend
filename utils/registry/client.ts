import "react-native-get-random-values";

import { hexlify } from "@ethersproject/bytes";
import { keccak256 } from "@ethersproject/keccak256";
import { JsonRpcProvider } from "@ethersproject/providers";
import { toUtf8Bytes, toUtf8String } from "@ethersproject/strings";
import { Wallet } from "@ethersproject/wallet";

import { getOrCreateDeviceWallet } from "@/utils/vocdoni/wallet";

export const REGISTRY_CONTRACT_ADDRESS = "0x30111f3D2715B2513DeB8e235542870cF2Be5301";

export type RegistrySurveyRecord = {
  index: number;
  electionId: string;
  creator: string;
  category: string;
  createdAt: number;
};

const REGISTRY_RPC_URL = process.env.EXPO_PUBLIC_REGISTRY_RPC_URL?.trim() || "https://ethereum-sepolia-rpc.publicnode.com";

let sharedProvider: JsonRpcProvider | null = null;

const stripHexPrefix = (value: string) => value.replace(/^0x/i, "");

const padWord = (hexValue: string) => stripHexPrefix(hexValue).padStart(64, "0");

const padDynamicHex = (hexValue: string) => {
  const normalized = stripHexPrefix(hexValue);
  const remainder = normalized.length % 64;
  return remainder === 0 ? normalized : normalized.padEnd(normalized.length + (64 - remainder), "0");
};

const encodeUint256 = (value: bigint | number) => padWord(BigInt(value).toString(16));

const encodeAddress = (address: string) => padWord(stripHexPrefix(address).toLowerCase());

const encodeString = (value: string) => {
  const encoded = stripHexPrefix(hexlify(toUtf8Bytes(value)));
  return `${encodeUint256(encoded.length / 2)}${padDynamicHex(encoded)}`;
};

const getSelector = (signature: string) => keccak256(toUtf8Bytes(signature)).slice(0, 10);

const buildRegisterSurveyCallData = (electionId: string, category: string) => {
  const firstTail = encodeString(electionId);
  const secondTail = encodeString(category);
  const secondOffsetBytes = 64 + firstTail.length / 2;

  return `0x${stripHexPrefix(getSelector("registerSurvey(string,string)"))}${encodeUint256(64)}${encodeUint256(
    secondOffsetBytes
  )}${firstTail}${secondTail}`;
};

const buildGetSurveyCallData = (index: number) =>
  `0x${stripHexPrefix(getSelector("getSurvey(uint256)"))}${encodeUint256(index)}`;

const buildGetSurveyCountCallData = () => getSelector("getSurveyCount()");

const buildGetSurveysByCreatorCallData = (creatorAddress: string) =>
  `0x${stripHexPrefix(getSelector("getSurveysByCreator(address)"))}${encodeAddress(creatorAddress)}`;

const readWord = (payload: string, index: number) => payload.slice(index * 64, index * 64 + 64);

const decodeUint256 = (hexWord: string) => BigInt(`0x${stripHexPrefix(hexWord || "0")}`);

const decodeStringAt = (payload: string, offsetBytes: bigint) => {
  const startIndex = Number(offsetBytes / 32n);
  const byteLength = Number(decodeUint256(readWord(payload, startIndex)));
  const dataStart = Number(offsetBytes + 32n) * 2;
  const dataEnd = dataStart + byteLength * 2;
  const rawHex = payload.slice(dataStart, dataEnd);

  if (!rawHex) {
    return "";
  }

  return toUtf8String(`0x${rawHex}`);
};

const decodeSurveyRecord = (result: string, index: number): RegistrySurveyRecord => {
  const payload = stripHexPrefix(result);
  const electionOffset = decodeUint256(readWord(payload, 0));
  const creatorWord = readWord(payload, 1);
  const categoryOffset = decodeUint256(readWord(payload, 2));
  const createdAt = Number(decodeUint256(readWord(payload, 3)));

  return {
    index,
    electionId: decodeStringAt(payload, electionOffset),
    creator: `0x${creatorWord.slice(24)}`,
    category: decodeStringAt(payload, categoryOffset),
    createdAt,
  };
};

const decodeUint256Array = (result: string) => {
  const payload = stripHexPrefix(result);
  const offset = Number(decodeUint256(readWord(payload, 0)) / 32n);
  const length = Number(decodeUint256(readWord(payload, offset)));

  return Array.from({ length }, (_, index) =>
    Number(decodeUint256(readWord(payload, offset + 1 + index)))
  );
};

const ensureRpcUrl = () => {
  if (!REGISTRY_RPC_URL) {
    throw new Error(
      "Missing EXPO_PUBLIC_REGISTRY_RPC_URL. Set it to your Sepolia RPC endpoint before using the survey registry."
    );
  }

  return REGISTRY_RPC_URL;
};

const isInsufficientFundsError = (error: unknown) =>
  error instanceof Error &&
  (error.message.toLowerCase().includes("insufficient funds") ||
    error.message.toLowerCase().includes("insufficient funds for transfer"));

const formatRegistryError = (error: unknown, address: string) => {
  if (isInsufficientFundsError(error)) {
    return new Error(
      `Registry registration needs Sepolia ETH for gas. Fund wallet ${address} on Sepolia and retry.`
    );
  }

  return error instanceof Error ? error : new Error("Registry registration failed.");
};

export const isRegistryConfigured = () => Boolean(REGISTRY_RPC_URL);

export const getRegistryProvider = () => {
  if (!sharedProvider) {
    sharedProvider = new JsonRpcProvider(ensureRpcUrl());
  }

  return sharedProvider;
};

export const getRegistryWallet = async (wallet?: Wallet) => {
  const baseWallet = wallet ?? (await getOrCreateDeviceWallet());
  return baseWallet.connect(getRegistryProvider());
};

export const getSurveyCount = async () => {
  const response = await getRegistryProvider().call({
    to: REGISTRY_CONTRACT_ADDRESS,
    data: buildGetSurveyCountCallData(),
  });

  return Number(decodeUint256(response));
};

export const getSurvey = async (index: number) => {
  const response = await getRegistryProvider().call({
    to: REGISTRY_CONTRACT_ADDRESS,
    data: buildGetSurveyCallData(index),
  });

  return decodeSurveyRecord(response, index);
};

export const listRegisteredSurveys = async () => {
  const count = await getSurveyCount();

  if (count === 0) {
    return [];
  }

  const surveys = await Promise.all(
    Array.from({ length: count }, (_, index) => getSurvey(index))
  );

  return surveys.sort((left, right) => right.createdAt - left.createdAt);
};

export const getSurveysByCreator = async (creatorAddress: string) => {
  const response = await getRegistryProvider().call({
    to: REGISTRY_CONTRACT_ADDRESS,
    data: buildGetSurveysByCreatorCallData(creatorAddress),
  });

  const indexes = decodeUint256Array(response);
  return Promise.all(indexes.map((index) => getSurvey(index)));
};

export const registerSurveyInRegistry = async ({
  electionId,
  category,
  wallet,
}: {
  electionId: string;
  category: string;
  wallet?: Wallet;
}) => {
  const signer = await getRegistryWallet(wallet);
  try {
    const transaction = await signer.sendTransaction({
      to: REGISTRY_CONTRACT_ADDRESS,
      data: buildRegisterSurveyCallData(electionId, category),
    });

    const receipt = await transaction.wait();

    return {
      txHash: transaction.hash,
      blockNumber: receipt?.blockNumber ?? null,
    };
  } catch (error) {
    throw formatRegistryError(error, signer.address);
  }
};
