// Components
export { DaimoModal } from "./components/DaimoModal.js";
export type { DaimoModalProps } from "./components/DaimoModal.js";
export type { DaimoModalPaymentEvent } from "./hooks/types.js";
export { DaimoModalPreview } from "./components/DaimoModalPreview.js";
export type {
  DaimoModalPreviewProps,
  DaimoModalPreviewVariant,
} from "./components/DaimoModalPreview.js";
export { DaimoSDKProvider } from "./hooks/DaimoClientContext.js";
export { ErrorPage } from "./components/ErrorPage.js";
export { AccountFlowProvider } from "./components/account/AccountFlowProvider.js";

// Types
export * from "./api/index.js";
export type { DaimoPlatform } from "./platform.js";
export type {
  InjectedWallet,
  InjectedWalletInfo,
} from "./hooks/useInjectedWallets.js";
export {
  DAIMO_MODAL_THEME_FIELDS,
  DEFAULT_DAIMO_MODAL_THEME,
  DaimoThemeStylesheet,
  daimoModalThemeToCss,
  daimoModalThemeToCssVars,
  normalizeDaimoModalTheme,
} from "./theme.js";
export type {
  DaimoModalTheme,
  DaimoModalThemeMode,
  DaimoModalThemeModeName,
} from "./theme.js";

// Hooks
export { useInjectedWallets } from "./hooks/useInjectedWallets.js";
export { useAccountFlow } from "./hooks/useAccountFlow.js";

// Localization
export { getLocale, setLocale, t } from "./hooks/locale.js";
