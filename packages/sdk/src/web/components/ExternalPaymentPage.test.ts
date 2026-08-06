import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import { ExternalPaymentPage } from "./ExternalPaymentPage.js";

const commonProps = {
  title: "Lemon",
  platform: "mobile" as const,
  url: "https://example.com",
  icon: "/lemon.svg",
  message: "legacy waiting message",
  onBack: null,
  baseUrl: "https://example.com",
  desktopBehavior: "qr" as const,
};

test("renders structured waiting instructions as line-preserving paragraphs", () => {
  const html = renderToStaticMarkup(
    createElement(ExternalPaymentPage, {
      ...commonProps,
      instructions: [
        {
          text: "Scan this QR code with",
          emphasis: "your phone’s camera",
        },
        {
          text: "In Lemon you'll pay",
          emphasis: "99 USDT + 1 USDT fee",
        },
        { text: "Keep this page open for confirmation" },
      ],
    }),
  );

  expect(html.match(/<p(?:\s|>)/g)).toHaveLength(3);
  expect(html).toContain("daimo-text-center");
  expect(html).toContain("daimo-whitespace-pre-line");
  expect(html).toContain("In Lemon you&#x27;ll pay");
  expect(html.match(/<strong(?:\s|>)/g)).toHaveLength(2);
  expect(html).toContain("daimo-block");
  expect(html).toContain("your phone’s camera</strong>");
  expect(html).toContain("99 USDT + 1 USDT fee</strong>");
  expect(html).not.toContain("<ul");
  expect(html).not.toMatch(/<li(?:\s|>)/);
  expect(html).not.toContain("•");
  expect(html).not.toContain("legacy waiting message");
  expect(html).not.toContain("&lt;bold&gt;");
  expect(html).not.toContain("\\n");
});

test("falls back to the legacy waiting-message paragraph", () => {
  const html = renderToStaticMarkup(
    createElement(ExternalPaymentPage, {
      ...commonProps,
      message:
        "In Lemon you'll pay\n99 USDT + 1 USDT fee\n\nReturn here for confirmation",
    }),
  );

  expect(html).toContain("<p");
  expect(html).toContain("daimo-whitespace-pre-line");
  expect(html).toContain("In Lemon you&#x27;ll pay\n99 USDT + 1 USDT fee");
  expect(html).not.toContain("<ul");
  expect(html).not.toMatch(/<li(?:\s|>)/);
  expect(html).not.toContain("•");
});
