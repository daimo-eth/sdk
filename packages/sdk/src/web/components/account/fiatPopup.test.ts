import { describe, expect, it } from "vitest";

import { buildFiatPopupUrl, interactionRequiresPopup } from "./fiatPopup.js";

describe("buildFiatPopupUrl", () => {
  it("swaps embed layout for popup params, preserving session context", () => {
    const url = buildFiatPopupUrl(
      "https://daimo.com/webview?session=abc123&cs=secret&layout=embed&locale=es&theme=dark",
      "Fiat-ApplePay",
    );
    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://daimo.com");
    expect(parsed.pathname).toBe("/webview");
    expect(parsed.searchParams.get("session")).toBe("abc123");
    expect(parsed.searchParams.get("cs")).toBe("secret");
    expect(parsed.searchParams.get("locale")).toBe("es");
    expect(parsed.searchParams.get("theme")).toBe("dark");
    expect(parsed.searchParams.get("layout")).toBe("center");
    expect(parsed.searchParams.get("popup")).toBe("1");
    expect(parsed.searchParams.get("nav")).toBe("Fiat-ApplePay");
  });

  it("adds params when none are present", () => {
    const url = buildFiatPopupUrl(
      "https://daimo.com/webview?session=abc&cs=s",
      "node-1",
    );
    expect(url).toContain("layout=center");
    expect(url).toContain("popup=1");
    expect(url).toContain("nav=node-1");
  });
});

describe("interactionRequiresPopup", () => {
  it("requires popup for wallet-pay widgets only", () => {
    expect(interactionRequiresPopup("wallet-pay-widget")).toBe(true);
    expect(interactionRequiresPopup("bank-transfer")).toBe(false);
    expect(interactionRequiresPopup("bank-picker")).toBe(false);
    expect(interactionRequiresPopup("directions")).toBe(false);
  });
});
