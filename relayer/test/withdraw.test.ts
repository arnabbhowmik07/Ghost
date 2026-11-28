import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { BN } from "@coral-xyz/anchor";
import { Connection, Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { getProgram, poolPda, submitWithdraw } from "../src/solana.js";

const relayer = Keypair.generate();
const mint = Keypair.generate().publicKey;
process.env.RELAYER_SECRET_KEY = JSON.stringify(Array.from(relayer.secretKey));
delete process.env.RELAYER_KEYPAIR_PATH;
process.env.USDC_MINT = mint.toBase58();
process.env.RPC_URL = "http://127.0.0.1:1"; // never reached: Connection is stubbed

const SIG = bs58.encode(Buffer.alloc(64, 7));
const proto = Connection.prototype as any;
let confirmResult: unknown;
let sent: number;

beforeEach(async () => {
  sent = 0;
  confirmResult = { context: { slot: 1 }, value: { err: null } };
  const program = getProgram(relayer);
  const [pool] = poolPda(mint, program.programId);
  const poolData = await program.coder.accounts.encode("poolConfig", {
    authority: Keypair.generate().publicKey,
    relayer: relayer.publicKey,
    mint,
    vault: Keypair.generate().publicKey,
    treasury: Keypair.generate().publicKey,
    denomination: new BN(1_000_000),
    feeBps: 30,
    nextIndex: 1,
    depositCount: 1,
    bump: 255,
  });
  proto.getAccountInfo = async (pk: { equals(o: unknown): boolean }) =>
    pk.equals(pool)
      ? { data: poolData, owner: program.programId, lamports: 1, executable: false }
      : { data: Buffer.alloc(0), owner: Keypair.generate().publicKey, lamports: 1, executable: false };
  // Anchor's account fetch goes through the *AndContext variant.
  proto.getAccountInfoAndContext = async (pk: { equals(o: unknown): boolean }) => ({
    context: { slot: 1 },
    value: await proto.getAccountInfo(pk),
  });
  proto.getLatestBlockhash = async () => ({
    blockhash: Keypair.generate().publicKey.toBase58(),
    lastValidBlockHeight: 1_150,
  });
  proto.sendRawTransaction = async () => {
    sent += 1;
    return SIG;
  };
  proto.confirmTransaction = async () => confirmResult;
});

const params = () => ({
  nullifier: 123n,
  root: 456n,
  recipient: Keypair.generate().publicKey,
});

describe("submitWithdraw status reporting", () => {
  it("returns the signature when the tx confirms without error", async () => {
    assert.equal(await submitWithdraw(params()), SIG);
    assert.equal(sent, 1);
  });

  it("throws when the tx lands but fails on-chain", async () => {
    // confirmTransaction resolves (does not throw) for a landed-but-failed tx.
    confirmResult = {
      context: { slot: 1 },
      value: { err: { InstructionError: [0, { Custom: 6000 }] } },
    };
    await assert.rejects(submitWithdraw(params()), (err: any) => {
      assert.match(err.message, /failed on-chain/);
      assert.match(err.message, /InstructionError/);
      assert.equal(err.signature, SIG);
      return true;
    });
    assert.equal(sent, 1);
  });
});
