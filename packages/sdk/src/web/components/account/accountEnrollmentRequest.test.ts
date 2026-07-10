import { describe, expect, test } from "vitest";

import { getAccountEnrollmentRequest } from "./accountEnrollmentRequest.js";

describe("getAccountEnrollmentRequest", () => {
  test("forwards the hosted KYC destination on initial and polling calls", () => {
    const args = {
      rail: "sepa" as const,
      legalName: { firstName: "Ada", lastName: "Lovelace" },
      returnUrl: "https://app.example/verification/done",
    };

    const initialRequest = getAccountEnrollmentRequest(args);
    const pollingRequest = getAccountEnrollmentRequest(args);

    expect(initialRequest).toEqual({
      rail: "sepa",
      legalName: args.legalName,
      returnUrl: "https://app.example/verification/done",
    });
    expect(pollingRequest.returnUrl).toBe(
      "https://app.example/verification/done",
    );
  });

  test("omits absent optional fields", () => {
    expect(
      getAccountEnrollmentRequest({ rail: "interac", legalName: null }),
    ).toEqual({ rail: "interac" });
  });
});
