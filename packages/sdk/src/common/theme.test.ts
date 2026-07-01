import { expect, test } from "vitest";

import { DEFAULT_DAIMO_MODAL_THEME, daimoModalThemeToCss } from "./theme.js";

test("daimoModalThemeToCss includes scoped light and dark selectors", () => {
  const css = daimoModalThemeToCss(DEFAULT_DAIMO_MODAL_THEME);

  expect(css).toContain(':root, [data-theme="light"]');
  expect(css).toContain(':root:not([data-theme="light"])');
  expect(css).toContain('[data-theme="dark"]');
});
