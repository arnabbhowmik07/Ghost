"use client";

import { useEffect, useState } from "react";
import { LINKS } from "@/lib/links";
import { TurnArrow, Wordmark } from "./marks";

const links = [
  { href: "/#how", label: "How it works" },
  { href: "/#security", label: "Security" },
  { href: "/#proof", label: "Proof" },
  { href: "/stake", label: "Stake" },
  { href: "/team", label: "Team" },
  { href: "/docs", label: "Docs" },
];

export function Nav() {
  const [compact, setCompact] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const on = () => {
      // the paper hero is the only place the bare logo sits cleanly
      const heroEnd = (document.querySelector("header")?.offsetHeight ?? 260) - 60;
      setCompact(window.scrollY > heroEnd);
      if (window.scrollY <= heroEnd) setOpen(false);
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <>
      {/* at the top the logo sits bare on the hero; once you scroll it gets the
          same solid black box as the nav, so it never runs into section content */}
      <div className="gutter fixed left-0 top-[28px] z-50">
        <a
          href="/"
          aria-label="Ghost home"
          className={`flex h-10 items-center transition-[background-color,color,padding] duration-500 ease-[cubic-bezier(0.6,0,0.2,1)] ${
            compact ? "bg-black px-[14px] text-cream [--eye:#000]" : "bg-transparent px-0 text-ink [--eye:var(--paper)]"
          }`}
        >
          <Wordmark className="text-[22px]" />
        </a>
      </div>

      <div className="gutter fixed right-0 top-[28px] z-50">
        <div className="relative flex h-10 items-stretch bg-black p-[3px] text-cream">
          {/* full links, collapse into the menu button once you scroll */}
          <nav
            className={`hidden items-center overflow-hidden transition-[max-width,opacity] duration-500 ease-[cubic-bezier(0.6,0,0.2,1)] md:flex ${
              compact ? "max-w-0 opacity-0" : "max-w-[560px] opacity-100"
            }`}
          >
            {links.map((l) => (
              <a key={l.label} href={l.href} className="t-16 whitespace-nowrap px-[13px] transition-opacity hover:opacity-60">
                {l.label}
              </a>
            ))}
          </nav>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
            aria-expanded={open}
            className={`grid place-items-center overflow-hidden transition-[width,opacity] duration-500 ease-[cubic-bezier(0.6,0,0.2,1)] ${
              compact ? "w-[44px] opacity-100" : "w-[44px] opacity-100 md:w-0 md:opacity-0"
            }`}
          >
            <span className="relative block h-[10px] w-[14px]">
              <span className={`absolute left-0 top-0 h-[1.5px] w-full bg-cream transition-transform duration-300 ${open ? "translate-y-[4.25px] rotate-45" : ""}`} />
              <span className={`absolute left-0 top-[4.25px] h-[1.5px] w-full bg-cream transition-opacity ${open ? "opacity-0" : ""}`} />
              <span className={`absolute left-0 top-[8.5px] h-[1.5px] w-full bg-cream transition-transform duration-300 ${open ? "-translate-y-[4.25px] -rotate-45" : ""}`} />
            </span>
          </button>
          <a
            href={LINKS.login}
            className="group ml-[3px] flex items-center gap-[10px] bg-sun px-[14px] text-[18px] leading-none tracking-[-0.01em] text-ink"
          >
            Launch app
            <TurnArrow className="h-[14px] w-[14px] transition-transform duration-300 group-hover:translate-x-[3px]" />
          </a>

          {/* dropdown */}
          <div
            className={`absolute right-0 top-[calc(100%+6px)] w-[260px] origin-top-right bg-black p-[3px] transition-all duration-300 ${
              open ? "visible scale-100 opacity-100" : "invisible scale-95 opacity-0"
            }`}
          >
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setOpen(false)}
                className="t-20 flex items-center justify-between border-b border-white/10 px-4 py-4 last:border-0 hover:bg-white/5"
              >
                {l.label}
                <TurnArrow className="h-[14px] w-[14px] opacity-50" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
