// @vitest-environment happy-dom

import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ModalChrome } from "./ModalChrome.js";

const roots: Root[] = [];

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("ModalChrome account controls", () => {
  afterEach(() => {
    for (const root of roots.splice(0)) {
      act(() => root.unmount());
    }
    document.body.replaceChildren();
  });

  it("shows the authenticated email and logs out", async () => {
    const onLogout = vi.fn().mockResolvedValue(undefined);
    const container = await renderChrome(onLogout);
    const accountButton = getButton(container, "Daimo Account menu");
    const accountPanel = getElement<HTMLElement>(container, '[role="dialog"]');

    expect(accountButton.getAttribute("aria-expanded")).toBe("false");
    expect(accountPanel.getAttribute("aria-hidden")).toBe("true");

    await click(accountButton);

    expect(accountButton.getAttribute("aria-expanded")).toBe("true");
    expect(accountPanel.getAttribute("aria-hidden")).toBe("false");
    expect(accountPanel.textContent).toContain("Logged in as");
    expect(accountPanel.textContent).toContain("person@example.com");
    expect(accountPanel.textContent).not.toContain("Log out");
    expect(getElement(accountPanel, "button").getAttribute("aria-label")).toBe(
      "Log out",
    );

    await click(getElement(accountPanel, "button"));

    expect(onLogout).toHaveBeenCalledOnce();
    expect(accountButton.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes the account panel from the modal body", async () => {
    const container = await renderChrome(vi.fn().mockResolvedValue(undefined));
    const accountButton = getButton(container, "Daimo Account menu");

    await click(accountButton);
    await click(getElement(container, '[data-testid="modal-body"]'));

    expect(accountButton.getAttribute("aria-expanded")).toBe("false");
  });

  it("keeps the account panel open when session recreation fails", async () => {
    const container = await renderChrome(
      vi.fn().mockRejectedValue(new Error("recreate failed")),
    );
    const accountButton = getButton(container, "Daimo Account menu");
    const accountPanel = getElement<HTMLElement>(container, '[role="dialog"]');

    await click(accountButton);
    await click(getElement(accountPanel, "button"));

    expect(accountButton.getAttribute("aria-expanded")).toBe("true");
    expect(accountPanel.textContent).toContain("Could not log out. Try again.");
  });
});

async function renderChrome(onLogout: () => Promise<void>) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  const children: ComponentProps<typeof ModalChrome>["children"] = (
    dismissAccount,
  ) =>
    createElement("div", {
      "data-testid": "modal-body",
      onClick: dismissAccount ?? undefined,
    });

  await act(async () => {
    root.render(
      createElement(ModalChrome, {
        controls: {
          type: "account-close",
          account: { email: "person@example.com", onLogout },
          close: { onClose: vi.fn() },
        },
        children,
      }),
    );
  });

  return container;
}

async function click(element: Element) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function getButton(container: HTMLElement, label: string): HTMLButtonElement {
  return getElement(container, `button[aria-label="${label}"]`);
}

function getElement<T extends Element>(
  container: HTMLElement,
  selector: string,
): T {
  const element = container.querySelector<T>(selector);
  if (!element) throw new Error(`element not found: ${selector}`);
  return element;
}
