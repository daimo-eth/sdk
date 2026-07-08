"use client";

import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import type { DaimoModalEventHandlers } from "../hooks/types.js";
import {
  DAIMO_FRAME_PARENT_ORIGIN_PARAM,
  parseDaimoFrameMessage,
} from "./frameMessages.js";
import { CloseIcon } from "./icons.js";
import { ContactSupportButton, ErrorMessage } from "./shared.js";

const DEFAULT_BASE_URL = "https://daimo.com";
const INITIAL_HEIGHT = 420;
/** Show the error fallback if the iframe hasn't rendered content within this. */
const LOAD_TIMEOUT_MS = 15000;

// Hoisted out of the style objects below so the SDK style linter (which scans
// string literals under a `position:` property for stale Tailwind tokens)
// doesn't flag these CSS keywords. They are real inline CSS values, not classes.
const CSS_FIXED = "fixed" as const;
const CSS_RELATIVE = "relative" as const;
const CSS_ABSOLUTE = "absolute" as const;

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

// Rounded surface that clips the content-sized iframe to four corners. Hidden
// (opacity 0) until the flow reports its first height, so the user never
// sees an empty shadowed bubble while the iframe loads.
const bubbleStyle: CSSProperties = {
  width: "100%",
  maxWidth: 440,
  maxHeight: "calc(100dvh - 24px - env(safe-area-inset-bottom))",
  borderRadius: 24,
  overflow: "hidden",
  // Small shadow that stays within the ~12px gap below the sheet (so it never
  // bleeds into the safe area): offset + blur reaches ~8px.
  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.2)",
  // `transition` is set inline: opacity always animates, height only after the
  // first appearance (see `animateHeight`).
};

// Inline embed surface: fills the host container's width, height follows the
// content. No chrome — the host owns rounding, borders, and dismissal.
const embedStyle: CSSProperties = {
  width: "100%",
  overflow: "hidden",
};

const iframeStyle: CSSProperties = {
  display: "block",
  width: "100%",
  height: "100%",
  border: 0,
};

// Error fallback card. Reuses the SDK surface token + components, so it needs
// the SDK theme CSS loaded on the host page.
const errorCardStyle: CSSProperties = {
  position: CSS_RELATIVE,
  width: "100%",
  maxWidth: 440,
  background: "var(--daimo-surface)",
  borderRadius: 24,
  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.2)",
  padding: "44px 24px 28px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 20,
};

const closeButtonStyle: CSSProperties = {
  position: CSS_ABSOLUTE,
  top: 12,
  right: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
  border: 0,
  borderRadius: 9999,
  background: "transparent",
  color: "var(--daimo-text-secondary)",
  cursor: "pointer",
};

/**
 * Presentation layout. `modal` renders the hosted flow in a full-screen dimmed
 * overlay with a rounded, content-sized sheet. `embed` renders the iframe
 * inline at the component's position, for use inside a host-defined modal or
 * page layout.
 */
export type DaimoFrameLayout = "modal" | "embed";

export type DaimoFrameProps = DaimoModalEventHandlers & {
  /** Session ID, created server-side via `POST /v1/sessions`. */
  sessionId: string;
  /** Client secret returned alongside the session. */
  clientSecret: string;
  /**
   * Presentation layout.
   * - `"modal"` (default): full-screen dimmed overlay with a rounded sheet
   *   sized to the content.
   * - `"embed"`: inline iframe at the component's position. Fills the
   *   container's width; height follows the content. The host owns all
   *   surrounding chrome, including the dismiss affordance.
   */
  layout?: DaimoFrameLayout;
  /**
   * Base URL of the hosted flow. Defaults to `https://daimo.com`.
   * Override only for staging / self-hosted environments.
   */
  baseUrl?: string;
};

