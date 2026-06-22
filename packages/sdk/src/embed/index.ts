import type { SessionPublicInfo } from "../common/session.js";

export type DaimoPayEmbedLayout = "embed";
export type DaimoPayEmbedTheme = "light" | "dark";

export type DaimoPayMessageType =
  | "ready"
  | "contentHeightChanged"
  | "modalOpened"
  | "modalClosed"
  | "sessionUpdated"
  | "paymentStarted"
  | "paymentCompleted"
  | "paymentBounced"
  | "paymentExpired"
  | "error";

export type DaimoPayMessage =
  | DaimoPayMessageWithPayload<"ready", Record<string, never>>
  | DaimoPayMessageWithPayload<"contentHeightChanged", { height: number }>
  | DaimoPayMessageWithPayload<"modalOpened", Record<string, never>>
  | DaimoPayMessageWithPayload<"modalClosed", Record<string, never>>
  | DaimoPayMessageWithPayload<"sessionUpdated", { session: SessionPublicInfo }>
  | DaimoPayMessageWithPayload<"paymentStarted", { session: SessionPublicInfo }>
  | DaimoPayMessageWithPayload<
      "paymentCompleted",
      { session: SessionPublicInfo }
    >
  | DaimoPayMessageWithPayload<"paymentBounced", { session: SessionPublicInfo }>
  | DaimoPayMessageWithPayload<"paymentExpired", { session: SessionPublicInfo }>
  | DaimoPayMessageWithPayload<"error", { message: string }>;

export type DaimoPayMessageWithPayload<
  Type extends DaimoPayMessageType,
  Payload extends Record<string, unknown>,
> = {
  source: "daimo-pay";
  version: 2;
  type: Type;
  payload: Payload;
};

export type BuildDaimoPayUrlArgs = {
  payUrl: string;
  layout?: DaimoPayEmbedLayout;
  parentOrigin?: string;
  locale?: string;
  theme?: DaimoPayEmbedTheme;
};

export type CreateDaimoPayIframeArgs = BuildDaimoPayUrlArgs & {
  container: HTMLElement;
  title?: string;
  className?: string;
  onReady?: (message: Extract<DaimoPayMessage, { type: "ready" }>) => void;
  onContentHeightChanged?: (
    message: Extract<DaimoPayMessage, { type: "contentHeightChanged" }>,
  ) => void;
  onModalOpened?: (
    message: Extract<DaimoPayMessage, { type: "modalOpened" }>,
  ) => void;
  onModalClosed?: (
    message: Extract<DaimoPayMessage, { type: "modalClosed" }>,
  ) => void;
  onSessionUpdated?: (
    message: Extract<DaimoPayMessage, { type: "sessionUpdated" }>,
  ) => void;
  onPaymentStarted?: (
    message: Extract<DaimoPayMessage, { type: "paymentStarted" }>,
  ) => void;
  onPaymentCompleted?: (
    message: Extract<DaimoPayMessage, { type: "paymentCompleted" }>,
  ) => void;
  onPaymentBounced?: (
    message: Extract<DaimoPayMessage, { type: "paymentBounced" }>,
  ) => void;
  onPaymentExpired?: (
    message: Extract<DaimoPayMessage, { type: "paymentExpired" }>,
  ) => void;
  onError?: (message: Extract<DaimoPayMessage, { type: "error" }>) => void;
  onMessage?: (message: DaimoPayMessage) => void;
};

export type DaimoPayIframeHandle = {
  iframe: HTMLIFrameElement;
  destroy: () => void;
};

export type ParseDaimoPayMessageOptions = {
  expectedOrigin?: string;
};

export function buildDaimoPayUrl(args: BuildDaimoPayUrlArgs): string {
  const url = new URL(args.payUrl);
  if (args.layout != null) url.searchParams.set("layout", args.layout);
  if (args.parentOrigin != null) {
    url.searchParams.set("parentOrigin", args.parentOrigin);
  }
  if (args.locale != null) url.searchParams.set("locale", args.locale);
  if (args.theme != null) url.searchParams.set("theme", args.theme);
  return url.toString();
}

