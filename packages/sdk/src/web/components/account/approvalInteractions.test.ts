import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import type { DepositPaymentInfo } from "../../../common/account.js";
import { baseUSDC } from "../../../common/token.js";
import {
  ApprovalActiveContent,
  ApprovalExpiredContent,
  getApprovalDraftConfig,
  getApprovalActionLabel,
} from "./AccountApprovalPage.js";
import {
  buildInstitutionPaymentInput,
  getApprovalContract,
  getAuthorizedRoutingAmount,
  getInstitutionPickerContract,
  isExpiredApproval,
} from "./accountPaymentCompatibility.js";

const CONSTRAINTS = {
  currency: { code: "USD", symbol: "$" },
  amountRange: { min: "10.00", max: "5000.00" },
  destinationToken: {
    ...baseUSDC,
    usd: 1,
    priceFromUsd: 1,
    maxAcceptUsd: 1_000_000,
    maxSendUsd: 1_000_000,
    displayDecimals: 2,
  },
  icon: { logoURI: "/flags/fixture.svg", alt: "Fixture" },
  badge: { logoURI: "/rails/fixture.svg", alt: "Fixture approval" },
} as const;

const INSTITUTION_PICKER = {
  ...CONSTRAINTS,
  flow: "institution-picker",
  instructions: "Choose an institution for this payment.",
  institutions: [
    {
      id: "institution-alpha",
      name: "Synthetic Credit Union",
      logoURI: null,
      featured: true,
    },
  ],
  ui: {
    title: "Choose an institution",
    searchPlaceholder: "Search institutions",
    otherInstitutionsLabel: "More institutions",
  },
  payableAmount: "105.00",
  expectedSettlementAmount: "98.00",
  action: {
    id: "dpi1_fixture-action",
    revision: "1",
    inputKind: "institution",
    catalogRevision: "catalog-7",
  },
} as const satisfies DepositPaymentInfo;

const HOSTED_APPROVAL = {
  ...CONSTRAINTS,
  flow: "hosted-approval",
  ui: {
    title: "Approve payment",
    instructions: "Approve the payment, then return here.",
    openLabel: "Open approval",
    reopenLabel: "Reopen approval",
    expiredTitle: "Approval expired",
    expiredInstructions: "Create a new payment to continue.",
    retryLabel: "Create new payment",
    retryingLabel: "Creating payment",
  },
  approvalUrl: "https://approval.example/fixture-order",
  payableAmount: "105.00",
  expectedSettlementAmount: "98.00",
  expiresAt: 2_000_000_000,
  returnBehavior: { type: "poll" },
  reopen: { type: "same-url" },
  polling: { type: "poll", delayMs: 2_000 },
  retry: { type: "recreate-session" },
} as const satisfies DepositPaymentInfo;

const EXTERNAL_APPROVAL = {
  ...CONSTRAINTS,
  flow: "external-app-approval",
  ui: {
    title: "Approve in your app",
    instructions: "Open your app and approve the pending request.",
    destinationLabel: "Approval destination",
    expiredTitle: "Approval expired",
    expiredInstructions: "Create a new payment to continue.",
    retryLabel: "Create new payment",
    retryingLabel: "Creating payment",
  },
  payableAmount: "105.00",
  expectedSettlementAmount: "98.00",
  maskedDestination: "+1 ••• ••• 0184",
  action: {
    type: "open-url",
    url: "fixture-wallet://approve",
    label: "Open approval app",
  },
  expiresAt: 2_000_000_000,
  polling: { type: "poll", delayMs: 2_000 },
  retry: { type: "recreate-session" },
} as const satisfies DepositPaymentInfo;

describe("institution selection contract", () => {
  test("submits one opaque catalog selection with exact revisions", () => {
    expect(getInstitutionPickerContract(INSTITUTION_PICKER)).not.toBeNull();
    expect(
      buildInstitutionPaymentInput(INSTITUTION_PICKER, "institution-alpha"),
    ).toEqual({
      kind: "institution",
      actionId: "dpi1_fixture-action",
      revision: "1",
      catalogRevision: "catalog-7",
      institutionId: "institution-alpha",
    });
    expect(getAuthorizedRoutingAmount(INSTITUTION_PICKER, "105.00")).toBe(
      "98.00",
    );
  });

  test("fails closed for fabricated selections and malformed catalogs", () => {
    expect(() =>
      buildInstitutionPaymentInput(INSTITUTION_PICKER, "fabricated"),
    ).toThrow("institution not in payment catalog");
    expect(
      getInstitutionPickerContract({
        ...INSTITUTION_PICKER,
        action: { ...INSTITUTION_PICKER.action, revision: "" },
      }),
    ).toBeNull();
    expect(
      getInstitutionPickerContract({
        ...INSTITUTION_PICKER,
        institutions: [
          INSTITUTION_PICKER.institutions[0],
          INSTITUTION_PICKER.institutions[0],
        ],
      }),
    ).toBeNull();
  });
});

