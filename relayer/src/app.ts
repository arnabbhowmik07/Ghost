import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { bigIntToBytes32, type Groth16ProofPayload } from "@ghost/sdk";
import { explorerTx, loadConfig, type RelayerConfig } from "./config.js";
import {
  commitmentHex,
  configureStore,
  getCurrentRoot,
  getDeposit,
  listDeposits,
  merklePathFor,
  rebuildRoots,
  upsertDeposit,
} from "./store.js";
import {
  fetchCommitmentRecord,
  fetchPool,
  loadRelayerKeypair,
  nullifierExists,
  submitWithdraw,
} from "./solana.js";
import { syncFromChain } from "./sync.js";
import { verifyProof } from "./zk.js";
import { validateWithdrawInput } from "./validate.js";
import {
  getGasPublicConfig,
  prepareSponsoredTransfer,
  submitSponsoredTransfer,
  type GasPrepareInput,
} from "./gas.js";
import { takeRateLimit } from "./gas-rate-limit.js";
import {
  configureGasCredits,
  getGasTreasuryAta,
  peekGasNoteBalance,
  quoteGasCreditDeposit,
  registerGasCreditDeposit,
} from "./gas-credits.js";

export interface RelayerHooks {
  verifyProof?: typeof verifyProof;
  submitWithdraw?: typeof submitWithdraw;
  fetchPool?: typeof fetchPool;
  syncFromChain?: typeof syncFromChain;
  fetchCommitmentRecord?: typeof fetchCommitmentRecord;
  nullifierExists?: typeof nullifierExists;
}

