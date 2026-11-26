import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/links";

/** Public marketing + legal URLs. App routes (/app/*) stay out — they require a wallet. */
export const SITEMAP_ROUTES: {
  path: string;
  changeFrequency: NonNullable<
    MetadataRoute.Sitemap[number]["changeFrequency"]
  >;
  priority: number;
}[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/docs", changeFrequency: "weekly", priority: 0.95 },
  { path: "/docs/how-it-works", changeFrequency: "monthly", priority: 0.9 },
  { path: "/docs/gas-notes", changeFrequency: "monthly", priority: 0.85 },
  { path: "/docs/fees", changeFrequency: "monthly", priority: 0.85 },
  { path: "/docs/trust", changeFrequency: "monthly", priority: 0.85 },
  { path: "/docs/api", changeFrequency: "monthly", priority: 0.8 },
  { path: "/docs/shield", changeFrequency: "monthly", priority: 0.75 },
  { path: "/docs/faq", changeFrequency: "monthly", priority: 0.9 },
  { path: "/stake", changeFrequency: "weekly", priority: 0.8 },
  { path: "/team", changeFrequency: "monthly", priority: 0.75 },
  { path: "/login", changeFrequency: "monthly", priority: 0.7 },
  { path: "/pitch-deck/index.html", changeFrequency: "monthly", priority: 0.7 },
  { path: "/brand-kit/index.html", changeFrequency: "monthly", priority: 0.6 },
  { path: "/litepaper.pdf", changeFrequency: "monthly", priority: 0.6 },
  { path: "/llms.txt", changeFrequency: "monthly", priority: 0.8 },
  { path: "/llms-full.txt", changeFrequency: "monthly", priority: 0.7 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/cookies", changeFrequency: "yearly", priority: 0.3 },
  { path: "/risk", changeFrequency: "yearly", priority: 0.3 },
];

export function buildSitemapEntries(
  lastModified: Date = new Date(),
): MetadataRoute.Sitemap {
  return SITEMAP_ROUTES.map(({ path, changeFrequency, priority }) => ({
    url: new URL(path, SITE_URL).toString(),
    lastModified,
    changeFrequency,
    priority,
  }));
}

/** Raw XML for /sitemap (extensionless) — more reliable behind Cloudflare for Googlebot. */
export function buildSitemapXml(lastModified: Date = new Date()): string {
  const entries = buildSitemapEntries(lastModified);
  const body = entries
    .map((entry) => {
      const lastmod =
        entry.lastModified instanceof Date
          ? entry.lastModified.toISOString()
          : new Date(entry.lastModified ?? Date.now()).toISOString();
      return [
        "<url>",
        `<loc>${entry.url}</loc>`,
        `<lastmod>${lastmod}</lastmod>`,
        entry.changeFrequency
          ? `<changefreq>${entry.changeFrequency}</changefreq>`
          : "",
        typeof entry.priority === "number"
          ? `<priority>${entry.priority}</priority>`
          : "",
        "</url>",
      ]
        .filter(Boolean)
        .join("");
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>\n`;
}
