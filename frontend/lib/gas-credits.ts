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
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
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

export type StoredGasNote = {
  note: string;
  commitment: string;
  initialAmount: string;
  depositTx?: string;
  createdAt: string;
  remaining?: string;
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

export function listGasNotes(): StoredGasNote[] {
  return readNotes();
}

export function saveGasNote(note: StoredGasNote) {
  writeNotes([note, ...readNotes().filter((n) => n.note !== note.note)]);
}

export function updateGasNoteRemaining(noteRaw: string, remaining: string) {
  writeNotes(
    readNotes().map((n) => (n.note === noteRaw ? { ...n, remaining } : n)),
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

/** On-chain transfer succeeded but Ghost did not issue a note - refund path. */
export class GasCreditDepositPendingError extends Error {
  readonly depositTx: string;
  readonly fundsTransferred = true as const;

  constructor(cause: string, depositTx: string) {
    super(
      `${cause} Your deposit was sent on-chain. If Ghost received the funds, they will be refunded within 48 hours - or reach support at support@ghostlabshq.xyz.`,
    );
    this.name = "GasCreditDepositPendingError";
    this.depositTx = depositTx;
  }
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
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  const signed = await params.signTransaction(tx);

  /** Set once the transfer is broadcast - any later failure may leave funds with Ghost. */
  let depositTx: string | undefined;
  try {
    depositTx = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction(depositTx, "confirmed");

    const reg = await fetch(`${RELAYER_URL}/v1/gas/credits/deposit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commitment: gasNote.commitment,
        amount: amountRaw,
        txSignature: depositTx,
        mint: isSol ? NATIVE_SOL : mintKey,
      }),
    });
    const regJson = await reg.json();
    if (!reg.ok) {
      throw new Error(regJson.error || "Credit registration failed");
    }

    const creditRaw = String(regJson.credit?.remaining ?? quote.creditRaw);
    const stored: StoredGasNote = {
      note: gasNote.raw,
      commitment: gasNote.commitment,
      initialAmount: creditRaw,
      depositTx,
      createdAt: new Date().toISOString(),
      remaining: creditRaw,
    };
    saveGasNote(stored);
    return stored;
  } catch (e: unknown) {
    if (depositTx) {
      if (e instanceof GasCreditDepositPendingError) throw e;
      throw new GasCreditDepositPendingError(
        e instanceof Error ? e.message : String(e),
        depositTx,
      );
    }
    throw e;
  }
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
