import Link from "next/link";
import type { Metadata } from "next";
import { TurnArrow } from "@/components/landing/marks";
import {
  DocsH1,
  DocsH2,
  DocsLead,
  DocsList,
  DocsP,
  DocsShell,
  DOCS_NAV,
} from "@/components/docs/docs-shell";
import { JsonLd } from "@/components/json-ld";
import { AEO, HOW_TO_STEPS, howToJsonLd } from "@/lib/aeo";
import { LINKS } from "@/lib/links";

export const metadata: Metadata = {
  title: "Docs",
  description:
    "Ghost Gas docs: prepaid Solana gas credits, gas notes, fees, trust model, API, and FAQ.",
  alternates: { canonical: "/docs" },
};

export default function DocsPage() {
  return (
    <DocsShell activeHref="/docs">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [howToJsonLd()],
        }}
      />

      <DocsH1>Ghost Gas docs</DocsH1>
      <DocsLead>
        {AEO.description} Start here, then jump into notes, fees, trust, and the
        API.
      </DocsLead>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href={LINKS.login}
          className="group inline-flex items-center gap-[10px] bg-ink px-[18px] py-[13px] text-[17px] leading-none tracking-[-0.01em] text-cream"
        >
          Open app
          <TurnArrow className="h-[14px] w-[14px] transition-transform group-hover:translate-x-[3px]" />
        </Link>
        <Link
          href="/docs/how-it-works"
          className="inline-flex items-center border border-ink/20 bg-transparent px-[18px] py-[13px] text-[17px] leading-none tracking-[-0.01em] text-ink"
        >
          How it works
        </Link>
      </div>

      <DocsH2>Quick map</DocsH2>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {DOCS_NAV.filter((n) => n.href !== "/docs").map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="border border-ink/15 bg-paper px-5 py-5 transition-colors hover:border-ink/35"
          >
            <p className="t-20">{item.label}</p>
            <p className="t-14 mt-2 font-normal text-ink/50">{item.href}</p>
          </Link>
        ))}
      </div>

      <DocsH2>In one line</DocsH2>
      <DocsP>
        <strong className="font-medium text-ink">{AEO.oneLiner}</strong>{" "}
        {AEO.tagline}
      </DocsP>

      <DocsH2>Three steps</DocsH2>
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

      <DocsH2>What Ghost Gas is not</DocsH2>
      <DocsList
        items={[
          "Not a mixer or tumbler.",
          "Not a custodial exchange.",
          "Not the same product as Ghost Shield.",
          "Not a promise that explorers cannot see the SPL transfer itself - only that X1 never has to fund X2 with SOL for gas.",
        ]}
      />

      <div className="mt-14 border border-ink/15 bg-night p-8 text-cream md:p-10">
        <p className="t-24 max-w-[28ch]">Ready to try it.</p>
        <p className="t-16 mt-4 max-w-[42ch] font-normal text-cream/65">
          Top up Credits from a funded wallet, then send from an alt with the gas
          note attached.
        </p>
        <Link
          href={LINKS.login}
          className="group mt-8 inline-flex items-center gap-[10px] bg-sun px-[18px] py-[13px] text-[17px] leading-none tracking-[-0.01em] text-ink"
        >
          Try Credits
          <TurnArrow className="h-[14px] w-[14px] transition-transform group-hover:translate-x-[3px]" />
        </Link>
      </div>
    </DocsShell>
  );
}
