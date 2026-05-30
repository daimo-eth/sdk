import { useEffect } from "react";

export {
  DAIMO_MODAL_THEME_FIELDS,
  DEFAULT_DAIMO_MODAL_THEME,
  daimoModalThemeToCss,
  daimoModalThemeToCssVars,
  normalizeDaimoModalTheme,
} from "../common/theme.js";
export type {
  DaimoModalTheme,
  DaimoModalThemeMode,
  DaimoModalThemeModeName,
} from "../common/theme.js";

export function DaimoThemeStylesheet({ url }: { url: string }) {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    document.head.appendChild(link);
    return () => link.remove();
  }, [url]);

  return null;
}
