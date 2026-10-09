import { describe, expect, test } from "vitest";

import { getChainById, retiredChains, supportedChains } from "./chain.js";

describe("retiredChains", () => {
  test("resolve by id but stay out of supportedChains", () => {
    for (const chain of retiredChains) {
      expect(getChainById(chain.chainId)).toBe(chain);
      expect(supportedChains.map((c) => c.chainId)).not.toContain(
        chain.chainId,
      );
    }
  });
});
