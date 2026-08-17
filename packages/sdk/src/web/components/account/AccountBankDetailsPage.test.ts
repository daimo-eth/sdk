// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { DepositBankTransferUi } from "../../../common/account.js";
import { BankTransferFlowPage } from "./AccountBankDetailsPage.js";

const roots: Root[] = [];
const UI = {
  arrivalNotice: "ACH transfers can take up to 3 business days to arrive.",
  providerDisclosure: "Processed by Bridge Building Inc.",
  actionLabel: "I’ve made the transfer",
  confirmation: {
    title: "Your funds are on the way",
    description:
      "We’ll detect your transfer automatically. It can take up to 3 business days to arrive. You can close this page.",
  },
} as const satisfies DepositBankTransferUi;

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => root.unmount());
  }
  document.body.replaceChildren();
});

describe("BankTransferFlowPage", () => {
  test("renders server-owned timing and provider copy", () => {
    const container = renderPage(UI);

    expect(container.textContent).toContain(
      "Send exactly $100 USD by ACH from an account in your name.",
    );
    expect(container.textContent).toContain(
      `${UI.arrivalNotice} ${UI.providerDisclosure}`,
    );
    expect(actionButton(container).textContent).toBe(UI.actionLabel);
  });

  test("shows a final confirmation and returns to the instructions", () => {
    const container = renderPage(UI);

    act(() => actionButton(container).click());

    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(container.textContent).toContain(UI.confirmation.title);
    expect(container.textContent).toContain(UI.confirmation.description);
    expect(container.textContent).toContain(UI.providerDisclosure);
    expect(container.textContent).not.toContain("Routing number");

    const backButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Go back"]',
    );
    if (!backButton) throw new Error("missing confirmation back button");
    act(() => backButton.click());

    expect(container.textContent).toContain("Routing number");
    expect(container.textContent).not.toContain(UI.confirmation.description);
  });

  test("keeps the legacy instruction screen when UI copy is absent", () => {
    const container = renderPage();

    expect(container.textContent).toContain("Return to this page.");
    expect(
      [...container.querySelectorAll("button")].some(
        (button) => button.textContent === UI.actionLabel,
      ),
    ).toBe(false);
    expect(container.textContent).not.toContain(UI.providerDisclosure);
  });
});

function renderPage(ui?: DepositBankTransferUi) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  act(() => {
    root.render(
      createElement(BankTransferFlowPage, {
        title: "Transfer details",
        fields: [
          { label: "Routing number", value: "101019644" },
          { label: "Account number", value: "123456789" },
        ],
        summary: ui
          ? "Send exactly $100 USD by ACH from an account in your name."
          : "Return to this page.",
        ui,
        onBack: vi.fn(),
      }),
    );
  });
  return container;
}

function actionButton(container: HTMLElement): HTMLButtonElement {
  const button = [...container.querySelectorAll("button")].find(
    (node) => node.textContent === UI.actionLabel,
  );
  if (!button) throw new Error("missing transfer action");
  return button;
}
