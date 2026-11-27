/**
 * Ghost Labs team — single source for /team and related JSON-LD.
 */

export type TeamMember = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  /** Optional — missing image renders an initials tile. */
  image?: string;
  imageAlt: string;
  x?: string;
  xHandle?: string;
  /** Featured founders render centered above the rest of the grid. */
  featured?: boolean;
};

export type Advisor = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  image: string;
  imageAlt: string;
};

export const TEAM: TeamMember[] = [
  {
    id: "arnab",
    firstName: "Arnab",
    lastName: "Bhowmik",
    role: "Co-founder",
    image: "/team/arnab.jpg",
    imageAlt: "Arnab Bhowmik, co-founder of Ghost Labs",
    x: "https://x.com/bhowmik_arnab07",
    xHandle: "@bhowmik_arnab07",
    featured: true,
  },
  {
    id: "amaan",
    firstName: "Amaan",
    lastName: "Sayyad",
    role: "Co-founder",
    image: "/team/amaan.jpg",
    imageAlt: "Amaan Sayyad, co-founder of Ghost Labs",
    x: "https://x.com/amaanbiz",
    xHandle: "@amaanbiz",
    featured: true,
  },
  {
    id: "konan",
    firstName: "Konan",
    lastName: "",
    role: "Head of Design",
    image: "/team/konan.jpg",
    imageAlt: "Konan, head of design at Ghost Labs",
    x: "https://x.com/konaniie",
    xHandle: "@konaniie",
  },
  {
    id: "joseph",
    firstName: "Joseph",
    lastName: "Emmanuel",
    role: "Community Moderator",
    image: "/team/joseph.jpg",
    imageAlt: "Joseph Emmanuel, community moderator at Ghost Labs",
    x: "https://x.com/joe_1210",
    xHandle: "@joe_1210",
  },
  {
    id: "oluwatukesi",
    firstName: "Oluwatukesi",
    lastName: "Israel",
    role: "Junior Manager",
    image: "/team/oluwatukesi.png",
    imageAlt: "Oluwatukesi Israel, junior manager at Ghost Labs",
    x: "https://x.com/Web3Tuke_",
    xHandle: "@Web3Tuke_",
  },
  {
    id: "abdul",
    firstName: "Abdul",
    lastName: "Yakub",
    role: "Community Manager",
    image: "/team/abdul.jpg",
    imageAlt: "Abdul Yakub, community manager at Ghost Labs",
    x: "https://x.com/abdyweb3",
    xHandle: "@abdyweb3",
  },
  {
    id: "solosufi",
    firstName: "SoloSufi",
    lastName: "AbMajid",
    role: "Chief Community Officer",
    image: "/team/solosufi.png",
    imageAlt: "SoloSufi (AbMajid), chief community officer at Ghost Labs",
    x: "https://x.com/HassanA98493054",
    xHandle: "@HassanA98493054",
  },
  {
    id: "sohan",
    firstName: "Sohan",
    lastName: "Parvas",
    role: "KOLs Manager",
    image: "/team/sohan.png",
    imageAlt: "Sohan Parvas, KOLs manager at Ghost Labs",
    x: "https://x.com/MdSohan13605277",
    xHandle: "@MdSohan13605277",
  },
  {
    id: "draheem",
    firstName: "Draheem",
    lastName: "",
    role: "Video Production Lead",
    image: "/team/draheem.jpg",
    imageAlt: "Draheem, video production lead at Ghost Labs",
    x: "https://x.com/web3prosper",
    xHandle: "@web3prosper",
  },
];

export const ADVISORS: Advisor[] = [
  {
    id: "lucas-liao",
    firstName: "Lucas",
    lastName: "Liao",
    role: "Advisor · BNB Chain",
    image: "/team/lucas-liao.jpg",
    imageAlt: "Lucas Liao, advisor at Ghost Labs",
  },
  {
    id: "vlad",
    firstName: "Vlad",
    lastName: "",
    role: "Advisor · BNB Chain",
    image: "/team/vlad.jpg",
    imageAlt: "Vlad, advisor at Ghost Labs",
  },
];

export function fullName(member: Pick<TeamMember, "firstName" | "lastName">): string {
  return [member.firstName, member.lastName].filter(Boolean).join(" ");
}

export function initials(member: Pick<TeamMember, "firstName" | "lastName">): string {
  const a = member.firstName[0] ?? "";
  const b = member.lastName[0] ?? member.firstName[1] ?? "";
  return `${a}${b}`.toUpperCase();
}
