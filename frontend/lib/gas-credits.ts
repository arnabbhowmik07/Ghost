import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  getMint,
} from "@solana/spl-token";
import {
  Connection,
  PublicKey,
  SendTransactionError,
  SystemProgram,
  Transaction,
  TransactionExpiredBlockheightExceededError,
  TransactionInstruction,
} from "@solana/web3.js";
import { utils } from "@coral-xyz/anchor";
import { createGasNote } from "@ghost/sdk";
import { CLUSTER, RELAYER_URL, RPC_URL } from "./config";
import { fetchGasConfig, toRawAmount } from "./gas";

/** Scope notes by cluster so mainnet never mixes with mock-USDC notes. */
const GAS_NOTES_KEY = `ghost.gasNotes.v1.${CLUSTER}`;

export const NATIVE_SOL = "native";
const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

function memoIx(signer: PublicKey, memo: string): TransactionInstruction {
  return new TransactionInstruction({
    keys: [{ pubkey: signer, isSigner: true, isWritable: true }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memo, "utf8"),
  });
}

/**
 * Top-up lifecycle, persisted so the note secret survives any failure:
 *
 *   pending ──sign──► sent ──register──► active
 *      │               │
 *      └─ wallet       └─ never landed / failed on-chain ─► removed
 *         rejected ─► removed
 *
 * - pending: note created, tx not signed yet. Nothing can have moved.
 * - sent:    tx signed; its signature is recorded BEFORE broadcast, so funds
 *            may be on-chain. Registration can be retried from this state.
 * - active:  relayer issued the credit; usable on Send.
 */
export type GasNoteStatus = "pending" | "sent" | "active";

export type StoredGasNote = {
  note: string;
  commitment: string;
  initialAmount: string;
  depositTx?: string;
  createdAt: string;
  remaining?: string;
  /** Missing on notes saved before statuses existed; those are active. */
  status?: GasNoteStatus;
  /** Deposit asset ("native" for SOL) and raw amount, needed to re-register. */
  depositMint?: string;
  depositAmount?: string;
  /** Last registration error, shown next to a note that needs a retry. */
  lastError?: string;
};

export type CreditQuote = {
  depositMint: string;
  depositAmount: string;
  creditRaw: string;
  creditUi: string;
  usdcOutRaw: string;
  haircutBps: number;
  routeLabel: string;
  feePerTxRaw: string;
};

function readNotes(): StoredGasNote[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GAS_NOTES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredGasNote[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeNotes(notes: StoredGasNote[]) {
  window.localStorage.setItem(GAS_NOTES_KEY, JSON.stringify(notes));
}

function isRegistered(n: StoredGasNote): boolean {
  return (n.status ?? "active") === "active";
}

/** Notes the relayer has credited (safe to spend on Send). */
export function listGasNotes(): StoredGasNote[] {
  return readNotes().filter(isRegistered);
}

/** Notes whose deposit may be on-chain but has no credit yet. */
export function listUnregisteredGasNotes(): StoredGasNote[] {
  return readNotes().filter((n) => !isRegistered(n));
}

export function saveGasNote(note: StoredGasNote) {
  writeNotes([note, ...readNotes().filter((n) => n.note !== note.note)]);
}

function patchGasNote(noteRaw: string, patch: Partial<StoredGasNote>) {
  writeNotes(
    readNotes().map((n) => (n.note === noteRaw ? { ...n, ...patch } : n)),
  );
}

function removeGasNote(noteRaw: string) {
  writeNotes(readNotes().filter((n) => n.note !== noteRaw));
}

export function updateGasNoteRemaining(noteRaw: string, remaining: string) {
  patchGasNote(noteRaw, { remaining });
}

/**
 * A "pending" note never reached broadcast (the signature is recorded before
 * sending), so once it is older than any blockhash it can be dropped safely.
 */
const ABANDONED_PENDING_MS = 10 * 60 * 1000;

export function pruneAbandonedGasNotes() {
  if (typeof window === "undefined") return;
  const now = Date.now();
  writeNotes(
    readNotes().filter(
      (n) =>
        n.status !== "pending" ||
        now - Date.parse(n.createdAt) < ABANDONED_PENDING_MS,
    ),
  );
}

export async function quoteGasCredit(params: {
  mint: string;
  amountRaw: string;
}): Promise<CreditQuote> {
  const res = await fetch(`${RELAYER_URL}/v1/gas/credits/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mint: params.mint, amount: params.amountRaw }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Quote failed");
  return json as CreditQuote;
}

/**
 * The deposit may be on-chain but Ghost has not issued the credit yet.
 * The note is saved on this device in the "sent" state and can be retried.
 */
export class GasCreditDepositPendingError extends Error {
  readonly depositTx: string;
  readonly fundsTransferred = true as const;

  constructor(cause: string, depositTx: string) {
    super(
      `${cause} Your deposit may already be on-chain. The gas note is saved in this browser - retry registration from Credits, or reach support at support@ghostlabshq.xyz with the transaction.`,
    );
    this.name = "GasCreditDepositPendingError";
    this.depositTx = depositTx;
  }
}

type DepositChainState = "landed" | "failed" | "missing";

/** Ask the cluster directly whether a deposit signature exists. */
async function depositChainState(
  connection: Connection,
  signature: string,
): Promise<DepositChainState> {
  const { value } = await connection.getSignatureStatus(signature, {
    searchTransactionHistory: true,
  });
  if (!value) return "missing";
  return value.err ? "failed" : "landed";
}

const REGISTER_ATTEMPTS = 6;
const REGISTER_BACKOFF_MS = 1_500;
const REGISTER_BACKOFF_MAX_MS = 8_000;

type RegisterResult =
  | { ok: true; initialAmount: string; remaining: string }
  | { ok: false; retryable: boolean; error: string };

async function registerOnce(n: StoredGasNote): Promise<RegisterResult> {
  let res: Response;
  try {
    res = await fetch(`${RELAYER_URL}/v1/gas/credits/deposit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commitment: n.commitment,
        amount: n.depositAmount,
        txSignature: n.depositTx,
        mint: n.depositMint,
      }),
    });
  } catch (e: unknown) {
    // Network failure: the relayer may be briefly unreachable.
    return {
      ok: false,
      retryable: true,
      error: e instanceof Error ? e.message : String(e),
    };
  }
  const json = await res.json().catch(() => ({}));
  if (res.ok) {
    const remaining = String(json.credit?.remaining ?? n.initialAmount);
    return {
      ok: true,
      initialAmount: String(json.credit?.initialAmount ?? remaining),
      remaining,
    };
  }
  return {
    ok: false,
    // Older relayers do not send `retryable`; treat non-400s as transient.
    retryable: json.retryable ?? res.status !== 400,
    error: json.error || `Credit registration failed (${res.status})`,
  };
}