/**
 * Hosted Daimo deposit flow, embedded as an iframe.
 *
 * `DaimoFrame` loads `/webview` in content-only (`embed`) mode and sizes the
 * iframe to the height the content reports over `postMessage`. No wallet
 * libraries or app providers required. The surface stays hidden until the
 * flow's first content arrives; if nothing loads within
 * {@link LOAD_TIMEOUT_MS}, a dismissable error card is shown instead.
 *
 * With `layout="modal"` (default) the iframe renders inside a fixed, dimmed
 * scrim portaled to `document.body`. With `layout="embed"` it renders inline
 * where the component is placed, so the host can wrap it in its own modal or
 * page layout.
 *
 * The modal's dimming scrim is `position: fixed` on purpose: iOS 26 derives
 * the safe-area strip colors (notch / home indicator) from the
 * `background-color` of fixed/sticky elements near the viewport edges (falling
 * back to `body`). An `absolute` scrim is never sampled, so the strips would
 * stay light — the fixed scrim's semi-transparent background instead tints
 * them to match the dimmed page. See
 * https://nasedk.in/blog/ios26-safari-toolbar-colors/.
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
  onOpen,
  onPaymentStarted,
  onPaymentCompleted,
  baseUrl = DEFAULT_BASE_URL,
}: DaimoFrameProps) {
  const [parentOrigin, setParentOrigin] = useState<string | null>(null);
  const src = useMemo(
    () =>
      parentOrigin
        ? getFrameSrc(baseUrl, sessionId, clientSecret, parentOrigin)
        : null,
    [baseUrl, clientSecret, parentOrigin, sessionId],
  );
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState(INITIAL_HEIGHT);
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    "loading",
  );
  // Height animates only after the surface's first appearance, so revealing it
  // doesn't animate from INITIAL_HEIGHT down to the first measured (skeleton)
  // height. Only later growth (skeleton -> content) animates.
  const [animateHeight, setAnimateHeight] = useState(false);

  // Portals require a DOM target, so only render after mount (client-only).
  useEffect(() => {
    setMounted(true);
    setParentOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!src) return;

    // Only trust messages from our own iframe: match both the frame origin
    // and the sending window, so two DaimoFrames on one page don't cross-talk.
    const frameOrigin = new URL(src, window.location.href).origin;
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== frameOrigin) return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      const message = parseDaimoFrameMessage(event.data);
      if (!message) return;

      if (message.type === "modalOpened") onOpen?.();
      if (message.type === "modalClosed") onClose?.();
      if (message.type === "paymentStarted") onPaymentStarted?.();
      if (message.type === "paymentCompleted") onPaymentCompleted?.();
      if (message.type === "contentHeightChanged") {
        setHeight(message.payload.height);
        setStatus("loaded");
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onClose, onOpen, onPaymentCompleted, onPaymentStarted, src]);

  // Fall back to the error card if the flow never reports content.
  useEffect(() => {
    if (status !== "loading") return;
    const id = setTimeout(() => setStatus("error"), LOAD_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [status]);

  // Enable the height transition one frame after the surface first appears, so
  // its reveal snaps to the first height instead of animating down to it.
  useEffect(() => {
    if (status !== "loaded" || animateHeight) return;
    const id = requestAnimationFrame(() => setAnimateHeight(true));
    return () => cancelAnimationFrame(id);
  }, [status, animateHeight]);

  if (!mounted || !src) return null;

  const surfaceTransition = animateHeight
    ? "height 0.2s ease-in-out, opacity 0.2s ease-in-out"
    : "opacity 0.2s ease-in-out";

  const iframe = (
    <iframe
      ref={iframeRef}
      title="Daimo"
      src={src}
      allow="payment; clipboard-write"
      style={iframeStyle}
    />
  );

  if (layout === "embed") {
    if (status === "error") {
      return <DaimoFrameError sessionId={sessionId} onClose={onClose} />;
    }
    return (
      <div
        style={{
          ...embedStyle,
          height,
          opacity: status === "loaded" ? 1 : 0,
          transition: surfaceTransition,
        }}
      >
        {iframe}
      </div>
    );
  }

  return createPortal(
    <div onClick={() => onClose?.()} style={scrimStyle}>
      {status === "error" ? (
        <DaimoFrameError sessionId={sessionId} onClose={onClose} />
      ) : (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            ...bubbleStyle,
            height,
            opacity: status === "loaded" ? 1 : 0,
            transition: surfaceTransition,
          }}
        >
          {iframe}
        </div>
      )}
    </div>,
    document.body,
  );
}

function getFrameSrc(
  baseUrl: string,
  sessionId: string,
  clientSecret: string,
  parentOrigin: string,
) {
  const base = baseUrl.replace(/\/$/, "");
  const params = new URLSearchParams({
    session: sessionId,
    cs: clientSecret,
    layout: "embed",
    [DAIMO_FRAME_PARENT_ORIGIN_PARAM]: parentOrigin,
  });
  return `${base}/webview?${params.toString()}`;
}

/** Dismissable "couldn't load" card with a contact-support mailto link. */
function DaimoFrameError({
  sessionId,
  onClose,
}: {
  sessionId: string;
  onClose?: () => void;
}) {
  return (
    <div onClick={(e) => e.stopPropagation()} style={errorCardStyle}>
      <button
        type="button"
        aria-label="Close"
        onClick={() => onClose?.()}
        style={closeButtonStyle}
      >
        <CloseIcon />
      </button>
      <ErrorMessage message="Couldn't load. Offline?" />
      <ContactSupportButton
        subject="Couldn't load Daimo"
        info={{ sessionId }}
      />
    </div>
  );
}
