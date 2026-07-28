import { describe, expect, test } from "vitest";

import {
  findCanonicalPrivyWallet,
  findPrivyEmbeddedWalletByAddress,
  listPrivyEmbeddedWallets,
} from "./accountWallet.js";

describe("wallet-scoped Privy selection", () => {
  test("preserves every exact wallet ID with a normalized address", () => {
    const wallets = listPrivyEmbeddedWallets([
      {
        id: "wallet-primary",
        type: "wallet",
        chainType: "ethereum",
        walletClientType: "privy",
        address: "0x1234567890abcdef1234567890abcdef12345678",
        walletIndex: 0,
      },
      {
        id: "wallet-routing",
        type: "wallet",
        chainType: "ethereum",
        walletClientType: "privy",
        address: "0x0000000000000000000000000000000000000814",
        walletIndex: 7,
      },
    ]);

    expect(wallets).toEqual([
      {
        walletId: "wallet-primary",
        walletAddress: "0x1234567890AbcdEF1234567890aBcdef12345678",
      },
      {
        walletId: "wallet-routing",
        walletAddress: "0x0000000000000000000000000000000000000814",
      },
    ]);
  });

  test("selects the only embedded wallet bound to an Account address", () => {
    const wallets = listPrivyEmbeddedWallets([
      {
        id: "wallet-one",
        chainType: "ethereum",
        walletClientType: "privy",
        address: "0x1234567890abcdef1234567890abcdef12345678",
      },
      {
        id: "wallet-two",
        chainType: "ethereum",
        walletClientType: "privy-v2",
        address: "0x0000000000000000000000000000000000000002",
      },
    ]);

    expect(
      findPrivyEmbeddedWalletByAddress(wallets, wallets[1]!.walletAddress),
    ).toEqual(wallets[1]);
    expect(
      findPrivyEmbeddedWalletByAddress(
        wallets,
        "0x1234567890abcdef1234567890abcdef12345678",
      ),
    ).toEqual(wallets[0]);
    expect(
      findPrivyEmbeddedWalletByAddress(
        wallets,
        "0x0000000000000000000000000000000000000099",
      ),
    ).toBeNull();
  });

  test("does not guess when two wallet IDs share the Account address", () => {
    const walletAddress = "0x1234567890abcdef1234567890abcdef12345678";
    const wallets = listPrivyEmbeddedWallets([
      {
        id: "wallet-one",
        chainType: "ethereum",
        walletClientType: "privy",
        address: walletAddress,
      },
      {
        id: "wallet-two",
        chainType: "ethereum",
        walletClientType: "privy",
        address: walletAddress,
      },
    ]);

    expect(findPrivyEmbeddedWalletByAddress(wallets, walletAddress)).toBeNull();
  });

  test("finds the connected signing wallet regardless of address casing", () => {
    const wallet = {
      chainType: "ethereum",
      walletClientType: "privy",
      address: "0x1234567890abcdef1234567890abcdef12345678",
    };

    expect(
      findCanonicalPrivyWallet(
        [wallet],
        "0x1234567890AbcdEF1234567890aBcdef12345678",
      ),
    ).toBe(wallet);
  });

  test("rejects external, non-EVM, malformed, and conflicting wallets", () => {
    const wallets = listPrivyEmbeddedWallets([
      {
        id: "external",
        chainType: "ethereum",
        walletClientType: "metamask",
        address: "0x0000000000000000000000000000000000000001",
      },
      {
        id: "solana",
        chainType: "solana",
        walletClientType: "privy",
        address: "11111111111111111111111111111111",
      },
      {
        id: "conflict",
        chainType: "ethereum",
        walletClientType: "privy",
        address: "0x0000000000000000000000000000000000000002",
      },
      {
        id: "conflict",
        chainType: "ethereum",
        walletClientType: "privy",
        address: "0x0000000000000000000000000000000000000003",
      },
    ]);

    expect(wallets).toEqual([]);
  });
});
