import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setLocale } from "../hooks/locale.js";
import { ConfirmationPage } from "./ConfirmationPage.js";
import { DaimoWithdrawal } from "./DaimoWithdrawal.js";

describe("withdrawal localization", () => {
  afterEach(() => setLocale("en"));

  it("localizes the withdrawal picker", () => {
    setLocale("es");
    const html = renderToStaticMarkup(
      createElement(DaimoWithdrawal, {
        fundingMode: "injected-wallet",
        contactStorageScope: "account-1",
        resolveEns: vi.fn(),
        createSession: vi.fn(),
      }),
    );

    expect(html).toContain("Retirar");
  });

  it("localizes withdrawal cancellation and retry", () => {
    setLocale("es");
    const html = renderToStaticMarkup(
      createElement(ConfirmationPage, {
        sessionId: "session-1",
        rejected: true,
        onRetry: vi.fn(),
        baseUrl: "https://daimo.com",
        mode: "withdrawal",
      }),
    );

    expect(html).toContain("Retiro cancelado");
    expect(html).toContain("Reintentar retiro");
  });
});
