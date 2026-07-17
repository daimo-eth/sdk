import { describe, expect, test } from "vitest";

import type {
  AccountDepositStatus,
  DepositPaymentInfo,
  DepositPaymentInteraction,
} from "../../../common/account.js";
import type { NavNodeFiat } from "../../api/navTree.js";
import type { DaimoPlatform } from "../../platform.js";
import {
  getAccountPaymentAdvanceTarget,
  getAccountPaymentEntryTarget,
  getDepositResumeTarget,
  isPaymentInteractionCompatible,
  shouldRecoverExpiredPayment,
} from "./accountNav.js";
import {
  getInstitutionPaymentContract,
  getNodePaymentInteraction,
} from "./accountPaymentCompatibility.js";

const ALL_PLATFORMS: DaimoPlatform[] = [
  "desktop",
  "mobile",
  "ios",
  "android",
  "other",
];

const ALL_INTERACTIONS: DepositPaymentInteraction[] = [
  "bank-picker",
  "bank-transfer",
  "directions",
  "request-to-pay",
  "wallet-pay-widget",
];

describe("interaction-driven account navigation", () => {
  test("wallet pay keeps combined entry while other interactions enter amount", () => {
    expect(getAccountPaymentEntryTarget("wallet-pay-widget")).toBe(
      "account-wallet-pay",
    );
    for (const interaction of [
      "bank-picker",
      "bank-transfer",
      "directions",
      "request-to-pay",
    ] as const) {
      expect(getAccountPaymentEntryTarget(interaction)).toBe("account-amount");
    }
  });

  test("institution picker preserves desktop and mobile choreography", () => {
    expect(getAccountPaymentAdvanceTarget("bank-picker", "desktop")).toBe(
      "account-institution-picker",
    );
    expect(getAccountPaymentAdvanceTarget("bank-picker", "other")).toBe(
      "account-institution-picker",
    );
    for (const platform of ["mobile", "ios", "android"] as const) {
      expect(getAccountPaymentAdvanceTarget("bank-picker", platform)).toBe(
        "account-institution-review",
      );
    }
  });

  test("every non-picker interaction has a platform-independent renderer", () => {
    const expected = {
      "bank-transfer": "account-payment-instructions",
      directions: "account-payment-instructions",
      "request-to-pay": "account-request-to-pay",
      "wallet-pay-widget": "account-wallet-pay",
    } as const;
    for (const [interaction, target] of Object.entries(expected)) {
      for (const platform of ALL_PLATFORMS) {
        expect(
          getAccountPaymentAdvanceTarget(
            interaction as keyof typeof expected,
            platform,
          ),
        ).toBe(target);
      }
    }
  });

  test("actual payment flow must match the advertised interaction", () => {
    for (const advertised of ALL_INTERACTIONS) {
      for (const actual of ALL_INTERACTIONS) {
        const payment = { flow: actual } as DepositPaymentInfo;
        expect(isPaymentInteractionCompatible(advertised, payment)).toBe(
          advertised === actual,
        );
      }
    }
  });

  test("uses server interaction without consulting the rail", () => {
    const node = makeFiatNode("ach", "wallet-pay-widget");
    expect(getNodePaymentInteraction(node)).toBe("wallet-pay-widget");
  });

  test("isolates temporary old-server rail fallback", () => {
    expect(getNodePaymentInteraction(makeFiatNode("interac"))).toBe(
      "bank-picker",
    );
    expect(getNodePaymentInteraction(makeFiatNode("apple_pay"))).toBe(
      "wallet-pay-widget",
    );
    expect(getNodePaymentInteraction(makeFiatNode("ach"))).toBe(
      "bank-transfer",
    );
    expect(getNodePaymentInteraction(makeFiatNode("sepa"))).toBe(
      "bank-transfer",
    );
    expect(getNodePaymentInteraction(makeFiatNode("jpyc"))).toBe("directions");
    expect(getNodePaymentInteraction(makeFiatNode("ars"))).toBe(
      "bank-transfer",
    );
  });

  test("isolates old bank-picker payload normalization", () => {
    const payment = {
      flow: "bank-picker",
      currency: { code: "CAD", symbol: "CA$" },
      qrUrl: "https://example.com/accept?rID=legacy-reference",
    } as const;

    const contract = getInstitutionPaymentContract(payment, "25.00");
    expect(contract.ui.review.fields).toEqual([
      { key: "sender", label: "Sender", value: "PayTrie AB Inc" },
      { key: "amount", label: "Amount", value: "CA$25.00 CAD" },
    ]);
    expect(contract.ui.review.fieldsAfterInstitution).toEqual([
      {
        key: "processing_time",
        label: "Processing time",
        value: "5–30 min",
      },
    ]);
    expect(contract.ui.waiting.instructions).toContain("5–30 min");
    expect(contract.fallbackDeeplink).toEqual({
      type: "redirect",
      url: payment.qrUrl,
    });
  });

  test("preserves server-owned UI when only the fallback action is absent", () => {
    const institutionPaymentUi = {
      picker: {
        title: "Choose an institution",
        searchPlaceholder: "Search institutions",
        otherInstitutionsLabel: "More institutions",
      },
      review: {
        title: "Review payment request",
        description: "Review the request in your institution.",
        fields: [{ key: "reference", label: "Reference", value: "abc-123" }],
        institutionLabel: "Institution",
        openInstitutionLabel: "Open",
        openFallbackLabel: "Open request",
      },
      waiting: {
        title: "Complete payment",
        instructions: "Approve the request in your institution.",
        openInstitutionLabel: "Open",
        openFallbackLabel: "Open request",
      },
    };
    const payment = {
      flow: "bank-picker",
      currency: { code: "USD", symbol: "$" },
      qrUrl: "https://example.com/request/abc-123",
      institutionPaymentUi,
    } as const;

    const contract = getInstitutionPaymentContract(payment, "25.00");
    expect(contract.ui).toBe(institutionPaymentUi);
    expect(contract.fallbackDeeplink).toEqual({
      type: "redirect",
      url: payment.qrUrl,
    });
  });
});

