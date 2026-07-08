import { describe, expect, test } from "vitest";

import { parseDaimoFrameMessage } from "./frameMessages.js";

const base = { source: "daimo-pay", version: 1 } as const;

describe("parseDaimoFrameMessage", () => {
  test("parses lifecycle and payment events", () => {
    for (const type of [
      "ready",
      "modalOpened",
      "modalClosed",
      "paymentStarted",
      "paymentCompleted",
    ] as const) {
      expect(parseDaimoFrameMessage({ ...base, type })).toEqual({
        ...base,
        type,
      });
    }
  });

  test("parses contentHeightChanged with a positive height", () => {
    expect(
      parseDaimoFrameMessage({
        ...base,
        type: "contentHeightChanged",
        payload: { height: 480 },
      }),
    ).toEqual({ ...base, type: "contentHeightChanged", payload: { height: 480 } });
  });

  test("rejects non-positive or missing heights", () => {
    expect(
      parseDaimoFrameMessage({
        ...base,
        type: "contentHeightChanged",
        payload: { height: 0 },
      }),
    ).toBeNull();
    expect(
      parseDaimoFrameMessage({ ...base, type: "contentHeightChanged" }),
    ).toBeNull();
  });

  test("rejects foreign, mis-versioned, or malformed messages", () => {
    expect(parseDaimoFrameMessage(null)).toBeNull();
    expect(parseDaimoFrameMessage("paymentCompleted")).toBeNull();
    expect(
      parseDaimoFrameMessage({ source: "other", version: 1, type: "ready" }),
    ).toBeNull();
    expect(
      parseDaimoFrameMessage({ ...base, version: 2, type: "ready" }),
    ).toBeNull();
    expect(parseDaimoFrameMessage({ ...base, type: "unknown" })).toBeNull();
  });
});
