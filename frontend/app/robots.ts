import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/links";

/** Allow search + answer-engine crawlers; keep wallet app routes out. */
const AI_BOTS = [
  "GPTBot",
  "ChatGPT-User",
  "ClaudeBot",
  "anthropic-ai",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
  "Bytespider",
  "CCBot",
] as const;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/app/"],
      },
      ...AI_BOTS.map((userAgent) => ({
        userAgent,
        allow: [
          "/",
          "/docs",
          "/docs/",
          "/llms.txt",
          "/llms-full.txt",
          "/litepaper.pdf",
          "/sitemap",
          "/sitemap.xml",
        ],
        disallow: ["/app/"],
      })),
    ],
    // Prefer extensionless /sitemap - Cloudflare sometimes interferes with *.xml for Googlebot.
    sitemap: [`${SITE_URL}/sitemap`, `${SITE_URL}/sitemap.xml`],
  };
}