describe("approval contracts", () => {
  test("starts fresh approvals signed and resumes existing approvals plainly", () => {
    expect(getApprovalDraftConfig(false, "105.00")).toEqual({
      enabled: true,
      draftMode: "signed",
    });
    expect(getApprovalDraftConfig(true, "105.00")).toEqual({
      enabled: true,
      draftMode: "plain",
    });
    expect(getApprovalDraftConfig(false, "")).toEqual({
      enabled: false,
      draftMode: "signed",
    });
  });

  test("keeps hosted return, reopen, polling, expiry, and settlement explicit", () => {
    expect(getApprovalContract(HOSTED_APPROVAL)).not.toBeNull();
    expect(getApprovalActionLabel(HOSTED_APPROVAL, false)).toBe(
      "Open approval",
    );
    expect(getApprovalActionLabel(HOSTED_APPROVAL, true)).toBe(
      "Reopen approval",
    );
    expect(getAuthorizedRoutingAmount(HOSTED_APPROVAL, "105.00")).toBe("98.00");
    expect(isExpiredApproval(HOSTED_APPROVAL, 1_999_999_999)).toBe(false);
    expect(isExpiredApproval(HOSTED_APPROVAL, 2_000_000_000)).toBe(true);
  });

  test("renders passive masked approval without a QR or payment code", () => {
    const html = renderToStaticMarkup(
      createElement(ApprovalActiveContent, {
        payment: EXTERNAL_APPROVAL,
        remainingS: 90,
        hasOpened: false,
        onOpen: () => undefined,
      }),
    );
    expect(getApprovalContract(EXTERNAL_APPROVAL)).not.toBeNull();
    expect(html).toContain("+1 ••• ••• 0184");
    expect(html).toContain("Open approval app");
    expect(html).toContain("105.00");
    expect(html).toContain("98.00 USDC");
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain("QR");
    expect(html).not.toContain("paymentCode");
  });

  test("supports passive approval with no external action", () => {
    const passive = {
      ...EXTERNAL_APPROVAL,
      action: undefined,
    } satisfies DepositPaymentInfo;
    const contract = getApprovalContract(passive);
    expect(contract).not.toBeNull();
    if (!contract) throw new Error("approval contract missing");
    expect(getApprovalActionLabel(contract, false)).toBeNull();
  });

  test("removes stale approval data and exposes recreation after expiry", () => {
    const html = renderToStaticMarkup(
      createElement(ApprovalExpiredContent, {
        payment: EXTERNAL_APPROVAL,
        isRetrying: false,
        retryError: null,
        onRetry: () => undefined,
      }),
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="assertive"');
    expect(html).toContain("Create new payment");
    expect(html).not.toContain(EXTERNAL_APPROVAL.maskedDestination);
    expect(html).not.toContain(EXTERNAL_APPROVAL.action.label);
  });

  test.each([
    ["relative hosted URL", { approvalUrl: "/relative" }],
    [
      "unsafe external action",
      { action: { ...EXTERNAL_APPROVAL.action, url: "javascript:alert(1)" } },
    ],
    ["missing masked destination", { maskedDestination: "" }],
    ["changed settlement", { expectedSettlementAmount: "0" }],
    ["invalid polling", { polling: { type: "poll", delayMs: 0 } }],
  ])("fails closed for %s", (label, override) => {
    const source =
      label === "relative hosted URL" ? HOSTED_APPROVAL : EXTERNAL_APPROVAL;
    const malformed = { ...source, ...override } as DepositPaymentInfo;
    expect(getApprovalContract(malformed)).toBeNull();
  });

  test("new semantic surfaces contain no provider or rail branches", () => {
    const sources = [
      "AccountApprovalPage.tsx",
      "AccountPaymentResumePage.tsx",
      "accountPaymentCompatibility.ts",
    ].map((file) => readFileSync(new URL(file, import.meta.url), "utf8"));
    for (const source of sources) {
      expect(source).not.toMatch(/ripio|pse|breb|bancolombia|nequi/i);
    }
  });
});
