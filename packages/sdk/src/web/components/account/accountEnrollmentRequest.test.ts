import { describe, expect, test } from "vitest";

import { getAccountEnrollmentRequest } from "./accountEnrollmentRequest.js";

describe("getAccountEnrollmentRequest", () => {
  test("includes the legal name on initial and polling calls", () => {
    const args = {
      rail: "sepa" as const,
      legalName: { firstName: "Ada", lastName: "Lovelace" },
    };

    const initialRequest = getAccountEnrollmentRequest(args);
    const pollingRequest = getAccountEnrollmentRequest(args);

    expect(initialRequest).toEqual({
      rail: "sepa",
      legalName: args.legalName,
    });
    expect(pollingRequest).toEqual(initialRequest);
  });

  test("omits absent optional fields", () => {
    expect(
      getAccountEnrollmentRequest({ rail: "interac", legalName: null }),
    ).toEqual({ rail: "interac" });
  });
});
