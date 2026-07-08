import { describe, expect, test } from "vitest";

import type { PaymentMethod } from "../../common/session.js";
import type { NavNode, SessionWithNav } from "../api/navTree.js";
import { getAccountResumeTarget } from "./accountResumeNav.js";

const interacNode = {
  type: "Fiat",
  id: "Interac",
  title: "Interac",
  fiatMethod: "interac",
} satisfies NavNode;

const applePayNode = {
  type: "Fiat",
  id: "ApplePay",
  title: "Apple Pay",
  fiatMethod: "apple_pay",
} satisfies NavNode;

const walletNode = {
  type: "DepositAddress",
  id: "DepositAddress",
  title: "Deposit address",
  address: "0x0000000000000000000000000000000000000001",
  chainId: 8453,
  minimumUsd: 1,
  maximumUsd: 1000,
  expiresAt: 1,
  tokenSuffix: "USDC",
} satisfies NavNode;

const fiatPaymentMethod = {
  type: "fiat",
  fiatMethod: "interac",
  createdAt: 1,
} satisfies PaymentMethod;

const evmPaymentMethod = {
  type: "evm",
  receiverAddress: "0x0000000000000000000000000000000000000001",
  createdAt: 1,
} satisfies PaymentMethod;

function session(
  overrides: Partial<
    Pick<SessionWithNav, "status" | "paymentMethod" | "navTree">
  >,
): Pick<SessionWithNav, "status" | "paymentMethod" | "navTree"> {
  return {
    status: "succeeded",
    paymentMethod: fiatPaymentMethod,
    navTree: [interacNode],
    ...overrides,
  };
}

describe("getAccountResumeTarget", () => {
  test("paid interac session chooses the interac fiat node", () => {
    expect(getAccountResumeTarget(session({}))).toEqual({
      nodeId: "Interac",
      rail: "interac",
    });
  });

  test("paid fiat session works inside a multi-option nav tree", () => {
    const navTree: NavNode[] = [
      {
        type: "ChooseOption",
        id: "root",
        title: "Choose a payment method",
        options: [walletNode, { ...applePayNode }, { ...interacNode }],
      },
    ];

    expect(getAccountResumeTarget(session({ navTree }))).toEqual({
      nodeId: "Interac",
      rail: "interac",
    });
  });

  test("selected fiat session resumes while waiting for account payment", () => {
    expect(
      getAccountResumeTarget(session({ status: "waiting_payment" })),
    ).toEqual({
      nodeId: "Interac",
      rail: "interac",
    });
  });

  test("session requiring payment method returns no resume target", () => {
    expect(
      getAccountResumeTarget(
        session({
          status: "requires_payment_method",
          paymentMethod: undefined,
        }),
      ),
    ).toBeNull();
  });

  test("paid non-fiat session returns no resume target", () => {
    expect(
      getAccountResumeTarget(session({ paymentMethod: evmPaymentMethod })),
    ).toBeNull();
  });

  test("fiat session without fiatMethod returns no resume target", () => {
    expect(
      getAccountResumeTarget(
        session({ paymentMethod: { type: "fiat", createdAt: 1 } }),
      ),
    ).toBeNull();
  });
});
