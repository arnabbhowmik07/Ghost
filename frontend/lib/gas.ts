import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { getMint, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { RELAYER_URL, RPC_URL, CLUSTER } from "./config";
import { explorerTx } from "./addresses";

/** How long we keep retrying prepare→sign→submit when Solana blockhash expires. */
export const GAS_SEND_WINDOW_MS = 5 * 60 * 1000;

export type GasConfig = {
  enabled: boolean;
  feePayer: string;
  maxPerHour: number;
  allowedMints: string[] | null;
  creditFeeRaw: string;
  usdcMint: string | null;
  treasury: string | null;
  multiAsset?: boolean;
  creditHaircutBps?: number;
  creditDepositMints?: string[];
};

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}

function isBlockhashError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("blockhash not found") ||
    m.includes("blockhash expired") ||
    m.includes("block height exceeded") ||
    m.includes("transaction has expired")
  );
}

export async function fetchGasConfig(): Promise<GasConfig> {
  const res = await fetch(`${RELAYER_URL}/v1/gas/config`, { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load Ghost Gas config");
  return res.json();
}

export async function fetchMintDecimals(mint: string): Promise<number> {
  const connection = new Connection(RPC_URL, "confirmed");
  const pk = new PublicKey(mint);
  const info = await connection.getAccountInfo(pk);
  if (!info) throw new Error("Mint not found");
  const program =
    info.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
  const m = await getMint(connection, pk, "confirmed", program);
  return m.decimals;
}

async function prepareSponsoredTx(params: {
  from: string;
  to: string;
  mint: string;
  amountRaw: string;
  gasNote: string;
}): Promise<string> {
  const prepRes = await fetch(`${RELAYER_URL}/v1/gas/prepare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      from: params.from,
      to: params.to,
      mint: params.mint,
      amount: params.amountRaw,
      gasNote: params.gasNote,
    }),
  });
  const prepJson = await prepRes.json();
  if (!prepRes.ok) {
    throw new Error(prepJson.error || "Ghost Gas prepare failed");
  }
  return String(prepJson.transaction);
}

async function submitSponsoredTx(params: {
  transactionB64: string;
  gasNote: string;
}): Promise<{ signature: string; explorer: string; creditRemaining: string }> {
  const subRes = await fetch(`${RELAYER_URL}/v1/gas/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transaction: params.transactionB64,
      gasNote: params.gasNote,
    }),
  });
  const subJson = await subRes.json();
  if (!subRes.ok) {
    throw new Error(subJson.error || "Ghost Gas submit failed");
  }
  const signature = String(subJson.signature);
  const creditRemaining = String(subJson.creditRemaining ?? "");
  return {
    signature,
    explorer: subJson.explorer || explorerTx(signature),
    creditRemaining,
  };
}

/**
 * Prepare + sign + submit a Ghost-sponsored SPL transfer.
 * Debits prepaid gas note (X1 credit) and pays SOL as feePayer.
 *
 * Solana blockhashes only last ~60–90s. If the stamp expires (slow wallet
 * approve), we re-prepare and ask for another signature for up to 5 minutes
 * from the first attempt - you cannot extend a single blockhash to 5 minutes.
 */
export async function sponsoredTransfer(params: {
  from: string;
  to: string;
  mint: string;
  amountRaw: string;
  gasNote: string;
  signTransaction: <T extends Transaction>(tx: T) => Promise<T>;
}): Promise<{ signature: string; explorer: string; creditRemaining: string }> {
  const deadline = Date.now() + GAS_SEND_WINDOW_MS;
  let lastError: Error | null = null;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt += 1;
    try {
      const transactionB64 = await prepareSponsoredTx({
        from: params.from,
        to: params.to,
        mint: params.mint,
        amountRaw: params.amountRaw,
        gasNote: params.gasNote,
      });
      const tx = Transaction.from(b64ToBytes(transactionB64));
      const signed = await params.signTransaction(tx);
      const serialized = signed.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });
      return await submitSponsoredTx({
        transactionB64: bytesToB64(serialized),
        gasNote: params.gasNote,
      });
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      lastError = err;
      const remaining = deadline - Date.now();
      if (!isBlockhashError(err.message) || remaining <= 0) {
        throw err;
      }
      // Stamp expired - loop for a fresh prepare + wallet approve within the window.
      if (attempt >= 8) {
        throw new Error(
          `${err.message} (retried ${attempt} times within 5 minutes - try Send again)`,
        );
      }
    }
  }

  throw (
    lastError ??
    new Error("Send window expired after 5 minutes - try Send again")
  );
}

export function toRawAmount(uiAmount: string, decimals: number): string {
  const trimmed = uiAmount.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("Enter a valid amount");
  }
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > decimals) {
    throw new Error(`Max ${decimals} decimal places`);
  }
  const padded = frac.padEnd(decimals, "0");
  const raw = `${whole}${padded}`.replace(/^0+(?=\d)/, "");
  return raw === "" ? "0" : raw;
}

export { CLUSTER };
