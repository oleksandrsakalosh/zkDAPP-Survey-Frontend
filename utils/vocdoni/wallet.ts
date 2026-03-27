import 'react-native-get-random-values';
import { Wallet } from '@ethersproject/wallet';
import * as SecureStore from 'expo-secure-store';

const DEVICE_WALLET_PRIVATE_KEY_STORAGE_KEY = 'vocdoni.deviceWallet.privateKey';

const canUseBrowserStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const readStoredPrivateKey = async (): Promise<string | null> => {
  const useBrowserStorage = canUseBrowserStorage();
  console.log('[device-wallet] readStoredPrivateKey:start', {
    storage: useBrowserStorage ? 'localStorage' : 'SecureStore',
  });

  if (canUseBrowserStorage()) {
    const storedPrivateKey = window.localStorage.getItem(DEVICE_WALLET_PRIVATE_KEY_STORAGE_KEY);
    console.log('[device-wallet] readStoredPrivateKey:success', {
      storage: 'localStorage',
      found: Boolean(storedPrivateKey),
    });
    return storedPrivateKey;
  }

  const storedPrivateKey = await SecureStore.getItemAsync(DEVICE_WALLET_PRIVATE_KEY_STORAGE_KEY);
  console.log('[device-wallet] readStoredPrivateKey:success', {
    storage: 'SecureStore',
    found: Boolean(storedPrivateKey),
  });
  return storedPrivateKey;
};

const persistPrivateKey = async (privateKey: string): Promise<void> => {
  const useBrowserStorage = canUseBrowserStorage();
  console.log('[device-wallet] persistPrivateKey:start', {
    storage: useBrowserStorage ? 'localStorage' : 'SecureStore',
    hasPrivateKey: Boolean(privateKey),
  });

  if (canUseBrowserStorage()) {
    window.localStorage.setItem(DEVICE_WALLET_PRIVATE_KEY_STORAGE_KEY, privateKey);
    console.log('[device-wallet] persistPrivateKey:success', {
      storage: 'localStorage',
    });
    return;
  }

  await SecureStore.setItemAsync(DEVICE_WALLET_PRIVATE_KEY_STORAGE_KEY, privateKey);
  console.log('[device-wallet] persistPrivateKey:success', {
    storage: 'SecureStore',
  });
};

export const getOrCreateDeviceWallet = async (): Promise<Wallet> => {
  console.log('[device-wallet] getOrCreateDeviceWallet:start');

  try {
    const storedPrivateKey = await readStoredPrivateKey();

    if (storedPrivateKey) {
      console.log('[device-wallet] getOrCreateDeviceWallet:usingStoredKey');
      const wallet = new Wallet(storedPrivateKey);
      console.log('[device-wallet] getOrCreateDeviceWallet:success', {
        address: wallet.address,
        source: 'stored',
      });
      return wallet;
    }

    console.log('[device-wallet] getOrCreateDeviceWallet:creatingNewWallet');
    const wallet = Wallet.createRandom();
    console.log('[device-wallet] getOrCreateDeviceWallet:newWalletCreated', {
      address: wallet.address,
    });
    await persistPrivateKey(wallet.privateKey);
    console.log('[device-wallet] getOrCreateDeviceWallet:success', {
      address: wallet.address,
      source: 'created',
    });
    return wallet;
  } catch (error) {
    console.error('[device-wallet] getOrCreateDeviceWallet:error', error);
    throw error;
  }
};

export const formatWalletAddress = (address: string) =>
  `${address.slice(0, 6)}...${address.slice(-4)}`;
