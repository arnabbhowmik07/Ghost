"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AppWorkspace,
  RailBlock,
  StatusPill,
  WorkspacePanel,
  formatUsdcRaw,
} from "@/components/app-workspace";
import { useGhostWallet } from "@/hooks/useGhostWallet";
import {
  GasCreditDepositPendingError,
  NATIVE_SOL,
  fetchGasNoteBalance,
  listGasNotes,
  listUnregisteredGasNotes,
  pruneAbandonedGasNotes,
  quoteGasCredit,
  retryGasNoteRegistration,
  topUpGasCredits,
  type CreditQuote,
  type StoredGasNote,
} from "@/lib/gas-credits";
import { fetchGasConfig, toRawAmount, type GasConfig } from "@/lib/gas";
import {
  fetchWalletAssets,
  type WalletToken,
} from "@/lib/token-balances";
import { shortAddr } from "@/lib/ghost";

export default function CreditsPage() {
  const { publicKey, signTransaction, connected } = useGhostWallet();
  const [amount, setAmount] = useState("1");
  const [busy, setBusy] = useState(false);
  const [gas, setGas] = useState<GasConfig | null>(null);
  const [notes, setNotes] = useState<StoredGasNote[]>([]);
  const [lastNote, setLastNote] = useState("");
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [assets, setAssets] = useState<WalletToken[]>([]);
  const [selectedMint, setSelectedMint] = useState<string>("");
  const [quote, setQuote] = useState<CreditQuote | null>(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  /** Deposits that may be on-chain but have no credit yet (persisted). */
  const [unregistered, setUnregistered] = useState<StoredGasNote[]>([]);
  const [retrying, setRetrying] = useState<string | null>(null);

  function refresh() {
    setNotes(listGasNotes());
    setUnregistered(listUnregisteredGasNotes());
  }

  async function retryRegistration(note: string, quiet = false) {
    setRetrying(note);
    try {
      const out = await retryGasNoteRegistration(note);
      if (!quiet) {
        toast[out ? "success" : "message"](
          out
            ? "Credit registered."
            : "That deposit never landed on-chain, so nothing was spent. Note removed.",
        );
      }
    } catch (e: unknown) {
      if (!quiet) toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setRetrying(null);
      refresh();
    }
  }

  useEffect(() => {
    pruneAbandonedGasNotes();
    refresh();
    // Resume any top-up that was interrupted (closed tab, relayer outage).
    void (async () => {
      for (const n of listUnregisteredGasNotes()) {
        if (n.status === "sent") await retryRegistration(n.note, true);
      }
    })();
    fetchGasConfig()
      .then(setGas)
      .catch(() => setGas(null));
  }, []);

  useEffect(() => {
    if (!publicKey) {
      setAssets([]);
      setSelectedMint("");
      return;
    }
    let cancelled = false;
    fetchWalletAssets(publicKey)
      .then((list) => {
        if (cancelled) return;
        const allow = gas?.creditDepositMints;
        const filtered =
          allow && allow.length
            ? list.filter(
                (a) =>
                  allow.includes(a.mint) ||
                  (a.mint === NATIVE_SOL && allow.includes("native")),
              )
            : list;
        setAssets(filtered.length ? filtered : list);
        setSelectedMint((prev) => {
          const pool = filtered.length ? filtered : list;
          if (prev && pool.some((a) => a.mint === prev)) return prev;
          const usdc = gas?.usdcMint;
          const prefer =
            (usdc && pool.find((a) => a.mint === usdc)) ||
            pool.find((a) => a.mint === NATIVE_SOL) ||
            pool[0];
          return prefer?.mint ?? NATIVE_SOL;
        });
      })
      .catch(() => {
        if (!cancelled) setAssets([]);
      });
    return () => {
      cancelled = true;
    };
  }, [publicKey, gas?.usdcMint]);

  const activeAsset = useMemo(
    () => assets.find((a) => a.mint === selectedMint) ?? null,
    [assets, selectedMint],
  );

  useEffect(() => {
    if (!activeAsset || !amount.trim()) {
      setQuote(null);
      setQuoteError("");
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(() => {
      setQuoteBusy(true);
      setQuoteError("");
      const raw = toRawAmount(amount, activeAsset.decimals);
      if (raw === "0") {
        setQuote(null);
        setQuoteBusy(false);
        return;
      }
      quoteGasCredit({ mint: activeAsset.mint, amountRaw: raw })
        .then((q) => {
          if (!cancelled) setQuote(q);
        })
        .catch((e: unknown) => {
          if (!cancelled) {
            setQuote(null);
            setQuoteError(e instanceof Error ? e.message : String(e));
          }
        })
        .finally(() => {
          if (!cancelled) setQuoteBusy(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [activeAsset, amount]);

  const totalRemaining = useMemo(() => {
    let sum = 0n;
    let known = false;
    for (const n of notes) {
      if (n.remaining != null && /^\d+$/.test(n.remaining)) {
        sum += BigInt(n.remaining);
        known = true;
      }
    }
    return known ? sum.toString() : null;
  }, [notes]);

  const feeUi =
    gas?.creditFeeRaw != null
      ? (Number(gas.creditFeeRaw) / 1_000_000).toFixed(2)
      : "-";

  const estimatedSends =
    totalRemaining != null && gas?.creditFeeRaw
      ? Math.floor(Number(totalRemaining) / Number(gas.creditFeeRaw))
      : null;

  async function onTopUp() {
    if (!connected || !publicKey || !signTransaction) {
      toast.error("Connect a funded wallet to top up gas credits.");
      return;
    }
    if (!activeAsset) {
      toast.error("Choose an asset to deposit.");
      return;
    }
    setBusy(true);
    try {
      toast.message(`Depositing ${activeAsset.label} for gas credit…`);
      const stored = await topUpGasCredits({
        uiAmount: amount,
        mint: activeAsset.mint,
        decimals: activeAsset.decimals,
        tokenProgramId:
          activeAsset.programId === "native"
            ? undefined
            : activeAsset.programId,
        publicKey,
        signTransaction,
      });
      setLastNote(stored.note);
      refresh();
      toast.success("Credit funded. Save the note; Send needs it.");
      if (publicKey) {
        fetchWalletAssets(publicKey).then(setAssets).catch(() => undefined);
      }
    } catch (e: unknown) {
      if (e instanceof GasCreditDepositPendingError) {
        toast.error(
          "Deposit sent, but the credit is not registered yet. Your note is saved below. Retry registration.",
        );
      } else {
        toast.error(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setBusy(false);
      refresh();
    }
  }

  async function refreshBalance(note: string) {
    setRefreshing(note);
    try {
      const bal = await fetchGasNoteBalance(note);
      setNotes((prev) =>
        prev.map((n) => (n.note === note ? { ...n, remaining: bal.remaining } : n)),
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(null);
    }
  }

  async function copyNote(note: string) {
    await navigator.clipboard.writeText(note);
    toast.success("Gas note copied");
  }

  function setMax() {
    if (activeAsset) setAmount(activeAsset.uiAmount);
  }

  const multi = gas?.multiAsset !== false;

  return (
    <AppWorkspace
      title="Credits"
      description={
        multi
          ? "Deposit an allowlisted asset (USDC, SOL, and approved stables). Ghost prices non-USDC deposits from live liquidity and issues dollar credit."
          : "Prepay USDC once. Any wallet with the note can send tokens while Ghost covers network fees."
      }
      actions={
        <>
          <StatusPill tone={notes.length ? "ok" : "warn"}>
            {notes.length
              ? `${notes.length} note${notes.length === 1 ? "" : "s"} saved`
              : "No notes yet"}
          </StatusPill>
          <StatusPill tone="neutral">{feeUi} USDC / send</StatusPill>
        </>
      }
      rail={
        <>
          <RailBlock title="Balance in this browser">
            <p className="text-[28px] tracking-[-0.03em] text-ink">
              {formatUsdcRaw(totalRemaining)}{" "}
              <span className="text-[13px] text-ink/50">USDC credit</span>
            </p>
            {estimatedSends != null ? (
              <p className="mt-2">~{estimatedSends} sponsored sends left</p>
            ) : (
              <p className="mt-2">Refresh a note to see remaining credit.</p>
            )}
          </RailBlock>

          <RailBlock title="Pricing">
            <ul className="space-y-2">
              <li>Credits are always tracked in USDC dollars.</li>
              <li>
                Non-USDC deposits use live Jupiter liquidity (with a small
                haircut).
              </li>
              <li>Only allowlisted assets are accepted (no random tokens).</li>
            </ul>
          </RailBlock>

          <RailBlock title="Next">
            After funding, open{" "}
            <Link href="/app/send" className="underline underline-offset-2">
              Send
            </Link>{" "}
            and attach the note.
          </RailBlock>
        </>
      }
    >
      {unregistered.length ? (
        <WorkspacePanel className="border-ink/20 bg-sand/50">
          <p className="text-[15px] text-ink">Deposits waiting for credit</p>
          <p className="mt-2 text-[13px] font-normal leading-relaxed text-ink/70">
            These notes are saved in this browser. If the deposit landed on-chain,
            retrying registers the credit. If it never landed, the note is removed
            and nothing was spent. Still stuck? Email{" "}
            <a
              href="mailto:support@ghostlabshq.xyz"
              className="underline underline-offset-2"
            >
              support@ghostlabshq.xyz
            </a>{" "}
            with the transaction.
          </p>
          <ul className="mt-4 divide-y divide-ink/10 border border-ink/12 bg-paper">
            {unregistered.map((n) => (
              <li
                key={n.commitment}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                data-testid="gas-note-unregistered"
              >
                <div className="min-w-0">
                  <p className="text-[14px] text-ink">
                    {formatUsdcRaw(n.initialAmount)} USDC credit ·{" "}
                    {n.status === "sent" ? "deposit sent" : "awaiting signature"}
                  </p>
                  {n.depositTx ? (
                    <p className="mt-1 truncate font-mono text-[11px] text-ink/45">
                      Tx {n.depositTx}
                    </p>
                  ) : null}
                  {n.lastError ? (
                    <p className="mt-1 text-[12px] text-ink/60">{n.lastError}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => copyNote(n.note)}
                  >
                    <Copy className="size-3.5" />
                    Copy
                  </Button>
                  {n.status === "sent" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={retrying === n.note}
                      onClick={() => retryRegistration(n.note)}
                    >
                      <RefreshCw
                        className={`size-3.5 ${retrying === n.note ? "animate-spin" : ""}`}
                      />
                      Retry registration
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </WorkspacePanel>
      ) : null}

      <WorkspacePanel>
        <div className="space-y-5">
          <div>
            <Label htmlFor="credit-asset">Deposit asset</Label>
            <select
              id="credit-asset"
              className="mt-2 h-12 w-full border border-ink/15 bg-cream px-3 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ink/20"
              value={selectedMint}
              onChange={(e) => setSelectedMint(e.target.value)}
              disabled={!connected}
            >
              {!connected ? (
                <option value="">Connect wallet to load balances</option>
              ) : assets.length === 0 ? (
                <option value={NATIVE_SOL}>SOL</option>
              ) : (
                assets.map((a) => (
                  <option key={a.mint} value={a.mint}>
                    {a.label} · {a.uiAmount}
                  </option>
                ))
              )}
            </select>
            {activeAsset ? (
              <p className="mt-2 text-[12px] text-ink/50">
                Available {activeAsset.uiAmount}
                <button
                  type="button"
                  className="ml-3 underline underline-offset-2"
                  onClick={setMax}
                >
                  Max
                </button>
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <Label htmlFor="credit-amount">Amount</Label>
              <div className="relative mt-2 max-w-xs">
                <Input
                  id="credit-amount"
                  className="h-12 rounded-none border-ink/15 bg-cream pr-16 text-[20px] tracking-[-0.02em]"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-ink/45">
                  {activeAsset?.label ?? "…"}
                </span>
              </div>
            </div>
            <Button
              size="pill"
              className="h-12 w-full shrink-0 text-[16px] sm:w-auto sm:min-w-[180px]"
              disabled={busy || !connected || !quote || !!quoteError}
              onClick={onTopUp}
              data-testid="gas-credit-topup"
            >
              {busy ? "Confirm in wallet…" : "Buy credit"}
            </Button>
          </div>

          <div className="border border-ink/10 bg-sand/40 px-4 py-3 text-[13px]">
            {quoteBusy ? (
              <p className="text-ink/55">Fetching live USD quote…</p>
            ) : quoteError ? (
              <p className="text-ink/70">{quoteError}</p>
            ) : quote ? (
              <p className="text-ink">
                ≈ <span className="text-[18px] tracking-[-0.02em]">{quote.creditUi}</span>{" "}
                USDC credit
                {quote.haircutBps > 0 ? (
                  <span className="text-ink/50">
                    {" "}
                    (after {quote.haircutBps / 100}% buffer)
                  </span>
                ) : null}
                <span className="mt-1 block text-[12px] text-ink/45">
                  via {quote.routeLabel}
                </span>
              </p>
            ) : (
              <p className="text-ink/50">Enter an amount to see dollar credit.</p>
            )}
          </div>
        </div>
        {!connected ? (
          <p className="mt-4 text-[13px] font-normal text-ink/50">
            Connect the wallet that holds the asset you want to deposit.
          </p>
        ) : null}
      </WorkspacePanel>

      {lastNote ? (
        <WorkspacePanel className="bg-sun/40">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[15px] text-ink">New credit note</p>
              <p className="mt-2 break-all font-mono text-[11px] leading-relaxed text-ink/70">
                {lastNote}
              </p>
              <p className="mt-3 text-[13px] font-normal text-ink/55">
                Treat this like a bearer voucher. Anyone with the note can spend the
                credit.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 gap-2"
              onClick={() => copyNote(lastNote)}
            >
              <Copy className="size-3.5" />
              Copy
            </Button>
          </div>
        </WorkspacePanel>
      ) : null}

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] text-ink">Saved notes</h2>
          <span className="text-[12px] text-ink/45">Stored in this browser only</span>
        </div>

        {notes.length === 0 ? (
          <div className="border border-dashed border-ink/20 bg-paper/60 px-5 py-10 text-center">
            <p className="text-[15px] text-ink">No credits yet</p>
            <p className="mt-2 text-[13px] font-normal text-ink/50">
              Buy a credit above. The note appears here and on Send.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-ink/10 border border-ink/12 bg-paper">
            {notes.map((n) => (
              <li
                key={n.commitment}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div className="min-w-0">
                  <p className="text-[18px] tracking-[-0.02em] text-ink">
                    {formatUsdcRaw(n.remaining ?? n.initialAmount)}{" "}
                    <span className="text-[12px] text-ink/45">
                      / {formatUsdcRaw(n.initialAmount)} USDC
                    </span>
                  </p>
                  <p className="mt-1 truncate font-mono text-[11px] text-ink/40">
                    {shortAddr(n.commitment, 8)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => copyNote(n.note)}
                  >
                    <Copy className="size-3.5" />
                    Copy
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={refreshing === n.note}
                    onClick={() => refreshBalance(n.note)}
                  >
                    <RefreshCw
                      className={`size-3.5 ${refreshing === n.note ? "animate-spin" : ""}`}
                    />
                    Refresh
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppWorkspace>
  );
}
