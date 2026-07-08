// Wire protocol for messages the hosted flow sends to its host container
// (web iframe or native WebView). Pure: no DOM or React Native APIs, so it can
// be imported from any entry point. Versioned via `version: 1`.

const DAIMO_MESSAGE_SOURCE = "daimo-pay";
const DAIMO_MESSAGE_VERSION = 1;

export type DaimoFrameMessage =
  | {
      source: typeof DAIMO_MESSAGE_SOURCE;
      version: typeof DAIMO_MESSAGE_VERSION;
      type: "ready" | "modalOpened" | "modalClosed";
    }
  | {
      source: typeof DAIMO_MESSAGE_SOURCE;
      version: typeof DAIMO_MESSAGE_VERSION;
      type: "paymentStarted" | "paymentCompleted";
    }
  | {
      source: typeof DAIMO_MESSAGE_SOURCE;
      version: typeof DAIMO_MESSAGE_VERSION;
      type: "contentHeightChanged";
      payload: { height: number };
    };

/**
 * Parse a raw message payload from the hosted flow. Returns `null` for anything
 * that isn't a well-formed Daimo message, so callers can safely ignore
 * unrelated postMessage traffic.
 */
export function parseDaimoFrameMessage(value: unknown): DaimoFrameMessage | null {
  if (value == null || typeof value !== "object") return null;
  if (!("source" in value) || value.source !== DAIMO_MESSAGE_SOURCE) return null;
  if ("version" in value && value.version !== DAIMO_MESSAGE_VERSION) return null;
  if (!("type" in value) || typeof value.type !== "string") return null;

  switch (value.type) {
    case "ready":
    case "modalOpened":
    case "modalClosed":
    case "paymentStarted":
    case "paymentCompleted":
      return {
        source: DAIMO_MESSAGE_SOURCE,
        version: DAIMO_MESSAGE_VERSION,
        type: value.type,
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

function getPayload(value: object): Record<string, unknown> | null {
  if (!("payload" in value)) return null;
  if (value.payload == null || typeof value.payload !== "object") return null;
  return value.payload as Record<string, unknown>;
}
