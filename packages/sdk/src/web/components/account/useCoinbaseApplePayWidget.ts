import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import {
  zCoinbaseWidgetErrorData,
  type CoinbaseWidgetErrorData,
} from "../../../common/api.js";

// Bind committed iframe state before the browser can deliver postMessage tasks.
const useBrowserLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

type CoinbaseEventName = string;

type CoinbaseEvent = {
  eventName: CoinbaseEventName;
  data?: { errorCode?: string; errorMessage?: string };
};

type UseCoinbaseApplePayWidgetArgs = {
  allowExpandedView: boolean;
  onRefreshDeposit: () => Promise<void>;
  paymentLinkUrl: string | null;
  providerOrderId?: string;
  onWidgetError?: (event: CoinbaseWidgetErrorData) => void;
};

type UseCoinbaseApplePayWidgetResult = {
  iframeExpanded: boolean;
  onIframeLoad: () => void;
  iframeReady: boolean;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  resetWidget: () => void;
  widgetError: string | null;
};

/**
 * Coinbase iframe lifecycle and postMessage handling. Keeps the account page
 * focused on amount entry / layout while this hook owns hosted-widget state.
 */
export function useCoinbaseApplePayWidget({
  allowExpandedView,
  onRefreshDeposit,
  paymentLinkUrl,
  providerOrderId,
  onWidgetError,
}: UseCoinbaseApplePayWidgetArgs): UseCoinbaseApplePayWidgetResult {
  const [widgetError, setWidgetError] = useState<string | null>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const [iframeExpanded, setIframeExpanded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const refreshRef = useRef(onRefreshDeposit);
  const reportedRef = useRef({
    orderId: providerOrderId,
    errors: new Set<string>(),
  });

  const resetWidget = useCallback(() => {
    debugApplePay("reset widget", { hasPaymentLink: paymentLinkUrl != null });
    setWidgetError(null);
    setIframeReady(false);
    setIframeExpanded(false);
  }, [paymentLinkUrl]);

  useBrowserLayoutEffect(() => {
    refreshRef.current = onRefreshDeposit;
  }, [onRefreshDeposit]);

  useEffect(() => {
    if (!allowExpandedView) setIframeExpanded(false);
  }, [allowExpandedView]);

  useBrowserLayoutEffect(() => {
    debugApplePay("payment link updated", {
      hasPaymentLink: paymentLinkUrl != null,
    });
    resetWidget();
  }, [paymentLinkUrl, resetWidget]);

  const updateExpandedView = useCallback(
    (expanded: boolean) => {
      if (!allowExpandedView) {
        if (!expanded) setIframeExpanded(false);
        return;
      }
      setIframeExpanded(expanded);
    },
    [allowExpandedView],
  );

  useBrowserLayoutEffect(() => {
    const handler = (event: MessageEvent) => {
      if (typeof event.origin !== "string" || !isCoinbaseOrigin(event.origin)) {
        return;
      }
      const iframeWindow = iframeRef.current?.contentWindow;
      if (!iframeWindow || event.source !== iframeWindow) {
        return;
      }
      const parsed = parseCoinbaseEvent(event.data);
      if (!parsed) return;
      const diagnostic = zCoinbaseWidgetErrorData.safeParse({
        providerOrderId,
        eventName: parsed.eventName,
        errorCode: parsed.data?.errorCode ?? null,
      });
      if (diagnostic.success)
        debugApplePay("coinbase widget error", diagnostic.data);
      if (diagnostic.success && onWidgetError) {
        if (reportedRef.current.orderId !== providerOrderId) {
          reportedRef.current = { orderId: providerOrderId, errors: new Set() };
        }
        const key = `${diagnostic.data.eventName}:${diagnostic.data.errorCode}`;
        const reported = reportedRef.current.errors;
        // Bound noisy/repeated widget events; a failed log never retries payment.
        if (!reported.has(key) && reported.size < 10) {
          reported.add(key);
          try {
            onWidgetError(diagnostic.data);
          } catch {
            console.warn("[apple-pay] widget diagnostic could not be reported");
          }
        }
      }

      switch (parsed.eventName) {
        case "onramp_api.load_pending":
          setIframeReady(false);
          return;
        case "onramp_api.load_success":
          setWidgetError(null);
          setIframeReady(true);
          return;
        case "onramp_api.load_error":
          if (
            parsed.data?.errorCode ===
            "ERROR_CODE_GUEST_APPLE_PAY_NOT_SUPPORTED"
          ) {
            setIframeReady(false);
            return;
          }
          setWidgetError(
            parsed.data?.errorMessage ?? "failed to load payment widget",
          );
          return;
        case "onramp_api.apple_pay_button_pressed":
          updateExpandedView(true);
          return;
        case "onramp_api.pending_payment_auth":
        case "onramp_api.payment_authorized":
          updateExpandedView(true);
          return;
        case "onramp_api.commit_success":
          updateExpandedView(false);
          void refreshRef.current();
          return;
        case "onramp_api.commit_error":
          updateExpandedView(false);
          setWidgetError(parsed.data?.errorMessage ?? "payment failed");
          return;
        case "onramp_api.cancel":
          debugApplePay("collapsing widget after cancel event");
          updateExpandedView(false);
          return;
        case "onramp_api.apple_pay_session_cancelled":
          updateExpandedView(false);
          return;
        case "onramp_api.polling_start":
          updateExpandedView(true);
          void refreshRef.current();
          return;
        case "onramp_api.polling_success":
          updateExpandedView(false);
          void refreshRef.current();
          return;
        case "onramp_api.polling_error":
          updateExpandedView(false);
          setWidgetError(
            parsed.data?.errorMessage ?? "transaction processing error",
          );
          return;
        default:
          return;
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [updateExpandedView, providerOrderId, onWidgetError]);

  const onIframeLoad = useCallback(() => {
    debugApplePay("iframe load", { hasPaymentLink: paymentLinkUrl != null });
  }, [paymentLinkUrl]);

  return {
    iframeExpanded,
    onIframeLoad,
    iframeReady,
    iframeRef,
    resetWidget,
    widgetError,
  };
}

/**
 * Coinbase sends postMessage payloads as JSON strings. Parse and narrow them
 * before the page reacts to lifecycle events.
 */
function parseCoinbaseEvent(raw: unknown): CoinbaseEvent | null {
  let parsed: unknown;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const maybe = parsed as Record<string, unknown>;
  if (typeof maybe.eventName !== "string") return null;
  if (!maybe.eventName.startsWith("onramp_api.")) return null;
  const data = maybe.data;
  const fields =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  return {
    eventName: maybe.eventName,
    data: {
      errorCode:
        typeof fields.errorCode === "string" ? fields.errorCode : undefined,
      errorMessage:
        typeof fields.errorMessage === "string"
          ? fields.errorMessage.slice(0, 1000)
          : undefined,
    },
  };
}

function isCoinbaseOrigin(origin: string): boolean {
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== "https:") return false;
    return hostname === "coinbase.com" || hostname.endsWith(".coinbase.com");
  } catch {
    return false;
  }
}

function debugApplePay(
  message: string,
  fields?: Record<string, unknown>,
): void {
  console.info("[apple-pay]", message, fields ?? {});
}
