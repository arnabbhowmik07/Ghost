"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, ExternalLink } from "lucide-react";
import { PublicKey } from "@solana/web3.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AppWorkspace,
  RailBlock,
  StatusPill,
  WorkspacePanel,
  formatUsdcRaw,
} from "@/components/app-workspace";
import { useGhostWallet } from "@/hooks/useGhostWallet";
import {
  fetchGasConfig,
  fetchMintDecimals,
  sponsoredTransfer,
  toRawAmount,
  type GasConfig,
} from "@/lib/gas";
import {
  listGasNotes,
  updateGasNoteRemaining,
  type StoredGasNote,
} from "@/lib/gas-credits";
import { recordActivity } from "@/lib/activity";
import { fetchWalletTokens, type WalletToken } from "@/lib/token-balances";
import { shortAddr } from "@/lib/ghost";

const CUSTOM = "__custom__";

export default function SendPage() {
  const { publicKey, signTransaction, connected } = useGhostWallet();
  const [tokens, setTokens] = useState<WalletToken[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const [customMint, setCustomMint] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [gasNote, setGasNote] = useState("");
  const [showGas, setShowGas] = useState(false);
  const [busy, setBusy] = useState(false);
  const [gas, setGas] = useState<GasConfig | null>(null);
  const [notes, setNotes] = useState<StoredGasNote[]>([]);
  const [result, setResult] = useState<{
    signature: string;
    explorer: string;
    creditRemaining: string;
  } | null>(null);

  const activeToken = useMemo(() => {
    if (selected === CUSTOM) return null;
    return tokens.find((t) => t.mint === selected) ?? null;
  }, [selected, tokens]);

  const mint = selected === CUSTOM ? customMint.trim() : selected;

  const activeNote = useMemo(
    () => notes.find((n) => n.note === gasNote.trim()) ?? notes[0] ?? null,
    [notes, gasNote],
  );

  useEffect(() => {
    fetchGasConfig()
      .then(setGas)
      .catch(() => setGas(null));
    const stored = listGasNotes();
    setNotes(stored);
    if (stored[0]?.note) setGasNote(stored[0].note);
    else setShowGas(true);
  }, []);

  useEffect(() => {
    if (!publicKey) {
      setTokens([]);
      setSelected("");
      return;
    }
    let cancelled = false;
    setLoadingTokens(true);
    fetchWalletTokens(publicKey)
      .then((list) => {
        if (cancelled) return;
        setTokens(list);
        setSelected((prev) => {
          if (prev && (prev === CUSTOM || list.some((t) => t.mint === prev))) {
            return prev;
          }
          return list[0]?.mint ?? CUSTOM;
        });
      })
      .catch(() => {
        if (!cancelled) {
          setTokens([]);
          setSelected(CUSTOM);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingTokens(false);
      });
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  function setMax() {
    if (activeToken) setAmount(activeToken.uiAmount);
  }

  async function onSend() {
    if (!connected || !publicKey || !signTransaction) {
      toast.error("Connect a wallet first.");
      return;
    }
    if (!gasNote.trim()) {
      setShowGas(true);
      toast.error("Add a gas credit note so Ghost can pay the network fee.");
      return;
    }
    const recipient = to.trim();
    if (!recipient) {
      toast.error("Enter a recipient address.");
      return;
    }
    try {
      new PublicKey(recipient);
    } catch {
      toast.error("Recipient address looks invalid.");
      return;
    }
    if (!mint) {
      toast.error("Choose a token.");
      return;
    }
    try {
      new PublicKey(mint);
    } catch {
      toast.error("Token mint looks invalid.");
      return;
    }

    if (gas?.allowedMints && gas.allowedMints.length > 0) {
      if (!gas.allowedMints.includes(mint)) {
        toast.error("This token isn’t allowlisted on the relayer.");
        return;
      }
    }

    setBusy(true);
    setResult(null);
    try {
      if (gas && !gas.enabled) throw new Error("Ghost Gas is paused right now.");

      const dec = activeToken?.decimals ?? (await fetchMintDecimals(mint));
      const amountRaw = toRawAmount(amount, dec);
      if (amountRaw === "0") throw new Error("Enter an amount greater than zero");

      if (activeToken && BigInt(amountRaw) > BigInt(activeToken.amountRaw)) {
        throw new Error("Amount exceeds your balance");
      }

      const out = await sponsoredTransfer({
        from: publicKey.toBase58(),
        to: recipient,
        mint,
        amountRaw,
        gasNote: gasNote.trim(),
        signTransaction,
      });

      recordActivity({
        kind: "send",
        signature: out.signature,
        explorer: out.explorer,
        at: new Date().toISOString(),
        detail: `send ${amount} → ${shortAddr(recipient, 4)}`,
      });

      if (out.creditRemaining) {
        updateGasNoteRemaining(gasNote.trim(), out.creditRemaining);
        setNotes(listGasNotes());
      }
      setResult(out);
      setAmount("");
      toast.success("Sent");
      if (publicKey) {
        fetchWalletTokens(publicKey).then(setTokens).catch(() => undefined);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const creditOk = Boolean(gasNote.trim());

  return (
    <AppWorkspace
      title="Send"
      description="Sign the transfer. Ghost pays the network fee from your prepaid credit. The signing wallet can hold zero SOL. If the network stamp expires, Ghost refreshes it and asks you to approve again (up to 5 minutes)."
      actions={
        <>
          <StatusPill tone={creditOk ? "ok" : "warn"}>
            {creditOk ? "Credit attached" : "Credit needed"}
          </StatusPill>
          {!connected ? (
            <StatusPill tone="warn">Wallet disconnected</StatusPill>
          ) : null}
        </>
      }
      rail={
        <>
          <RailBlock title="Gas credit">
            {activeNote ? (
              <div className="space-y-2">
                <p className="text-[22px] tracking-[-0.03em] text-ink">
                  {formatUsdcRaw(activeNote.remaining ?? activeNote.initialAmount)}{" "}
                  <span className="text-[13px] text-ink/50">USDC left</span>
                </p>
                <p className="font-mono text-[11px] text-ink/45">
                  {shortAddr(activeNote.commitment, 6)}
                </p>
                <Link
                  href="/app/credits"
                  className="inline-block text-ink underline underline-offset-2"
                >
                  Manage credits
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                <p>No credit note in this browser yet.</p>
                <Link
                  href="/app/credits"
                  className="inline-block text-ink underline underline-offset-2"
                >
                  Buy gas credit
                </Link>
              </div>
            )}
          </RailBlock>

          <RailBlock title="How it works">
            <ol className="list-decimal space-y-2 pl-4">
              <li>Fund credit once from your main wallet.</li>
              <li>Paste the note here (or keep the saved one).</li>
              <li>Send any token. You only sign.</li>
            </ol>
          </RailBlock>

          {result ? (
            <RailBlock title="Last send">
              <a
                href={result.explorer}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-ink underline underline-offset-2"
                data-testid="gas-send-result"
              >
                View on explorer
                <ExternalLink className="size-3.5" />
              </a>
              <p className="mt-2 font-mono text-[11px] break-all text-ink/45">
                {result.signature}
              </p>
              {result.creditRemaining ? (
                <p className="mt-2">
                  Credit left {formatUsdcRaw(result.creditRemaining)} USDC
                </p>
              ) : null}
            </RailBlock>
          ) : null}
        </>
      }
    >
      <WorkspacePanel>
        <div className="space-y-6">
          <div>
            <Label htmlFor="to">Recipient</Label>
            <Input
              id="to"
              className="mt-2 h-12 rounded-none border-ink/15 bg-cream font-mono text-sm"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="Solana address"
              autoComplete="off"
              data-testid="send-to"
            />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="token">Asset</Label>
                {loadingTokens ? (
                  <span className="text-[12px] text-ink/45">Loading…</span>
                ) : null}
              </div>
              <select
                id="token"
                className="mt-2 h-12 w-full border border-ink/15 bg-cream px-3 text-[15px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink/20"
                value={selected || CUSTOM}
                onChange={(e) => setSelected(e.target.value)}
                data-testid="send-token"
              >
                {tokens.length === 0 ? (
                  <option value={CUSTOM}>No tokens found; paste mint</option>
                ) : null}
                {tokens.map((t) => (
                  <option key={t.mint} value={t.mint}>
                    {t.label} · {t.uiAmount}
                  </option>
                ))}
                <option value={CUSTOM}>Other token (paste mint)…</option>
              </select>
              {selected === CUSTOM ? (
                <Input
                  className="mt-2 h-11 rounded-none border-ink/15 bg-cream font-mono text-xs"
                  value={customMint}
                  onChange={(e) => setCustomMint(e.target.value)}
                  placeholder="Token mint address"
                  data-testid="send-custom-mint"
                />
              ) : null}
              {activeToken ? (
                <p className="mt-2 text-[12px] text-ink/50">
                  Available {activeToken.uiAmount}
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

            <div>
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                className="mt-2 h-12 rounded-none border-ink/15 bg-cream text-[22px] tracking-[-0.02em]"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                data-testid="send-amount"
              />
            </div>
          </div>

          <div className="border border-ink/10 bg-sand/40 px-4 py-3">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left text-[13px] text-ink/75"
              onClick={() => setShowGas((v) => !v)}
            >
              <span className="inline-flex items-center gap-2">
                {creditOk ? (
                  <Check className="size-3.5 text-ink" aria-hidden />
                ) : null}
                {creditOk ? "Gas credit attached" : "Attach gas credit"}
              </span>
              <span className="text-ink/45">{showGas ? "Hide" : "Edit"}</span>
            </button>
            {showGas ? (
              <div className="mt-3 space-y-2">
                <Textarea
                  className="rounded-none border-ink/15 bg-paper font-mono text-[11px]"
                  placeholder="ghost-gas:v1:… (from Credits)"
                  value={gasNote}
                  onChange={(e) => setGasNote(e.target.value)}
                  rows={3}
                />
                {notes.length > 1 ? (
                  <select
                    className="h-10 w-full border border-ink/15 bg-paper px-3 text-[12px] outline-none"
                    value={gasNote}
                    onChange={(e) => setGasNote(e.target.value)}
                  >
                    {notes.map((n) => (
                      <option key={n.commitment} value={n.note}>
                        {formatUsdcRaw(n.remaining ?? n.initialAmount)} USDC ·{" "}
                        {shortAddr(n.commitment, 4)}
                      </option>
                    ))}
                  </select>
                ) : null}
                <p className="text-[12px] text-ink/50">
                  Top up on{" "}
                  <Link href="/app/credits" className="underline">
                    Credits
                  </Link>
                  , then keep the note here.
                </p>
              </div>
            ) : null}
          </div>

          <Button
            size="pill"
            className="h-12 w-full text-[17px] sm:w-auto sm:min-w-[200px]"
            disabled={busy || !connected}
            onClick={onSend}
            data-testid="gas-send-submit"
          >
            {busy ? "Sending…" : "Send"}
          </Button>
        </div>
      </WorkspacePanel>

      {!connected ? (
        <p className="text-[14px] font-normal text-ink/50">
          Connect a wallet from the sidebar to load balances and sign.
        </p>
      ) : null}
    </AppWorkspace>
  );
}
