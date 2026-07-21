import { describe, expect, test, vi } from "vitest";

import { createDaimoClient } from "../../client/createDaimoClient.js";
import type { AccountFlowState } from "./useAccountFlow.js";
import { signAndUpsertDeposit } from "./useDraftDeposit.js";

describe("signAndUpsertDeposit", () => {
  test("does not request signatures for direct delivery", async () => {
    const requestBodies: unknown[] = [];
    const client = createDaimoClient({
      baseUrl: "https://api.example.test",
      fetchImpl: async (input, init) => {
        requestBodies.push(JSON.parse(String(init?.body)));
        if (String(input).endsWith("/deposit/prepare")) {
          return Response.json({ kind: "direct" });
        }
        return Response.json({ deposit: { id: "deposit-1" }, payment: null });
      },
    });
    const signTypedData = vi.fn(async () => "0xsignature");
    const accountFlow = {
      getAccessToken: vi.fn(async () => "access-token"),
      signTypedData,
    } as unknown as AccountFlowState;

    await signAndUpsertDeposit({
      client,
      accountFlow,
      sessionId: "session-1",
      depositAmount: "100",
      rail: "interac",
    });

    expect(signTypedData).not.toHaveBeenCalled();
    expect(requestBodies).toHaveLength(2);
    expect(requestBodies[0]).toMatchObject({ authorizationVersion: 2 });
    expect(requestBodies[1]).toMatchObject({
      authorizationVersion: 2,
      sessionId: "session-1",
    });
    expect(requestBodies[1]).not.toMatchObject({
      routingSig: expect.anything(),
      deliverySig: expect.anything(),
    });
  });
});
