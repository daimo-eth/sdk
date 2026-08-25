// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";

import { t } from "../../hooks/locale.js";
import {
  AccountOtpCodeEntry,
  normalizeOtpCode,
} from "./AccountOtpCodeEntry.js";
import { AccountOtpPage } from "./AccountOtpPage.js";

const roots: Root[] = [];

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => root.unmount());
  }
  document.body.replaceChildren();
});

describe("OTP input semantics", () => {
  test("keeps a visible native input without a group focus ring", () => {
    const markup = renderToStaticMarkup(
      createElement(AccountOtpCodeEntry, {
        destination: "test@example.com",
        onBack: () => undefined,
        onVerified: () => undefined,
        onVerify: async () => ({ ok: true }),
        onResend: async () => undefined,
      }),
    );

    expect(markup).toContain('autoComplete="one-time-code"');
    expect(markup).toContain('inputMode="numeric"');
    expect(markup).toContain('pattern="[0-9]*"');
    expect(markup).toContain("daimo-text-transparent");
    expect(markup).not.toContain("daimo-opacity-0");
    expect(markup).not.toContain("focus-within:daimo-ring-2");
  });

  test("shows only terms and privacy consent on Account verification", () => {
    const markup = renderToStaticMarkup(
      createElement(AccountOtpPage, {
        sessionId: "session-test",
        clientSecret: "secret-test",
        onBack: () => undefined,
        onVerified: () => undefined,
      }),
    );

    expect(markup).toContain("By verifying, you agree to the");
    expect(markup).toContain("Terms and Conditions");
    expect(markup).toContain("https://daimo.com/terms-of-use");
    expect(markup).toContain("Privacy Policy");
    expect(markup).toContain("https://daimo.com/privacy");
    expect(markup).not.toContain("self-custodial wallet");
    expect(markup).not.toContain("routing policy");
  });
});

describe("OTP input normalization", () => {
  test("accepts keyboard entry", () => {
    expect(normalizeOtpCode("123456")).toBe("123456");
  });

  test("accepts formatted autofill and paste values", () => {
    expect(normalizeOtpCode("Your code is 123 456")).toBe("123456");
    expect(normalizeOtpCode("123-456")).toBe("123456");
  });

  test("limits input to one six-digit code", () => {
    expect(normalizeOtpCode("123456789")).toBe("123456");
  });
});

describe("OTP resend", () => {
  test("single-flights a resend while the request is pending", async () => {
    const onResend = vi.fn(() => new Promise<void>(() => undefined));
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    act(() => {
      root.render(
        createElement(AccountOtpCodeEntry, {
          destination: "test@example.com",
          onBack: vi.fn(),
          onVerified: vi.fn(),
          onVerify: async () => ({ ok: true }),
          onResend,
        }),
      );
    });

    const resend = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === t.accountResendCode,
    );
    if (!resend) throw new Error("missing resend button");

    await act(async () => {
      resend.click();
      resend.click();
    });

    expect(onResend).toHaveBeenCalledTimes(1);
    expect(resend.disabled).toBe(true);
  });
});
