import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { TurnArrow } from "@/components/landing/marks";
import { SiteFooter } from "@/components/site-footer";
import { JsonLd } from "@/components/json-ld";
import { LINKS, SITE_URL } from "@/lib/links";
import { TEAM, fullName, initials, type TeamMember } from "@/lib/team";
import { SITE } from "@/src/config/site";

export const metadata: Metadata = {
  title: "Team",
  description:
    "Meet the Ghost Labs team building prepaid gas and private rails for Solana.",
  alternates: { canonical: "/team" },
  openGraph: {
    title: "Team — Ghost Labs",
    description:
      "Meet the Ghost Labs team building prepaid gas and private rails for Solana.",
    url: `${SITE_URL}/team`,
  },
};

function Portrait({
  member,
  priority,
  sizes,
}: {
  member: TeamMember;
  priority?: boolean;
  sizes: string;
}) {
  if (member.image) {
    return (
      <Image
        src={member.image}
        alt={member.imageAlt}
        fill
        sizes={sizes}
        className="object-cover object-[center_18%]"
        priority={priority}
      />
    );
  }

  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-night text-cream"
      aria-hidden
    >
      <span className="t-28 tracking-[-0.02em]">{initials(member)}</span>
    </div>
  );
}

function MemberCard({
  member,
  priority,
}: {
  member: TeamMember;
  priority?: boolean;
}) {
  return (
    <li id={member.id} className="scroll-mt-28 min-w-0">
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-sand">
        <Portrait
          member={member}
          priority={priority}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
        />
      </div>
      <div className="mt-3 border-t border-ink/15 pt-3">
        <h2 className="t-16 leading-[1.2]">
          <span className="block">{member.firstName}</span>
          <span className="block text-ink/55">{member.lastName}</span>
        </h2>
        <a
          href={member.x}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 text-[12px] tracking-[-0.01em] text-ink/55 transition-colors hover:text-ink"
        >
          <span aria-hidden className="text-[13px] font-medium text-ink">
            𝕏
          </span>
          <span className="truncate">{member.xHandle}</span>
        </a>
      </div>
    </li>
  );
}

export default function TeamPage() {
  const founders = TEAM.filter((m) => m.featured);
  const rest = TEAM.filter((m) => !m.featured);

  const people = founders.map((m) => ({
    "@type": "Person",
    name: fullName(m),
    givenName: m.firstName,
    familyName: m.lastName,
    jobTitle: m.role,
    image: m.image ? new URL(m.image, SITE_URL).toString() : undefined,
    url: `${SITE_URL}/team#${m.id}`,
    sameAs: [m.x],
    worksFor: {
      "@type": "Organization",
      name: SITE.brand,
      url: SITE_URL,
    },
  }));

  return (
    <div className="landing-root min-h-screen bg-cream text-ink">
      <a id="top" />
      <Nav />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: SITE.brand,
              url: SITE_URL,
              founder: people,
              employee: people,
            },
            ...people,
          ],
        }}
      />

      <main>
        <header className="gutter border-b border-ink/10 bg-paper pb-12 pt-28 md:pb-14 md:pt-36">
          <div className="grid items-end gap-6 md:grid-cols-[1fr_minmax(0,380px)]">
            <h1 className="t-56">Team</h1>
            <p className="t-16 max-w-[34ch] font-normal leading-[1.45] text-ink/60">
              Ghost Labs — the people behind prepaid gas on Solana.
            </p>
          </div>
        </header>

        <section className="gutter py-12 md:py-16">
          {/* Co-founders — same cards, centered pair */}
          <ul className="mx-auto grid max-w-[520px] grid-cols-2 gap-x-4 gap-y-10 md:max-w-[640px] md:gap-x-6">
            {founders.map((member) => (
              <MemberCard key={member.id} member={member} priority />
            ))}
          </ul>

          {/* Everyone else — full grid */}
          {rest.length > 0 ? (
            <ul className="mt-12 grid grid-cols-2 gap-x-4 gap-y-10 border-t border-ink/10 pt-12 sm:grid-cols-3 md:mt-16 md:grid-cols-4 md:gap-x-6 md:gap-y-12 lg:grid-cols-5 md:pt-16">
              {rest.map((member) => (
                <MemberCard key={member.id} member={member} />
              ))}
            </ul>
          ) : null}
        </section>

        <section className="gutter border-t border-ink/10 bg-sun py-12 md:py-14">
          <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <h2 className="t-28">Building in public</h2>
              <p className="t-14 mt-2 max-w-[40ch] font-normal text-ink/65">
                Open source. Live on Solana.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={LINKS.login}
                className="group inline-flex items-center gap-[10px] bg-ink px-[16px] py-[12px] text-[16px] leading-none tracking-[-0.01em] text-cream"
              >
                Open app
                <TurnArrow className="h-[14px] w-[14px] transition-transform group-hover:translate-x-[3px]" />
              </Link>
              <a
                href={LINKS.x}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center border border-ink/25 px-[16px] py-[12px] text-[16px] leading-none tracking-[-0.01em] text-ink"
              >
                Follow on X
              </a>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
