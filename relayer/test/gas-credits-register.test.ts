import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, it } from "node:test";
import { Connection, Keypair } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

const relayer = Keypair.generate();
const mint = Keypair.generate().publicKey;
process.env.RELAYER_SECRET_KEY = JSON.stringify(Array.from(relayer.secretKey));
delete process.env.RELAYER_KEYPAIR_PATH;
delete process.env.GAS_TREASURY;
process.env.USDC_MINT = mint.toBase58();
process.env.GAS_MULTI_ASSET = "0"; // USDC 1:1, no Jupiter call
process.env.GAS_ENABLED = "1";
process.env.RPC_URL = "http://127.0.0.1:1"; // never reached: Connection is stubbed

const {
  MAX_DEPOSIT_AGE_SEC,
  MEMO_PROGRAM_ID,
  configureGasCredits,
  listCredits,
  registerGasCreditDeposit,
} = await import("../src/gas-credits.js");

const treasuryAta = getAssociatedTokenAddressSync(
  mint,
  relayer.publicKey,
  false,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
).toBase58();

const AMOUNT = "1000000";
const proto = Connection.prototype as any;
/** sig -> parsed tx the stubbed RPC returns (null = not visible yet). */
let chain: Map<string, unknown>;

function depositTx(opts: { commitment: string; ageSec?: number }) {
  const payer = Keypair.generate().publicKey.toBase58();
  return {
    blockTime: Math.floor(Date.now() / 1000) - (opts.ageSec ?? 5),
    meta: {
      err: null,
      preBalances: [0, 0, 0],
      postBalances: [0, 0, 0],
      preTokenBalances: [
        { accountIndex: 1, mint: mint.toBase58(), uiTokenAmount: { amount: "0" } },
      ],
      postTokenBalances: [
        { accountIndex: 1, mint: mint.toBase58(), uiTokenAmount: { amount: AMOUNT } },
      ],
    },
    transaction: {
      message: {
        accountKeys: [payer, treasuryAta, MEMO_PROGRAM_ID],
        instructions: [{ programId: MEMO_PROGRAM_ID, parsed: opts.commitment }],
      },
    },
  };
}

beforeEach(() => {
  configureGasCredits(mkdtempSync(join(tmpdir(), "ghost-gas-register-")));
  chain = new Map();
  proto.getParsedTransaction = async (sig: string) => chain.get(sig) ?? null;
  proto.getAccountInfo = async () => ({
    owner: TOKEN_PROGRAM_ID,
    data: Buffer.alloc(0),
    lamports: 1,
    executable: false,
  });
});

const commitment = (b: string) => b.repeat(64);

describe("registerGasCreditDeposit state handling", () => {
  it("is idempotent for the same commitment and deposit tx", async () => {
    chain.set("sigA", depositTx({ commitment: commitment("a") }));
    const first = await registerGasCreditDeposit({
      commitment: commitment("a"),
      amount: AMOUNT,
      txSignature: "sigA",
    });
    const again = await registerGasCreditDeposit({
      commitment: commitment("a"),
      amount: AMOUNT,
      txSignature: "sigA",
    });
    assert.equal(again.depositTx, first.depositTx);
    assert.equal(again.remaining, AMOUNT);
    assert.equal(listCredits().length, 1);
  });

  it("dedupes concurrent registrations of one deposit", async () => {
    chain.set("sigB", depositTx({ commitment: commitment("b") }));
    const req = () =>
      registerGasCreditDeposit({
        commitment: commitment("b"),
        amount: AMOUNT,
        txSignature: "sigB",
      });
    const results = await Promise.all([req(), req(), req()]);
    assert.ok(results.every((r) => r.depositTx === "sigB"));
    assert.equal(listCredits().length, 1);
  });

  it("rejects reusing a commitment with a different deposit tx", async () => {
    chain.set("sigC1", depositTx({ commitment: commitment("c") }));
    chain.set("sigC2", depositTx({ commitment: commitment("c") }));
    await registerGasCreditDeposit({
      commitment: commitment("c"),
      amount: AMOUNT,
      txSignature: "sigC1",
    });
    await assert.rejects(
      registerGasCreditDeposit({
        commitment: commitment("c"),
        amount: AMOUNT,
        txSignature: "sigC2",
      }),
      (err: any) => err.statusCode === 400 && /already registered/.test(err.message),
    );
  });

  it("marks a not-yet-visible deposit as retryable, then registers it", async () => {
    await assert.rejects(
      registerGasCreditDeposit({
        commitment: commitment("d"),
        amount: AMOUNT,
        txSignature: "sigD",
      }),
      (err: any) => err.statusCode === 409 && err.retryable === true,
    );
    // The relayer's RPC catches up; the same request now succeeds.
    chain.set("sigD", depositTx({ commitment: commitment("d") }));
    const credit = await registerGasCreditDeposit({
      commitment: commitment("d"),
      amount: AMOUNT,
      txSignature: "sigD",
    });
    assert.equal(credit.remaining, AMOUNT);
  });

  it("accepts a deposit registered an hour late", async () => {
    chain.set("sigE", depositTx({ commitment: commitment("e"), ageSec: 60 * 60 }));
    const credit = await registerGasCreditDeposit({
      commitment: commitment("e"),
      amount: AMOUNT,
      txSignature: "sigE",
    });
    assert.equal(credit.remaining, AMOUNT);
  });

  it("still rejects deposits past the max age", async () => {
    chain.set(
      "sigF",
      depositTx({ commitment: commitment("f"), ageSec: MAX_DEPOSIT_AGE_SEC + 60 }),
    );
    await assert.rejects(
      registerGasCreditDeposit({
        commitment: commitment("f"),
        amount: AMOUNT,
        txSignature: "sigF",
      }),
      /too old/,
    );
  });
});
