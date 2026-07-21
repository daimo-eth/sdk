import { describe, expect, test, vi } from "vitest";

import { getRemainingSeconds } from "./Countdown.js";

describe("absolute countdown", () => {
  test("uses wall-clock time after background and resume", () => {
    vi.setSystemTime(new Date("2026-07-15T12:00:00Z"));
    const expiresAt = Date.now() / 1000 + 120;
    expect(getRemainingSeconds(expiresAt)).toBe(120);

    vi.setSystemTime(new Date("2026-07-15T12:01:30Z"));
    expect(getRemainingSeconds(expiresAt)).toBe(30);
    vi.useRealTimers();
  });

  test("renders a past expiry immediately", () => {
    expect(getRemainingSeconds(100, 101_000)).toBe(0);
  });
});
