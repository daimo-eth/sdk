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

  it("keeps custom-theme withdrawal UI hidden until the stylesheet settles", () => {
    const html = renderToStaticMarkup(
      createElement(DaimoWithdrawal, {
        fundingMode: "injected-wallet",
        contactStorageScope: "account-1",
        resolveEns: vi.fn(),
        createSession: vi.fn(),
        theme: {
          themeCssUrl: "https://example.com/theme.css",
          themeMode: "dark",
        },
      }),
    );

    expect(html).toContain('style="visibility:hidden"');
    expect(html).toContain('data-theme="dark"');
    expect(html).not.toContain("Where do you want to withdraw?");
  });

  it("uses themeMode as an explicit organization-theme override", () => {
    const html = renderToStaticMarkup(
      createElement(DaimoWithdrawal, {
        fundingMode: "injected-wallet",
        contactStorageScope: "account-1",
        resolveEns: vi.fn(),
        createSession: vi.fn(),
        theme: { themeMode: "dark" },
        themeMode: "light",
      }),
    );

    expect(html).toContain('data-theme="light"');
  });

  it("renders the recipient flow as a dismissible modal", () => {
    const html = renderToStaticMarkup(
      createElement(DaimoWithdrawal, {
        fundingMode: "injected-wallet",
        contactStorageScope: "account-1",
        resolveEns: vi.fn(),
        createSession: vi.fn(),
        embedded: false,
        onClose: vi.fn(),
      }),
    );

    expect(html).toContain("daimo-modal-backdrop");
    expect(html).toContain('aria-label="Close"');
  });
});
