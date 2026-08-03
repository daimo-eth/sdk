import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { NavNodeDeeplink } from "../api/navTree.js";

import { DeeplinkPage } from "./DeeplinkPage.js";
import { QRCode } from "./QRCode.js";

const LONG_DEEPLINK_URL =
  "https://example.com/?partnerId=abcdef12-3456-7890-abcd-ef1234567890&cryptoCurrency=USDC&blockchain=ARBITRUM&walletAddress=0x1234567890abcdef1234567890ABCDEF12345678&disableCryptoCurrency=true&disableWalletAddress=true&source=example";

describe("QRCode", () => {
  it("renders long compact values with low correction and a four-module margin", () => {
    const html = renderToStaticMarkup(
      createElement(QRCode, { value: LONG_DEEPLINK_URL, variant: "compact" }),
    );

    // The payload is a 53-module version 9 QR at correction level L, plus an
    // explicit four-module quiet zone on each side.
    expect(html).toContain('data-qr-variant="compact"');
    expect(html).toContain('viewBox="0 0 61 61"');
    expect(html).toContain('shape-rendering="crispEdges"');
  });

  it("keeps the existing styled renderer by default", () => {
    const html = renderToStaticMarkup(
      createElement(QRCode, { value: LONG_DEEPLINK_URL }),
    );

    expect(html).not.toContain('data-qr-variant="compact"');
    expect(html).toContain('viewBox="0 0 288 288"');
  });
});

describe("DeeplinkPage", () => {
  it("uses the compact renderer for an unbranded desktop deeplink", () => {
    const node: NavNodeDeeplink = {
      type: "Deeplink",
      id: "LongDeeplink",
      title: "Long deeplink",
      icon: "/wallet-logos/example.svg",
      pageIcon: "",
      url: LONG_DEEPLINK_URL,
    };

    const html = renderToStaticMarkup(
      createElement(DeeplinkPage, {
        node,
        platform: "desktop",
        onBack: null,
        baseUrl: "https://example.com",
      }),
    );

    expect(html).toContain('data-qr-variant="compact"');
    expect(html).not.toContain("wallet-logos/example.svg");
  });
});
