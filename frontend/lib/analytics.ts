import posthog from "posthog-js";
import { CLUSTER } from "@/lib/config";

const WALLET_COLLECT_URL =
  process.env.NEXT_PUBLIC_WALLET_COLLECT_URL ||
  "https://observability.ghostlabshq.xyz/collect/wallet-connect";

const PAGEVIEW_COLLECT_URL =
  process.env.NEXT_PUBLIC_PAGEVIEW_COLLECT_URL ||
  "https://observability.ghostlabshq.xyz/collect/pageview";

/** Fire once per address per tab session. */
const reported = new Set<string>();

/**
 * Count a wallet connection for observability + PostHog.
 * Stores only a server-side hash for the local counter (no raw address retained in metrics UI).
 */
export function trackWalletConnected(
  address: string,
  source: "appkit" | "dev" = "appkit",
) {
  if (!address || reported.has(address)) return;
  reported.add(address);

  try {
    // posthog-js sets __loaded after init; ignore if analytics is off
    const loaded = Boolean((posthog as { __loaded?: boolean }).__loaded);
    if (loaded) {
      posthog.identify(address);
      posthog.capture("wallet_connected", {
        cluster: CLUSTER,
        source,
      });
    }
  } catch {
    /* ignore analytics failures */
  }

  try {
    void fetch(WALLET_COLLECT_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        address,
        cluster: CLUSTER,
        source,
      }),
      keepalive: true,
      mode: "cors",
    });
  } catch {
    /* ignore */
  }
}

/** Local Grafana page-view counter (works even when PostHog is off). */
export function trackPageView(pathname: string) {
  if (typeof window === "undefined" || !pathname) return;
  try {
    void fetch(PAGEVIEW_COLLECT_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        host: window.location.hostname,
        path: pathname,
        cluster: CLUSTER,
      }),
      keepalive: true,
      mode: "cors",
    });
  } catch {
    /* ignore */
  }
}
