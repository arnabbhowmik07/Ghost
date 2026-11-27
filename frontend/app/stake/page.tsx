import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { TurnArrow } from "@/components/landing/marks";
import { SiteFooter } from "@/components/site-footer";
import { StakeFaq } from "@/components/stake/stake-faq";
import { StakePanel } from "@/components/stake/stake-panel";
import { LINKS } from "@/lib/links";
import {
  DEXSCREENER_PAIR,
  STAKING_ENABLED,
  TOKEN_SYMBOL,
  dexscreenerEmbedUrl,
} from "@/src/config/site";

export const metadata: Metadata = {
  title: `Stake ${TOKEN_SYMBOL}`,
  description: `Stake ${TOKEN_SYMBOL} to earn a share of Ghost protocol fees. Opens at token launch.`,
};

const stats = [
  { label: "APY", value: "-" },
  { label: "Total Staked", value: "-" },
  { label: "Your Stake", value: "-" },
  { label: "Rewards Earned", value: "-" },
] as const;

const steps = [
  {
    title: `Stake ${TOKEN_SYMBOL}`,
    body: "Lock tokens into the staking desk when TGE goes live. Your position shows here.",
  },
  {
    title: "Earn fee share",
    body: "A share of the ~1% protocol fees is allocated to stakers from real product volume.",
  },
  {
    title: "Rewards from treasury",
    body: "Rewards stream from the Ghost treasury - not from opaque inflation by default.",
  },
  {
    title: "Unstake on your terms",
    body: "Unstake anytime or after a short cooldown once contracts publish the final rule.",
  },
] as const;

export default function StakePage() {
  const chartUrl = dexscreenerEmbedUrl(DEXSCREENER_PAIR);

  return (
    <div className="landing-root min-h-screen bg-cream text-ink">
      <a id="top" />
      <Nav />

      <main>
        <header className="gutter border-b border-ink/10 bg-paper pb-16 pt-28 md:pb-20 md:pt-36">
          <div className="flex flex-wrap items-center gap-3">
            <p className="tag">Token</p>
            <span className="border border-ink/15 bg-sun px-3 py-1 text-[12px] tracking-[-0.01em] text-ink">
              {STAKING_ENABLED
                ? "Staking live"
                : "Staking opens at token launch"}
            </span>
          </div>
          <h1 className="t-56 mt-6 max-w-[12ch]">Stake {TOKEN_SYMBOL}</h1>
          <p className="t-20 mt-5 max-w-[40ch] font-normal leading-[1.45] text-ink/65">
            Earn a share of Ghost protocol fees when the token launches.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href={LINKS.login}
              className="group inline-flex items-center gap-[10px] bg-ink px-[18px] py-[13px] text-[17px] leading-none tracking-[-0.01em] text-cream"
            >
              Open app
              <TurnArrow className="h-[14px] w-[14px] transition-transform group-hover:translate-x-[3px]" />
            </Link>
            <Link
              href="/#how"
              className="inline-flex items-center border border-ink/20 bg-transparent px-[18px] py-[13px] text-[17px] leading-none tracking-[-0.01em] text-ink"
            >
              How Ghost Gas works
            </Link>
          </div>
          <p className="t-14 mt-4 max-w-[40ch] font-normal text-ink/50">
            Early mainnet pilot. Small limits per transaction.
          </p>
        </header>

        <section className="gutter border-b border-ink/10 py-10 md:py-12">
          <div className="grid gap-px bg-ink/10 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="bg-cream px-5 py-6 md:px-6">
                <p className="t-14 text-ink/50">{s.label}</p>
                <p className="t-28 mt-3 tabular-nums">{s.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="gutter grid gap-8 py-14 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] md:py-20">
          <div>
            <p className="tag">Position</p>
            <h2 className="t-48 mt-5 max-w-[14ch]">Stake desk</h2>
            <p className="t-16 mt-5 max-w-[42ch] font-normal leading-[1.5] text-ink/65">
              Connect a wallet after TGE to stake or unstake {TOKEN_SYMBOL}. No
              contracts are called from this page until staking is enabled in
              config.
            </p>
          </div>
          <StakePanel />
        </section>

        <section className="border-y border-ink/10 bg-paper">
          <div className="gutter py-16 md:py-20">
            <p className="tag">Flow</p>
            <h2 className="t-48 mt-5">How staking works</h2>
            <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {steps.map((step, i) => (
                <article
                  key={step.title}
                  className="border border-ink/15 bg-cream p-5 md:p-6"
                >
                  <p className="font-mono text-[12px] tracking-[0.08em] text-ink/40">
                    {String(i + 1).padStart(2, "0")}
                  </p>
                  <h3 className="t-20 mt-4">{step.title}</h3>
                  <p className="t-14 mt-3 font-normal leading-[1.5] text-ink/60">
                    {step.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {chartUrl ? (
          <section className="gutter py-16 md:py-20">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="tag">Market</p>
                <h2 className="t-48 mt-5">Chart</h2>
              </div>
              <a
                href={`https://dexscreener.com/solana/${DEXSCREENER_PAIR}`}
                target="_blank"
                rel="noreferrer"
                className="t-14 text-ink/55 underline-offset-2 hover:text-ink hover:underline"
              >
                Open on DexScreener
              </a>
            </div>
            <div className="mt-8 overflow-hidden border border-ink/15 bg-coal">
              <iframe
                title={`${TOKEN_SYMBOL} DexScreener chart`}
                src={chartUrl}
                className="h-[420px] w-full md:h-[520px]"
                allow="clipboard-write"
                loading="lazy"
              />
            </div>
          </section>
        ) : null}

        <section className="gutter border-t border-ink/10 py-16 md:py-20">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div>
              <p className="tag">FAQ</p>
              <h2 className="t-48 mt-5">Questions</h2>
              <p className="t-16 mt-5 max-w-[36ch] font-normal leading-[1.5] text-ink/65">
                Short answers on fees, treasury, timing, and risk before TGE.
              </p>
            </div>
            <StakeFaq />
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
