"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { STAKING_ENABLED, TOKEN_SYMBOL } from "@/src/config/site";

export function StakePanel() {
  const [amount, setAmount] = useState("");
  const live = STAKING_ENABLED;

  return (
    <div className="border border-ink/15 bg-paper p-5 md:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="tag">Stake desk</p>
          <h2 className="t-28 mt-3">Manage position</h2>
        </div>
        {!live && (
          <span className="shrink-0 border border-ink/15 bg-sun px-3 py-1.5 text-[12px] tracking-[-0.01em] text-ink">
            Coming at TGE
          </span>
        )}
      </div>

      <Tabs defaultValue="stake" className="mt-7">
        <TabsList
          variant="line"
          className="h-auto w-full justify-start gap-0 rounded-none border-b border-ink/15 bg-transparent p-0"
        >
          <TabsTrigger
            value="stake"
            className="rounded-none border-0 px-0 pb-3 pr-6 text-[15px] data-[state=active]:bg-transparent"
          >
            Stake
          </TabsTrigger>
          <TabsTrigger
            value="unstake"
            className="rounded-none border-0 px-0 pb-3 pr-6 text-[15px] data-[state=active]:bg-transparent"
          >
            Unstake
          </TabsTrigger>
        </TabsList>

        {(["stake", "unstake"] as const).map((mode) => (
          <TabsContent key={mode} value={mode} className="mt-6 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor={`amount-${mode}`} className="t-14 text-ink/60">
                  Amount
                </label>
                <button
                  type="button"
                  disabled={!live}
                  onClick={() => setAmount("0")}
                  className="t-14 text-ink/55 underline-offset-2 hover:text-ink hover:underline disabled:pointer-events-none disabled:opacity-40"
                >
                  Max
                </button>
              </div>
              <div className="relative">
                <Input
                  id={`amount-${mode}`}
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  disabled={!live}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-12 border-ink/15 bg-cream pr-20 text-[17px]"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] tracking-[0.04em] text-ink/45">
                  {TOKEN_SYMBOL}
                </span>
              </div>
              <p className="t-14 font-normal text-ink/45">
                Balance: {live ? `0.00 ${TOKEN_SYMBOL}` : "-"}
              </p>
            </div>

            <Button
              type="button"
              disabled
              className="h-12 w-full"
              title={live ? "Connect a wallet after TGE" : "Coming at TGE"}
            >
              {live ? "Connect wallet" : "Coming at TGE"}
            </Button>
            <p className="t-14 font-normal leading-[1.45] text-ink/45">
              {live
                ? "UI is live. On-chain staking contracts are not wired yet - no transactions will be sent."
                : `Staking ${TOKEN_SYMBOL} opens at token launch. This panel stays read-only until then.`}
            </p>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
