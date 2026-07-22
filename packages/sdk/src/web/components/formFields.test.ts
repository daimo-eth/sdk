import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import {
  DaimoPhoneField,
  inferPhoneCountry,
  isPossiblePhoneInput,
  isValidPhoneInput,
} from "./formFields.js";

describe("phone input", () => {
  test("infers the default country from the field example", () => {
    expect(inferPhoneCountry("+57 300 111 2233")).toBe("CO");
    expect(inferPhoneCountry("+54 221 122 8855")).toBe("AR");
  });

  test("detects complete invalid numbers before submission", () => {
    expect(isPossiblePhoneInput("1234567890", "CO")).toBe(true);
    expect(isValidPhoneInput("1234567890", "CO")).toBe(false);
    expect(isValidPhoneInput("3001112233", "CO")).toBe(true);
    expect(isValidPhoneInput("+14157350982", "CO")).toBe(true);
  });

  test("renders an accessible region selector and formatted phone input", () => {
    const markup = renderToStaticMarkup(
      createElement(DaimoPhoneField, {
        value: "+14157350982",
        defaultCountry: "CO",
        autoComplete: "tel",
        placeholder: "+57 300 111 2233",
        onValueChange: () => undefined,
      }),
    );

    expect(markup).toContain("<select");
    expect(markup).toContain('aria-label="Phone number country"');
    expect(markup).toContain("🇺🇸");
    expect(markup).toContain("+1");
    expect(markup).toContain('type="tel"');
    expect(markup).toContain('inputMode="tel"');
    expect(markup).toContain('autoComplete="tel"');
    expect(markup).toContain('value="+1 415 735 0982"');
    expect(markup).toContain('placeholder="300 1112233"');
  });
});
