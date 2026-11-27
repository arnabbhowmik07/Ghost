import type { Metadata } from "next";
import {
  DocsH1,
  DocsH2,
  DocsLead,
  DocsList,
  DocsP,
  DocsShell,
} from "@/components/docs/docs-shell";

export const metadata: Metadata = {
  title: "Shield",
  description:
    "Ghost Shield vs Ghost Gas: optional private USDC pool, fixed deposits, ZK withdraws.",
  alternates: { canonical: "/docs/shield" },
};

export default function ShieldDocsPage() {
  return (
    <DocsShell activeHref="/docs/shield">
      <DocsH1>Ghost Shield</DocsH1>
      <DocsLead>
        Shield is the optional private pool. Gas is the everyday product. Do not
        mix them up.
      </DocsLead>

      <DocsH2>Gas vs Shield</DocsH2>
      <div className="mt-6 overflow-x-auto border-t border-ink/15">
        <table className="w-full min-w-[560px] text-left">
          <thead>
            <tr className="border-b border-ink/15">
              <th className="py-4 pr-4 t-14 font-medium text-ink/50" />
              <th className="py-4 pr-4 t-14 font-medium text-ink/50">Gas</th>
              <th className="py-4 t-14 font-medium text-ink/50">Shield</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Job", "Sponsor SPL sends", "Private fixed USDC pool"],
              ["Asset movement", "User wallet → recipient", "Vault → recipient via withdraw"],
              ["Note", "ghost-gas:v1:…", "ghost:v1:… deposit note"],
              ["Mainnet need", "Relayer + USDC treasury", "On-chain pool program"],
            ].map(([label, gas, shield]) => (
              <tr key={label} className="border-b border-ink/10">
                <td className="py-4 pr-4 t-16 font-normal text-ink">{label}</td>
                <td className="py-4 pr-4 t-16 font-normal text-ink/70">{gas}</td>
                <td className="py-4 t-16 font-normal text-ink/70">{shield}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DocsH2>Shield flow (when enabled)</DocsH2>
      <DocsList
        items={[
          "Deposit a fixed denomination (1 USDC) into the pool with a commitment.",
          "Save the deposit note - it proves which leaf you own.",
          "Later, prove Merkle inclusion + nullifier in a Groth16 proof bound to a recipient.",
          "Relayer submits withdraw; nullifier prevents double-spend; fee may go to pool treasury.",
        ]}
      />

      <DocsH2>Mainnet posture</DocsH2>
      <DocsP>
        Gas does not require Shield. Hosts can leave Shield off until the pool
        program is deployed and ops are ready. When Shield is off, deposit /
        withdraw / notes routes redirect to Send.
      </DocsP>

      <DocsH2>Trust note</DocsH2>
      <DocsP>
        Shield’s lean path still leans on relayer-assisted verification for some
        steps. A malicious Shield relayer is a vault risk - different from Gas
        fee sponsorship. Read the trust model page for Gas, and treat Shield as
        higher stakes until audits and on-chain verification land.
      </DocsP>
    </DocsShell>
  );
}
