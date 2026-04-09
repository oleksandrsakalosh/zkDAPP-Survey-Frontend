declare module "@ethersproject/bytes" {
  export function hexlify(value: unknown): string;
}

declare module "@ethersproject/keccak256" {
  export function keccak256(value: unknown): string;
}

declare module "@ethersproject/providers" {
  export class JsonRpcProvider {
    constructor(url?: string);
    call(transaction: { to: string; data: string }): Promise<string>;
  }
}

declare module "@ethersproject/strings" {
  export function toUtf8Bytes(value: string): Uint8Array;
  export function toUtf8String(value: string): string;
}

declare module "@ethersproject/wallet" {
  export class Wallet {
    address: string;
    privateKey: string;
    provider?: unknown;
    constructor(privateKey: string);
    static createRandom(): Wallet;
    connect(provider: unknown): Wallet;
    sendTransaction(transaction: { to: string; data: string }): Promise<{
      hash: string;
      wait(): Promise<{ blockNumber?: number } | null>;
    }>;
  }
}

declare module "expo-secure-store" {
  export function getItemAsync(key: string): Promise<string | null>;
  export function setItemAsync(key: string, value: string): Promise<void>;
}

declare module "@react-native-community/slider";

declare module "poseidon-lite";
