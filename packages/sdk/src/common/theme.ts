export type DaimoModalThemeMode = {
  bg: string;
  surface: string;
  surfaceSecondary: string;
  surfaceHover: string;
  skeleton: string;
  title: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  success: string;
  error: string;
  warning: string;
  accent: string;
  placeholder: string;
  border: string;
  qrBg: string;
  qrDot: string;
  radiusSm: string;
  radiusMd: string;
  radiusLg: string;
  radiusXl: string;
};

export type DaimoModalTheme = {
  light: DaimoModalThemeMode;
  dark: DaimoModalThemeMode;
};

export type DaimoModalThemeModeName = "light" | "dark";

export type DaimoThemeMode = "system" | DaimoModalThemeModeName;

export type DaimoSessionTheme = {
  /** Custom theme CSS URL. */
  themeCssUrl?: string;
  /** Org-controlled light/dark/system theme mode. Defaults to system. */
  themeMode?: DaimoThemeMode;
};

export type DaimoResolvedSessionTheme = DaimoSessionTheme & {
  /** Org-controlled light/dark/system theme mode. */
  themeMode: DaimoThemeMode;
};

export function resolveDaimoSessionTheme(
  theme: DaimoSessionTheme | undefined,
  themeModeOverride?: DaimoThemeMode,
): DaimoResolvedSessionTheme {
  const themeCssUrl = theme?.themeCssUrl;
  return {
    ...(themeCssUrl == null ? {} : { themeCssUrl }),
    themeMode: themeModeOverride ?? theme?.themeMode ?? "system",
  };
}

export type DaimoModalThemeStyle = Record<`--${string}`, string>;

export type LegacyDaimoModalTheme = {
  colors: {
    primary: string;
    background: string;
    surface: string;
    textPrimary: string;
    textSecondary: string;
    border: string;
    success: string;
    error: string;
  };
};

export const DAIMO_MODAL_THEME_FIELDS = [
  "bg",
  "surface",
  "surfaceSecondary",
  "surfaceHover",
  "skeleton",
  "title",
  "text",
  "textSecondary",
  "textMuted",
  "success",
  "error",
  "warning",
  "accent",
  "placeholder",
  "border",
  "qrBg",
  "qrDot",
  "radiusSm",
  "radiusMd",
  "radiusLg",
  "radiusXl",
] as const satisfies readonly (keyof DaimoModalThemeMode)[];

export const DEFAULT_DAIMO_MODAL_THEME: DaimoModalTheme = {
  light: {
    bg: "#00000008",
    surface: "#FFFFFF",
    surfaceSecondary: "#F6F7F9",
    surfaceHover: "#F0F2F5",
    skeleton: "#F6F7F9",
    title: "#373737",
    text: "#373737",
    textSecondary: "#999999",
    textMuted: "#9CA3AF",
    success: "#22C55E",
    error: "#EF4444",
    warning: "#F97316",
    accent: "#3B82F6",
    placeholder: "#D1D5DB",
    border: "#FBFAFB",
    qrBg: "#FFFFFF",
    qrDot: "#373737",
    radiusSm: "0.5rem",
    radiusMd: "0.75rem",
    radiusLg: "1rem",
    radiusXl: "20px",
  },
  dark: {
    bg: "#00000008",
    surface: "#2B2B2B",
    surfaceSecondary: "#383838",
    surfaceHover: "#404040",
    skeleton: "#383838",
    title: "#FFFFFF",
    text: "#FFFFFF",
    textSecondary: "#7E7E7E",
    textMuted: "#858585",
    success: "#4ADE80",
    error: "#F87171",
    warning: "#FB923C",
    accent: "#0977D5",
    placeholder: "#9CA3AF",
    border: "#3D3D3D",
    qrBg: "#2B2B2B",
    qrDot: "#FFFFFF",
    radiusSm: "0.5rem",
    radiusMd: "0.75rem",
    radiusLg: "1rem",
    radiusXl: "20px",
  },
};

const DEFAULT_DAIMO_MODAL_DERIVED_THEME = {
  light: {
    successLight: "#DCFCE7",
    checkmark: "#22C55E",
    brandGreen: "#009110",
    brandGreenLight: "#E6F4E8",
    errorLight: "#FEE2E2",
    errorBadgeBg: "#FFF1F1",
    errorBadgeRing: "#FFD6D6",
    errorBadgeMark: "#D62F2F",
    warningLight: "#FFF7ED",
  },
  dark: {
    successLight: "#14532D",
    checkmark: "#F3F4F6",
    brandGreen: "#009110",
    brandGreenLight: "#12351A",
    errorLight: "#7F1D1D",
    errorBadgeBg: "#3A2222",
    errorBadgeRing: "#673232",
    errorBadgeMark: "#FF8585",
    warningLight: "#431407",
  },
};

export function normalizeDaimoModalTheme(
  theme: unknown,
): DaimoModalTheme | null {
  if (!isObject(theme)) return null;
  if (isObject(theme.light) && isObject(theme.dark)) {
    return {
      light: normalizeMode(theme.light, DEFAULT_DAIMO_MODAL_THEME.light),
      dark: normalizeMode(theme.dark, DEFAULT_DAIMO_MODAL_THEME.dark),
    };
  }
  if (isObject(theme.colors)) {
    return legacyThemeToDaimoModalTheme(theme as LegacyDaimoModalTheme);
  }
  return {
    light: normalizeMode(theme, DEFAULT_DAIMO_MODAL_THEME.light),
    dark: DEFAULT_DAIMO_MODAL_THEME.dark,
  };
}