/** Register a "sent" note with backoff; marks it active on success. */
async function registerWithRetry(n: StoredGasNote): Promise<StoredGasNote> {
  let last: RegisterResult | null = null;
  for (let attempt = 0; attempt < REGISTER_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const wait = Math.min(
        REGISTER_BACKOFF_MS * 2 ** (attempt - 1),
        REGISTER_BACKOFF_MAX_MS,
      );
      await new Promise((r) => setTimeout(r, wait));
    }
    last = await registerOnce(n);
    if (last.ok) {
      const active: StoredGasNote = {
        ...n,
        status: "active",
        initialAmount: last.initialAmount,
        remaining: last.remaining,
        lastError: undefined,
      };
      saveGasNote(active);
      return active;
    }
    if (!last.retryable) break;
  }
  const error = last && !last.ok ? last.error : "Credit registration failed";
  patchGasNote(n.note, { lastError: error });
  throw new GasCreditDepositPendingError(error, n.depositTx ?? "");
}

/**
 * Retry registration for a note stuck in "sent" (e.g. after a relayer outage
 * or a closed tab). Drops the note only when the cluster shows the deposit
 * never landed or failed, i.e. no funds left the wallet.
 */
export async function retryGasNoteRegistration(
  noteRaw: string,
): Promise<StoredGasNote | null> {
  const n = readNotes().find((x) => x.note === noteRaw);
  if (!n) throw new Error("Gas note not found in this browser");
  if (isRegistered(n)) return n;
  if (n.status !== "sent" || !n.depositTx || !n.depositAmount || !n.depositMint) {
    removeGasNote(noteRaw);
    return null;
  }
  const connection = new Connection(RPC_URL, "confirmed");
  const state = await depositChainState(connection, n.depositTx);
  const stale = Date.now() - Date.parse(n.createdAt) > ABANDONED_PENDING_MS;
  if (state === "failed" || (state === "missing" && stale)) {
    removeGasNote(noteRaw);
    return null;
  }
  return registerWithRetry(n);
}

/**
 * X1 tops up prepaid gas with USDC, SOL, or any liquid SPL.
 * Credit is priced to USD via Jupiter liquidity on the relayer.
 */
