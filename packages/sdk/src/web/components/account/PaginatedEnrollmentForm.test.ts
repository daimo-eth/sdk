import type { EnrollmentFormField } from "../../../common/account.js";
import { describe, expect, test } from "vitest";

import {
  dependentFieldKeys,
  updateFormValuesForChange,
  validateEnrollmentField,
} from "./PaginatedEnrollmentForm.js";

const fields: EnrollmentFormField[] = [
  {
    key: "department",
    type: "select",
    label: "Department",
    required: true,
    options: [
      { value: "CO.DC", label: "Bogotá" },
      { value: "CO.AN", label: "Antioquia" },
    ],
  },
  {
    key: "municipality",
    type: "dependent-select",
    label: "Municipality",
    required: true,
    dependsOn: "department",
    optionsByValue: {
      "CO.DC": [{ value: "11001", label: "11001" }],
      "CO.AN": [{ value: "5001", label: "5001" }],
    },
  },
  {
    key: "neighborhood",
    type: "dependent-select",
    label: "Neighborhood",
    required: true,
    dependsOn: "municipality",
    optionsByValue: {
      "11001": [{ value: "chapinero", label: "Chapinero" }],
      "5001": [{ value: "poblado", label: "El Poblado" }],
    },
  },
];

describe("dependent enrollment form selects", () => {
  test("clears a child selection when its parent changes", () => {
    expect(
      updateFormValuesForChange(
        fields,
        {
          department: "CO.DC",
          municipality: "11001",
          neighborhood: "chapinero",
        },
        "department",
        "CO.AN",
      ),
    ).toEqual({
      department: "CO.AN",
      municipality: "",
      neighborhood: "",
    });
  });

  test("preserves a child selection when it remains valid", () => {
    expect(
      updateFormValuesForChange(
        fields,
        {
          department: "CO.DC",
          municipality: "11001",
          neighborhood: "chapinero",
        },
        "department",
        "CO.DC",
      ),
    ).toEqual({
      department: "CO.DC",
      municipality: "11001",
      neighborhood: "chapinero",
    });
  });

  test("finds transitive fields whose errors must be cleared", () => {
    expect(dependentFieldKeys(fields, "department")).toEqual([
      "municipality",
      "neighborhood",
    ]);
  });
});

describe("enrollment phone validation", () => {
  const phoneField: EnrollmentFormField = {
    key: "phone",
    type: "text",
    label: "Phone",
    required: true,
    inputMode: "tel",
    autoComplete: "tel",
    maxLength: 40,
    placeholder: "+57 300 111 2233",
  };

  test("accepts local and international Colombian numbers", () => {
    expect(validateEnrollmentField(phoneField, "3001112233")).toBeUndefined();
    expect(
      validateEnrollmentField(phoneField, "+57 300 111 2233"),
    ).toBeUndefined();
  });

  test("rejects a complete invalid number locally", () => {
    expect(validateEnrollmentField(phoneField, "1234567890")).toBe(
      "enter a valid phone number",
    );
  });
});
