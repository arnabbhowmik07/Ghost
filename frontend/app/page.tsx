import { Nav } from "@/components/landing/Nav";
import { Reveal } from "@/components/landing/Reveal";
import { FlowDiagram } from "@/components/landing/FlowDiagram";
import { Cases, Faq, HowPanel, type Case } from "@/components/landing/Interactive";
import { ReceiptArt } from "@/components/landing/LineArt";
import { SchCompliance, SchGasless } from "@/components/landing/Schematics";
import { PrivacyStat } from "@/components/landing/PrivacyStat";
import { FigProof, FigTree } from "@/components/landing/Figures";
import { TurnArrow } from "@/components/landing/marks";
import { BuiltWithLogos } from "@/components/landing/BuiltWithLogos";
import {
  APP_URL,
  contracts,
  explorerAddress,
  explorerTx,
  transactions,
} from "@/lib/landing-site";
import { SiteFooter } from "@/components/site-footer";
import { SITE_FAQS } from "@/lib/aeo";

const pillars = [
  {
    title: "Prepaid",
    sub: ["Fund once.", "Spend many times."],
    body: "X1 tops up USDC into Ghost and gets a gas note. That credit pays network fees later - without ever sending SOL to the signing wallet.",
    bg: "#625e5f",
    kind: "lock" as const,
  },
  {
    title: "Gasless",
    sub: ["Zero SOL.", "Just a signature."],
    body: "X2 signs the token transfer. Ghost’s relayer is the fee payer, debits the note a flat USDC fee, and the recipient gets the tokens.",
    bg: "#3f3d3e",
    kind: "diode" as const,
  },
  {
    title: "Private rail",
    sub: ["Optional", "Shield pool."],
    body: "Ghost Shield remains available for fixed-denomination private USDC when you need unlinkability. Gas is the product you use every day.",
    bg: "#252324",
    kind: "switch" as const,
  },
];

const steps = [
  {
    title: ["Top up", "gas credit"],
    body: "From a funded wallet, deposit USDC (or an allowlisted asset). Ghost issues a gas note you can save or share.",
    icon: <circle cx="12" cy="12" r="9" />,
  },
  {
    title: ["Attach the", "note on Send"],
    body: "X2 pastes the note (or uses the one saved in this browser). No SOL required on that wallet.",
    icon: (
      <>
        <circle cx="12" cy="12" r="5" />
        <path d="M12 1v4M12 19v4M1 12h4M19 12h4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M4.2 19.8L7 17M17 7l2.8-2.8" />
      </>
    ),
  },
  {
    title: ["Sign.", "Ghost pays gas."],
    body: "You sign the SPL transfer. Ghost fronts SOL, the tokens move, and a small fee is debited from the note.",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M6 6l12 12M18 6L6 18" />
      </>
    ),
  },
];

const short = (h: string) => `${h.slice(0, 6)}…${h.slice(-4)}`;

const cases: Case[] = [
  {
    title: "A deposit issued a private Ghost Note",
    kind: "tx",
    label: "1 USDC",
    caption: "deposit · note issued",
    meta: [
      ["Type", "Deposit"],
      ["Network", "Solana"],
      ["Amount", "1 USDC"],
    ],
    body: "The depositor sent exactly one USDC into the pool. Ghost stored a Poseidon commitment on-chain and returned a note that never leaves the browser.",
    href: explorerTx(transactions[0].hash),
  },
  {
    title: "A withdraw with zero SOL from the recipient",
    kind: "tx",
    label: "Gasless",
    caption: "withdraw · relayer paid",
    meta: [
      ["Type", "Withdraw"],
      ["Network", "Solana"],
      ["Recipient SOL", "0"],
    ],
    body: "The relayer verified the Groth16 proof off-chain, paid Solana fees, and delivered USDC to a fresh address that held zero SOL.",
    href: explorerTx(transactions[1].hash),
  },
  {
    title: "The program that holds every deposit",
    kind: "contract",
    label: "ghost_pool",
    caption: "deployed program",
    meta: [
      ["Program", short(contracts[0].address)],
      ["Network", "Solana"],
      ["Status", "Live"],
    ],
    body: "Every deposit lands here as an anonymous fingerprint. The more deposits it holds, the harder it is for anyone to link a withdrawal to a depositor.",
    href: explorerAddress(contracts[0].address),
  },
  {
    title: "The pool account that tracks commitments",
    kind: "contract",
    label: "Pool PDA",
    caption: "on-chain config",
    meta: [
      ["Account", short(contracts[1].address)],
      ["Network", "Solana"],
      ["Role", "Config + index"],
    ],
    body: "The pool PDA tracks the next leaf index, denomination, fee bps, and the designated relayer that may call withdraw.",
    href: explorerAddress(contracts[1].address),
  },
  {
    title: "The relayer that pays fees for you",
    kind: "contract",
    label: "Relayer",
    caption: "fee payer + ZK gate",
    meta: [
      ["Pubkey", short(contracts[3].address)],
      ["Network", "Solana"],
      ["Role", "Fee payer"],
    ],
    body: "Before it submits withdraw, the relayer checks the proof and Merkle root off-chain. Then it fronts SOL and skims a small USDC fee from the vault.",
    href: explorerAddress(contracts[3].address),
  },
];

