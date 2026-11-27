import { SITE_URL, LINKS } from "@/lib/links";

/** Shared copy for answer engines, FAQ schema, and llms.txt - keep these factual and short. */
export const AEO = {
  name: "Ghost",
  legalName: "Ghost Labs",
  productName: "Ghost Gas",
  oneLiner: "Prepaid gas for Solana.",
  description:
    "Ghost Gas lets a primary wallet prepay USDC for gas credits (a gas note). An alt wallet can then sign SPL token transfers with zero SOL while Ghost’s relayer pays the network fee and debits a flat USDC fee from the note - without the primary wallet ever sending SOL to the alt.",
  tagline: "The fee that doesn't dox you.",
  fee: "0.01 USDC per sponsored send (default)",
  network: "Solana",
  contactEmail: "mail@ghostlabshq.xyz",
} as const;

export type FaqItem = { q: string; a: string };

export const SITE_FAQS: FaqItem[] = [
  {
    q: "What is Ghost Gas?",
    a: "Prepaid network fees on Solana. A primary wallet (X1) tops up USDC or an allowlisted asset, receives a gas note, and any wallet holding that note can send tokens while Ghost pays the SOL fee.",
  },
  {
    q: "Do I need SOL to send?",
    a: "Not on the signing wallet. You need a funded gas note. Ghost’s relayer is the fee payer and debits a flat USDC fee from the note per send.",
  },
  {
    q: "Who is X1 and X2?",
    a: "X1 is the wallet that buys credit. X2 is the wallet that signs transfers (often with zero SOL). They can be the same person or different wallets.",
  },
  {
    q: "What if I lose my gas note?",
    a: "The note is a bearer voucher. Anyone with it can spend the remaining credit. Store it like a password; Ghost cannot recover it for you.",
  },
  {
    q: "Is Ghost Shield the same as Ghost Gas?",
    a: "No. Shield is the optional private pool (fixed 1 USDC deposits and ZK withdraws). Gas is the everyday product for sponsoring sends.",
  },
  {
    q: "Which networks does Ghost support?",
    a: "Solana.",
  },
  {
    q: "How does Ghost stop the funding graph leak?",
    a: "On Solana, topping up an alt wallet with SOL creates a public link. Ghost removes that step: X1 prepays Ghost in USDC, X2 never receives SOL from X1, and Ghost pays fees as feePayer.",
  },
  {
    q: "What does a send cost?",
    a: "A flat USDC debit from the gas note per sponsored send (default 0.01 USDC), plus Ghost pays the actual SOL network fee.",
  },
  {
    q: "Can I top up with assets other than USDC?",
    a: "If the host allowlists the mint, yes. Non-USDC deposits are priced with a live quote and may take a haircut so credited USDC is less than the quoted amount.",
  },
  {
    q: "Do tokens pass through Ghost on a sponsored send?",
    a: "No. On a normal Ghost Gas send, tokens move from the signing wallet to the recipient. Ghost pays the SOL fee and debits the note.",
  },
  {
    q: "Where are the docs?",
    a: "https://ghostlabshq.xyz/docs - including how it works, gas notes, fees, trust model, API, Shield, and FAQ.",
  },
];

export const HOW_TO_STEPS = [
  {
    name: "Primary wallet tops up",
    text: "Your funded wallet sends USDC to Ghost and receives a gas note. That note is prepaid credit for network fees.",
  },
  {
    name: "Alt wallet only signs",
    text: "A second wallet (often with zero SOL) attaches the note, chooses a token and recipient, and signs the transfer.",
  },
  {
    name: "Ghost pays the fee",
    text: "Ghost covers the SOL fee on-chain. Tokens move from the alt wallet to the recipient. A small fee is taken from the gas note.",
  },
] as const;

export function organizationJsonLd() {
  return {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: AEO.legalName,
    alternateName: AEO.name,
    url: SITE_URL,
    logo: `${SITE_URL}/icon.svg`,
    email: AEO.contactEmail,
    sameAs: [
      LINKS.x,
      LINKS.telegram,
      LINKS.discord,
      LINKS.linkedin,
      LINKS.github,
    ],
    knowsAbout: [
      "Solana prepaid gas",
      "gasless SPL transfers",
      "USDC fee sponsorship",
      "wallet unlinkability",
    ],
  };
}

export function websiteJsonLd(description: string) {
  return {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: AEO.name,
    url: SITE_URL,
    description,
    publisher: { "@id": `${SITE_URL}/#organization` },
    inLanguage: "en",
  };
}

export function softwareApplicationJsonLd() {
  return {
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}/#ghost-gas`,
    name: AEO.productName,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web, Solana",
    url: SITE_URL,
    description: AEO.description,
    offers: {
      "@type": "Offer",
      price: "0.01",
      priceCurrency: "USD",
      description: "Default flat USDC debit per sponsored send from the gas note",
    },
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

export function faqPageJsonLd(faqs: FaqItem[] = SITE_FAQS) {
  return {
    "@type": "FAQPage",
    "@id": `${SITE_URL}/#faq`,
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };
}

export function howToJsonLd() {
  return {
    "@type": "HowTo",
    "@id": `${SITE_URL}/#how-to`,
    name: "How to send tokens with Ghost Gas",
    description:
      "Prepay USDC once, then send SPL tokens from a wallet with zero SOL.",
    step: HOW_TO_STEPS.map((step, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: step.name,
      text: step.text,
    })),
  };
}

export function siteGraphJsonLd(description: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(),
      websiteJsonLd(description),
      softwareApplicationJsonLd(),
      faqPageJsonLd(),
      howToJsonLd(),
    ],
  };
}
