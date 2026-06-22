import { describe, expect, test } from "vitest";

import { buildDaimoPayUrl, parseDaimoPayMessage } from "./index.js";

describe("Daimo Pay embed", () => {
  test("builds embed URL from the secret pay URL", () => {
    const url = buildDaimoPayUrl({
      payUrl: "https://miniapp.daimo.com/pay?session=sess&cs=secret",
      layout: "embed",
      parentOrigin: "https://merchant.example",
      locale: "pt-BR",
      theme: "dark",
    });

    expect(url).toBe(
      "https://miniapp.daimo.com/pay?session=sess&cs=secret&layout=embed&parentOrigin=https%3A%2F%2Fmerchant.example&locale=pt-BR&theme=dark",
    );
  });

  test("parses valid V2 host messages", () => {
    const message = parseDaimoPayMessage(
      {
        origin: "https://miniapp.daimo.com",
        data: {
          source: "daimo-pay",
          version: 2,
          type: "contentHeightChanged",
          payload: { height: 480 },
        },
      } as MessageEvent,
      { expectedOrigin: "https://miniapp.daimo.com" },
    );

    expect(message).toEqual({
      source: "daimo-pay",
      version: 2,
      type: "contentHeightChanged",
      payload: { height: 480 },
    });
  });

  test("rejects wrong origin, source, version, and payload", () => {
    const base = {
      origin: "https://evil.example",
      data: {
        source: "daimo-pay",
        version: 2,
        type: "ready",
        payload: {},
      },
    } as MessageEvent;

    expect(
      parseDaimoPayMessage(base, {
        expectedOrigin: "https://miniapp.daimo.com",
      }),
    ).toBeNull();
    expect(
      parseDaimoPayMessage({
        origin: "https://miniapp.daimo.com",
        data: { ...base.data, source: "other" },
      } as MessageEvent),
    ).toBeNull();
    expect(
      parseDaimoPayMessage({
        origin: "https://miniapp.daimo.com",
        data: { ...base.data, version: 1 },
      } as MessageEvent),
    ).toBeNull();
    expect(
      parseDaimoPayMessage({
        origin: "https://miniapp.daimo.com",
        data: {
          source: "daimo-pay",
          version: 2,
          type: "contentHeightChanged",
          payload: {},
        },
      } as MessageEvent),
    ).toBeNull();
  });
});
