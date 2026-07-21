import { describe, expect, test } from "vitest";

import {
  applyFrameHeight,
  applyFrameReady,
  createFrameReadiness,
  markFrameError,
} from "./frameReadiness.js";

const INITIAL = 420;

describe("frameReadiness", () => {
  test("stays loading when height arrives before ready", () => {
    let state = createFrameReadiness(INITIAL);
    state = applyFrameHeight(state, 360);
    expect(state).toMatchObject({
      gotReady: false,
      gotHeight: true,
      height: 360,
      status: "loading",
    });
  });

  test("stays loading when ready arrives before height", () => {
    let state = createFrameReadiness(INITIAL);
    state = applyFrameReady(state);
    expect(state).toMatchObject({
      gotReady: true,
      gotHeight: false,
      height: INITIAL,
      status: "loading",
    });
  });

  test("loads once both ready and a positive height have arrived", () => {
    let state = createFrameReadiness(INITIAL);
    state = applyFrameHeight(state, 360);
    state = applyFrameReady(state);
    expect(state.status).toBe("loaded");
    expect(state.height).toBe(360);

    state = createFrameReadiness(INITIAL);
    state = applyFrameReady(state);
    state = applyFrameHeight(state, 480);
    expect(state.status).toBe("loaded");
    expect(state.height).toBe(480);
  });

  test("ignores non-positive heights", () => {
    let state = applyFrameReady(createFrameReadiness(INITIAL));
    state = applyFrameHeight(state, 0);
    state = applyFrameHeight(state, -10);
    expect(state).toMatchObject({
      gotHeight: false,
      height: INITIAL,
      status: "loading",
    });
  });

  test("height messages only resize after loaded", () => {
    let state = applyFrameReady(createFrameReadiness(INITIAL));
    state = applyFrameHeight(state, 360);
    expect(state.status).toBe("loaded");
    state = applyFrameHeight(state, 520);
    expect(state).toMatchObject({ height: 520, status: "loaded" });
  });

  test("reset via createFrameReadiness clears prior readiness", () => {
    let state = applyFrameReady(createFrameReadiness(INITIAL));
    state = applyFrameHeight(state, 360);
    expect(state.status).toBe("loaded");

    state = createFrameReadiness(INITIAL);
    expect(state).toEqual({
      gotReady: false,
      gotHeight: false,
      height: INITIAL,
      status: "loading",
    });
  });

  test("timeout/error wins over subsequent ready or height", () => {
    let state = markFrameError(createFrameReadiness(INITIAL));
    state = applyFrameReady(state);
    state = applyFrameHeight(state, 400);
    expect(state.status).toBe("error");
    expect(state.gotReady).toBe(true);
    expect(state.gotHeight).toBe(true);
    expect(state.height).toBe(400);
  });
});
