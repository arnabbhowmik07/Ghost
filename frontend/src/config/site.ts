/**
 * Staking / token flags for the marketing site.
 * Flip STAKING_ENABLED and set DEXSCREENER_PAIR to go live - no other code changes.
 *
 * Social and footer URLs live in `@/lib/links` so they never drift.
 */

export {
  FOOTER_COLUMNS,
  LINKS,
  SITE_URL,
  SOCIAL_LINKS,
  isExternalHref,
} from "@/lib/links";

export const TOKEN_SYMBOL = "GHOST";

/** When false, stake UI stays in “Coming at TGE” / placeholder mode. */
export const STAKING_ENABLED = false;

/**
 * Solana pair address for the DexScreener embed.
 * Leave empty to hide the chart section.
 */
export const DEXSCREENER_PAIR = "";

export function dexscreenerEmbedUrl(pair = DEXSCREENER_PAIR): string | null {
  const trimmed = pair.trim();
  if (!trimmed) return null;
  return `https://dexscreener.com/solana/${trimmed}?embed=1&theme=dark`;
}

export const SITE = {
  name: "Ghost",
  brand: "Ghost Labs",
  tagline: "Prepaid gas and private rails for Solana.",
  url: "https://ghostlabshq.xyz",
  copyrightYear: 2026,
} as const;