export function daimoModalThemeToCssVars(
  theme: DaimoModalTheme,
  mode: DaimoModalThemeModeName,
): DaimoModalThemeStyle {
  const tokens = theme[mode];
  const defaults = DEFAULT_DAIMO_MODAL_THEME[mode];
  const derived = DEFAULT_DAIMO_MODAL_DERIVED_THEME[mode];
  const hasDefaultSuccess = tokens.success === defaults.success;
  const hasDefaultError = tokens.error === defaults.error;
  const hasDefaultWarning = tokens.warning === defaults.warning;
  return {
    "--daimo-bg": tokens.bg,
    "--daimo-surface": tokens.surface,
    "--daimo-surface-secondary": tokens.surfaceSecondary,
    "--daimo-surface-hover": tokens.surfaceHover,
    "--daimo-skeleton": tokens.skeleton,
    "--daimo-title": tokens.title,
    "--daimo-text": tokens.text,
    "--daimo-text-secondary": tokens.textSecondary,
    "--daimo-text-muted": tokens.textMuted,
    "--daimo-success": tokens.success,
    "--daimo-success-light": hasDefaultSuccess
      ? derived.successLight
      : tint(tokens.success),
    "--daimo-checkmark": hasDefaultSuccess
      ? derived.checkmark
      : "var(--daimo-success)",
    "--daimo-brand-green": hasDefaultSuccess
      ? derived.brandGreen
      : "var(--daimo-success)",
    "--daimo-brand-green-light": hasDefaultSuccess
      ? derived.brandGreenLight
      : "var(--daimo-success-light)",
    "--daimo-error": tokens.error,
    "--daimo-error-light": hasDefaultError
      ? derived.errorLight
      : tint(tokens.error),
    "--daimo-error-badge-bg": hasDefaultError
      ? derived.errorBadgeBg
      : tint(tokens.error),
    "--daimo-error-badge-ring": hasDefaultError
      ? derived.errorBadgeRing
      : tint(tokens.error, 24),
    "--daimo-error-badge-mark": hasDefaultError
      ? derived.errorBadgeMark
      : "var(--daimo-error)",
    "--daimo-warning": tokens.warning,
    "--daimo-warning-light": hasDefaultWarning
      ? derived.warningLight
      : tint(tokens.warning),
    "--daimo-accent": tokens.accent,
    "--daimo-placeholder": tokens.placeholder,
    "--daimo-border": tokens.border,
    "--daimo-qr-bg": tokens.qrBg,
    "--daimo-qr-dot": tokens.qrDot,
    "--daimo-radius-sm": tokens.radiusSm,
    "--daimo-radius-md": tokens.radiusMd,
    "--daimo-radius-lg": tokens.radiusLg,
    "--daimo-radius-xl": tokens.radiusXl,
  };
}

export function daimoModalThemeToCss(theme: DaimoModalTheme): string {
  const light = cssBlock(
    ':root, [data-theme="light"]',
    daimoModalThemeToCssVars(theme, "light"),
  );
  const dark = cssBlock(
    ':root:not([data-theme="light"])',
    daimoModalThemeToCssVars(theme, "dark"),
  );
  const explicitDark = cssBlock(
    '[data-theme="dark"]',
    daimoModalThemeToCssVars(theme, "dark"),
  );
  return `${light}\n\n@media (prefers-color-scheme: dark) {\n${indent(dark)}\n}\n\n${explicitDark}\n`;
}

function normalizeMode(
  value: Record<string, unknown>,
  defaults: DaimoModalThemeMode,
): DaimoModalThemeMode {
  const normalized = { ...defaults };
  for (const field of DAIMO_MODAL_THEME_FIELDS) {
    const token = value[field];
    if (token == null) continue;
    if (typeof token !== "string") continue;
    normalized[field] = token;
  }
  return normalized;
}

function legacyThemeToDaimoModalTheme(
  theme: LegacyDaimoModalTheme,
): DaimoModalTheme {
  const { colors } = theme;
  const light: DaimoModalThemeMode = {
    ...DEFAULT_DAIMO_MODAL_THEME.light,
    bg: colors.background,
    surface: colors.surface,
    surfaceSecondary: colors.background,
    skeleton: colors.background,
    title: colors.textPrimary,
    text: colors.textPrimary,
    textSecondary: colors.textSecondary,
    textMuted: colors.textSecondary,
    success: colors.success,
    error: colors.error,
    warning: colors.primary,
    accent: colors.primary,
    placeholder: colors.textSecondary,
    border: colors.border,
    qrBg: colors.surface,
    qrDot: colors.textPrimary,
  };
  return { light, dark: DEFAULT_DAIMO_MODAL_THEME.dark };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

function cssBlock(selector: string, vars: DaimoModalThemeStyle): string {
  const body = Object.entries(vars)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join("\n");
  return `${selector} {\n${body}\n}`;
}

function tint(color: string, amount = 14): string {
  return `color-mix(in srgb, ${color} ${amount}%, var(--daimo-surface))`;
}

function indent(css: string): string {
  return css
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}
