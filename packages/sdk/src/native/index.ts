// React Native entry point for the Daimo SDK.
//
// Ships a single component, `DaimoFrameRN`, that renders the hosted deposit
// flow in a `react-native-webview`. This entry point is deliberately isolated
// from `@daimo/sdk/web`: it imports only React, React Native,
// react-native-webview, and pure helpers from `@daimo/sdk/common`, so React
// Native apps never pull in the web build's DOM or wallet dependencies.

export { DaimoFrameRN } from "./DaimoFrameRN.js";
export type {
  DaimoFrameRNProps,
  DaimoFrameRNLayout,
} from "./DaimoFrameRN.js";
export type { DaimoFrameMessage } from "../common/frameMessages.js";
export { parseDaimoFrameMessage } from "../common/frameMessages.js";