describe("getDepositResumeTarget", () => {
  const ALL_STATUSES: AccountDepositStatus[] = [
    "initiated",
    "awaiting_payment",
    "payment_received",
    "token_delivered",
    "completed",
    "expired",
    "failed",
  ];

  test("deposits past payment resume at the status page", () => {
    const resumed: AccountDepositStatus[] = [
      "payment_received",
      "token_delivered",
      "completed",
      "failed",
      "expired",
    ];
    for (const status of resumed) {
      expect(getDepositResumeTarget(status)).toBe("account-status");
    }
  });

  test("pre-payment deposits re-enter the interaction flow", () => {
    expect(getDepositResumeTarget("initiated")).toBeNull();
    expect(getDepositResumeTarget("awaiting_payment")).toBeNull();
  });

  test("expired request-to-pay re-enters interaction recovery", () => {
    expect(getDepositResumeTarget("expired", "request-to-pay")).toBeNull();
    expect(shouldRecoverExpiredPayment("expired", "request-to-pay")).toBe(
      true,
    );
    expect(shouldRecoverExpiredPayment("expired", "bank-transfer")).toBe(
      false,
    );
  });

  test("every status has a decision", () => {
    for (const status of ALL_STATUSES) {
      const target = getDepositResumeTarget(status);
      expect(target === "account-status" || target === null).toBe(true);
    }
  });
});

function makeFiatNode(
  fiatMethod: NavNodeFiat["fiatMethod"],
  paymentInteraction?: DepositPaymentInteraction,
): NavNodeFiat {
  return {
    type: "Fiat",
    id: `Fiat-${fiatMethod}`,
    title: fiatMethod,
    fiatMethod,
    paymentInteraction,
  };
}
