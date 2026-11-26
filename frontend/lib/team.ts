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
  x: string;
  xHandle: string;
  /** Featured founders render as full-width rows above the grid. */
  featured?: boolean;
};

const DUMMY: Omit<TeamMember, "id" | "imageAlt">[] = [
  { firstName: "Maya", lastName: "Chen", role: "Engineering", x: "https://x.com/ghostlabshq", xHandle: "@maya_chen" },
  { firstName: "Leo", lastName: "Okoye", role: "Engineering", x: "https://x.com/ghostlabshq", xHandle: "@leookoye" },
  { firstName: "Sofia", lastName: "Reyes", role: "Design", x: "https://x.com/ghostlabshq", xHandle: "@sofiareyes" },
  { firstName: "Noah", lastName: "Patel", role: "Product", x: "https://x.com/ghostlabshq", xHandle: "@noahpatel" },
  { firstName: "Aisha", lastName: "Khan", role: "Growth", x: "https://x.com/ghostlabshq", xHandle: "@aishak" },
  { firstName: "Jonas", lastName: "Berg", role: "Protocol", x: "https://x.com/ghostlabshq", xHandle: "@jonasberg" },
  { firstName: "Elena", lastName: "Volkov", role: "Security", x: "https://x.com/ghostlabshq", xHandle: "@elenav" },
  { firstName: "Kai", lastName: "Nakamura", role: "Engineering", x: "https://x.com/ghostlabshq", xHandle: "@kainakamura" },
  { firstName: "Priya", lastName: "Nair", role: "Ops", x: "https://x.com/ghostlabshq", xHandle: "@priyanair" },
  { firstName: "Marcus", lastName: "Cole", role: "BD", x: "https://x.com/ghostlabshq", xHandle: "@marcuscole" },
  { firstName: "Yuki", lastName: "Sato", role: "Engineering", x: "https://x.com/ghostlabshq", xHandle: "@yukisato" },
  { firstName: "Amara", lastName: "Diallo", role: "Community", x: "https://x.com/ghostlabshq", xHandle: "@amarad" },
  { firstName: "Theo", lastName: "Martin", role: "Research", x: "https://x.com/ghostlabshq", xHandle: "@theomartin" },
  { firstName: "Nina", lastName: "Costa", role: "Design", x: "https://x.com/ghostlabshq", xHandle: "@ninacosta" },
  { firstName: "Omar", lastName: "Hassan", role: "Engineering", x: "https://x.com/ghostlabshq", xHandle: "@omarh" },
  { firstName: "Ivy", lastName: "Brooks", role: "Marketing", x: "https://x.com/ghostlabshq", xHandle: "@ivybrooks" },
  { firstName: "Diego", lastName: "Alvarez", role: "DevRel", x: "https://x.com/ghostlabshq", xHandle: "@diegoa" },
  { firstName: "Hana", lastName: "Kim", role: "Engineering", x: "https://x.com/ghostlabshq", xHandle: "@hanakim" },
];

export const TEAM: TeamMember[] = [
  {
    id: "arnab",
    firstName: "Arnab",
    lastName: "Bhowmik",
    role: "Co-founder",
    image: "/team/arnab.jpg",
    imageAlt: "Arnab Bhowmik, co-founder of Ghost Labs",
    x: "https://x.com/ghostlabshq",
    xHandle: "@ghostlabshq",
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
  ...DUMMY.map((d, i) => ({
    ...d,
    id: `dummy-${i + 1}`,
    imageAlt: `${d.firstName} ${d.lastName}`,
  })),
];

export function fullName(member: TeamMember): string {
  return `${member.firstName} ${member.lastName}`;
}

export function initials(member: TeamMember): string {
  return `${member.firstName[0] ?? ""}${member.lastName[0] ?? ""}`.toUpperCase();
}
