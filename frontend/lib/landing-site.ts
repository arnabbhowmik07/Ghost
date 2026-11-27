/** Links and on-chain proof data for the marketing landing. */

import { LINKS } from "@/lib/links";
import {
  CLUSTER as ENV_CLUSTER,
  MAINNET_RELAYER_PUBKEY,
  MAINNET_USDC_MINT,
  isMainnetCluster,
} from "./config";

/** Marketing CTAs land on login so the wallet connector never opens elsewhere. */
export const APP_URL = LINKS.login;
export const REPO_URL = LINKS.github;

export const SCAN = "https://explorer.solana.com";
export const CLUSTER = ENV_CLUSTER;

/** Relayer's mainnet Circle USDC associated token account (created 2026-11-22). */
export const MAINNET_RELAYER_USDC_ATA =
  "8nso8xA8LC5thQGyJawY3iusmhdc3YdsaE48CnTRnDFH";

export function explorerAddress(address: string) {
  const q = isMainnetCluster() ? "" : `?cluster=${CLUSTER}`;
  return `${SCAN}/address/${address}${q}`;
}

export function explorerTx(signature: string) {
  const q = isMainnetCluster() ? "" : `?cluster=${CLUSTER}`;
  return `${SCAN}/tx/${signature}${q}`;
}

const DEVNET_CONTRACTS = [
  {
    name: "ghost_pool",
    address: "69gepJRrDXGgaKExaUHWmDjtLe4LHxTrNiGVzBGoTczR",
    tags: ["Privacy pool", "Poseidon notes"],
  },
  {
    name: "Pool PDA",
    address: "DbMcqri6ScZSnQBpDATapaWWUfUGTiytyMuzZrZKpZCr",
    tags: ["Config", "Merkle index"],
  },
  {
    name: "Vault ATA",
    address: "GDhkKy7KupmP9w24XhinatErS8R6ejea95brgKX2z9uR",
    tags: ["USDC vault"],
  },
  {
    name: "Relayer",
    address: "EWpDhR9kvBtPSwhiGbqarjxsy97nJSE784HjzkQ9Lsxf",
    tags: ["Fee payer", "ZK gate"],
  },
  {
    name: "Mock USDC",
    address: "GLfrBSjkzFQZJrWEcWfA9j1yapabGYTwdcNJKAgqWeCt",
    tags: ["SPL mint", "6 decimals"],
  },
];

const MAINNET_CONTRACTS = [
  {
    name: "Circle USDC",
    address: MAINNET_USDC_MINT,
    tags: ["SPL mint", "6 decimals"],
  },
  {
    name: "Relayer",
    address: MAINNET_RELAYER_PUBKEY,
    tags: ["Fee payer", "Ghost Gas"],
  },
  {
    name: "Treasury ATA",
    address: MAINNET_RELAYER_USDC_ATA,
    tags: ["USDC vault", "Prepaid credit"],
  },
];

/** Mock USDC and devnet pool accounts are hidden on a mainnet build. */
export const contracts = isMainnetCluster() ? MAINNET_CONTRACTS : DEVNET_CONTRACTS;

export const transactions = isMainnetCluster()
  ? []
  : [
      {
        name: "UI deposit",
        hash: "hhpGJ73UU2Nj4SMyPevcGS8PMamC7CvJf6WbUXDTuve1vH9p5Jwp7jVbgmkVsLGWodRKN1PkMvD1wqjmztTvQbC",
        tags: ["1 USDC", "Ghost Note issued"],
      },
      {
        name: "UI withdraw",
        hash: "5uWUc9DXn1bURdDAZzSoqNN3x5zpdsgwiAmxMin8867Vv6uvKGhKWaCTg5NE6RFVBmcGxeHhxcWYhFND86iitYWp",
        tags: ["0 SOL from recipient", "Relayer paid fees"],
      },
    ];
