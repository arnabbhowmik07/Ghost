import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  bigIntToBytes32,
  commitmentPda,
  leafPda,
  nullifierPda,
  poolPda,
} from "@ghost/sdk";
import { loadConfig } from "./config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Load the fee-payer keypair.
 *
 * Preferred: RELAYER_KEYPAIR_PATH pointing at a standard Solana
 * `solana-keygen` 64-byte JSON array file (the format the host uses).
 * Fallback: RELAYER_SECRET_KEY as the same JSON array string, or bs58.
 */
export function loadRelayerKeypair(): Keypair {
  const cfg = loadConfig();
  if (cfg.keypairPath) {
    if (!existsSync(cfg.keypairPath)) {
      throw new Error(`RELAYER_KEYPAIR_PATH not found: ${cfg.keypairPath}`);
    }
    const raw = readFileSync(cfg.keypairPath, "utf8").trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(
        "Relayer keypair file must be a Solana 64-byte JSON array (solana-keygen format)",
      );
    }
    if (!Array.isArray(parsed) || parsed.length !== 64) {
      throw new Error(
        "Relayer keypair file must be a Solana 64-byte JSON array (solana-keygen format)",
      );
    }
    if (!parsed.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
      throw new Error("Relayer keypair file contains invalid byte values");
    }
    return Keypair.fromSecretKey(Uint8Array.from(parsed));
  }
  const secret = cfg.secretKey;
  if (!secret) {
    throw new Error(
      "Set RELAYER_KEYPAIR_PATH to a 64-byte JSON keypair file (preferred) or RELAYER_SECRET_KEY",
    );
  }
  if (secret.trim().startsWith("[")) {
    const parsed = JSON.parse(secret) as number[];
    if (!Array.isArray(parsed) || parsed.length !== 64) {
      throw new Error("RELAYER_SECRET_KEY JSON must be a 64-byte array");
    }
    return Keypair.fromSecretKey(Uint8Array.from(parsed));
  }
  return Keypair.fromSecretKey(bs58.decode(secret));
}

export function getConnection(): Connection {
  return new Connection(loadConfig().rpcUrl, "confirmed");
}

export function getProgramId(): PublicKey {
  return loadConfig().programId;
}

export function getMint(): PublicKey {
  const mint = loadConfig().usdcMint;
  if (!mint) throw new Error("Missing USDC_MINT");
  return mint;
}

function loadIdl(): any {
  const local = join(__dirname, "..", "idl", "ghost_pool.json");
  const fallback = join(__dirname, "..", "..", "target", "idl", "ghost_pool.json");
  const path = existsSync(local) ? local : fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

export function getProgram(payer: Keypair): Program {
  const connection = getConnection();
  const wallet = new Wallet(payer);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const idl = loadIdl();
  idl.address = getProgramId().toBase58();
  return new Program(idl, provider);
}

export async function fetchCommitmentRecord(commitment: number[]): Promise<{
  commitment: number[];
  leafIndex: number;
} | null> {
  const relayer = loadRelayerKeypair();
  const program = getProgram(relayer);
  const [pda] = commitmentPda(commitment, getProgramId());
  try {
    const account: any = await (program.account as any).commitmentRecord.fetch(pda);
    return {
      commitment: Array.from(account.commitment as number[] | Uint8Array),
      leafIndex: account.leafIndex as number,
    };
  } catch {
    return null;
  }
}

export async function fetchLeafRecord(leafIndex: number): Promise<{
  commitment: number[];
  leafIndex: number;
} | null> {
  const relayer = loadRelayerKeypair();
  const program = getProgram(relayer);
  const mint = getMint();
  const [pda] = leafPda(mint, leafIndex, getProgramId());
  try {
    const account: any = await (program.account as any).leafRecord.fetch(pda);
    return {
      commitment: Array.from(account.commitment as number[] | Uint8Array),
      leafIndex: account.leafIndex as number,
    };
  } catch {
    return null;
  }
}

export async function nullifierExists(nullifier: number[]): Promise<boolean> {
  const connection = getConnection();
  const [pda] = nullifierPda(nullifier, getProgramId());
  const info = await connection.getAccountInfo(pda);
  return info !== null;
}

export async function submitWithdraw(params: {
  nullifier: bigint;
  root: bigint;
  recipient: PublicKey;
}): Promise<string> {
  const relayer = loadRelayerKeypair();
  const program = getProgram(relayer);
  const mint = getMint();
  const programId = getProgramId();
  const [pool] = poolPda(mint, programId);
  const poolAccount: any = await (program.account as any).poolConfig.fetch(pool);

  const nullifierBytes = bigIntToBytes32(params.nullifier);
  const rootBytes = bigIntToBytes32(params.root);
  const [nullifierRecord] = nullifierPda(nullifierBytes, programId);

  const recipientToken = getAssociatedTokenAddressSync(mint, params.recipient);
  const treasuryToken = getAssociatedTokenAddressSync(mint, poolAccount.treasury as PublicKey);

  const tx = await program.methods
    .withdraw(nullifierBytes, rootBytes)
    .accounts({
      relayer: relayer.publicKey,
      pool,
      vault: poolAccount.vault,
      recipient: params.recipient,
      recipientToken,
      treasury: poolAccount.treasury,
      treasuryToken,
      nullifierRecord,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .transaction();

  const connection = getConnection();
  const info = await connection.getAccountInfo(recipientToken);
  const ixs = [];
  if (!info) {
    ixs.push(
      createAssociatedTokenAccountInstruction(
        relayer.publicKey,
        recipientToken,
        params.recipient,
        mint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    );
  }

  const finalTx = new Transaction().add(...ixs, ...tx.instructions);
  finalTx.feePayer = relayer.publicKey;
  finalTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  finalTx.sign(relayer);
  const sig = await connection.sendRawTransaction(finalTx.serialize());
  const confirmation = await connection.confirmTransaction(sig, "confirmed");
  // confirmTransaction resolves (does not throw) when the tx landed but failed.
  if (confirmation.value.err) {
    throw Object.assign(
      new Error(
        `Withdraw transaction ${sig} failed on-chain: ${JSON.stringify(confirmation.value.err)}`,
      ),
      { signature: sig },
    );
  }
  return sig;
}

export async function fetchPool() {
  const relayer = loadRelayerKeypair();
  const program = getProgram(relayer);
  const mint = getMint();
  const [pool] = poolPda(mint, getProgramId());
  const account: any = await (program.account as any).poolConfig.fetch(pool);
  let vaultBalanceUi: string | null = null;
  try {
    const bal = await getConnection().getTokenAccountBalance(account.vault);
    vaultBalanceUi = bal.value.uiAmountString ?? String(bal.value.uiAmount ?? "");
  } catch {
    vaultBalanceUi = null;
  }
  return {
    address: pool.toBase58(),
    authority: account.authority.toBase58(),
    relayer: account.relayer.toBase58(),
    mint: account.mint.toBase58(),
    vault: account.vault.toBase58(),
    treasury: account.treasury.toBase58(),
    denomination: account.denomination?.toString?.() ?? String(account.denomination),
    feeBps: account.feeBps,
    nextIndex: account.nextIndex as number,
    depositCount: account.depositCount as number,
    vaultBalanceUi,
  };
}

export { poolPda, commitmentPda, leafPda, nullifierPda };
