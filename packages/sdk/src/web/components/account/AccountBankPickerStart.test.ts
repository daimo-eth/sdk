// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";

import type { DepositPaymentInfo } from "../../../common/account.js";
import { baseCADC } from "../../../common/token.js";
import { AccountInstitutionPickerPage } from "./AccountBankPickerPage.js";

const mocks = vi.hoisted(() => ({
  draft: vi.fn(),
  start: vi.fn(),
  setDepositState: vi.fn(),
}));
vi.mock("../../hooks/DaimoClientContext.js", () => ({
  useDaimoClient: () => ({}),
}));
vi.mock("../../hooks/useAccountFlow.js", () => ({
  useAccountFlow: () => ({}),
  useSessionDepositState: () => ({
    depositState: { kind: "idle", rail: "interac", depositAmount: "100" },
    setDepositState: mocks.setDepositState,
  }),
}));
vi.mock("../../hooks/useDraftDeposit.js", () => ({
  useDraftDeposit: mocks.draft,
  startBankDeposit: mocks.start,
}));

const DISPLAY = {
  currency: { code: "CAD", symbol: "CA$" },
  amountRange: { min: "10", max: "4999" },
  destinationToken: {
    ...baseCADC,
    usd: 0.7,
    priceFromUsd: 1,
    maxAcceptUsd: 10000,
    maxSendUsd: 10000,
    displayDecimals: 2,
  },
  icon: { logoURI: "/flag.svg", alt: "CAD" },
  badge: { logoURI: "/bank.svg", alt: "Bank" },
};
const CATALOG = {
  ...DISPLAY,
  flow: "institution-picker",
  instructions: "Select Bank",
  institutions: [
    { id: "bank-1", name: "Test Bank", logoURI: null, featured: true },
  ],
  ui: {
    title: "Select Bank",
    searchPlaceholder: "Search",
    otherInstitutionsLabel: "Other banks",
  },
  payableAmount: "100",
  expectedSettlementAmount: "100",
  action: {
    id: "action-1",
    revision: "1",
    inputKind: "institution",
    catalogRevision: "interac-1",
  },
} satisfies DepositPaymentInfo;
const PAYMENT = {
  ...DISPLAY,
  flow: "bank-picker",
  instructions: "Approve the request in your bank.",
  institutions: [
    {
      ...CATALOG.institutions[0]!,
      deeplink: { type: "redirect", url: "https://bank.example/request" },
    },
  ],
  qrUrl: "https://interac.example/request",
} satisfies DepositPaymentInfo;

let root: Root | undefined;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
  vi.clearAllMocks();
});

test("previews banks without starting payment, then opens the signed Interac request", async () => {
  mocks.draft.mockReturnValue({
    payment: CATALOG,
    isCreating: false,
    error: null,
  });
  mocks.start.mockResolvedValue({ depositId: "deposit-1", payment: PAYMENT });
  const onSelect = vi.fn();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root?.render(
      createElement(AccountInstitutionPickerPage, {
        rail: "interac",
        paymentInteraction: "bank-picker",
        sessionId: "session-1",
        onSelect,
      }),
    ),
  );
  expect(mocks.start).not.toHaveBeenCalled();
  expect(container.textContent).toContain("Test Bank");
  const bank = container.querySelector<HTMLButtonElement>(
    'button[aria-label="Test Bank"]',
  );
  expect(bank).not.toBeNull();
  await act(async () => bank?.click());
  expect(mocks.start).toHaveBeenCalledWith(
    expect.objectContaining({
      authorizedAmount: "100",
      paymentInput: {
        kind: "institution",
        institutionId: "bank-1",
        actionId: "action-1",
        revision: "1",
        catalogRevision: "interac-1",
      },
    }),
  );
  expect(mocks.setDepositState).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: "started",
      depositId: "deposit-1",
      selectedInstitutionId: "bank-1",
      payment: PAYMENT,
    }),
  );
  expect(onSelect).toHaveBeenCalledWith(PAYMENT);
});
