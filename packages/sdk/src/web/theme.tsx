import { useEffect, useState } from "react";

export {
  DAIMO_MODAL_THEME_FIELDS,
  DEFAULT_DAIMO_MODAL_THEME,
  daimoModalThemeToCss,
  daimoModalThemeToCssVars,
  normalizeDaimoModalTheme,
  resolveDaimoSessionTheme,
} from "../common/theme.js";
export type {
  DaimoModalTheme,
  DaimoModalThemeMode,
  DaimoModalThemeModeName,
  DaimoResolvedSessionTheme,
  DaimoSessionTheme,
  DaimoThemeMode,
} from "../common/theme.js";

type DaimoThemeStylesheetEntry = {
  link: HTMLLinkElement;
  ready: boolean;
  users: number;
  listeners: Set<() => void>;
  dispose: () => void;
};

const daimoThemeStylesheets = new Map<string, DaimoThemeStylesheetEntry>();

export function useDaimoThemeReady(url: string | undefined): boolean {
  const [readyUrl, setReadyUrl] = useState<string | undefined>(() =>
    url != null && daimoThemeStylesheets.get(url)?.ready ? url : undefined,
  );

  useEffect(() => {
    if (url == null) {
      setReadyUrl(undefined);
      return;
    }

    return retainDaimoThemeStylesheet(url, () => setReadyUrl(url));
  }, [url]);

  return url == null || readyUrl === url;
}

export function DaimoThemeStylesheet({ url }: { url: string }) {
  useDaimoThemeReady(url);
  return null;
}

/** Share one custom-theme link across nested SDK surfaces. */
export function retainDaimoThemeStylesheet(
  url: string,
  onReady: () => void,
): () => void {
  let entry = daimoThemeStylesheets.get(url);
  if (entry == null) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    link.dataset.daimoThemeUrl = url;

    const listeners = new Set<() => void>();
    const settle = () => {
      const current = daimoThemeStylesheets.get(url);
      if (current == null || current.link !== link || current.ready) return;
      current.ready = true;
      for (const listener of current.listeners) listener();
      current.listeners.clear();
    };
    link.addEventListener("load", settle, { once: true });
    link.addEventListener("error", settle, { once: true });
    entry = {
      link,
      ready: false,
      users: 0,
      listeners,
      dispose: () => {
        link.removeEventListener("load", settle);
        link.removeEventListener("error", settle);
        link.remove();
      },
    };
    daimoThemeStylesheets.set(url, entry);
    document.head.appendChild(link);
  }

  entry.users += 1;
  if (entry.ready) onReady();
  else entry.listeners.add(onReady);

  return () => {
    const current = daimoThemeStylesheets.get(url);
    if (current == null) return;
    current.listeners.delete(onReady);
    current.users -= 1;
    if (current.users > 0) return;
    current.dispose();
    daimoThemeStylesheets.delete(url);
  };
}
