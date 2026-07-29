import { describe, expect, test } from "vitest";

import { getAccountAuthFailure } from "./accountAuthFailure.js";

describe("getAccountAuthFailure", () => {
  test("classifies missing auth token without preserving provider text", () => {
    expect(
      getAccountAuthFailure(
        "email_code_send",
        new Error("Missing auth token for person@example.com"),
      ),
    ).toEqual({
      stage: "email_code_send",
      eventError: "email code send failed",
      errorCode: "missing_auth_token",
    });
  });

  test("prefers a stable provider code", () => {
    expect(
      getAccountAuthFailure("email_code_verify", {
        message: "request failed for person@example.com",
        privyErrorCode: "Invalid OTP",
      }),
    ).toEqual({
      stage: "email_code_verify",
      eventError: "email code verify failed",
      errorCode: "invalid_otp",
    });
  });

  test("reads a nested numeric provider code", () => {
    expect(
      getAccountAuthFailure(
        "wallet_provisioning",
        new Error("request failed", { cause: { code: 429 } }),
      ),
    ).toEqual({
      stage: "wallet_provisioning",
      eventError: "wallet provisioning failed",
      errorCode: "429",
    });
  });

  test("does not serialize arbitrary error values", () => {
    expect(
      getAccountAuthFailure("phone_code_send", {
        email: "person@example.com",
        accessToken: "secret",
      }),
    ).toEqual({
      stage: "phone_code_send",
      eventError: "phone code send failed",
      errorCode: "provider_error",
    });
  });
});
