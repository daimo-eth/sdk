// @vitest-environment happy-dom

import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { getAddress } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { base } from "../../common/chain.js";
import { DaimoSDKProvider } from "../hooks/DaimoClientContext.js";
import { saveDaimoWithdrawalContact } from "../withdrawal.js";
import { DaimoWithdrawal } from "./DaimoWithdrawal.js";

const STORAGE_SCOPE = "withdrawal-dismiss-test";
const DESTINATION = getAddress("0x1111111111111111111111111111111111111111");
const roots: Root[] = [];
const storedValues = new Map<string, string>();
const storage = {
  getItem: (key: string) => storedValues.get(key) ?? null,
  setItem: (key: string, value: string) => storedValues.set(key, value),
};

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("DaimoWithdrawal dismissal", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", storage);
  });

  afterEach(() => {
    for (const root of roots.splice(0)) {
      act(() => root.unmount());
    }
    document.body.replaceChildren();
    storedValues.clear();
    vi.unstubAllGlobals();
  });

  it.each([
    ["close button", (container: HTMLElement) => getCloseButton(container)],
    [
      "backdrop",
      (container: HTMLElement) =>
        getElement(container, ".daimo-modal-backdrop"),
    ],
  ])("self-dismisses from the %s and calls onClose once", async (_, target) => {
    const onClose = vi.fn();
    const { container } = await renderWithdrawal({
      fundingMode: "injected-wallet",
      contactStorageScope: STORAGE_SCOPE,
      createSession: vi.fn(),
      embedded: false,
      onClose,
    });

    await click(target(container));

    expect(container.innerHTML).toBe("");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("self-dismisses after entering the manual flow", async () => {
    saveDaimoWithdrawalContact(
      {
        identifier: DESTINATION,
        identifierType: "evm",
        asset: "USDC",
        chainId: base.chainId,
        lastUsedAt: Date.now(),
      },
      STORAGE_SCOPE,
      storage,
    );
    const createSession = vi.fn().mockResolvedValue({
      sessionId: "session-1",
      clientSecret: "secret-1",
    });
    const onClose = vi.fn();
    const { container } = await renderWithdrawal({
      fundingMode: "manual",
      contactStorageScope: STORAGE_SCOPE,
      createSession,
      sendManualTransaction: vi.fn(),
      embedded: false,
      onClose,
    });

    const savedDestination = getElement(
      container,
      `[title="${DESTINATION}"]`,
    ).closest("button");
    if (!savedDestination)
      throw new Error("saved destination button not found");
    await click(savedDestination);

    expect(createSession).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Enter Amount");

    await click(getCloseButton(container));

    expect(container.innerHTML).toBe("");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("self-dismisses without an onClose callback", async () => {
    const { container } = await renderWithdrawal({
      fundingMode: "injected-wallet",
      contactStorageScope: STORAGE_SCOPE,
      createSession: vi.fn(),
      embedded: false,
    });

    await click(getCloseButton(container));

    expect(container.innerHTML).toBe("");
  });

  it("keeps embedded rendering open without modal controls", async () => {
    const onClose = vi.fn();
    const { container } = await renderWithdrawal({
      fundingMode: "injected-wallet",
      contactStorageScope: STORAGE_SCOPE,
      createSession: vi.fn(),
      onClose,
    });

    expect(container.textContent).toContain("Where do you want to withdraw?");
    expect(container.querySelector(".daimo-modal-backdrop")).toBeNull();
    expect(container.querySelector('button[aria-label="Close"]')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("starts open again after remounting", async () => {
    const props: ComponentProps<typeof DaimoWithdrawal> = {
      fundingMode: "injected-wallet",
      contactStorageScope: STORAGE_SCOPE,
      createSession: vi.fn(),
      embedded: false,
    };
    const first = await renderWithdrawal(props);
    await click(getCloseButton(first.container));
    expect(first.container.innerHTML).toBe("");

    act(() => first.root.unmount());
    roots.splice(roots.indexOf(first.root), 1);
    const second = await renderWithdrawal(props);

    expect(
      second.container.querySelector(".daimo-modal-backdrop"),
    ).not.toBeNull();
    expect(getCloseButton(second.container)).toBeInstanceOf(HTMLButtonElement);
  });
});

async function renderWithdrawal(props: ComponentProps<typeof DaimoWithdrawal>) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);

  await act(async () => {
    root.render(
      createElement(DaimoSDKProvider, {
        apiUrl: "https://api.example.test",
        children: createElement(DaimoWithdrawal, props),
      }),
    );
  });

  return { container, root };
}

async function click(element: Element) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function getCloseButton(container: HTMLElement): HTMLButtonElement {
  return getElement<HTMLButtonElement>(container, 'button[aria-label="Close"]');
}

function getElement<T extends Element>(
  container: HTMLElement,
  selector: string,
): T {
  const element = container.querySelector<T>(selector);
  if (!element) throw new Error(`element not found: ${selector}`);
  return element;
}
