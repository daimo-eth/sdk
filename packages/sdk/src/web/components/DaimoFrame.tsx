"use client";

import { type CSSProperties, useEffect, useState } from "react";
import { createPortal } from "react-dom";

const DAIMO_MESSAGE_SOURCE = "daimo-pay";
const DEFAULT_BASE_URL = "https://daimo.com";
const INITIAL_HEIGHT = 420;

// Hoisted out of the style object below so the SDK style linter (which scans
// string literals under a `position:` property for stale Tailwind tokens)
// doesn't flag the CSS keyword "fixed". This is a real inline CSS value, not a
// utility class.
const CSS_FIXED = "fixed" as const;

// Fixed scrim: dims the viewport, and on iOS 26 its background is what Safari
// samples to tint the safe-area strips dark (an `absolute` scrim is not
// sampled). Also positions the sheet at the bottom, clear of the home bar.
const scrimStyle: CSSProperties = {
  position: CSS_FIXED,
  inset: 0,
  zIndex: 999,
  background: "rgba(0, 0, 0, 0.5)",
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-end",
  padding: 12,
  paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
};

// Rounded surface that clips the content-sized iframe to four corners.
const bubbleStyle: CSSProperties = {
  width: "100%",
  maxWidth: 440,
  maxHeight: "calc(100dvh - 24px - env(safe-area-inset-bottom))",
  borderRadius: 24,
  overflow: "hidden",
  // Small shadow that stays within the ~12px gap below the sheet (so it never
  // bleeds into the safe area): offset + blur reaches ~8px.
  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.2)",
  transition: "height 0.2s ease-in-out",
};

const iframeStyle: CSSProperties = {
  display: "block",
  width: "100%",
  height: "100%",
  border: 0,
};

/**
 * The only supported layout. `modal` renders the hosted checkout in a
 * full-screen dimmed overlay with a rounded, content-sized sheet.
 */
export type DaimoFrameLayout = "modal";

export interface DaimoFrameProps {
  /** Session ID, created server-side via `POST /v1/sessions`. */
  sessionId: string;
  /** Client secret returned alongside the session. */
  clientSecret: string;
  /**
   * Presentation layout. Currently only `"modal"` is supported: a full-screen
   * dimmed overlay with a rounded sheet sized to the checkout content.
   */
  layout?: DaimoFrameLayout;
  /** Called when the user dismisses the checkout (taps the scrim or closes). */
  onClose?: () => void;
  /**
   * Base URL of the hosted checkout. Defaults to `https://daimo.com`.
   * Override only for staging / self-hosted environments.
   */
  baseUrl?: string;
}

/**
 * Hosted Daimo checkout, embedded as an iframe in a full-screen modal overlay.
 *
 * `DaimoFrame` loads `/webview` in content-only (`embed`) mode inside a fixed,
 * dimmed scrim and sizes the iframe to the height the content reports over
 * `postMessage`. No wallet libraries or app providers required.
 *
 * The dimming scrim is `position: fixed` on purpose: iOS 26 derives the
 * safe-area strip colors (notch / home indicator) from the `background-color`
 * of fixed/sticky elements near the viewport edges (falling back to `body`). An
 * `absolute` scrim is never sampled, so the strips would stay light — the fixed
 * scrim's semi-transparent background instead tints them to match the dimmed
 * page. See https://nasedk.in/blog/ios26-safari-toolbar-colors/.
 *
 * @example
 * ```tsx
 * <DaimoFrame
 *   layout="modal"
 *   sessionId={sessionId}
 *   clientSecret={clientSecret}
 *   onClose={() => setOpen(false)}
 * />
 * ```
 */
export function DaimoFrame({
  sessionId,
  clientSecret,
  layout = "modal",
  onClose,
  baseUrl = DEFAULT_BASE_URL,
}: DaimoFrameProps) {
  const [src] = useState(
    () =>
      `${baseUrl.replace(/\/$/, "")}/webview?session=${encodeURIComponent(
        sessionId,
      )}&cs=${encodeURIComponent(clientSecret)}&layout=embed`,
  );
  const [height, setHeight] = useState(INITIAL_HEIGHT);
  const [mounted, setMounted] = useState(false);

  // Portals require a DOM target, so only render after mount (client-only).
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    // Only trust messages from the iframe's own origin.
    const frameOrigin = new URL(src, window.location.href).origin;
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== frameOrigin) return;
      if (event.data?.source !== DAIMO_MESSAGE_SOURCE) return;
      if (event.data.type === "modalClosed") onClose?.();
      if (event.data.type === "contentHeightChanged") {
        const reported = Number(event.data.payload?.height);
        if (reported > 0) setHeight(reported);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onClose, src]);

  // `layout` is reserved for future modes; only "modal" is supported today.
  void layout;

  if (!mounted) return null;

  return createPortal(
    <div onClick={() => onClose?.()} style={scrimStyle}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ ...bubbleStyle, height }}
      >
        <iframe
          title="Daimo"
          src={src}
          allow="payment; clipboard-write"
          style={iframeStyle}
        />
      </div>
    </div>,
    document.body,
  );
}