export async function topUpGasCredits(params: {
  uiAmount: string;
  mint: string;
  decimals: number;
  tokenProgramId?: string;
  publicKey: PublicKey;
  signTransaction: <T extends Transaction>(tx: T) => Promise<T>;
}): Promise<StoredGasNote> {
  const gas = await fetchGasConfig();
  if (!gas.enabled) throw new Error("Ghost Gas is disabled");
  if (!gas.feePayer) throw new Error("Relayer fee payer missing");

  const mintKey = params.mint.trim() || NATIVE_SOL;
  const isSol = mintKey === NATIVE_SOL || mintKey.toLowerCase() === "sol";
  const amountRaw = toRawAmount(params.uiAmount, params.decimals);
  if (amountRaw === "0") throw new Error("Amount must be greater than zero");

  const quote = await quoteGasCredit({
    mint: isSol ? NATIVE_SOL : mintKey,
    amountRaw,
  });

  const gasNote = await createGasNote(quote.creditRaw);
  const connection = new Connection(RPC_URL, "confirmed");
  const feePayer = new PublicKey(gas.feePayer);
  // Memo binds this deposit to the commitment so others cannot front-run claim.
  const ixs = [memoIx(params.publicKey, gasNote.commitment)];

  if (isSol) {
    ixs.push(
      SystemProgram.transfer({
        fromPubkey: params.publicKey,
        toPubkey: feePayer,
        lamports: BigInt(amountRaw),
      }),
    );
  } else {
    const mint = new PublicKey(mintKey);
    const tokenProgram = params.tokenProgramId
      ? new PublicKey(params.tokenProgramId)
      : TOKEN_PROGRAM_ID;
    const mintAccount = await getMint(
      connection,
      mint,
      "confirmed",
      tokenProgram,
    );
    const fromAta = getAssociatedTokenAddressSync(
      mint,
      params.publicKey,
      false,
      tokenProgram,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    const treasuryAta = getAssociatedTokenAddressSync(
      mint,
      feePayer,
      false,
      tokenProgram,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    const treasuryInfo = await connection.getAccountInfo(treasuryAta);
    if (!treasuryInfo) {
      ixs.push(
        createAssociatedTokenAccountIdempotentInstruction(
          params.publicKey,
          treasuryAta,
          feePayer,
          mint,
          tokenProgram,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      );
    }
    ixs.push(
      createTransferCheckedInstruction(
        fromAta,
        mint,
        treasuryAta,
        params.publicKey,
        BigInt(amountRaw),
        mintAccount.decimals,
        [],
        tokenProgram,
      ),
    );
  }

  const tx = new Transaction().add(...ixs);
  tx.feePayer = params.publicKey;
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;

  // Persist the secret before anything can move funds.
  const pending: StoredGasNote = {
    note: gasNote.raw,
    commitment: gasNote.commitment,
    initialAmount: quote.creditRaw,
    createdAt: new Date().toISOString(),
    status: "pending",
    depositMint: isSol ? NATIVE_SOL : mintKey,
    depositAmount: amountRaw,
  };
  saveGasNote(pending);

  let signed: Transaction;
  try {
    signed = await params.signTransaction(tx);
  } catch (e) {
    removeGasNote(pending.note); // wallet rejected: nothing was signed
    throw e;
  }
  if (!signed.signature) {
    removeGasNote(pending.note);
    throw new Error("Wallet returned an unsigned transaction");
  }

  // The fee-payer signature is the tx id: record it BEFORE broadcast so a
  // crash or lost response can never orphan funds without a retry handle.
  const depositTx = utils.bytes.bs58.encode(signed.signature);
  const sent: StoredGasNote = { ...pending, status: "sent", depositTx };
  saveGasNote(sent);

  try {
    await connection.sendRawTransaction(signed.serialize());
  } catch (e: unknown) {
    if (e instanceof SendTransactionError) {
      // The RPC rejected it (preflight / blockhash): it was never forwarded.
      removeGasNote(pending.note);
      throw e;
    }
    // Network error: the tx may or may not have been broadcast. Fall through;
    // confirmation below resolves it to landed or expired.
  }

  let state: DepositChainState | "unknown" = "unknown";
  try {
    const conf = await connection.confirmTransaction(
      { signature: depositTx, blockhash, lastValidBlockHeight },
      "confirmed",
    );
    state = conf.value.err ? "failed" : "landed";
  } catch (e: unknown) {
    if (e instanceof TransactionExpiredBlockheightExceededError) {
      // web3.js does not re-check status on expiry; ask once more.
      state = await depositChainState(connection, depositTx).catch(
        () => "unknown" as const,
      );
    }
    // Otherwise (timeout / socket drop): unknown, let registration decide.
  }

  if (state === "failed") {
    removeGasNote(pending.note);
    throw new Error(`Deposit ${depositTx} failed on-chain; no credit was purchased.`);
  }
  if (state === "missing") {
    removeGasNote(pending.note);
    throw new Error("Deposit expired before it landed; nothing was sent. Try again.");
  }

  return registerWithRetry(sent);
}

export async function fetchGasNoteBalance(gasNote: string): Promise<{
  remaining: string;
  feePerTx: string;
}> {
  const res = await fetch(`${RELAYER_URL}/v1/gas/credits/balance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gasNote }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Balance check failed");
  return { remaining: json.remaining, feePerTx: json.feePerTx };
}
