import { en } from "./locales/en.js";
import { es } from "./locales/es.js";
import { ja } from "./locales/ja.js";
import { ko } from "./locales/ko.js";
import { pt } from "./locales/pt.js";
import { zh } from "./locales/zh.js";

export type DaimoModalLocale = typeof en;

const DEFAULT_LOCALE = "en";
const DEFAULT_NUMBER_LOCALE = "en-US";

const translations: Record<string, DaimoModalLocale> = {
  en,
  es,
  ja,
  ko,
  pt,
  zh,
};

/** Current active translations. Defaults to English. */
export let t: DaimoModalLocale = en;

/** Current active locale code (short form, e.g. "en", "zh"). */
let currentLocale = DEFAULT_LOCALE;

/** Current numeric locale code (full form, e.g. "en-US", "de-DE"). */
let currentNumberLocale = DEFAULT_NUMBER_LOCALE;

/** Whether setLocale has been called explicitly or via auto-detect. */
let localeInitialized = false;

/** Get the current active locale code. */
export function getLocale(): string {
  return currentLocale;
}

/** Get the current numeric locale code. */
export function getNumberLocale(): string {
  return currentNumberLocale;
}

/** Set the active locale. Accepts full codes (es-ES) or short codes (es). */
export function setLocale(languageCode: string) {
  localeInitialized = true;
  if (translations[languageCode]) {
    t = translations[languageCode];
    currentLocale = languageCode;
    currentNumberLocale = languageCode;
    return;
  }
  const short = languageCode.split("-")[0].toLowerCase();
  const translation = translations[short];
  if (translation) {
    t = translation;
    currentLocale = short;
    currentNumberLocale = languageCode;
    return;
  }
  t = en;
  currentLocale = DEFAULT_LOCALE;
  currentNumberLocale = getLatinNumberLocale(languageCode);
}

/** Auto-detect locale from browser language if not explicitly set. */
export function autoDetectLocale() {
  if (localeInitialized) return;
  if (typeof navigator !== "undefined" && navigator.language) {
    setLocale(navigator.language);
  }
}

function getLatinNumberLocale(languageCode: string): string {
  const locale = `${languageCode}-u-nu-latn`;
  try {
    if (Intl.NumberFormat.supportedLocalesOf([locale]).length === 0) {
      return DEFAULT_NUMBER_LOCALE;
    }
    return locale;
  } catch {
    return DEFAULT_NUMBER_LOCALE;
  }
}
