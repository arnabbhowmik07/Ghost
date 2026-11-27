import type { Metadata } from "next";
import {
  DocsH1,
  DocsH2,
  DocsLead,
  DocsP,
  DocsShell,
} from "@/components/docs/docs-shell";

export const metadata: Metadata = {
  title: "API",
  description:
    "Ghost Gas relayer API: credits deposit, prepare, and submit for sponsored Solana transfers.",
  alternates: { canonical: "/docs/api" },
};

const endpoints = [
  {
    method: "POST",
    path: "/v1/gas/credits/quote",
    body: "Preview how much USDC credit a deposit of a given mint/amount would create after haircut and protocol fee.",
  },
  {
    method: "POST",
    path: "/v1/gas/credits/deposit",
    body: "After the user transfers to the treasury (with memo/commitment), submit the signature so Ghost can verify and issue a gas note.",
  },
  {
    method: "POST",
    path: "/v1/gas/prepare",
    body: "Build an unsigned sponsored transfer. Requires gasNote plus from, to, mint, amount. Relayer is feePayer.",
  },
  {
    method: "POST",
    path: "/v1/gas/submit",
    body: "Submit the user-signed transaction with the same gasNote. Relayer co-signs, broadcasts, and debits the note.",
  },
];

export default function ApiDocsPage() {
  return (
    <DocsShell activeHref="/docs/api">
      <DocsH1>API</DocsH1>
      <DocsLead>
        The web app talks to Ghost’s relayer over HTTPS JSON. Both prepare and
        submit require a gas note.
      </DocsLead>

      <DocsH2>UI ↔ API map</DocsH2>
      <div className="mt-6 overflow-x-auto border-t border-ink/15">
        <table className="w-full min-w-[520px] text-left">
          <thead>
            <tr className="border-b border-ink/15">
              <th className="py-4 pr-4 t-14 font-medium text-ink/50">UI</th>
              <th className="py-4 t-14 font-medium text-ink/50">API</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Credits top-up", "POST /v1/gas/credits/deposit"],
              ["Send", "POST /v1/gas/prepare + /v1/gas/submit"],
            ].map(([ui, api]) => (
              <tr key={ui} className="border-b border-ink/10">
                <td className="py-4 pr-4 t-16 font-normal text-ink">{ui}</td>
                <td className="py-4 font-mono text-[14px] text-ink/70">{api}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DocsH2>Endpoints</DocsH2>
      <ul className="mt-6 border-t border-ink/15">
        {endpoints.map((ep) => (
          <li key={ep.path} className="border-b border-ink/10 py-6">
            <p className="font-mono text-[14px] tracking-[-0.01em] text-ink">
              <span className="text-ink/45">{ep.method}</span> {ep.path}
            </p>
            <p className="t-14 mt-2 max-w-[58ch] font-normal leading-[1.5] text-ink/60">
              {ep.body}
            </p>
          </li>
        ))}
      </ul>

      <DocsH2>Policy highlights</DocsH2>
      <DocsP>
        Sponsored transactions are fail-closed: only allowlisted instruction
        shapes, fee caps, and rate limits. Deposits require a fresh, matching
        treasury transfer - risky Token-2022 shapes are rejected.
      </DocsP>

      <DocsH2>Base URL</DocsH2>
      <DocsP>
        Production hosts publish their relayer origin separately from the UI
        origin (for example an <code className="font-mono text-[0.92em]">api</code>{" "}
        subdomain). Point clients at the host you trust; do not assume a public
        free relayer.
      </DocsP>
    </DocsShell>
  );
}
