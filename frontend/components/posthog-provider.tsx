"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { trackPageView } from "@/lib/analytics";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || "";
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

function initPostHog() {
  if (!POSTHOG_KEY || typeof window === "undefined") return;
  if (posthog.__loaded) return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false, // App Router: capture on route changes below
    capture_pageleave: true,
    autocapture: true,
    session_recording: {
      maskAllInputs: true,
    },
  });
}

function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    trackPageView(pathname);

    if (!POSTHOG_KEY) return;
    let url = window.origin + pathname;
    const qs = searchParams?.toString();
    if (qs) url += `?${qs}`;
    try {
      posthog.capture("$pageview", { $current_url: url });
    } catch {
      /* ignore */
    }
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    initPostHog();
  }, []);

  // Always mount page-view tracker (local Grafana), even if PostHog is off.
  const tracker = (
    <Suspense fallback={null}>
      <PageViewTracker />
    </Suspense>
  );

  if (!POSTHOG_KEY) {
    return (
      <>
        {tracker}
        {children}
      </>
    );
  }

  return (
    <PHProvider client={posthog}>
      {tracker}
      {children}
    </PHProvider>
  );
}
