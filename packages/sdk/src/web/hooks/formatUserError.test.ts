import { describe, expect, test } from "vitest";

import { DaimoRequestError } from "../../common/errors.js";
import { formatUserError } from "./formatUserError.js";
import { t } from "./locale.js";

describe("formatUserError", () => {
  test("keeps backend-localized apple pay provider errors", () => {
    const message = "Apple Pay no está disponible en este sitio.";
    const error = new DaimoRequestError({
      status: 409,
      type: "invalid_request_error",
      code: "apple_pay_unavailable_on_site",
      message,
    });

    expect(formatUserError(error, t.errorDepositFailed)).toBe(message);
  });

  test("hides unrecognized internal api errors", () => {
    const error = new DaimoRequestError({
      status: 500,
      type: "api_error",
      code: "internal_error",
      message: "database connection failed",
    });

    expect(formatUserError(error, t.errorDepositFailed)).toBe(
      t.errorDepositFailed,
    );
  });

  test("keeps request conflict messages for user-actionable errors", () => {
    const message =
      "you have too many active interac transfers. complete or cancel existing transfers before starting another deposit.";
    const error = new DaimoRequestError({
      status: 409,
      type: "invalid_request_error",
      code: "conflict",
      message,
    });

    expect(formatUserError(error, t.errorDepositFailed)).toBe(message);
  });
});
