import { describe, expect, test } from "vitest";

import { DaimoRequestError } from "../../../common/errors.js";
import { formatUserError } from "../../hooks/formatUserError.js";
import { t } from "../../hooks/locale.js";
import { getBankPickerErrorMessage } from "./AccountBankPickerPage.js";

describe("bank picker errors", () => {
  test("keeps request conflict message for display", () => {
    const message =
      "you have too many active interac transfers. complete or cancel existing transfers before starting another deposit.";
    const formatted = formatUserError(
      new DaimoRequestError({
        status: 409,
        type: "invalid_request_error",
        code: "conflict",
        message,
      }),
      t.errorDepositFailed,
    );

    expect(formatted).toBe(message);
    expect(getBankPickerErrorMessage(formatted)).toBe(message);
  });

  test("falls back to generic deposit failure copy for empty errors", () => {
    expect(formatUserError(new Error(""), t.errorDepositFailed)).toBe(
      t.errorDepositFailed,
    );
    expect(getBankPickerErrorMessage("")).toBe(t.errorDepositFailed);
  });
});
