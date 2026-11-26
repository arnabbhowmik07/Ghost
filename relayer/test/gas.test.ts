import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createApproveInstruction,
  createTransferCheckedInstruction,
} from "@solana/spl-token";
import {
  GAS_CU_LIMIT,
  GAS_CU_LIMIT_MAX,
  GAS_CU_PRICE,
  GAS_CU_PRICE_MAX,
  assertSponsoredTransferTx,
} from "../src/gas.js";
import { resetRateLimits, takeRateLimit } from "../src/gas-rate-limit.js";

function signedTransferChecked(opts?: {
  cuLimit?: number;
  cuPrice?: number;
  withAta?: boolean;
  extraApprove?: boolean;
}) {
  const relayer = Keypair.generate();
  const owner = Keypair.generate();
  const mint = Keypair.generate().publicKey;
  const source = Keypair.generate().publicKey;
  const dest = Keypair.generate().publicKey;
  const toWallet = Keypair.generate().publicKey;

  const ixs = [
    ComputeBudgetProgram.setComputeUnitLimit({
      units: opts?.cuLimit ?? GAS_CU_LIMIT,
    }),
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: opts?.cuPrice ?? GAS_CU_PRICE,
    }),
  ];
  if (opts?.withAta) {
    ixs.push(
      createAssociatedTokenAccountIdempotentInstruction(
        relayer.publicKey,
        dest,
        toWallet,
        mint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    );
  }
  if (opts?.extraApprove) {
    ixs.push(
      createApproveInstruction(
        source,
        owner.publicKey,
        owner.publicKey,
        1n,
        [],
        TOKEN_PROGRAM_ID,
      ),
    );
  }
  ixs.push(
    createTransferCheckedInstruction(
      source,
      mint,
      dest,
      owner.publicKey,
      1_000_000n,
      6,
      [],
      TOKEN_PROGRAM_ID,
    ),
  );

  const tx = new Transaction().add(...ixs);
  tx.feePayer = relayer.publicKey;
  tx.recentBlockhash = "11111111111111111111111111111111";
  tx.partialSign(owner);
  return { tx, relayer, owner, mint, dest };
}