export function createDaimoPayIframe(
  args: CreateDaimoPayIframeArgs,
): DaimoPayIframeHandle {
  const parentOrigin = args.parentOrigin ?? window.location.origin;
  const src = buildDaimoPayUrl({
    payUrl: args.payUrl,
    layout: args.layout ?? "embed",
    parentOrigin,
    locale: args.locale,
    theme: args.theme,
  });
  const iframeOrigin = new URL(src).origin;

  const iframe = document.createElement("iframe");
  iframe.src = src;
  iframe.title = args.title ?? "Daimo Pay";
  iframe.allow = "payment; clipboard-write; publickey-credentials-get";
  iframe.style.border = "0";
  iframe.style.width = "100%";
  iframe.style.display = "block";
  if (args.className != null) iframe.className = args.className;

  const onWindowMessage = (event: MessageEvent) => {
    const message = parseDaimoPayMessage(event, {
      expectedOrigin: iframeOrigin,
    });
    if (message == null) return;
    args.onMessage?.(message);
    dispatchMessage(args, message);
  };

  window.addEventListener("message", onWindowMessage);
  args.container.appendChild(iframe);

  return {
    iframe,
    destroy: () => {
      window.removeEventListener("message", onWindowMessage);
      iframe.remove();
    },
  };
}

export function parseDaimoPayMessage(
  event: MessageEvent,
  options: ParseDaimoPayMessageOptions = {},
): DaimoPayMessage | null {
  if (
    options.expectedOrigin != null &&
    event.origin !== options.expectedOrigin
  ) {
    return null;
  }
  return parseMessageData(event.data);
}

function parseMessageData(data: unknown): DaimoPayMessage | null {
  const value = typeof data === "string" ? parseJson(data) : data;
  if (!isRecord(value)) return null;
  if (value.source !== "daimo-pay" || value.version !== 2) return null;
  if (typeof value.type !== "string" || !isMessageType(value.type)) {
    return null;
  }
  const payload = isRecord(value.payload) ? value.payload : null;
  if (payload == null) return null;

  if (value.type === "contentHeightChanged") {
    return typeof payload.height === "number"
      ? ({ ...value, payload: { height: payload.height } } as DaimoPayMessage)
      : null;
  }

  if (value.type === "error") {
    return typeof payload.message === "string"
      ? ({ ...value, payload: { message: payload.message } } as DaimoPayMessage)
      : null;
  }

  if (
    value.type === "sessionUpdated" ||
    value.type === "paymentStarted" ||
    value.type === "paymentCompleted" ||
    value.type === "paymentBounced" ||
    value.type === "paymentExpired"
  ) {
    return isRecord(payload.session)
      ? (value as unknown as DaimoPayMessage)
      : null;
  }

  return Object.keys(payload).length === 0 ? (value as DaimoPayMessage) : null;
}

function dispatchMessage(
  args: CreateDaimoPayIframeArgs,
  message: DaimoPayMessage,
) {
  switch (message.type) {
    case "ready":
      args.onReady?.(message);
      return;
    case "contentHeightChanged":
      args.onContentHeightChanged?.(message);
      return;
    case "modalOpened":
      args.onModalOpened?.(message);
      return;
    case "modalClosed":
      args.onModalClosed?.(message);
      return;
    case "sessionUpdated":
      args.onSessionUpdated?.(message);
      return;
    case "paymentStarted":
      args.onPaymentStarted?.(message);
      return;
    case "paymentCompleted":
      args.onPaymentCompleted?.(message);
      return;
    case "paymentBounced":
      args.onPaymentBounced?.(message);
      return;
    case "paymentExpired":
      args.onPaymentExpired?.(message);
      return;
    case "error":
      args.onError?.(message);
      return;
  }
}

function isMessageType(type: string): type is DaimoPayMessageType {
  return [
    "ready",
    "contentHeightChanged",
    "modalOpened",
    "modalClosed",
    "sessionUpdated",
    "paymentStarted",
    "paymentCompleted",
    "paymentBounced",
    "paymentExpired",
    "error",
  ].includes(type);
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
