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
    };

export function isDaimoFrameChild(): boolean {
  return window.parent !== window && getDaimoFrameParentOrigin() != null;
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
