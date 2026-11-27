import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { TurnArrow } from "@/components/landing/marks";
import { SiteFooter } from "@/components/site-footer";
import { JsonLd } from "@/components/json-ld";
import { LINKS, SITE_URL } from "@/lib/links";
import { ADVISORS, TEAM, fullName, initials } from "@/lib/team";
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

type CardPerson = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  image?: string;
  imageAlt: string;
  x?: string;
  xHandle?: string;
};

function Portrait({
  person,
  priority,
  sizes,
}: {
  person: CardPerson;
  priority?: boolean;
  sizes: string;
}) {
  if (person.image) {
    return (
      <Image
        src={person.image}
        alt={person.imageAlt}
        fill
        sizes={sizes}
        className="object-cover object-center"
        priority={priority}
      />
    );
  }

  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-night text-cream"
      aria-hidden
    >
      <span className="t-28 tracking-[-0.02em]">{initials(person)}</span>
    </div>
  );
}

function PersonCard({
  person,
  priority,
  className = "",
  aspectClass = "aspect-[4/5]",
  sizes = "(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw",
}: {
  person: CardPerson;
  priority?: boolean;
  className?: string;
  aspectClass?: string;
  sizes?: string;
}) {
  return (
    <li id={person.id} className={`scroll-mt-28 min-w-0 ${className}`}>
      <div className={`relative w-full overflow-hidden bg-sand ${aspectClass}`}>
        <Portrait
          person={person}
          priority={priority}
          sizes={sizes}
        />
      </div>
      <div className="mt-3 border-t border-ink/15 pt-3">
        <h2 className="t-16 leading-[1.2] text-ink">
          {[person.firstName, person.lastName].filter(Boolean).join(" ")}
        </h2>
        <p className="t-14 mt-2 font-normal leading-[1.3] text-ink/50">
          {person.role}
        </p>
        {person.x && person.xHandle ? (
          <a
            href={person.x}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-[12px] tracking-[-0.01em] text-ink/55 transition-colors hover:text-ink"
          >
            <span aria-hidden className="text-[13px] font-medium text-ink">
              𝕏
            </span>
            <span className="truncate">{person.xHandle}</span>
          </a>
        ) : null}
      </div>
    </li>
  );
}

export default function TeamPage() {
  const founders = TEAM.filter((m) => m.featured);
  const rest = TEAM.filter((m) => !m.featured);

  const people = TEAM.map((m) => ({
    "@type": "Person" as const,
    name: fullName(m),
    givenName: m.firstName,
    familyName: m.lastName || undefined,
    jobTitle: m.role,
    image: m.image ? new URL(m.image, SITE_URL).toString() : undefined,
    url: `${SITE_URL}/team#${m.id}`,
    sameAs: m.x ? [m.x] : undefined,
    worksFor: {
      "@type": "Organization",
      name: SITE.brand,
      url: SITE_URL,
    },
  }));

  const advisorsLd = ADVISORS.map((a) => ({
    "@type": "Person" as const,
    name: fullName(a),
    givenName: a.firstName,
    familyName: a.lastName || undefined,
    jobTitle: a.role,
    image: new URL(a.image, SITE_URL).toString(),
    url: `${SITE_URL}/team#${a.id}`,
    sameAs: a.x ? [a.x] : undefined,
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
              founder: people.filter((p) =>
                founders.some((f) => fullName(f) === p.name),
              ),
              employee: people,
              member: advisorsLd,
            },
            ...people,
            ...advisorsLd,
          ],
        }}
      />

      <main>
        <header className="gutter border-b border-ink/10 bg-paper pb-10 pt-28 md:pb-12 md:pt-36">
          <div className="grid items-end gap-6 md:grid-cols-[1fr_minmax(0,380px)]">
            <h1 className="t-56">Team</h1>
            <p className="t-16 max-w-[34ch] font-normal leading-[1.45] text-ink/60">
              Ghost Labs — the people behind prepaid gas on Solana.
            </p>
          </div>
          <div className="relative mx-auto mt-8 aspect-[1672/941] w-full max-w-[1100px] overflow-hidden bg-night md:mt-10">
            <Image
              src="/team/hero.jpg"
              alt="Ghost Labs team at BNB Hack Bengaluru — hackathon winners"
              fill
              priority
              sizes="(max-width: 1100px) 100vw, 1100px"
              className="object-cover object-center"
            />
          </div>
        </header>

        <section className="gutter py-12 md:py-16">
          {/* Co-founders — same cards, centered pair */}
          <ul className="mx-auto grid max-w-[520px] grid-cols-2 gap-x-4 gap-y-10 md:max-w-[640px] md:gap-x-6">
            {founders.map((member) => (
              <PersonCard key={member.id} person={member} priority />
            ))}
          </ul>

          {/* Everyone else — same cards, centered */}
          {rest.length > 0 ? (
            <ul className="mt-12 flex flex-wrap justify-center gap-x-4 gap-y-10 border-t border-ink/10 pt-12 md:mt-16 md:gap-x-6 md:gap-y-12 md:pt-16">
              {rest.map((member) => (
                <PersonCard
                  key={member.id}
                  person={member}
                  className="w-[calc((100%-1rem)/2)] sm:w-[calc((100%-2rem)/3)] md:w-[calc((100%-4.5rem)/4)] lg:w-[calc((100%-6rem)/5)]"
                />
              ))}
            </ul>
          ) : null}
        </section>

        <section className="gutter border-t border-ink/10 bg-paper py-12 md:py-16">
          <div className="mb-10 md:mb-12">
            <p className="tag">Guidance</p>
            <h2 className="t-40 mt-4">Advisors</h2>
            <p className="t-16 mt-3 max-w-[40ch] font-normal text-ink/60">
              Experienced operators advising Ghost Labs.
            </p>
          </div>
          <ul className="grid grid-cols-1 gap-y-10 md:grid-cols-2 md:gap-x-8 md:gap-y-12">
            {ADVISORS.map((advisor) => (
              <PersonCard
                key={advisor.id}
                person={advisor}
                aspectClass="aspect-[16/9]"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            ))}
          </ul>
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
