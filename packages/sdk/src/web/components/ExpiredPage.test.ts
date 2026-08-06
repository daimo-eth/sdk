import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { setLocale } from "../hooks/locale.js";
import { ExpiredPage } from "./ExpiredPage.js";

describe("ExpiredPage", () => {
  afterEach(() => setLocale("en"));

  it("uses withdrawal copy in withdrawal mode", () => {
    const html = renderToStaticMarkup(
      createElement(ExpiredPage, {
        sessionId: "session-1",
        mode: "withdrawal",
      }),
    );

    expect(html).toContain("Withdrawal expired");
    expect(html).toContain("withdrawal session expired");
    expect(html).not.toContain("payment session expired");
  });

  it("localizes withdrawal copy", () => {
    setLocale("es");
    const html = renderToStaticMarkup(
      createElement(ExpiredPage, {
        sessionId: "session-1",
        mode: "withdrawal",
      }),
    );

    expect(html).toContain("Retiro expirado");
    expect(html).toContain("Esta sesión de retiro expiró.");
  });
});
