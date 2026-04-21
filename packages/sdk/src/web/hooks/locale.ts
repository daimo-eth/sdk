import { en } from "./locales/en.js";
import { es } from "./locales/es.js";
import { ja } from "./locales/ja.js";
import { ko } from "./locales/ko.js";
import { zh } from "./locales/zh.js";

export type DaimoModalLocale = typeof en;

const translations: Record<string, DaimoModalLocale> = { en, es, ja, ko, zh };

/** Current active translations. Defaults to English. */
export let t: DaimoModalLocale = en;

/** Current active locale code (short form, e.g. "en", "zh"). */
let currentLocale = "en";

/** Whether setLocale has been called explicitly or via auto-detect. */
let localeInitialized = false;

/** Get the current active locale code. */
export function getLocale(): string {
  return currentLocale;
}

/** Set the active locale. Accepts full codes (es-ES) or short codes (es). */
export function setLocale(languageCode: string) {
  localeInitialized = true;
  if (translations[languageCode]) {
    t = translations[languageCode];
    currentLocale = languageCode;
    return;
  }
  const short = languageCode.split("-")[0].toLowerCase();
  t = translations[short] ?? en;
  currentLocale = translations[short] ? short : "en";
}

/** Auto-detect locale from browser language if not explicitly set. */
export function autoDetectLocale() {
  if (localeInitialized) return;
  if (typeof navigator !== "undefined" && navigator.language) {
    setLocale(navigator.language);
  }
}