describe("Ghost Gas", () => {
  it("rate-limits per key", () => {
    resetRateLimits();
    assert.equal(takeRateLimit("a", 2).ok, true);
    assert.equal(takeRateLimit("a", 2).ok, true);
    const third = takeRateLimit("a", 2);
    assert.equal(third.ok, false);
  });

  it("rejects txs that are not fee-paid by the relayer", () => {
    const relayer = Keypair.generate();
    const stranger = Keypair.generate();
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: stranger.publicKey,
        toPubkey: Keypair.generate().publicKey,
        lamports: 1,
      }),
    );
    tx.feePayer = stranger.publicKey;
    tx.recentBlockhash = Keypair.generate().publicKey.toBase58();

    assert.throws(
      () => assertSponsoredTransferTx(tx, relayer),
      /feePayer must be the Ghost relayer/,
    );
  });

  it("rejects non-token programs", () => {
    const relayer = Keypair.generate();
    const user = Keypair.generate();
    const tx = new Transaction().add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: GAS_CU_LIMIT }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: GAS_CU_PRICE }),
      SystemProgram.transfer({
        fromPubkey: user.publicKey,
        toPubkey: Keypair.generate().publicKey,
        lamports: 1,
      }),
    );
    tx.feePayer = relayer.publicKey;
    tx.recentBlockhash = "11111111111111111111111111111111";

    assert.throws(() => assertSponsoredTransferTx(tx, relayer), /not allowlisted|Missing SPL/);
  });

  it("accepts a TransferChecked shaped tx signed by owner", () => {
    const { tx, relayer, owner, mint } = signedTransferChecked();
    const out = assertSponsoredTransferTx(tx, relayer);
    assert.equal(out.from.toBase58(), owner.publicKey.toBase58());
    assert.equal(out.mint.toBase58(), mint.toBase58());
  });

  it("accepts one ATA create for the transfer destination", () => {
    const { tx, relayer, owner } = signedTransferChecked({ withAta: true });
    const out = assertSponsoredTransferTx(tx, relayer);
    assert.equal(out.from.toBase58(), owner.publicKey.toBase58());
  });

  it("accepts wallet-injected extra ComputeBudget ixs (5–6 total)", () => {
    const { tx, relayer, owner } = signedTransferChecked({ withAta: true });
    // Mimic Phantom/Solflare injecting another priority fee on sign.
    tx.instructions.splice(
      2,
      0,
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: GAS_CU_PRICE }),
    );
    assert.equal(tx.instructions.length, 5);
    const out = assertSponsoredTransferTx(tx, relayer);
    assert.equal(out.from.toBase58(), owner.publicKey.toBase58());
  });

  it("accepts wallet-rewritten priority fee within max", () => {
    const { tx, relayer, owner } = signedTransferChecked({ cuPrice: 100_000 });
    const out = assertSponsoredTransferTx(tx, relayer);
    assert.equal(out.from.toBase58(), owner.publicKey.toBase58());
  });

  it("rejects inflated priority fees", () => {
    const { tx, relayer } = signedTransferChecked({
      cuPrice: GAS_CU_PRICE_MAX + 1,
    });
    assert.throws(() => assertSponsoredTransferTx(tx, relayer), /Priority fee/);
  });

  it("rejects Approve and other token instructions", () => {
    const { tx, relayer } = signedTransferChecked({ extraApprove: true });
    assert.throws(
      () => assertSponsoredTransferTx(tx, relayer),
      /not allowed|instruction count/,
    );
  });

  it("accepts wallet-rewritten CU limit within max", () => {
    const { tx, relayer, owner } = signedTransferChecked({ cuLimit: 240_000 });
    const out = assertSponsoredTransferTx(tx, relayer);
    assert.equal(out.from.toBase58(), owner.publicKey.toBase58());
  });

  it("rejects compute budget above accepted max", () => {
    const { tx, relayer } = signedTransferChecked({
      cuLimit: GAS_CU_LIMIT_MAX + 1,
    });
    assert.throws(() => assertSponsoredTransferTx(tx, relayer), /Compute unit limit/);
  });

  it("accepts wallet-injected Lighthouse assertion ixs", () => {
    const { tx, relayer, owner } = signedTransferChecked({ withAta: true });
    const lighthouse = new PublicKey(
      "L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95",
    );
    tx.add({
      keys: [
        { pubkey: owner.publicKey, isSigner: false, isWritable: false },
      ],
      programId: lighthouse,
      data: Buffer.from([9]), // AssertTokenAccount discriminator-ish
    });
    const out = assertSponsoredTransferTx(tx, relayer);
    assert.equal(out.from.toBase58(), owner.publicKey.toBase58());
  });

  it("rejects Lighthouse ixs that mark relayer writable", () => {
    const { tx, relayer } = signedTransferChecked();
    const lighthouse = new PublicKey(
      "L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95",
    );
    tx.add({
      keys: [
        { pubkey: relayer.publicKey, isSigner: false, isWritable: true },
      ],
      programId: lighthouse,
      data: Buffer.from([5]),
    });
    assert.throws(
      () => assertSponsoredTransferTx(tx, relayer),
      /Lighthouse instruction must not use the Ghost relayer/,
    );
  });

  it("accepts Memo and ComputeBudget loaded-accounts size ix", () => {
    const { tx, relayer, owner } = signedTransferChecked();
    const memo = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
    tx.add({
      keys: [{ pubkey: owner.publicKey, isSigner: false, isWritable: false }],
      programId: memo,
      data: Buffer.from("ghost-test", "utf8"),
    });
    // SetLoadedAccountsDataSizeLimit = tag 4 + u32
    const loaded = Buffer.alloc(5);
    loaded[0] = 4;
    loaded.writeUInt32LE(32 * 1024 * 1024, 1);
    tx.add({
      keys: [],
      programId: ComputeBudgetProgram.programId,
      data: loaded,
    });
    const out = assertSponsoredTransferTx(tx, relayer);
    assert.equal(out.from.toBase58(), owner.publicKey.toBase58());
  });
});
