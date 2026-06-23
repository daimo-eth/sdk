import { describe, expect, test } from "vitest";

import {
  digitsOnly,
  parseDateOfBirth,
  zApplePayVerificationForm,
  zLegalNameForm,
} from "./formSchemas.js";

describe("account form schemas", () => {
  test("normalizes legal names", () => {
    expect(
      zLegalNameForm.parse({ firstName: " Ada ", lastName: " Lovelace " }),
    ).toEqual({ firstName: "Ada", lastName: "Lovelace" });
  });

  test("rejects empty legal names with lowercase field errors", () => {
    const result = zLegalNameForm.safeParse({ firstName: " ", lastName: "" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.flatten().fieldErrors).toEqual({
      firstName: ["enter your first name"],
      lastName: ["enter your last name"],
    });
  });

  test("normalizes valid date of birth fields", () => {
    expect(parseDateOfBirth({ month: "2", day: "9", year: "1990" })).toEqual({
      month: "02",
      day: "09",
      year: "1990",
    });
  });

  test("rejects impossible dates", () => {
    expect(parseDateOfBirth({ month: "2", day: "29", year: "2024" })).toEqual(
      { month: "02", day: "29", year: "2024" },
    );
    expect(parseDateOfBirth({ month: "2", day: "29", year: "2023" })).toBe(
      null,
    );
    expect(parseDateOfBirth({ month: "13", day: "1", year: "1990" })).toBe(
      null,
    );
  });

  test("normalizes apple pay verification payloads", () => {
    const result = zApplePayVerificationForm.parse({
      ssnLast4: "1234",
      dateOfBirth: { month: "1", day: "31", year: "1985" },
    });

    expect(result).toEqual({
      ssnLast4: "1234",
      dateOfBirth: { month: "01", day: "31", year: "1985" },
    });
  });

  test("keeps only digits up to the max length", () => {
    expect(digitsOnly("12a-34 56", 4)).toBe("1234");
  });
});

