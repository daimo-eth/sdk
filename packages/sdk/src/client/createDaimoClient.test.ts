import { describe, expect, test } from "vitest";

import { createDaimoClient } from "./createDaimoClient.js";

describe("prepareDeposit authorization compatibility", () => {
  test("normalizes a legacy flat response from an older server", async () => {
    let requestBody: unknown;
    const client = createDaimoClient({
      baseUrl: "https://api.example.test",
      fetchImpl: async (_input, init) => {
        requestBody = JSON.parse(String(init?.body));
        return Response.json({
          routingSignData: { legacy: true },
          deliverySignData: { legacy: true },
        });
      },
    });

    await expect(
      client.account.prepareDeposit(
        {
          sessionId: "session-1",
          rail: "interac",
          depositAmount: "100",
          authorizationVersion: 2,
        },
        { bearerToken: "token" },
      ),
    ).resolves.toEqual({
      kind: "signatures",
      routingSignData: { legacy: true },
      deliverySignData: { legacy: true },
    });
    expect(requestBody).toMatchObject({ authorizationVersion: 2 });
  });

  test("preserves a v2 direct response", async () => {
    const client = createDaimoClient({
      baseUrl: "https://api.example.test",
      fetchImpl: async () => Response.json({ kind: "direct" }),
    });

    await expect(
      client.account.prepareDeposit(
        {
          sessionId: "session-2",
          rail: "interac",
          depositAmount: "100",
          authorizationVersion: 2,
        },
        { bearerToken: "token" },
      ),
    ).resolves.toEqual({ kind: "direct" });
  });
});
