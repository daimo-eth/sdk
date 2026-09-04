// @vitest-environment happy-dom

import { act, createElement, type ReactElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  DepositConstraints,
  EnrollmentInteraction,
} from "../../common/account.js";
import {
  AccountFlowContext,
  useAccountFlowState,
} from "../hooks/useAccountFlow.js";
import { AccountOtpCodeEntry } from "./account/AccountOtpCodeEntry.js";
import { setLocale, t } from "../hooks/locale.js";
import { DaimoAccountEnrollmentPreview } from "./DaimoAccountEnrollmentPreview.js";
import { AccountAmountContent } from "./account/AccountPaymentPage.js";

const roots: Root[] = [];
const active: EnrollmentInteraction = {
  version: 1,
  kind: "active",
  polling: { status: "none" },
};
const fetchMock = vi.fn();

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

beforeEach(() => {
  setLocale("en");
  vi.useFakeTimers();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockRejectedValue(new Error("preview must not request data"));
});

afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount());
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("DaimoAccountEnrollmentPreview", () => {
  it("shows the real finalizing skeleton without starting the supplied poll", async () => {
    const container = renderPreview({
      version: 1,
      kind: "wait",
      reason: "processing",
      polling: { status: "poll", delayMs: 500 },
    });
    expect(container.textContent).toContain(t.accountProviderPending);
    expect(
      container.querySelector('[aria-busy="true"]')?.getAttribute("aria-label"),
    ).toBe(t.accountProviderPendingDesc);
    expect(container.querySelector("fieldset:disabled")).not.toBeNull();
    await act(async () => vi.advanceTimersByTime(60_000));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "isolates OTP preview from host auth errors and loggingIn=%s",
    async (isLoggingIn) => {
      const setAuthError = vi.fn();
      const interaction: EnrollmentInteraction = {
        version: 1,
        kind: "otp",
        destination: "email",
        copy: {
          title: "Verify your email",
          message: "Enter the enrollment code",
          invalidMessage: "Invalid code",
        },
        submitAction: { id: "otp-submit", revision: "1" },
        resend: {
          status: "available",
          delayMs: 0,
          action: { id: "otp-resend", revision: "1" },
        },
        polling: { status: "none" },
      };
      const container = render(
        createElement(
          HostAccount,
          { isLoggingIn, setAuthError },
          createElement(
            "section",
            { "data-preview": true },
            createElement(DaimoAccountEnrollmentPreview, {
              email: "customer@example.test",
              interaction,
            }),
          ),
          createElement(
            "section",
            { "data-live": true },
            createElement(AccountOtpCodeEntry, {
              destination: "host@example.test",
              onBack: () => undefined,
              onVerified: () => undefined,
              onVerify: async () => ({ ok: true }),
              onResend: async () => undefined,
            }),
          ),
        ),
      );
      const preview = container.querySelector("[data-preview]");
      const live = container.querySelector("[data-live]");
      if (!preview || !live) throw new Error("missing otp test views");
      expect(preview?.textContent).toContain("Enter the enrollment code");
      expect([...preview.querySelectorAll("button")].at(-1)?.textContent).toBe(
        t.accountVerify,
      );
      expect(preview?.textContent).not.toContain("host login failed");
      expect(
        preview?.querySelector("input")?.getAttribute("aria-invalid"),
      ).toBe("false");
      expect(preview?.querySelector("fieldset:disabled")).not.toBeNull();
      expect(live?.textContent).toContain("host login failed");
      expect([...live.querySelectorAll("button")].at(-1)?.textContent).toBe(
        isLoggingIn ? t.loading : t.accountVerify,
      );
      expect(live?.querySelector("input")?.getAttribute("aria-invalid")).toBe(
        "true",
      );
      await act(async () => vi.advanceTimersByTime(60_000));
      expect(setAuthError).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("shows review copy without a finalizing skeleton", () => {
    const container = renderPreview({
      version: 1,
      kind: "wait",
      reason: "review",
      polling: { status: "none" },
    });
    expect(container.textContent).toContain(t.accountEnrollmentPending);
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it.each(["USD", "EUR"])(
    "shows the real %s amount entry while blocking deposit creation",
    async (currency) => {
      const container = renderPreview(active, constraints(currency));
      expect(container.textContent).toContain(t.accountPayment);
      expect(container.querySelector('[aria-busy="true"]')).toBeNull();
      inputAmount(container, "100");
      expect(container.querySelector("input")?.value).toBe("100");
      expect(continueButton(container).disabled).toBe(true);
      await act(async () => {
        container
          .querySelector("input")
          ?.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
          );
        continueButton(container).click();
        vi.advanceTimersByTime(60_000);
      });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("reports missing active constraints rather than showing a false loading state", () => {
    const container = renderPreview(active);
    expect(container.textContent).toContain("payment constraints are missing");
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it("shows errors without a client provider or telemetry", async () => {
    const container = renderPreview({
      version: 1,
      kind: "error",
      message: "account is unavailable",
      retryable: false,
      polling: { status: "none" },
    });
    expect(container.textContent).toContain("account is unavailable");
    await act(async () => vi.advanceTimersByTime(60_000));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cannot open hosted verification or run its return action", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const container = renderPreview({
      version: 1,
      kind: "hosted",
      mode: "hosted",
      purpose: "identity-verification",
      url: "https://example.test/verify",
      copy: {
        title: "Verify identity",
        description: "Complete verification",
        openExternalLabel: "Verify",
      },
      returnBehavior: {
        kind: "submit",
        action: { id: "verify", revision: "1" },
        autoSubmitDelayMs: 500,
      },
      polling: { status: "none" },
    });
    const button = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Verify",
    );
    expect(button?.disabled).toBe(true);
    await act(async () => {
      button?.click();
      vi.advanceTimersByTime(60_000);
    });
    expect(open).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("shared amount content", () => {
  it("keeps runtime validation and amount submission", () => {
    const onSubmit = vi.fn();
    const container = render(
      createElement(AccountAmountContent, {
        constraints: constraints("EUR"),
        platform: "desktop",
        baseUrl: "",
        onSubmit,
      }),
    );
    inputAmount(container, "1");
    expect(continueButton(container).disabled).toBe(true);
    inputAmount(container, "1001");
    expect(continueButton(container).disabled).toBe(true);
    inputAmount(container, "100");
    expect(continueButton(container).disabled).toBe(false);
    act(() => continueButton(container).click());
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ nativeAmount: 100 });
  });
});

function renderPreview(
  interaction: EnrollmentInteraction,
  paymentConstraints?: DepositConstraints,
) {
  return render(
    createElement(DaimoAccountEnrollmentPreview, {
      email: "support@example.test",
      interaction,
      constraints: paymentConstraints,
    }),
  );
}

function render(element: ReactElement) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  act(() => root.render(element));
  return container;
}

function continueButton(container: HTMLElement) {
  const button = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === t.continue,
  );
  if (!button) throw new Error("missing continue button");
  return button;
}

function inputAmount(container: HTMLElement, value: string) {
  const input = container.querySelector("input");
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  if (!input || !setter) throw new Error("missing amount input");
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function constraints(currency: string): DepositConstraints {
  const symbol = currency === "EUR" ? "€" : "$";
  return {
    currency: { code: currency, symbol },
    amountRange: { min: "10", max: "1000" },
    icon: { logoURI: "/flag.svg", alt: currency },
    badge: { logoURI: "/bank.svg", alt: "Bank" },
    destinationToken: {
      chainId: 8453,
      token: "0x0000000000000000000000000000000000000001",
      symbol: currency === "EUR" ? "EURC" : "USDC",
      decimals: 6,
      logoURI: "/coin.svg",
      logoSourceURI: "/coin.svg",
      usd: currency === "EUR" ? 1.1 : 1,
      priceFromUsd: 1,
      maxAcceptUsd: 10000,
      maxSendUsd: 10000,
      displayDecimals: 2,
    },
  };
}

function HostAccount({
  children,
  isLoggingIn,
  setAuthError,
}: {
  children?: ReactNode;
  isLoggingIn: boolean;
  setAuthError: (error: string | null) => void;
}) {
  const account = useAccountFlowState();
  return createElement(
    AccountFlowContext.Provider,
    {
      value: {
        ...account,
        email: "host@example.test",
        authError: "host login failed",
        authErrorDetails: {
          stage: "email_code_verify",
          eventError: "email code verify failed",
          errorCode: "host_auth_failure",
        },
        isLoggingIn,
        setAuthError,
      },
    },
    children,
  );
}
