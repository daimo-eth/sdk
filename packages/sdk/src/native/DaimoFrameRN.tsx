import { useEffect, useState } from "react";
import {
  Keyboard,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { DAIMO_BASE_URL, DAIMO_SUPPORT_EMAIL } from "../common/constants.js";
import { parseDaimoFrameMessage } from "../common/frameMessages.js";

const INITIAL_HEIGHT = 420;
/** Show the error fallback if the WebView reports no content within this. */
const LOAD_TIMEOUT_MS = 15000;
// Route every navigation through onShouldStartLoadWithRequest so external links
// are handed off consistently on iOS and Android; the handler, not the WebView,
// decides what stays in-frame.
const ORIGIN_WHITELIST = ["*"];
// Larger than the web DaimoFrame's 24 so the modal sheet nests concentrically
// inside the rounded screen corners of current phones (~62pt on Pro-class
// devices, minus the 20pt scrim inset). Tunable via the `borderRadius` prop;
// there is no dependency-free way to read the exact per-device screen radius.
const DEFAULT_BORDER_RADIUS = 42;
// Inset from the screen edges to the modal sheet (left / right / bottom).
const SCRIM_INSET = 20;

/**
 * Presentation layout.
 * - `"modal"` (default): a dimmed, full-screen overlay with a rounded bottom
 *   sheet sized to the content.
 * - `"embed"`: the WebView inline at the component's position. Fills the
 *   container's width; height follows the content. The host owns all chrome,
 *   including the dismiss affordance.
 */
export type DaimoFrameRNLayout = "modal" | "embed";

export type DaimoFrameRNProps = {
  /** Session ID, created server-side via `POST /v1/sessions`. */
  sessionId: string;
  /** Client secret returned alongside the session. */
  clientSecret: string;
  /** Presentation layout. Defaults to `"modal"`. */
  layout?: DaimoFrameRNLayout;
  /**
   * Base URL of the hosted flow. Defaults to `https://daimo.com`.
   * Override only for staging / self-hosted environments.
   */
  baseUrl?: string;
  /** Called when the flow reports it has opened. */
  onOpen?: () => void;
  /** Called when the user dismisses the flow. */
  onClose?: () => void;
  /** Called when the user's deposit transaction is detected. */
  onPaymentStarted?: () => void;
  /** Called when funds are delivered to the destination. */
  onPaymentCompleted?: () => void;
  /**
   * Called when the flow needs to leave the WebView — Apple Pay, a wallet
   * deeplink, or a hosted fiat provider. Defaults to `Linking.openURL`, which
   * hands the URL to the system browser (where Apple Pay works with no host-app
   * certification). Pass `expo-web-browser`'s `openBrowserAsync` for an in-app
   * Safari sheet.
   */
  onOpenExternalUrl?: (url: string) => void;
  /**
   * Corner radius of the modal sheet and its WebView, in points. Defaults to
   * {@link DEFAULT_BORDER_RADIUS} — larger than the web `DaimoFrame` so the sheet
   * nests neatly inside the device's rounded screen corners.
   */
  borderRadius?: number;
};

/**
 * Hosted Daimo deposit flow, embedded in a React Native `WebView`.
 *
 * `DaimoFrameRN` loads `/webview` in content-only (`embed`) mode and sizes the
 * WebView to the height the content reports over the `postMessage` bridge. No
 * wallet libraries or app providers required. The surface stays hidden until
 * the flow's first content arrives; if nothing loads within
 * {@link LOAD_TIMEOUT_MS}, a dismissable error card is shown instead.
 *
 * Apple Pay, wallet deeplinks, and hosted fiat providers cannot run inside the
 * message-bridged WebView (WKWebView disables Apple Pay JS once scripts are
 * injected). `DaimoFrameRN` intercepts those navigations and opens them outside
 * the WebView via {@link DaimoFrameRNProps.onOpenExternalUrl}, so the embedding
 * app needs no Apple Pay merchant ID or entitlement.
 *
 * @example
 * ```tsx
 * <DaimoFrameRN
 *   layout="modal"
 *   sessionId={sessionId}
 *   clientSecret={clientSecret}
 *   onClose={() => setOpen(false)}
 * />
 * ```
 */
export function DaimoFrameRN({
  sessionId,
  clientSecret,
  layout = "modal",
  baseUrl = DAIMO_BASE_URL,
  onOpen,
  onClose,
  onPaymentStarted,
  onPaymentCompleted,
  onOpenExternalUrl,
  borderRadius = DEFAULT_BORDER_RADIUS,
}: DaimoFrameRNProps) {
  const [height, setHeight] = useState(INITIAL_HEIGHT);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    "loading",
  );
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Fall back to the error card if the flow never reports content.
  useEffect(() => {
    if (status !== "loading") return;
    const id = setTimeout(() => setStatus("error"), LOAD_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [status]);

  // Lift the modal sheet above the on-screen keyboard. Inputs live inside the
  // WebView, but iOS/Android still raise the system keyboard and fire these
  // events. The sheet is inside a RN `<Modal>` (its own window), so the host
  // can't wrap it — the component avoids the keyboard itself. Embed layout: the
  // host owns the container and handles this.
  useEffect(() => {
    if (layout !== "modal") return;
    const onShow = (e: { endCoordinates: { height: number } }) =>
      setKeyboardHeight(e.endCoordinates.height);
    const onHide = () => setKeyboardHeight(0);
    const subs =
      Platform.OS === "ios"
        ? [
            Keyboard.addListener("keyboardWillShow", onShow),
            Keyboard.addListener("keyboardWillHide", onHide),
          ]
        : [
            Keyboard.addListener("keyboardDidShow", onShow),
            Keyboard.addListener("keyboardDidHide", onHide),
          ];
    return () => subs.forEach((s) => s.remove());
  }, [layout]);

  const origin = normalizeOrigin(baseUrl);
  const src = getFrameSrc(origin, sessionId, clientSecret);

  const openExternal = (url: string) => {
    if (onOpenExternalUrl) return onOpenExternalUrl(url);
    Linking.openURL(url).catch(() => {});
  };

  // onMessage only fires for our own WebView's content, so no origin check is
  // needed here (unlike the web iframe, which shares a window message bus).
  const handleMessage = (event: WebViewMessageEvent) => {
    let data: unknown;
    try {
      data = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    const message = parseDaimoFrameMessage(data);
    if (!message) return;

    switch (message.type) {
      case "ready":
      case "modalOpened":
        setStatus("loaded");
        onOpen?.();
        break;
      case "modalClosed":
        onClose?.();
        break;
      case "paymentStarted":
        onPaymentStarted?.();
        break;
      case "paymentCompleted":
        onPaymentCompleted?.();
        break;
      case "contentHeightChanged":
        setHeight(message.payload.height);
        setStatus("loaded");
        break;
    }
  };

  // Keep the checkout flow inside the WebView: allow sub-frames (the flow's
  // third-party iframes — Privy, Coinbase, KYC, etc.) and same-origin top-frame
  // navigations. Hand everything else (wallet deeplinks and provider redirects
  // the flow navigates to expecting the host to open them) off to the host.
  const handleShouldStart = (request: {
    url: string;
    isTopFrame?: boolean;
  }) => {
    if (request.isTopFrame === false) return true;
    if (isInternalUrl(request.url, origin)) return true;
    openExternal(request.url);
    return false;
  };

  // `WebViewOpenWindowEvent` isn't re-exported from the package root, so type
  // just the field we read.
  const handleOpenWindow = (event: { nativeEvent: { targetUrl: string } }) => {
    openExternal(event.nativeEvent.targetUrl);
  };

  const webView = (
    <WebView
      source={{ uri: src }}
      originWhitelist={ORIGIN_WHITELIST}
      onMessage={handleMessage}
      onShouldStartLoadWithRequest={handleShouldStart}
      onOpenWindow={handleOpenWindow}
      onError={() => setStatus("error")}
      scrollEnabled={layout === "modal"}
      javaScriptEnabled
      domStorageEnabled
      style={[styles.webView, { borderRadius }]}
    />
  );

  if (layout === "embed") {
    if (status === "error") {
      return <DaimoFrameRNError sessionId={sessionId} onClose={onClose} />;
    }
    return (
      <View
        style={[
          styles.embed,
          { height, opacity: status === "loaded" ? 1 : 0 },
        ]}
      >
        {webView}
      </View>
    );
  }

  return (
    <Modal
      transparent
      visible
      statusBarTranslucent
      animationType="slide"
      onRequestClose={() => onClose?.()}
    >
      {/* The backdrop dims the screen but does NOT dismiss on tap — too easy to
          hit by accident. Dismissal is the hosted flow's own close button
          (requested via `close=1`, which posts `modalClosed`) or the Android
          hardware back, via onRequestClose. */}
      <View
        style={[styles.scrim, { paddingBottom: keyboardHeight + SCRIM_INSET }]}
      >
        {status === "error" ? (
          <DaimoFrameRNError sessionId={sessionId} onClose={onClose} />
        ) : (
          <View
            style={[
              styles.bubble,
              { height, opacity: status === "loaded" ? 1 : 0, borderRadius },
            ]}
          >
            {webView}
          </View>
        )}
      </View>
    </Modal>
  );
}

function getFrameSrc(origin: string, sessionId: string, clientSecret: string) {
  const params = [
    `session=${encodeURIComponent(sessionId)}`,
    `cs=${encodeURIComponent(clientSecret)}`,
    "layout=embed",
    // Ask the hosted flow to render its own close button (embed normally hides
    // it, assuming host chrome). We have no chrome, so the flow owns dismissal.
    "close=1",
  ].join("&");
  return `${origin}/webview?${params}`;
}

/** Strip any path/trailing slash so `baseUrl` compares as an origin. */
function normalizeOrigin(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function isInternalUrl(url: string, origin: string) {
  if (url === "about:blank" || url.startsWith("data:")) return true;
  return url === origin || url.startsWith(`${origin}/`);
}

/** Dismissable "couldn't load" card with a contact-support mailto link. */
function DaimoFrameRNError({
  sessionId,
  onClose,
}: {
  sessionId: string;
  onClose?: () => void;
}) {
  const mailto =
    `mailto:${DAIMO_SUPPORT_EMAIL}` +
    `?subject=${encodeURIComponent("Couldn't load Daimo")}` +
    `&body=${encodeURIComponent(`sessionId: ${sessionId}`)}`;

  return (
    <View style={styles.errorCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={() => onClose?.()}
        style={styles.closeButton}
      >
        <Text style={styles.closeIcon}>✕</Text>
      </Pressable>
      <Text style={styles.errorText}>Couldn't load. Offline?</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => Linking.openURL(mailto).catch(() => {})}
      >
        <Text style={styles.supportText}>Contact support</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  webView: {
    flex: 1,
    width: "100%",
    backgroundColor: "transparent",
  },
  embed: {
    width: "100%",
    overflow: "hidden",
  },
  scrim: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
    alignItems: "center",
    padding: SCRIM_INSET,
  },
  bubble: {
    width: "100%",
    maxWidth: 440,
    maxHeight: "90%",
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },
  errorCard: {
    width: "100%",
    maxWidth: 440,
    borderRadius: DEFAULT_BORDER_RADIUS,
    backgroundColor: "#ffffff",
    paddingHorizontal: 24,
    paddingTop: 44,
    paddingBottom: 28,
    alignItems: "center",
    gap: 20,
  },
  closeButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  closeIcon: {
    fontSize: 16,
    color: "#8a8a8a",
  },
  errorText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    color: "#4a4a4a",
  },
  supportText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#009110",
  },
});
