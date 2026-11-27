"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppKit, useAppKitState } from "@reown/appkit/react";
import { useGhostWallet } from "@/hooks/useGhostWallet";
import { ENABLE_DEV_WALLET } from "@/lib/config";
import "@/lib/appkit";

export function WalletGuard({ children }: { children: React.ReactNode }) {
  const { connected } = useGhostWallet();
  const { close } = useAppKit();
  const { open: modalOpen } = useAppKitState();
  const router = useRouter();
  const [waited, setWaited] = useState(false);

  useEffect(() => {
    const ms = ENABLE_DEV_WALLET ? 1600 : 400;
    const t = window.setTimeout(() => setWaited(true), ms);
    return () => window.clearTimeout(t);
  }, []);

  // Never show the Connect modal on /app - send users to /login instead.
  useEffect(() => {
    if (modalOpen) void close();
  }, [modalOpen, close]);

  useEffect(() => {
    if (!waited) return;
    if (!connected) router.replace("/login");
  }, [waited, connected, router]);

  if (!connected) {
    return (
      <div className="landing-root flex min-h-screen items-center justify-center bg-cream text-ink">
        <p className="t-16 text-ink/55">
          {!waited ? "Checking wallet…" : "Redirecting to login…"}
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