const faqs = SITE_FAQS;

export default function Home() {
  return (
    <div id="top" className="landing-root">
      <Nav />

      <div className="md:flex md:h-[100svh] md:min-h-[540px] md:flex-col">
        <header className="gutter bg-paper pb-[56px] pt-[150px] md:shrink-0 md:pb-[clamp(28px,7vh,72px)] md:pt-[clamp(96px,16vh,150px)]">
          <div className="grid items-end gap-8 md:grid-cols-[1fr_minmax(0,584px)] md:gap-10">
            <h1 className="t-68">
              <span className="mask">
                <span>Gas, prepaid.</span>
              </span>
            </h1>
            <p className="t-24 max-w-[584px]">
              Fund credit once. Any wallet can send tokens with zero SOL. Ghost pays the network
              fee and debits the note - no SOL handoff that leaks who bankrolled whom.
            </p>
          </div>
        </header>

        <section className="gutter bg-night text-cream md:min-h-0 md:flex-1">
          <div className="grid md:h-full md:grid-cols-[316px_1fr]">
            <div className="flex flex-col justify-between gap-12 pb-10 pt-[66px] md:gap-6 md:pb-[clamp(20px,6vh,68px)] md:pr-10 md:pt-[clamp(24px,6vh,66px)]">
              <p className="t-16 max-w-[240px]">
                Your prepaid,
                <br />
                gasless send rail
              </p>
              <ul className="max-w-[276px]">
                {[
                  "0 SOL on the signing wallet",
                  "Top up once, send many times",
                  "Fees settled in USDC credit",
                  "Live on Solana",
                ].map((t) => (
                  <li
                    key={t}
                    className="t-14 border-t border-cream/20 py-[14px] md:py-[clamp(8px,1.5vh,14px)]"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="-mx-5 overflow-x-auto px-5 pb-12 md:relative md:mx-0 md:min-h-0 md:overflow-visible md:p-0">
              <div className="md:absolute md:inset-0 md:py-[clamp(16px,5vh,56px)]">
                <FlowDiagram className="h-auto w-full min-w-[760px] md:h-full md:min-w-0" />
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="gutter border-b border-ink/10 bg-cream py-[72px] md:py-[96px]">
        <div className="grid gap-10 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-16 md:items-start">
          <Reveal>
            <h2 className="t-48 max-w-[16ch]">How Ghost Gas works</h2>
            <p className="t-16 mt-5 max-w-[36ch] font-normal leading-[1.5] text-ink/65">
              In plain terms: one wallet pays for gas ahead of time. Another wallet can send
              tokens without holding any SOL.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <ol className="border-t border-ink/15">
              {[
                {
                  title: "Primary wallet tops up",
                  body: "Your funded wallet sends USDC to Ghost and gets a gas note back. That note is prepaid credit for network fees.",
                },
                {
                  title: "Alt wallet only signs",
                  body: "A second wallet (often with zero SOL) pastes the note, picks a token and recipient, and signs the transfer.",
                },
                {
                  title: "Ghost pays the network fee",
                  body: "Ghost covers the SOL fee on-chain, the tokens move from the alt wallet to the recipient, and a small fee comes out of the gas note.",
                },
              ].map((step, i) => (
                <li
                  key={step.title}
                  className="grid grid-cols-[48px_1fr] gap-4 border-b border-ink/15 py-6 md:gap-6"
                >
                  <span className="font-mono text-[12px] tracking-[0.06em] text-ink/45">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="t-20">{step.title}</p>
                    <p className="t-14 mt-2 max-w-[52ch] font-normal leading-[1.5] text-ink/60">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>

      <section className="bg-sand">
        <div className="gutter">
          <div className="flex flex-wrap items-center gap-x-10 gap-y-6 border-b border-ink/15 py-[60px]">
            <p className="t-14 w-[200px] md:border-r md:border-ink/15 md:pr-10">
              Built on the standards serious teams already trust
            </p>
            <BuiltWithLogos />
          </div>

          <div className="grid gap-12 pb-[80px] pt-[110px] md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:gap-10">
            <div className="flex flex-col justify-between gap-12">
              <span className="tag text-ink">Also built</span>
              <Reveal>
                <h2 className="t-56">
                  Shield when
                  <br />
                  you need unlinkable.
                </h2>
                <p className="t-16 mt-6 max-w-[400px] font-normal leading-[1.5] text-ink/70">
                  Ghost Gas is the daily product. Ghost Shield is the optional private pool: a
                  Merkle tree hides which deposit is yours, and a proof shows a withdraw is valid
                  without saying more.
                </p>
                <ol className="mt-10 max-w-[400px]">
                  {[
                    ["01", "Hide which deposit is yours", "Commitment tree"],
                    ["02", "Prove it without revealing it", "Groth16 proof"],
                  ].map(([n, t, f]) => (
                    <li
                      key={n}
                      className="t-14 grid grid-cols-[36px_1fr_auto] items-baseline gap-2 border-t border-ink/15 py-[14px] last:border-b"
                    >
                      <span className="font-mono text-[11px] text-ink/50">{n}</span>
                      <span>{t}</span>
                      <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink/50">
                        Fig. {n}
                        <span className="sr-only"> · {f}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </Reveal>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Reveal className="aspect-[360/468]">
                <FigTree />
              </Reveal>
              <Reveal delay={120} className="aspect-[360/468]">
                <FigProof />
              </Reveal>
            </div>
          </div>

          <div className="grid gap-6 border-t border-ink/15 pb-[140px] pt-10 md:grid-cols-2 md:gap-10">
            <span className="tag self-start text-ink md:mt-[12px]">The Ghost difference</span>
            <Reveal>
              <p className="t-32 max-w-[640px]">
                Prepaid credit means X2 never needs SOL. The note stays with you, Ghost sponsors
                each send, and a flat USDC fee comes out of the credit - not a SOL transfer from X1
                to X2.
              </p>
              <dl className="mt-12 grid max-w-[640px] grid-cols-3 border-t border-ink/15">
                {[
                  ["0 SOL", "on the signing wallet"],
                  ["1 note", "funds many sponsored sends"],
                  ["$0.01", "USDC fee per send"],
                ].map(([v, k]) => (
                  <div
                    key={k}
                    className="flex flex-col border-l border-ink/15 py-5 pl-4 first:border-0 first:pl-0"
                  >
                    <dt className="t-14 mt-2 max-w-[150px] font-normal text-ink/60">{k}</dt>
                    <dd className="t-28 order-first">{v}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
        </div>
      </section>

      <section id="security" className="scroll-mt-0">
        {pillars.map((p, i) => (
          <article
            key={p.title}
            className="gutter text-cream md:sticky"
            style={{ background: p.bg, top: `${96 + i * 56}px` }}
          >
            <div className="grid gap-8 pt-6 md:grid-cols-[1fr_500px]">
              <div className="flex min-h-[220px] flex-col justify-between">
                <div className="flex items-start justify-between gap-6">
                  <h2 className="t-64">{p.title}</h2>
                  <span className="mt-3 font-mono text-[11px] tracking-[0.08em] text-cream/50">
                    {String(i + 1).padStart(2, "0")} / {String(pillars.length).padStart(2, "0")}
                  </span>
                </div>
                <p className="t-16">
                  {p.sub[0]}
                  <br />
                  {p.sub[1]}
                </p>
              </div>
              <Reveal className="pb-4" threshold={0.02}>
                {p.kind === "lock" ? (
                  <PrivacyStat />
                ) : p.kind === "diode" ? (
                  <SchGasless />
                ) : (
                  <SchCompliance />
                )}
              </Reveal>
            </div>
            <div className="mt-4 grid border-t border-cream/15 md:grid-cols-[1fr_500px]">
              <p className="t-24 max-w-[560px] py-6 pb-10">{p.body}</p>
              <div className="border-cream/15 pb-10 md:border-l md:pl-10 md:pt-6">
                <a href={APP_URL} className="t-16 group inline-flex items-center gap-[10px]">
                  Launch app{" "}
                  <TurnArrow className="h-[14px] w-[14px] transition-transform group-hover:translate-x-[3px]" />
                </a>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section id="how" className="gutter scroll-mt-24 pt-[110px]">
        <div className="grid border-t border-ink/15 pt-6 md:grid-cols-2 md:gap-10">
          <div className="flex flex-col justify-between gap-12 pb-10 md:border-l md:border-ink/15 md:pl-6">
            <span className="tag">How it works</span>
            <Reveal>
              <p className="t-24 max-w-[560px]">
                X1 prepays. X2 signs. Ghost pays the network fee from the note. No SOL handoff
                between them - that link is the leak Gas is built to avoid.
              </p>
            </Reveal>
            <div>
              <a
                href={APP_URL}
                className="group inline-flex w-fit items-center gap-[10px] bg-ink px-[18px] py-[13px] text-[18px] leading-none tracking-[-0.01em] text-cream"
              >
                Launch app{" "}
                <TurnArrow className="h-[14px] w-[14px] transition-transform group-hover:translate-x-[3px]" />
              </a>
              <p className="t-14 mt-3 max-w-[36ch] font-normal text-ink/50">
                Early mainnet pilot. Small limits per transaction.
              </p>
            </div>
          </div>
          <HowPanel />
        </div>
      </section>

      <section className="gutter py-[110px]">
        <div className="grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={i} delay={i * 100} className="flex h-[455px] flex-col bg-sand">
              <span className="px-5 pt-6 text-[30px] font-semibold leading-none tracking-[-0.02em] [font-stretch:125%]">
                {i + 1}
              </span>
              <h3 className="t-28 mt-auto px-5 pb-8">
                {s.title[0]}
                <br />
                {s.title[1]}
              </h3>
              <div className="relative border-t border-ink/15">
                <svg
                  viewBox="0 0 24 24"
                  className="absolute right-[34px] top-0 h-9 w-9 -translate-y-1/2 bg-sand p-1 text-ink/45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                >
                  {s.icon}
                </svg>
              </div>
              <p className="t-20 h-[150px] max-w-[300px] px-5 pt-6">{s.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="gutter pb-[140px] md:pb-[180px]">
        <div className="relative">
          <Reveal className="h-[420px] md:h-[640px]" threshold={0.1}>
            <ReceiptArt />
          </Reveal>
          <figure className="relative -mt-24 ml-auto flex min-h-[320px] max-w-[560px] flex-col justify-between gap-10 bg-night p-8 text-cream md:absolute md:-bottom-[100px] md:right-[40px] md:mt-0 md:min-h-[400px] md:w-[42%]">
            <blockquote className="t-24 leading-[1.3]">
              “A wallet with zero SOL signed a transfer. Ghost paid the network fee from prepaid
              credit and the tokens still arrived.”
            </blockquote>
            <figcaption className="t-16 font-normal">
              <a
                href={explorerTx(transactions[1].hash)}
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:underline"
              >
                Transaction {short(transactions[1].hash)}
              </a>
              <span className="text-smoke">Solana · Ghost Gas</span>
            </figcaption>
          </figure>
        </div>
      </section>

      <section id="proof" className="gutter scroll-mt-0 bg-sun pb-[110px] pt-[60px]">
        <span className="tag">On-chain proof</span>
        <h2 className="t-56 mb-[60px] mt-[90px] max-w-[620px]">
          Every claim on this page,
          <br />
          verifiable on-chain
        </h2>
        <div className="border-t border-ink/15 pt-10">
          <Cases items={cases} />
        </div>
      </section>

      <section id="faq" className="gutter scroll-mt-24 py-[110px]">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] md:gap-16">
          <div>
            <div className="md:sticky md:top-[120px]">
              <span className="tag">FAQs</span>
              <h2 className="t-48 mt-8">Questions, answered.</h2>
              <p className="t-16 mt-6 max-w-[380px] font-normal leading-[1.5] text-ink/70">
                The short version: your secret stays on your device, you never need SOL to receive,
                and every account is public on Solana.
              </p>
            </div>
          </div>
          <Faq items={faqs} />
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
