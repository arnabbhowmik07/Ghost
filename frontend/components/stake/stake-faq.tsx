"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { TOKEN_SYMBOL } from "@/src/config/site";

const items = [
  {
    q: `What do I earn by staking ${TOKEN_SYMBOL}?`,
    a: `Stakers earn a share of Ghost protocol fees (targeted at 1% of sponsored volume). Rewards accrue from the treasury and are shown on this page once staking is live.`,
  },
  {
    q: "When does staking open?",
    a: "At token generation event (TGE). Until then the desk shows placeholders, and stake / unstake actions stay disabled.",
  },
  {
    q: "Is there a lockup or cooldown?",
    a: "Final parameters ship with the staking contracts. Expect either flexible unstake or a short cooldown - this page will reflect the live rules.",
  },
  {
    q: "Where do rewards come from?",
    a: "Protocol fees collected by Ghost Gas (and related products) flow into a treasury. A defined share is streamed to stakers - not inflation by default.",
  },
  {
    q: `Does staking affect Ghost Gas credits?`,
    a: "Gas notes and staking are separate. Staking is about fee share on the token; gas credits still sponsor Solana fees for sends.",
  },
  {
    q: "What are the risks?",
    a: "Smart-contract risk, market risk on the token, and policy changes to fee share. Nothing on this page is financial advice. Read the Risk Disclosure before participating.",
  },
];

export function StakeFaq() {
  return (
    <Accordion type="single" collapsible className="w-full border-t border-ink/15">
      {items.map((item, i) => (
        <AccordionItem
          key={item.q}
          value={`item-${i}`}
          className="border-b border-ink/15"
        >
          <AccordionTrigger className="t-20 py-5 text-left hover:no-underline">
            {item.q}
          </AccordionTrigger>
          <AccordionContent className="pb-5 text-[16px] font-normal leading-[1.55] text-ink/65">
            {item.a}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
