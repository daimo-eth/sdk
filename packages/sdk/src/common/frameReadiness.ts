/**
 * Host-side reveal gating for DaimoFrame / DaimoFrameRN.
 *
 * The hosted webview may report height while still applying the org theme, and
 * may signal `ready` before the first layout measurement. Reveal only once both
 * have arrived so the host never paints default (unthemed) colors.
 */

export type FrameSurfaceStatus = "loading" | "loaded" | "error";

export type FrameReadiness = {
  /** Hosted flow reported `ready` (theme resolved, safe to show). */
  gotReady: boolean;
  /** Received at least one positive `contentHeightChanged` height. */
  gotHeight: boolean;
  /** Latest content height (placeholder until the first positive report). */
  height: number;
  status: FrameSurfaceStatus;
};

export function createFrameReadiness(initialHeight: number): FrameReadiness {
  return {
    gotReady: false,
    gotHeight: false,
    height: initialHeight,
    status: "loading",
  };
}

export function applyFrameReady(state: FrameReadiness): FrameReadiness {
  return finalize({ ...state, gotReady: true });
}

export function applyFrameHeight(
  state: FrameReadiness,
  height: number,
): FrameReadiness {
  if (height <= 0) return state;
  return finalize({ ...state, gotHeight: true, height });
}

export function markFrameError(state: FrameReadiness): FrameReadiness {
  return { ...state, status: "error" };
}

function finalize(state: FrameReadiness): FrameReadiness {
  if (state.status === "error") return state;
  const loaded = state.gotReady && state.gotHeight;
  return { ...state, status: loaded ? "loaded" : "loading" };
}
