export const IPFS_API_KEY =
  process.env.EXPO_PUBLIC_LIGHTHOUSE_API_KEY?.trim() || "";

export const IPFS_GATEWAY_URL =
  process.env.EXPO_PUBLIC_IPFS_GATEWAY_URL?.trim() ||
  "https://conservative-lungfish-gj815.lighthouseweb3.xyz/ipfs";
