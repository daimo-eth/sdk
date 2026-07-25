import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import {
  AccountOtpCodeEntry,
  normalizeOtpCode,
} from "./AccountOtpCodeEntry.js";
import { AccountOtpPage } from "./AccountOtpPage.js";

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

  test("shows wallet and routing consent on Account verification", () => {
    const markup = renderToStaticMarkup(
      createElement(AccountOtpPage, {
        onBack: () => undefined,
        onVerified: () => undefined,
      }),
    );

    expect(markup).toContain("By verifying");
    expect(markup).toContain("self-custodial wallet");
    expect(markup).toContain("https://daimo.com/terms-of-use");
    expect(markup).toContain("https://daimo.com/privacy");
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
