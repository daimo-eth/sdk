import { useEffect, useState } from "react";

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

export function useDaimoThemeReady(url: string | undefined): boolean {
  const [readyUrl, setReadyUrl] = useState<string>();

  useEffect(() => {
    if (url == null) return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    link.dataset.daimoThemeUrl = url;
    link.addEventListener("load", () => setReadyUrl(url), { once: true });
    link.addEventListener("error", () => setReadyUrl(url), { once: true });
    document.head.appendChild(link);

    return () => link.remove();
  }, [url]);

  return url == null || readyUrl === url;
}

export function DaimoThemeStylesheet({ url }: { url: string }) {
  useDaimoThemeReady(url);
  return null;
}
