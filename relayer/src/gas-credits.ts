import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileAtomic } from "./atomic-write.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  assertGasNoteIntegrity,
  decodeGasNote,
  type GasNote,
} from "@ghost/sdk";
import { loadConfig } from "./config.js";
import {
  MAINNET_USDC_MINT,
  MAINNET_USDT_MINT,
  applyHaircut,
  isNativeMint,
  quoteDepositToUsdc,
} from "./prices.js";
import { getConnection, loadRelayerKeypair } from "./solana.js";

export const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

/**
 * Reject deposits older than this (seconds).
 *
 * The Memo commitment binding already stops anyone but the note holder from
 * claiming a deposit, so this window only has to bound how stale a price can
 * be when a deposit is registered late (client crash, relayer outage, RPC lag).
 * 15 minutes was short enough to strand funds whenever registration failed.
 */
export const MAX_DEPOSIT_AGE_SEC = 24 * 60 * 60;

export type GasCredit = {
  commitment: string;
  /** Remaining / initial always in USDC micro-units (6 decimals). */
  initialAmount: string;
  remaining: string;
  depositTx: string;
  /** Asset deposited: mint base58, or "native" for SOL. */
  depositMint?: string;
  /** Raw amount of depositMint that was verified on-chain. */
  depositAmount?: string;
  createdAt: string;
  updatedAt: string;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
let persistDir: string | null = null;
let credits: GasCredit[] = [];

/** In-flight deposit sigs — closes the TOCTOU window before save. */
const pendingDepositSigs = new Map<string, number>();
const PENDING_TTL_MS = 120_000;

/** Serialize mutations per commitment (debit / reserve). */
const commitmentChains = new Map<string, Promise<unknown>>();

export function configureGasCredits(dataDir?: string) {
  persistDir =
    dataDir && dataDir.length > 0 ? dataDir : join(__dirname, "..", "data");
  loadCredits();
}

function creditsFile(): string {
  return join(persistDir || join(__dirname, "..", "data"), "gas-credits.json");
}

function loadCredits() {
  const file = creditsFile();
  if (!existsSync(file)) {
    credits = [];
    return;
  }
  credits = JSON.parse(readFileSync(file, "utf8")) as GasCredit[];
}

function saveCredits() {
  writeFileAtomic(creditsFile(), JSON.stringify(credits, null, 2));
}

function normCommitment(c: string): string {
  return (c.startsWith("0x") ? c.slice(2) : c).toLowerCase();
}

function accountKeyStr(
  accountKeys: unknown[],
  index: number,
): string | null {
  const key = accountKeys[index];
  if (typeof key === "string") return key;
  if (key && typeof key === "object" && "pubkey" in key) {
    const pk = (key as { pubkey: PublicKey | string }).pubkey;
    return typeof pk === "string" ? pk : pk.toBase58();
  }
  return null;
}

async function withCommitmentLock<T>(
  commitment: string,
  fn: () => Promise<T>,
): Promise<T> {
  const key = normCommitment(commitment);
  const prev = commitmentChains.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const tail = prev.then(() => gate);
  commitmentChains.set(
    key,
    tail.catch(() => undefined),
  );
  await prev.catch(() => undefined);
  try {
    return await fn();
  } finally {
    release();
    if (commitmentChains.get(key) === tail) commitmentChains.delete(key);
  }
}

/**
 * Transient failure: the deposit may still register if the client retries
 * (e.g. the relayer's RPC has not seen the tx yet). Never for bad input.
 */
function retryableError(message: string): Error {
  return Object.assign(new Error(message), {
    statusCode: 409,
    retryable: true,
  });
}

function purgePendingDeposits() {
  const now = Date.now();
  for (const [sig, until] of pendingDepositSigs) {
    if (until <= now) pendingDepositSigs.delete(sig);
  }
}

/** Claim a deposit tx signature for registration (anti-race). */
function beginDepositReservation(txSignature: string): void {
  purgePendingDeposits();
  if (getCreditByDepositTx(txSignature) || pendingDepositSigs.has(txSignature)) {
    throw Object.assign(new Error("Deposit transaction already registered"), {
      statusCode: 400,
    });
  }
  pendingDepositSigs.set(txSignature, Date.now() + PENDING_TTL_MS);
}

function endDepositReservation(txSignature: string): void {
  pendingDepositSigs.delete(txSignature);
}

/** USDC ATA used as default treasury display / legacy deposits. */
export function getGasTreasuryAta(): PublicKey {
  const cfg = loadConfig();
  const mint = cfg.usdcMint;
  if (!mint) throw new Error("USDC_MINT required for gas credits");
  if (cfg.gasTreasury) return cfg.gasTreasury;
  const relayer = loadRelayerKeypair();
  return getAssociatedTokenAddressSync(
    mint,
    relayer.publicKey,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
}

/** Relayer ATA for classic SPL Token only (Token-2022 deposits rejected). */
export function getRelayerTokenAta(mint: PublicKey): PublicKey {
  const relayer = loadRelayerKeypair();
  return getAssociatedTokenAddressSync(
    mint,
    relayer.publicKey,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
}

export function getCredit(commitment: string): GasCredit | undefined {
  const key = normCommitment(commitment);
  return credits.find((c) => normCommitment(c.commitment) === key);
}

export function getCreditByDepositTx(txSignature: string): GasCredit | undefined {
  const sig = txSignature.trim();
  if (!sig) return undefined;
  return credits.find((c) => c.depositTx === sig);
}

export function listCredits(): GasCredit[] {
  return [...credits];
}

export function commitmentFromSecretHex(secretHex: string): string {
  const h = secretHex.startsWith("0x") ? secretHex.slice(2) : secretHex;
  const bytes = Buffer.from(h, "hex");
  if (bytes.length !== 32) throw new Error("secret must be 32 bytes");
  return createHash("sha256").update(bytes).digest("hex");
}

async function verifyNote(raw: string): Promise<GasNote> {
  const note = decodeGasNote(raw);
  await assertGasNoteIntegrity(note);
  const expected = commitmentFromSecretHex(note.secret);
  if (expected !== normCommitment(note.commitment)) {
    throw Object.assign(new Error("Gas note failed integrity check"), {
      statusCode: 400,
    });
  }
  return note;
}

function resolveQuoteUsdcMint(): string {
  const cfg = loadConfig();
  if (cfg.gasQuoteUsdcMint) return cfg.gasQuoteUsdcMint.toBase58();
  return MAINNET_USDC_MINT;
}

function normalizeDepositMint(raw: string | undefined): string {
  const cfg = loadConfig();
  if (!raw || !raw.trim()) {
    if (!cfg.usdcMint) throw new Error("USDC_MINT required");
    return cfg.usdcMint.toBase58();
  }
  const t = raw.trim();
  if (isNativeMint(t)) return "native";
  return t;
}

/**
 * Fail closed: multi-asset requires an explicit allowlist.
 * If unset, default to native SOL + configured USDC (+ mainnet USDT when on mainnet).
 */
export function effectiveDepositAllowlist(): string[] {
  const cfg = loadConfig();
  if (!cfg.gasMultiAsset) {
    return cfg.usdcMint ? [cfg.usdcMint.toBase58()] : [];
  }
  if (cfg.gasCreditDepositMints?.length) {
    return cfg.gasCreditDepositMints.map((m) =>
      isNativeMint(m) ? "native" : m,
    );
  }
  const list: string[] = ["native"];
  if (cfg.usdcMint) list.push(cfg.usdcMint.toBase58());
  if (cfg.cluster === "mainnet-beta" || cfg.cluster === "mainnet") {
    if (!list.includes(MAINNET_USDC_MINT)) list.push(MAINNET_USDC_MINT);
    list.push(MAINNET_USDT_MINT);
  }
  return list;
}

function assertDepositMintAllowed(mint: string) {
  const list = effectiveDepositAllowlist();
  if (!list.includes(mint)) {
    throw Object.assign(
      new Error(
        "This asset is not accepted for gas credits (allowlisted assets only)",
      ),
      { statusCode: 400 },
    );
  }
}

export async function quoteGasCreditDeposit(params: {
  mint?: string;
  amount: string;
}): Promise<{
  depositMint: string;
  depositAmount: string;
  creditRaw: string;
  creditUi: string;
  usdcOutRaw: string;
  haircutBps: number;
  routeLabel: string;
  feePerTxRaw: string;
}> {
  const cfg = loadConfig();
  if (!cfg.gasEnabled) {
    throw Object.assign(new Error("Ghost Gas is disabled"), { statusCode: 503 });
  }
  if (!/^\d+$/.test(params.amount) || params.amount === "0") {
    throw Object.assign(new Error("amount must be a positive integer string"), {
      statusCode: 400,
    });
  }
  const depositMint = normalizeDepositMint(params.mint);
  assertDepositMintAllowed(depositMint);

  if (cfg.usdcMint && depositMint === cfg.usdcMint.toBase58()) {
    const creditRaw = params.amount;
    if (BigInt(creditRaw) < BigInt(cfg.gasCreditFeeRaw)) {
      throw Object.assign(
        new Error(
          `Deposit too small (credit ${creditRaw} < fee ${cfg.gasCreditFeeRaw})`,
        ),
        { statusCode: 400 },
      );
    }
    return {
      depositMint,
      depositAmount: params.amount,
      creditRaw,
      creditUi: (Number(creditRaw) / 1_000_000).toFixed(6),
      usdcOutRaw: params.amount,
      haircutBps: 0,
      routeLabel: "1:1 USDC",
      feePerTxRaw: cfg.gasCreditFeeRaw,
    };
  }

  const quote = await quoteDepositToUsdc({
    inputMint: depositMint === "native" ? "native" : depositMint,
    amountRaw: params.amount,
    outputUsdcMint: resolveQuoteUsdcMint(),
  });

  const haircut = Number.isFinite(cfg.gasCreditHaircutBps)
    ? cfg.gasCreditHaircutBps
    : 200;
  const creditRaw = applyHaircut(quote.usdcOutRaw, haircut);
  if (BigInt(creditRaw) < BigInt(cfg.gasCreditFeeRaw)) {
    throw Object.assign(
      new Error(
        `Deposit too small after pricing (credit ${creditRaw} < fee ${cfg.gasCreditFeeRaw})`,
      ),
      { statusCode: 400 },
    );
  }

  return {
    depositMint,
    depositAmount: params.amount,
    creditRaw,
    creditUi: (Number(creditRaw) / 1_000_000).toFixed(6),
    usdcOutRaw: quote.usdcOutRaw,
    haircutBps: haircut,
    routeLabel: quote.routeLabel,
    feePerTxRaw: cfg.gasCreditFeeRaw,
  };
}

type ParsedTx = {
  blockTime: number | null | undefined;
  meta: {
    err: unknown;
    preBalances: number[];
    postBalances: number[];
    preTokenBalances?: Array<{
      accountIndex: number;
      mint: string;
      owner?: string;
      uiTokenAmount: { amount: string };
    }>;
    postTokenBalances?: Array<{
      accountIndex: number;
      mint: string;
      owner?: string;
      uiTokenAmount: { amount: string };
    }>;
    innerInstructions?: unknown;
  };
  transaction: {
    message: {
      accountKeys: unknown[];
      instructions?: Array<{
        programId?: PublicKey | string;
        programIdIndex?: number;
        parsed?: { type?: string; info?: Record<string, unknown> };
        data?: string;
        accounts?: unknown[];
      }>;
    };
  };
};

function requireFreshDeposit(parsed: ParsedTx) {
  const bt = parsed.blockTime;
  if (bt == null) {
    throw retryableError("Deposit transaction missing blockTime");
  }
  const age = Math.floor(Date.now() / 1000) - bt;
  if (age > MAX_DEPOSIT_AGE_SEC || age < -120) {
    throw Object.assign(
      new Error("Deposit transaction is too old (or from the future)"),
      { statusCode: 400 },
    );
  }
}

function requireCommitmentMemo(parsed: ParsedTx, commitment: string) {
  const want = normCommitment(commitment);
  const keys = parsed.transaction.message.accountKeys;
  const ixs = parsed.transaction.message.instructions || [];
  for (const ix of ixs) {
    let programId = "";
    if (ix.programId) {
      programId =
        typeof ix.programId === "string"
          ? ix.programId
          : ix.programId.toBase58();
    } else if (typeof ix.programIdIndex === "number") {
      programId = accountKeyStr(keys, ix.programIdIndex) || "";
    }
    if (programId !== MEMO_PROGRAM_ID) continue;

    let memo = "";
    // Helius/jsonParsed often returns Memo as a plain string (parsed: "e9b11e…").
    if (typeof ix.parsed === "string") {
      memo = ix.parsed;
    } else if (
      ix.parsed &&
      typeof (ix.parsed as { info?: unknown }).info === "string"
    ) {
      memo = String((ix.parsed as { info?: unknown }).info);
    } else if (typeof ix.data === "string") {
      try {
        memo = Buffer.from(ix.data, "base64").toString("utf8");
      } catch {
        memo = ix.data;
      }
    }
    const normalized = memo.replace(/^0x/i, "").toLowerCase();
    if (normalized.includes(want)) return;
  }
  throw Object.assign(
    new Error(
      "Deposit tx must include a Memo with the gas note commitment (anti front-run)",
    ),
    { statusCode: 400 },
  );
}

function measureSolTransferToRelayer(
  parsed: ParsedTx,
  relayerPk: string,
  want: bigint,
): bigint {
  const keys = parsed.transaction.message.accountKeys;
  const ixs = parsed.transaction.message.instructions || [];
  let transferred = 0n;

  for (const ix of ixs) {
    let programId = "";
    if (ix.programId) {
      programId =
        typeof ix.programId === "string"
          ? ix.programId
          : ix.programId.toBase58();
    } else if (typeof ix.programIdIndex === "number") {
      programId = accountKeyStr(keys, ix.programIdIndex) || "";
    }
    if (programId !== SystemProgram.programId.toBase58()) continue;

    const parsedIx = ix.parsed;
    if (!parsedIx || parsedIx.type !== "transfer") continue;
    const info = parsedIx.info || {};
    const dest = String(info.destination || "");
    const lamports = BigInt(String(info.lamports ?? "0"));
    if (dest === relayerPk && lamports > 0n) transferred += lamports;
  }

  if (transferred !== want) {
    // Fallback: some RPCs omit parsed system transfers — still require exact
    // balance delta AND that relayer is in the message (instruction path preferred).
    if (transferred === 0n) {
      let idx = -1;
      for (let i = 0; i < keys.length; i++) {
        if (accountKeyStr(keys, i) === relayerPk) {
          idx = i;
          break;
        }
      }
      if (idx >= 0) {
        const before = BigInt(parsed.meta.preBalances[idx] ?? 0);
        const after = BigInt(parsed.meta.postBalances[idx] ?? 0);
        const delta = after - before;
        if (delta === want) {
          throw Object.assign(
            new Error(
              "SOL deposit must use an explicit SystemProgram transfer to the Ghost fee payer",
            ),
            { statusCode: 400 },
          );
        }
      }
    }
  }
  return transferred;
}

function measureSplToTreasuryAta(
  parsed: ParsedTx,
  mintStr: string,
  treasuryAta: string,
  want: bigint,
): bigint {
  const pre = parsed.meta.preTokenBalances || [];
  const post = parsed.meta.postTokenBalances || [];
  const accountKeys = parsed.transaction.message.accountKeys;
  let credited = 0n;

  for (const after of post) {
    if (after.mint !== mintStr) continue;
    const tokenAccount = accountKeyStr(accountKeys, after.accountIndex);
    // Strict: only the known treasury ATA — not "any account owned by relayer".
    if (tokenAccount !== treasuryAta) continue;

    const before = pre.find((b) => b.accountIndex === after.accountIndex);
    const afterAmt = BigInt(after.uiTokenAmount.amount);
    const beforeAmt = before ? BigInt(before.uiTokenAmount.amount) : 0n;
    const delta = afterAmt - beforeAmt;
    if (delta > 0n) credited += delta;
  }

  if (credited !== want) {
    throw Object.assign(
      new Error(
        `Claimed amount ${want.toString()} must equal on-chain treasury credit ${credited.toString()}`,
      ),
      { statusCode: 400 },
    );
  }
  return credited;
}

/**
 * Confirm an on-chain transfer into the Ghost treasury, price to USDC, open credit.
 */
export async function registerGasCreditDeposit(params: {
  commitment: string;
  amount: string;
  txSignature: string;
  mint?: string;
}): Promise<GasCredit> {
  const cfg = loadConfig();
  if (!cfg.gasEnabled) {
    throw Object.assign(new Error("Ghost Gas is disabled"), { statusCode: 503 });
  }
  if (!cfg.usdcMint) {
    throw Object.assign(new Error("USDC_MINT required"), { statusCode: 500 });
  }
  if (!/^\d+$/.test(params.amount) || params.amount === "0") {
    throw Object.assign(new Error("amount must be a positive integer string"), {
      statusCode: 400,
    });
  }
  const commitment = normCommitment(params.commitment);
  if (!/^[0-9a-f]{64}$/.test(commitment)) {
    throw Object.assign(new Error("invalid commitment"), { statusCode: 400 });
  }
  const txSignature = params.txSignature.trim();
  if (!txSignature) {
    throw Object.assign(new Error("txSignature required"), { statusCode: 400 });
  }

  // One registration per commitment at a time: the slow path below awaits RPC
  // and Jupiter, and the dedupe checks must hold across those awaits.
  return withCommitmentLock(commitment, () =>
    registerLocked({ ...params, commitment, txSignature }),
  );
}

/**
 * A retry of a registration that already succeeded returns the same credit,
 * so clients can safely re-send after a lost response.
 */
function existingRegistration(
  commitment: string,
  txSignature: string,
): GasCredit | undefined {
  const byCommitment = getCredit(commitment);
  if (byCommitment) {
    if (byCommitment.depositTx === txSignature) return byCommitment;
    throw Object.assign(new Error("Commitment already registered"), {
      statusCode: 400,
    });
  }
  if (getCreditByDepositTx(txSignature)) {
    throw Object.assign(new Error("Deposit transaction already registered"), {
      statusCode: 400,
    });
  }
  return undefined;
}

async function registerLocked(params: {
  commitment: string;
  amount: string;
  txSignature: string;
  mint?: string;
}): Promise<GasCredit> {
  const cfg = loadConfig();
  const { commitment, txSignature } = params;

  const already = existingRegistration(commitment, txSignature);
  if (already) return already;

  // Reserve BEFORE any await that widens the race window.
  beginDepositReservation(txSignature);

  try {
    const depositMint = normalizeDepositMint(params.mint);
    assertDepositMintAllowed(depositMint);

    const connection = getConnection();
    const parsed = (await connection.getParsedTransaction(txSignature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    })) as ParsedTx | null;
    if (!parsed?.meta) {
      // Usually the relayer RPC lagging the client RPC by a few slots.
      throw retryableError("Deposit transaction not found yet");
    }
    if (parsed.meta.err) {
      throw Object.assign(new Error("Deposit transaction failed on-chain"), {
        statusCode: 400,
      });
    }

    requireFreshDeposit(parsed);
    requireCommitmentMemo(parsed, commitment);

    const relayerPk = loadRelayerKeypair().publicKey.toBase58();
    const want = BigInt(params.amount);

    if (depositMint === "native") {
      const got = measureSolTransferToRelayer(parsed, relayerPk, want);
      if (got !== want) {
        throw Object.assign(
          new Error(
            `Claimed SOL ${want.toString()} must equal SystemProgram transfer ${got.toString()} to Ghost`,
          ),
          { statusCode: 400 },
        );
      }
    } else {
      const mintPk = new PublicKey(depositMint);
      const mintInfo = await connection.getAccountInfo(mintPk);
      if (!mintInfo) {
        throw Object.assign(new Error("Unknown mint"), { statusCode: 400 });
      }
      if (mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID)) {
        throw Object.assign(
          new Error("Token-2022 deposits are not accepted for gas credits"),
          { statusCode: 400 },
        );
      }
      if (!mintInfo.owner.equals(TOKEN_PROGRAM_ID)) {
        throw Object.assign(new Error("Unsupported token program"), {
          statusCode: 400,
        });
      }
      const atas = new Set<string>([getRelayerTokenAta(mintPk).toBase58()]);
      if (cfg.usdcMint && depositMint === cfg.usdcMint.toBase58()) {
        try {
          atas.add(getGasTreasuryAta().toBase58());
        } catch {
          /* ignore */
        }
      }
      // Prefer primary ATA; measure against any allowlisted treasury ATA exactly.
      let matched = false;
      for (const ata of atas) {
        try {
          measureSplToTreasuryAta(parsed, depositMint, ata, want);
          matched = true;
          break;
        } catch {
          /* try next */
        }
      }
      if (!matched) {
        throw Object.assign(
          new Error(
            `Claimed amount ${want.toString()} must equal on-chain credit to Ghost treasury ATA`,
          ),
          { statusCode: 400 },
        );
      }
    }

    // Re-check after slow path (another writer may have finished).
    const raced = existingRegistration(commitment, txSignature);
    if (raced) return raced;

    const priced = await quoteGasCreditDeposit({
      mint: depositMint,
      amount: params.amount,
    });

    const now = new Date().toISOString();
    const row: GasCredit = {
      commitment,
      initialAmount: priced.creditRaw,
      remaining: priced.creditRaw,
      depositTx: txSignature,
      depositMint,
      depositAmount: params.amount,
      createdAt: now,
      updatedAt: now,
    };
    credits.push(row);
    saveCredits();
    return row;
  } finally {
    endDepositReservation(txSignature);
  }
}

export async function peekGasNoteBalance(gasNoteRaw: string): Promise<{
  commitment: string;
  remaining: string;
  feePerTx: string;
}> {
  const note = await verifyNote(gasNoteRaw);
  const credit = getCredit(note.commitment);
  if (!credit) {
    throw Object.assign(new Error("Unknown gas note; top up credits first"), {
      statusCode: 400,
    });
  }
  return {
    commitment: credit.commitment,
    remaining: credit.remaining,
    feePerTx: loadConfig().gasCreditFeeRaw,
  };
}

export async function assertGasNoteHasFee(gasNoteRaw: string): Promise<GasNote> {
  const note = await verifyNote(gasNoteRaw);
  const credit = getCredit(note.commitment);
  if (!credit) {
    throw Object.assign(new Error("Unknown gas note; top up credits first"), {
      statusCode: 400,
    });
  }
  const fee = BigInt(loadConfig().gasCreditFeeRaw);
  if (BigInt(credit.remaining) < fee) {
    throw Object.assign(
      new Error(
        `Insufficient gas credit (need ${fee.toString()} base units, have ${credit.remaining})`,
      ),
      { statusCode: 402 },
    );
  }
  return note;
}

/** Debit flat fee (serialized per commitment). */
export async function debitGasNoteFee(gasNoteRaw: string): Promise<GasCredit> {
  const note = await verifyNote(gasNoteRaw);
  return withCommitmentLock(note.commitment, async () => {
    const credit = getCredit(note.commitment);
    if (!credit) {
      throw Object.assign(new Error("Unknown gas note; top up credits first"), {
        statusCode: 400,
      });
    }
    const fee = BigInt(loadConfig().gasCreditFeeRaw);
    if (BigInt(credit.remaining) < fee) {
      throw Object.assign(
        new Error(
          `Insufficient gas credit (need ${fee.toString()} base units, have ${credit.remaining})`,
        ),
        { statusCode: 402 },
      );
    }
    credit.remaining = (BigInt(credit.remaining) - fee).toString();
    credit.updatedAt = new Date().toISOString();
    saveCredits();
    return credit;
  });
}

/** Refund a previously debited fee (submit failed after debit). */
export async function creditGasNoteFee(gasNoteRaw: string): Promise<GasCredit> {
  const note = await verifyNote(gasNoteRaw);
  return withCommitmentLock(note.commitment, async () => {
    const credit = getCredit(note.commitment);
    if (!credit) {
      throw Object.assign(new Error("Unknown gas note"), { statusCode: 400 });
    }
    const fee = BigInt(loadConfig().gasCreditFeeRaw);
    credit.remaining = (BigInt(credit.remaining) + fee).toString();
    credit.updatedAt = new Date().toISOString();
    saveCredits();
    return credit;
  });
}
