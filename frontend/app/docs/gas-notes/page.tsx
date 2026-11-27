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
  title: "Gas notes",
  description:
    "What a Ghost gas note is, how to store it, and what happens if you lose it.",
  alternates: { canonical: "/docs/gas-notes" },
};

export default function GasNotesDocsPage() {
  return (
    <DocsShell activeHref="/docs/gas-notes">
      <DocsH1>Gas notes</DocsH1>
      <DocsLead>
        A gas note is prepaid fee credit. Whoever holds it can spend the remaining
        balance on sponsored sends.
      </DocsLead>

      <DocsH2>Format</DocsH2>
      <DocsP>
        Notes are bearer strings in the form{" "}
        <code className="font-mono text-[0.92em] text-ink">ghost-gas:v1:…</code>.
        They encode the secret material and remaining credit Ghost’s relayer
        recognizes when you call prepare/submit.
      </DocsP>

      <DocsH2>How you get one</DocsH2>
      <DocsList
        items={[
          "Connect a funded wallet at /app/credits.",
          "Deposit USDC (or an allowlisted asset) to the Ghost treasury.",
          "Ghost verifies the deposit on-chain and returns a gas note.",
          "Save the note immediately - Ghost cannot re-issue the same secret.",
        ]}
      />

      <DocsH2>How you use one</DocsH2>
      <DocsP>
        On Send, paste or select the note, choose mint / amount / recipient, then
        sign. Ghost checks the note balance, reserves the flat fee, sponsors the
        transaction as feePayer, and finalizes the debit after broadcast.
      </DocsP>

      <DocsH2>Loss and sharing</DocsH2>
      <DocsP>
        Treat a gas note like a password or seed phrase fragment. Anyone with the
        string can spend remaining credit. If you lose it, Ghost cannot recover it
        for you.
      </DocsP>
      <DocsList
        items={[
          "You can share a note with an operator wallet on purpose.",
          "Do not paste notes into public chats or screenshots.",
          "Browser storage is convenient, not a backup.",
        ]}
      />

      <DocsH2>Balance</DocsH2>
      <DocsP>
        Credit is denominated in USDC micro-units. Each successful sponsored send
        debits a flat fee (default 0.01 USDC). Failed sends that never land should
        not keep the debit - the relayer refunds reserved credit when submission
        fails after reserve.
      </DocsP>
    </DocsShell>
  );
}
