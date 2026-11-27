import type { Metadata } from "next";
import {
  DocsH1,
  DocsH2,
  DocsLead,
  DocsP,
  DocsShell,
} from "@/components/docs/docs-shell";

export const metadata: Metadata = {
  title: "Trust model",
  description:
    "What Ghost Gas enforces on-chain vs what you trust the relayer for - honest security model.",
  alternates: { canonical: "/docs/trust" },
};

const rows = [
  {
    concern: "SPL transfer correctness",
    who: "On-chain Token program + user signature",
  },
  {
    concern: "Who pays SOL",
    who: "Relayer key as feePayer",
  },
  {
    concern: "Gas credit balance / debit",
    who: "Off-chain relayer ledger (today)",
  },
  {
    concern: "Deposit replay / freshness",
    who: "Relayer verification + reservations",
  },
  {
    concern: "Sponsored instruction shape",
    who: "Relayer allowlist (TransferChecked + optional compute budget + single ATA create)",
  },
];

export default function TrustDocsPage() {
  return (
    <DocsShell activeHref="/docs/trust">
      <DocsH1>Trust model</DocsH1>
      <DocsLead>
        Ghost Gas is useful today because the relayer sponsors fees. That also
        means the credit ledger is a trust surface. Here is the honest split.
      </DocsLead>

      <DocsH2>What is enforced where</DocsH2>
      <div className="mt-6 overflow-x-auto border-t border-ink/15">
        <table className="w-full min-w-[520px] text-left">
          <thead>
            <tr className="border-b border-ink/15">
              <th className="py-4 pr-4 t-14 font-medium text-ink/50">Concern</th>
              <th className="py-4 t-14 font-medium text-ink/50">Enforced by</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.concern} className="border-b border-ink/10">
                <td className="py-4 pr-4 t-16 font-normal text-ink">{row.concern}</td>
                <td className="py-4 t-16 font-normal text-ink/70">{row.who}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DocsH2>What a malicious relayer could do</DocsH2>
      <DocsP>
        Because credit accounting is off-chain today, a malicious operator could
        mis-debit notes or refuse service. Sponsored sends still move tokens only
        with the user’s signature and only along the allowlisted instruction
        shape - Ghost does not take custody of the transferred SPL on a normal
        Gas send.
      </DocsP>

      <DocsH2>What you should do</DocsH2>
      <DocsP>
        Start small. Prefer hosts that publish addresses, open-source policy, and
        tight allowlists. Roadmap hardening includes moving credit commitments
        on-chain so balances are less relayer-opinions and more verifiable state.
      </DocsP>

      <DocsH2>Shield is separate</DocsH2>
      <DocsP>
        Ghost Shield’s MVP trust model is different (relayer-assisted proofs /
        withdraws). Do not conflate Shield vault risk with everyday Gas
        sponsorship. See the Shield docs page for that product.
      </DocsP>
    </DocsShell>
  );
}
