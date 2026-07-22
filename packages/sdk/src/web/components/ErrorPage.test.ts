import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { DaimoSDKProvider } from "../hooks/DaimoClientContext.js";

import { ErrorPage } from "./ErrorPage.js";

describe("ErrorPage", () => {
  test("shows back navigation when provided", () => {
    const html = renderErrorPage({ onBack: () => {} });

    expect(html).toContain('aria-label="Go back"');
  });

  test("keeps back navigation optional", () => {
    const html = renderErrorPage({});

    expect(html).not.toContain('aria-label="Go back"');
  });
});

function renderErrorPage(props: { onBack?: () => void }): string {
  return renderToStaticMarkup(
    createElement(DaimoSDKProvider, {
      apiUrl: "https://api.example.test",
      children: createElement(ErrorPage, { message: "failed", ...props }),
    }),
  );
}
