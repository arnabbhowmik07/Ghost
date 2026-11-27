import { buildSitemapXml } from "@/lib/sitemap-routes";

export const dynamic = "force-static";
export const revalidate = 3600;

/** Served at /sitemap via rewrite - extensionless URL for Google Search Console. */
export function GET() {
  return new Response(buildSitemapXml(), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
