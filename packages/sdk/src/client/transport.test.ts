import { afterEach, describe, expect, test, vi } from "vitest";

import { DaimoRequestError } from "../common/errors.js";
import { createTransport } from "./transport.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("transport request timeout", () => {
  test("aborts a response body that stalls after headers arrive", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const transport = createTransport({
      baseUrl: "https://api.example.test",
      timeoutMs: 100,
      fetchImpl: async (_url, init) => {
        signal = init?.signal ?? undefined;
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('{"status":'));
              signal?.addEventListener("abort", () => {
                controller.error(signal?.reason);
              });
            },
          }),
        );
      },
    });
    const result = transport
      .request({ method: "GET", path: "/v1/sessions/session" })
      .catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(100);

    expect(signal?.aborted).toBe(true);
    expect(await result).toBeInstanceOf(DaimoRequestError);
    expect(await result).toMatchObject({
      status: 0,
      message: "request timed out",
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  test("clears the timeout after a successful response body", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const transport = createTransport({
      baseUrl: "https://api.example.test",
      timeoutMs: 100,
      fetchImpl: async (_url, init) => {
        signal = init?.signal ?? undefined;
        return Response.json({ status: "pending" });
      },
    });

    await expect(
      transport.request({ method: "GET", path: "/v1/sessions/session" }),
    ).resolves.toEqual({ status: "pending" });
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(100);
    expect(signal?.aborted).toBe(false);
  });

  test("clears the timeout after a response body read fails", async () => {
    vi.useFakeTimers();
    const readError = new Error("connection interrupted");
    const transport = createTransport({
      baseUrl: "https://api.example.test",
      timeoutMs: 100,
      fetchImpl: async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.error(readError);
            },
          }),
        ),
    });

    await expect(
      transport.request({ method: "GET", path: "/v1/sessions/session" }),
    ).rejects.toMatchObject({
      name: "DaimoRequestError",
      status: 0,
      message: "connection interrupted",
      raw: readError,
    });
    expect(vi.getTimerCount()).toBe(0);
  });
});
