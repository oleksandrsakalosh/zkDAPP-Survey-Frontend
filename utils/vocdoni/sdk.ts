import { Wallet } from '@ethersproject/wallet';

import { getOrCreateDeviceWallet } from '@/utils/vocdoni/wallet';

// The SDK is loaded lazily to match the React Native runtime constraints in this app.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const getVocdoniSdk = () => require('@vocdoni/sdk');

export const createVocdoniClient = async (wallet: Wallet) => {
  const { EnvOptions, VocdoniSDKClient } = getVocdoniSdk();
  const apiUrl = process.env.API_URL;

  console.log('[vocdoni-sdk] createClient:start', {
    env: EnvOptions.DEV,
    apiUrl: apiUrl ?? null,
    walletAddress: wallet.address,
  });

  const client = new VocdoniSDKClient({
    env: EnvOptions.DEV,
    api_url: apiUrl,
    wallet,
  });

  console.log('[vocdoni-sdk] createClient:ready', {
    apiUrl: client.url,
    explorerUrl: client.explorerUrl,
  });

  return client;
};

export const getDeviceClient = async () => {
  const wallet = await getOrCreateDeviceWallet();
  const client = await createVocdoniClient(wallet);

  return { wallet, client };
};
