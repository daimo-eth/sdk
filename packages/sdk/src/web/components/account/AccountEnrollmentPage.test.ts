// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setLocale, t } from "../../hooks/locale.js";
import type { EnrollmentInteraction } from "../../../common/account.js";
import {
  EnrollmentCodePage,
  EnrollmentEmailChangePage,
} from "./AccountEnrollmentPage.js";

const roots: Root[] = [];

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("EnrollmentEmailChangePage", () => {
  beforeEach(() => {
    setLocale("en");
  });

  afterEach(() => {
    for (const root of roots.splice(0)) {
      act(() => root.unmount());
    }
    document.body.replaceChildren();
  });

  function renderPage(onUseAnotherEmail: () => Promise<void>) {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);
    act(() => {
      root.render(
        createElement(EnrollmentEmailChangePage, {
          email: "user@example.com",
          onBack: vi.fn(),
          onUseAnotherEmail,
        }),
      );
    });
    return container;
  }

  function cta(container: HTMLElement): HTMLButtonElement {
    const button = [...container.querySelectorAll("button")].find(
      (node) => node.getAttribute("aria-label") !== "Go back",
    );
    if (!button) throw new Error("missing use-another-email button");
    return button;
  }

  it("shows the authenticated email and no support action", () => {
    const container = renderPage(vi.fn(async () => undefined));
    expect(container.textContent).toContain("We can't use user@example.com");
    expect(container.textContent).toContain(
      "It is linked to another company on PayTrie",
    );
    expect(container.querySelector("strong")?.textContent).toBe(
      "user@example.com",
    );
    expect(container.querySelector("br")).not.toBeNull();
    expect(container.textContent?.endsWith(".")).toBe(false);
    expect(container.textContent).toContain(t.accountEmailChangeCta);
    expect(container.textContent).not.toContain(t.contactSupport);
  });

  it("disables the button and single-flights logout", async () => {
    const onUseAnotherEmail = vi.fn(() => new Promise<void>(() => undefined));
    const container = renderPage(onUseAnotherEmail);
    const button = cta(container);

    await act(async () => {
      button.click();
      button.click();
    });

    expect(onUseAnotherEmail).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe(t.loading);
  });

  it("shows the existing logout-failure copy", async () => {
    const onUseAnotherEmail = vi.fn(async () => {
      throw new Error("recreate failed");
    });
    const container = renderPage(onUseAnotherEmail);

    await act(async () => {
      cta(container).click();
    });

    expect(container.textContent).toContain(t.accountLogoutFailed);
    expect(cta(container).disabled).toBe(false);
  });
});

describe("EnrollmentCodePage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    for (const root of roots.splice(0)) {
      act(() => root.unmount());
    }
    document.body.replaceChildren();
  });

  it("enforces the server-provided resend delay after load and resend", async () => {
    const interaction: Extract<EnrollmentInteraction, { kind: "code" }> = {
      version: 3,
      kind: "code",
      polling: { status: "none" },
      destination: "email",
      format: "uuid",
      copy: {
        title: "Connect account",
        message: "Check your email",
        invalidMessage: "Invalid code",
        inputLabel: "Link code",
        submitLabel: "Connect",
        resendLabel: "Send a new code",
      },
      submitAction: { id: "submit-link", revision: "1" },
      resend: {
        status: "available",
        delayMs: 1_000,
        action: { id: "resend-link", revision: "1" },
      },
    };
    const onSubmit = vi.fn(async () => ({
      interaction,
      protocol: "generic" as const,
    }));
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    act(() => {
      root.render(
        createElement(EnrollmentCodePage, {
          interaction,
          onBack: vi.fn(),
          onSubmit,
        }),
      );
    });

    const resend = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === interaction.copy.resendLabel,
    );
    if (!resend) throw new Error("missing resend button");
    expect(resend.disabled).toBe(true);

    await act(async () => vi.advanceTimersByTime(1_000));
    expect(resend.disabled).toBe(false);

    await act(async () => resend.click());
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("resend-link", {
      kind: "resend-code",
    });
    expect(resend.disabled).toBe(true);

    await act(async () => vi.advanceTimersByTime(999));
    expect(resend.disabled).toBe(true);
    await act(async () => vi.advanceTimersByTime(1));
    expect(resend.disabled).toBe(false);
  });
});
