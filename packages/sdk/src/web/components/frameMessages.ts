// Web-only helpers around the shared frame-message protocol. The wire protocol
// and parser live in `@daimo/sdk/common` so the web and native entry points
// share one source of truth; this module adds the browser-specific bits.

export type { DaimoFrameMessage } from "../../common/frameMessages.js";
export { parseDaimoFrameMessage } from "../../common/frameMessages.js";

export const DAIMO_FRAME_PARENT_ORIGIN_PARAM = "parentOrigin";

export function isDaimoFrameChild(): boolean {
  return window.parent !== window && getDaimoFrameParentOrigin() != null;
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
