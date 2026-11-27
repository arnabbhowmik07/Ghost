"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  useAppKit,
  useAppKitAccount,
  useAppKitProvider,
  useAppKitState,
  useDisconnect,
} from "@reown/appkit/react";
import type { Provider } from "@reown/appkit-adapter-solana/react";
import { ENABLE_DEV_WALLET } from "@/lib/config";
import { trackWalletConnected } from "@/lib/analytics";
import { GhostDevWalletAdapter } from "@/lib/devWallet";
import "@/lib/appkit";

type SignerWallet = {
  publicKey: PublicKey | null;
  signTransaction: <T extends Transaction | VersionedTransaction>(
    tx: T,
  ) => Promise<T>;
  signAllTransactions: <T extends Transaction | VersionedTransaction>(
    txs: T[],
  ) => Promise<T[]>;
};

let sharedDevAdapter: GhostDevWalletAdapter | null = null;

function getDevAdapter(): GhostDevWalletAdapter {
  if (!sharedDevAdapter) sharedDevAdapter = new GhostDevWalletAdapter();
  return sharedDevAdapter;
}

/**
 * Wallet bridge: Reown AppKit (any Solana wallet + WalletConnect QR)
 * plus optional Ghost Dev Wallet for CI / local demos.
 */
export function useGhostWallet() {
  const { open } = useAppKit();
  const { disconnect } = useDisconnect();
  const { address, isConnected, status } = useAppKitAccount({
    namespace: "solana",
  });
  const { walletProvider } = useAppKitProvider<Provider>("solana");
  const { loading } = useAppKitState();

  const [devConnected, setDevConnected] = useState(false);
  const [devConnecting, setDevConnecting] = useState(false);
  const [devPublicKey, setDevPublicKey] = useState<PublicKey | null>(null);

  useEffect(() => {
    if (!ENABLE_DEV_WALLET) return;
    const adapter = getDevAdapter();
    const sync = () => {
      setDevConnected(adapter.connected);
      setDevPublicKey(adapter.publicKey);
    };
    sync();
    adapter.on("connect", sync);
    adapter.on("disconnect", sync);
    return () => {
      adapter.off("connect", sync);
      adapter.off("disconnect", sync);
    };
  }, []);

  const appkitPublicKey = useMemo(() => {
    if (!address) return null;
    try {
      return new PublicKey(address);
    } catch {
      return null;
    }
  }, [address]);

  const usingDev = ENABLE_DEV_WALLET && devConnected && !isConnected;
  const publicKey = usingDev ? devPublicKey : appkitPublicKey;
  const connected = usingDev || Boolean(isConnected && publicKey);
  const connecting =
    loading ||
    status === "connecting" ||
    status === "reconnecting" ||
    devConnecting;

  useEffect(() => {
    if (!connected || !publicKey) return;
    trackWalletConnected(
      publicKey.toBase58(),
      usingDev ? "dev" : "appkit",
    );
  }, [connected, publicKey, usingDev]);

  const connect = useCallback(async () => {
    // Connect UI is login-only - never open AppKit from other routes.
    if (
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/login")
    ) {
      window.location.assign("/login");
      return;
    }
    await open({ view: "Connect", namespace: "solana" });
  }, [open]);

  const connectDevWallet = useCallback(async () => {
    if (!ENABLE_DEV_WALLET) throw new Error("Dev wallet is disabled");
    setDevConnecting(true);
    try {
      const adapter = getDevAdapter();
      if (!adapter.connected) await adapter.connect();
      setDevConnected(true);
      setDevPublicKey(adapter.publicKey);
    } finally {
      setDevConnecting(false);
    }
  }, []);

  const disconnectWallet = useCallback(async () => {
    if (usingDev || devConnected) {
      try {
        await getDevAdapter().disconnect();
      } catch {
        /* ignore */
      }
      setDevConnected(false);
      setDevPublicKey(null);
    }
    if (isConnected) {
      await disconnect({ namespace: "solana" });
    }
  }, [usingDev, devConnected, isConnected, disconnect]);

  const signTransaction = useCallback(
    async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
      if (usingDev) {
        return getDevAdapter().signTransaction(tx);
      }
      if (!walletProvider?.signTransaction) {
        throw new Error("Wallet does not support signTransaction");
      }
      return walletProvider.signTransaction(tx);
    },
    [usingDev, walletProvider],
  );

  const signAllTransactions = useCallback(
    async <T extends Transaction | VersionedTransaction>(
      txs: T[],
    ): Promise<T[]> => {
      if (usingDev) {
        return getDevAdapter().signAllTransactions(txs);
      }
      if (!walletProvider?.signAllTransactions) {
        throw new Error("Wallet does not support signAllTransactions");
      }
      return walletProvider.signAllTransactions(txs);
    },
    [usingDev, walletProvider],
  );

  /** Shape expected by Anchor `AnchorProvider` / `depositUsdc`. */
  const anchorWallet: SignerWallet | null = useMemo(() => {
    if (!publicKey) return null;
    return {
      publicKey,
      signTransaction,
      signAllTransactions,
    };
  }, [publicKey, signTransaction, signAllTransactions]);

  return {
    publicKey,
    connected,
    connecting,
    connect,
    connectDevWallet,
    disconnect: disconnectWallet,
    signTransaction,
    signAllTransactions,
    anchorWallet,
  };
}
