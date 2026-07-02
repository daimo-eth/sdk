import type { DepositDeeplink } from "../../common/account.js";

export const DAIMO_FRAME_PARENT_ORIGIN_PARAM = "parentOrigin";

const DAIMO_MESSAGE_SOURCE = "daimo-pay";
const DAIMO_MESSAGE_VERSION = 1;

export type DaimoFrameMessage =
  | {
      source: typeof DAIMO_MESSAGE_SOURCE;
      version: typeof DAIMO_MESSAGE_VERSION;
      type: "modalClosed";
    }
  | {
      source: typeof DAIMO_MESSAGE_SOURCE;
      version: typeof DAIMO_MESSAGE_VERSION;
      type: "contentHeightChanged";
      payload: { height: number };
    }
  | {
      source: typeof DAIMO_MESSAGE_SOURCE;
      version: typeof DAIMO_MESSAGE_VERSION;
      type: "openDeeplink";
      payload: { deeplink: DepositDeeplink };
    };

type DaimoFrameMessageInput = DaimoFrameMessage extends infer Message
  ? Message extends DaimoFrameMessage
    ? Omit<Message, "source" | "version">
    : never
  : never;

export function postDaimoFrameMessage(
  input: DaimoFrameMessageInput,
): boolean {
  if (window.parent === window) return false;

  const targetOrigin = getDaimoFrameParentOrigin();
  if (!targetOrigin) return false;

  window.parent.postMessage(
    {
      source: DAIMO_MESSAGE_SOURCE,
      version: DAIMO_MESSAGE_VERSION,
      ...input,
    },
    targetOrigin,
  );
  return true;
}

export function parseDaimoFrameMessage(value: unknown): DaimoFrameMessage | null {
  if (value == null || typeof value !== "object") return null;
  if (!("source" in value) || value.source !== DAIMO_MESSAGE_SOURCE) {
    return null;
  }
  if (!("version" in value) || value.version !== DAIMO_MESSAGE_VERSION) {
    return null;
  }
  if (!("type" in value) || typeof value.type !== "string") return null;

  switch (value.type) {
    case "modalClosed":
      return {
        source: DAIMO_MESSAGE_SOURCE,
        version: DAIMO_MESSAGE_VERSION,
        type: "modalClosed",
      };
    case "contentHeightChanged": {
      const payload = getPayload(value);
      const height = Number(payload?.height);
      if (!(height > 0)) return null;
      return {
        source: DAIMO_MESSAGE_SOURCE,
        version: DAIMO_MESSAGE_VERSION,
        type: "contentHeightChanged",
        payload: { height },
      };
    }
    case "openDeeplink": {
      const deeplink = parseDepositDeeplink(getPayload(value)?.deeplink);
      if (!deeplink) return null;
      return {
        source: DAIMO_MESSAGE_SOURCE,
        version: DAIMO_MESSAGE_VERSION,
        type: "openDeeplink",
        payload: { deeplink },
      };
    }
    default:
      return null;
  }
}

function getDaimoFrameParentOrigin(): string | null {
  const rawOrigin = new URLSearchParams(window.location.search).get(
    DAIMO_FRAME_PARENT_ORIGIN_PARAM,
  );
  if (!rawOrigin) return null;

  try {
    return new URL(rawOrigin).origin;
  } catch {
    return null;
  }
}

function getPayload(value: object): Record<string, unknown> | null {
  if (!("payload" in value)) return null;
  if (value.payload == null || typeof value.payload !== "object") return null;
  return value.payload as Record<string, unknown>;
}

function parseDepositDeeplink(value: unknown): DepositDeeplink | null {
  if (value == null || typeof value !== "object") return null;
  if (!("type" in value)) return null;

  if (value.type === "redirect") {
    if (!("url" in value) || typeof value.url !== "string") return null;
    return { type: "redirect", url: value.url };
  }

  if (value.type !== "form-post") return null;
  if (!("warmUrl" in value) || typeof value.warmUrl !== "string") return null;
  if (
    !("warmDelayMs" in value) ||
    typeof value.warmDelayMs !== "number" ||
    !Number.isFinite(value.warmDelayMs)
  ) {
    return null;
  }
  if (
    !("formAction" in value) ||
    typeof value.formAction !== "string" ||
    !("formFields" in value) ||
    !isStringRecord(value.formFields)
  ) {
    return null;
  }

  return {
    type: "form-post",
    warmUrl: value.warmUrl,
    warmDelayMs: value.warmDelayMs,
    formAction: value.formAction,
    formFields: value.formFields,
  };
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (value == null || typeof value !== "object") return false;
  return Object.values(value).every((entry) => typeof entry === "string");
}
