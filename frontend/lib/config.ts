import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID as DEFAULT_PROGRAM_ID } from "@ghost/sdk";

/** Circle USDC on Solana mainnet-beta. */
export const MAINNET_USDC_MINT =
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

/** Mainnet Ghost Gas fee-payer (pubkey only). */
export const MAINNET_RELAYER_PUBKEY =
  "D2nKfrsQJ5pR4MHTaWv2h3ttUj9AfDmbvhQLLHXM6jkr";

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";
export const RELAYER_URL =
  process.env.NEXT_PUBLIC_RELAYER_URL || "http://localhost:3001";
export const CLUSTER = process.env.NEXT_PUBLIC_CLUSTER || "devnet";

export function isMainnetCluster(cluster = CLUSTER): boolean {
  return cluster === "mainnet-beta" || cluster === "mainnet";
}

/** Never enable the injected dev wallet on a mainnet build, even if the env is set. */
export const ENABLE_DEV_WALLET =
  process.env.NEXT_PUBLIC_ENABLE_DEV_WALLET === "true" && !isMainnetCluster();

export const USDC_MINT_STR = process.env.NEXT_PUBLIC_USDC_MINT || "";
export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || DEFAULT_PROGRAM_ID,
);

/**
 * Ghost Shield (deposit/withdraw/notes). Off by default on mainnet until the
 * pool program is deployed and audited for production use.
 * Set NEXT_PUBLIC_SHIELD_ENABLED=true to force on; =false to force off.
 */
export const SHIELD_ENABLED = (() => {
  const raw = process.env.NEXT_PUBLIC_SHIELD_ENABLED;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return !isMainnetCluster();
})();

export function getUsdcMint(): PublicKey {
  const mint =
    process.env.NEXT_PUBLIC_USDC_MINT ||
    (isMainnetCluster() ? MAINNET_USDC_MINT : "");
  if (!mint) throw new Error("Set NEXT_PUBLIC_USDC_MINT in frontend/.env.local");
  return new PublicKey(mint);
}
