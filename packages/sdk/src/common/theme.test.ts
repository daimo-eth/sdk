import { expect, test } from "vitest";

import {
  DEFAULT_DAIMO_MODAL_THEME,
  daimoModalThemeToCss,
  resolveDaimoSessionTheme,
} from "./theme.js";

test("daimoModalThemeToCss includes scoped light and dark selectors", () => {
  const css = daimoModalThemeToCss(DEFAULT_DAIMO_MODAL_THEME);

  expect(css).toContain(':root, [data-theme="light"]');
  expect(css).toContain(':root:not([data-theme="light"])');
  expect(css).toContain('[data-theme="dark"]');
});

test("resolveDaimoSessionTheme applies override precedence", () => {
  expect(resolveDaimoSessionTheme(undefined)).toEqual({
    themeMode: "system",
  });
  expect(resolveDaimoSessionTheme({ themeMode: "dark" })).toEqual({
    themeMode: "dark",
  });
  expect(
    resolveDaimoSessionTheme(
      { themeCssUrl: "https://example.com/theme.css", themeMode: "dark" },
      "light",
    ),
  ).toEqual({
    themeCssUrl: "https://example.com/theme.css",
    themeMode: "light",
  });
});
