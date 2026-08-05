import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ExpiredPage } from "./ExpiredPage.js";

describe("ExpiredPage", () => {
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
});