export async function buildApp(
  hooks: RelayerHooks = {},
  config?: RelayerConfig,
): Promise<FastifyInstance> {
  const cfg = config ?? loadConfig();
  configureStore(cfg.dataDir || undefined);
  configureGasCredits(cfg.dataDir || undefined);

  const verify = hooks.verifyProof ?? verifyProof;
  const withdraw = hooks.submitWithdraw ?? submitWithdraw;
  const pool = hooks.fetchPool ?? fetchPool;
  const sync = hooks.syncFromChain ?? syncFromChain;
  const fetchCommitment = hooks.fetchCommitmentRecord ?? fetchCommitmentRecord;
  const spent = hooks.nullifierExists ?? nullifierExists;

  const app = Fastify({
    logger: process.env.GHOST_RELAYER_LOG === "0" ? false : true,
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (cfg.allowedOrigins.includes("*") || cfg.allowedOrigins.includes(origin)) {
        return cb(null, true);
      }
      cb(null, false);
    },
  });

  app.get("/health", async () => {
    let feePayer: string | null = null;
    try {
      feePayer = loadRelayerKeypair().publicKey.toBase58();
    } catch {
      feePayer = null;
    }
    return {
      ok: true,
      service: "ghost-relayer",
      cluster: cfg.cluster,
      deposits: listDeposits().length,
      root: getCurrentRoot() || null,
      listen: `${cfg.host}:${cfg.port}`,
      gas: {
        enabled: cfg.gasEnabled,
        feePayer,
      },
    };
  });

  app.get("/v1/gas/config", async () => getGasPublicConfig());

  app.post<{
    Body: { mint?: string; amount?: string };
  }>("/v1/gas/credits/quote", async (req, reply) => {
    try {
      const amount = String(req.body?.amount || "");
      const mint = req.body?.mint != null ? String(req.body.mint) : undefined;
      if (!amount) return reply.code(400).send({ error: "amount required" });
      return await quoteGasCreditDeposit({ mint, amount });
    } catch (err: any) {
      const code =
        err?.statusCode === 400 ||
        err?.statusCode === 502 ||
        err?.statusCode === 503
          ? err.statusCode
          : 500;
      return reply.code(code).send({ error: err?.message ?? "quote failed" });
    }
  });

  app.post<{
    Body: {
      commitment?: string;
      amount?: string;
      txSignature?: string;
      mint?: string;
    };
  }>("/v1/gas/credits/deposit", async (req, reply) => {
    try {
      const commitment = String(req.body?.commitment || "");
      const amount = String(req.body?.amount || "");
      const txSignature = String(req.body?.txSignature || "");
      const mint = req.body?.mint != null ? String(req.body.mint) : undefined;
      if (!commitment || !amount || !txSignature) {
        return reply.code(400).send({
          error: "commitment, amount, and txSignature required",
        });
      }
      const credit = await registerGasCreditDeposit({
        commitment,
        amount,
        txSignature,
        mint,
      });
      let treasury: string | null = null;
      try {
        treasury = getGasTreasuryAta().toBase58();
      } catch {
        treasury = null;
      }
      return { credit, treasury };
    } catch (err: any) {
      const code =
        err?.statusCode === 400 ||
        err?.statusCode === 409 ||
        err?.statusCode === 502 ||
        err?.statusCode === 503
          ? err.statusCode
          : 500;
      req.log.error(err);
      // Tell clients whether re-sending the same registration can succeed;
      // the funds are already on-chain, so a retryable error must not be final.
      const retryable = err?.retryable === true || code !== 400;
      return reply
        .code(code)
        .send({ error: err?.message ?? "credit deposit failed", retryable });
    }
  });

  app.post<{ Body: { gasNote?: string } }>("/v1/gas/credits/balance", async (req, reply) => {
    try {
      const gasNote = String(req.body?.gasNote || "");
      if (!gasNote) return reply.code(400).send({ error: "gasNote required" });
      return await peekGasNoteBalance(gasNote);
    } catch (err: any) {
      const code = err?.statusCode === 400 ? 400 : 500;
      return reply.code(code).send({ error: err?.message ?? "balance failed" });
    }
  });

  app.post<{ Body: GasPrepareInput }>("/v1/gas/prepare", async (req, reply) => {
    try {
      const body = req.body ?? ({} as GasPrepareInput);
      const from = String(body.from || "");
      const limit = takeRateLimit(`prepare:${from}`, cfg.gasMaxPerHour);
      if (!limit.ok) {
        return reply.code(429).send({
          error: "Ghost Gas rate limit exceeded",
          retryAfterSec: limit.retryAfterSec,
        });
      }
      const prepared = await prepareSponsoredTransfer(body);
      return prepared;
    } catch (err: any) {
      const code =
        err?.statusCode === 400 ||
        err?.statusCode === 402 ||
        err?.statusCode === 503
          ? err.statusCode
          : 500;
      req.log.error(err);
      return reply.code(code).send({ error: err?.message ?? "gas prepare failed" });
    }
  });

  app.post<{ Body: { transaction?: string; gasNote?: string } }>(
    "/v1/gas/submit",
    async (req, reply) => {
      try {
        const transaction = String(req.body?.transaction || "");
        const gasNote = String(req.body?.gasNote || "");
        if (!transaction) {
          return reply.code(400).send({ error: "transaction (base64) required" });
        }
        if (!gasNote) {
          return reply.code(400).send({ error: "gasNote required" });
        }
        const limit = takeRateLimit(`submit:${req.ip}`, cfg.gasMaxPerHour);
        if (!limit.ok) {
          return reply.code(429).send({
            error: "Ghost Gas rate limit exceeded",
            retryAfterSec: limit.retryAfterSec,
          });
        }
        const { signature, creditRemaining } = await submitSponsoredTransfer(
          transaction,
          gasNote,
        );
        return {
          signature,
          explorer: explorerTx(signature, cfg.cluster),
          creditRemaining,
        };
      } catch (err: any) {
        const code =
          err?.statusCode === 400 ||
          err?.statusCode === 402 ||
          err?.statusCode === 503
            ? err.statusCode
            : 500;
        req.log.error(err);
        return reply.code(code).send({ error: err?.message ?? "gas submit failed" });
      }
    },
  );

  app.get("/v1/pool", async () => pool());

  app.get("/v1/deposits", async () => ({ deposits: listDeposits(), root: getCurrentRoot() }));

  app.post("/v1/sync", async () => sync());

  app.post<{
    Body: { leafIndex?: number; commitment?: string; txSignature?: string };
  }>("/v1/deposits", async (req, reply) => {
    const { leafIndex, commitment, txSignature } = req.body ?? {};
    if (commitment === undefined || commitment === "") {
      return reply.code(400).send({ error: "commitment required" });
    }
    const hex = commitmentHex(String(commitment));
    const bytes = hexToBytes(hex);

    const onchain = await fetchCommitment(bytes);
    if (!onchain) {
      return reply.code(400).send({
        error: "Commitment not found on-chain — deposit first, then register",
      });
    }
    if (leafIndex !== undefined && Number(leafIndex) !== onchain.leafIndex) {
      return reply.code(400).send({
        error: `leafIndex mismatch: client=${leafIndex} on-chain=${onchain.leafIndex}`,
      });
    }
    if (commitmentHex(onchain.commitment) !== hex) {
      return reply.code(400).send({ error: "On-chain commitment bytes do not match" });
    }

    const saved = upsertDeposit({
      leafIndex: onchain.leafIndex,
      commitment: hex,
      txSignature,
      createdAt: new Date().toISOString(),
    });
    await rebuildRoots();
    return { deposit: saved, root: getCurrentRoot() };
  });

  app.get<{ Params: { leafIndex: string } }>(
    "/v1/merkle-path/:leafIndex",
    async (req, reply) => {
      const leafIndex = Number(req.params.leafIndex);
      if (!Number.isInteger(leafIndex) || leafIndex < 0) {
        return reply.code(400).send({ error: "Invalid leafIndex" });
      }
      try {
        if (!getDeposit(leafIndex)) {
          await sync();
        }
        const path = await merklePathFor(leafIndex);
        return {
          leafIndex,
          root: path.root.toString(),
          pathElements: path.pathElements.map((x) => x.toString()),
          pathIndices: path.pathIndices,
        };
      } catch (err: any) {
        return reply.code(404).send({ error: err?.message ?? "Unknown leafIndex" });
      }
    },
  );

  app.post<{
    Body: {
      recipient: string;
      proof: Groth16ProofPayload["proof"];
      publicSignals: string[];
      note?: string;
    };
  }>("/v1/withdraw", async (req, reply) => {
    try {
      if ((req.body as any)?.note) {
        req.log.warn("withdraw request included a Ghost Note; secrets are ignored and should stay client-side");
      }

      try {
        await sync();
      } catch (err: any) {
        req.log.warn({ err }, "syncFromChain failed; using cached tree");
        await rebuildRoots();
      }

      const { recipient, publicSignals } = validateWithdrawInput(req.body ?? {});

      const ok = await verify({
        proof: req.body.proof,
        publicSignals: req.body.publicSignals,
      });
      if (!ok) return reply.code(400).send({ error: "Invalid ZK proof" });

      const nullifierBytes = bigIntToBytes32(BigInt(publicSignals[1]));
      if (await spent(nullifierBytes)) {
        return reply.code(400).send({ error: "Nullifier already spent" });
      }

      const signature = await withdraw({
        nullifier: BigInt(publicSignals[1]),
        root: BigInt(publicSignals[0]),
        recipient,
      });

      return {
        signature,
        explorer: explorerTx(signature, cfg.cluster),
        recipient: recipient.toBase58(),
      };
    } catch (err: any) {
      const code = err?.statusCode === 400 ? 400 : 500;
      req.log.error(err);
      return reply.code(code).send({ error: err?.message ?? "withdraw failed" });
    }
  });

  return app;
}

function hexToBytes(hex: string): number[] {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out: number[] = [];
  for (let i = 0; i < 64; i += 2) out.push(parseInt(h.slice(i, i + 2), 16));
  return out;
}
