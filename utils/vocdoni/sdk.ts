import { Wallet } from '@ethersproject/wallet';

import { getOrCreateDeviceWallet, replaceDeviceWallet } from '@/utils/vocdoni/wallet';

// The SDK is loaded lazily to match the React Native runtime constraints in this app.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const getVocdoniSdk = () => require('@vocdoni/sdk');

const isDevFaucetCooldownError = (error: unknown): error is Error =>
  error instanceof Error &&
  error.message.includes('already funded') &&
  error.message.includes('wait until');

const formatFaucetCooldownMessage = (error: Error) => {
  const waitUntilMatch = error.message.match(/wait until ([0-9:-]+ [0-9:]+) \+0000 UTC/i);

  if (!waitUntilMatch) {
    return error.message;
  }

  const waitUntilUtc = `${waitUntilMatch[1]} UTC`;
  const waitUntilLocal = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZoneName: 'short',
  }).format(new Date(waitUntilUtc));

  return `Vocdoni DEV faucet blocked the current test wallet because it was already funded. Cooldown ends at ${waitUntilMatch[1]} UTC (${waitUntilLocal}).`;
};

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

export const ensureVocdoniAccount = async (wallet: Wallet) => {
  const client = await createVocdoniClient(wallet);

  try {
    const accountInfo = await client.fetchAccount();

    console.log('[vocdoni-sdk] ensureAccount:existing', {
      address: wallet.address,
      balance: accountInfo.balance,
    });

    return { client, accountInfo, created: false, wallet, rotatedWallet: false };
  } catch (fetchError) {
    console.log('[vocdoni-sdk] ensureAccount:creatingWithoutSik', {
      address: wallet.address,
      reason: fetchError instanceof Error ? fetchError.message : 'unknown',
    });
  }

  try {
    const accountInfo = await client.createAccount({ sik: false });

    console.log('[vocdoni-sdk] ensureAccount:created', {
      address: wallet.address,
      balance: accountInfo.balance,
    });

    return { client, accountInfo, created: true, wallet, rotatedWallet: false };
  } catch (createError) {
    if (!isDevFaucetCooldownError(createError)) {
      throw createError;
    }

    console.log('[vocdoni-sdk] ensureAccount:faucetCooldownDetected', {
      address: wallet.address,
      message: createError.message,
    });

    const rotatedWallet = await replaceDeviceWallet();
    const rotatedClient = await createVocdoniClient(rotatedWallet);
    const accountInfo = await rotatedClient.createAccount({ sik: false });

    console.log('[vocdoni-sdk] ensureAccount:createdWithRotatedWallet', {
      previousAddress: wallet.address,
      address: rotatedWallet.address,
      balance: accountInfo.balance,
    });

    return {
      client: rotatedClient,
      accountInfo,
      created: true,
      wallet: rotatedWallet,
      rotatedWallet: true,
      warning: formatFaucetCooldownMessage(createError),
    };
  }
};

export const getDeviceClient = async () => {
  const wallet = await getOrCreateDeviceWallet();
  const client = await createVocdoniClient(wallet);

  return { wallet, client };
};
