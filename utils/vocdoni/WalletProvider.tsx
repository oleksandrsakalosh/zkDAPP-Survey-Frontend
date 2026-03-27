import { Wallet } from '@ethersproject/wallet';
import React, { createContext, useContext, useEffect, useState } from 'react';

import { createVocdoniClient } from '@/utils/vocdoni/sdk';
import { getOrCreateDeviceWallet } from '@/utils/vocdoni/wallet';

type WalletContextValue = {
  wallet: Wallet | null;
  walletAddress: string | null;
  isLoading: boolean;
  error: Error | null;
};

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadWallet = async () => {
      console.log('[WalletProvider] loadWallet:start');

      try {
        const nextWallet = await getOrCreateDeviceWallet();
        console.log('[WalletProvider] loadWallet:walletResolved', {
          address: nextWallet.address,
        });

        const client = await createVocdoniClient(nextWallet);
        console.log('[WalletProvider] loadWallet:accountInit:start', {
          address: nextWallet.address,
        });
        const accountInfo = await client.createAccount();
        console.log('[WalletProvider] loadWallet:accountInit:success', {
          address: nextWallet.address,
          balance: accountInfo.balance,
        });

        if (!isMounted) {
          console.log('[WalletProvider] loadWallet:abortedAfterResolve');
          return;
        }

        setWallet(nextWallet);
        setWalletAddress(nextWallet.address);
        setError(null);
      } catch (nextError) {
        console.error('[WalletProvider] loadWallet:error', nextError);

        if (!isMounted) {
          console.log('[WalletProvider] loadWallet:abortedAfterError');
          return;
        }

        setError(nextError instanceof Error ? nextError : new Error('Failed to load wallet'));
      } finally {
        if (isMounted) {
          console.log('[WalletProvider] loadWallet:complete');
          setIsLoading(false);
        }
      }
    };

    loadWallet();

    return () => {
      console.log('[WalletProvider] loadWallet:cleanup');
      isMounted = false;
    };
  }, []);

  return (
    <WalletContext.Provider
      value={{
        wallet,
        walletAddress,
        isLoading,
        error,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useDeviceWallet() {
  const context = useContext(WalletContext);

  if (!context) {
    throw new Error('useDeviceWallet must be used within a WalletProvider');
  }

  return context;
}
