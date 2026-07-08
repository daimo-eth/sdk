import { describe, expect, test } from "vitest";

import { getInteracRequestReference } from "./AccountInteracConfirmPage.js";

describe("getInteracRequestReference", () => {
  test("parses rID from an interac url", () => {
    expect(
      getInteracRequestReference(
        "https://etransfer.interac.ca/acceptPaymentRequest.do?rID=CA1MRyhdKDRe&src=email",
      ),
    ).toBe("CA1MRyhdKDRe");
  });

  test("parses encoded rID values", () => {
    expect(
      getInteracRequestReference(
        "https://etransfer.interac.ca/acceptPaymentRequest.do?rID=CA%20123",
      ),
    ).toBe("CA 123");
  });

  test("returns null when rID is missing", () => {
    expect(
      getInteracRequestReference(
        "https://etransfer.interac.ca/acceptPaymentRequest.do?src=email",
      ),
    ).toBeNull();
  });

  test("returns null for invalid urls", () => {
    expect(getInteracRequestReference("https://[::1")).toBeNull();
  });

  test("returns null for null url", () => {
    expect(getInteracRequestReference(null)).toBeNull();
  });
});
