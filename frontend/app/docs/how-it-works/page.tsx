import type { Metadata } from "next";
import {
  DocsH1,
  DocsH2,
  DocsLead,
  DocsList,
  DocsP,
  DocsShell,
} from "@/components/docs/docs-shell";
import { JsonLd } from "@/components/json-ld";
import { HOW_TO_STEPS, howToJsonLd } from "@/lib/aeo";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How Ghost Gas works: prepay USDC, attach a gas note, sign with zero SOL, Ghost pays the fee.",
  alternates: { canonical: "/docs/how-it-works" },
};

export default function HowItWorksDocsPage() {
  return (
    <DocsShell activeHref="/docs/how-it-works">
      <JsonLd data={{ "@context": "https://schema.org", ...howToJsonLd() }} />

      <DocsH1>How Ghost Gas works</DocsH1>
      <DocsLead>
        Ghost moves the fee off the signing wallet. The funded wallet prepays.
        The alt wallet only signs.
      </DocsLead>

      <DocsH2>The pain</DocsH2>
      <DocsP>
        On Solana, every send needs SOL for fees. A wallet with tokens but no SOL
        is stuck. The usual fix is a SOL top-up from a primary wallet - and that
        transfer is public forever.
      </DocsP>
      <DocsList
        items={[
          "Alt wallets need SOL to move tokens.",
          "Someone has to send SOL first.",
          "That funding link is the leak - privacy breaks before the real transfer.",
        ]}
      />

      <DocsH2>The fix</DocsH2>
      <DocsP>
        Ghost Gas removes the SOL handoff. X1 prepays Ghost in USDC and gets a gas
        note. X2 attaches the note and signs an SPL transfer. Ghost’s relayer is
        the feePayer, pays SOL on-chain, and debits a flat USDC fee from the note.
      </DocsP>

      <DocsH2>Roles</DocsH2>
      <dl className="mt-6 grid gap-6 border-t border-ink/15 pt-6 sm:grid-cols-2">
        {[
          {
            t: "X1 - primary wallet",
            d: "Pays USDC (or an allowlisted asset) once and receives a gas note.",
          },
          {
            t: "X2 - signing wallet",
            d: "Holds tokens, attaches the note, signs. Can have zero SOL.",
          },
          {
            t: "Ghost relayer",
            d: "Pays the Solana fee as feePayer and debits the note.",
          },
          {
            t: "Recipient",
            d: "Receives tokens straight from X2. Tokens never pass through Ghost on a sponsored send.",
          },
        ].map((item) => (
          <div key={item.t}>
            <dt className="t-14 text-ink/50">{item.t}</dt>
            <dd className="t-16 mt-2 max-w-[36ch] font-normal leading-[1.45] text-ink/75">
              {item.d}
            </dd>
          </div>
        ))}
      </dl>

      <DocsH2>Step by step</DocsH2>
      <ol className="mt-6 border-t border-ink/15">
        {HOW_TO_STEPS.map((step, i) => (
          <li
            key={step.name}
            className="grid grid-cols-[48px_1fr] gap-4 border-b border-ink/15 py-6"
          >
            <span className="font-mono text-[12px] tracking-[0.06em] text-ink/45">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <p className="t-20">{step.name}</p>
              <p className="t-14 mt-2 max-w-[54ch] font-normal leading-[1.5] text-ink/60">
                {step.text}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <DocsH2>What observers see</DocsH2>
      <DocsP>
        Without Ghost, explorers can show that the alt was funded by your main
        wallet. With Ghost, the alt was never funded with SOL by that wallet -
        the fee came from Ghost’s relayer, paid for by prepaid USDC credit.
      </DocsP>
    </DocsShell>
  );
}
