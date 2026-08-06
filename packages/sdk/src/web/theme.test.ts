import { afterEach, describe, expect, test, vi } from "vitest";

import { retainDaimoThemeStylesheet } from "./theme.js";

type LinkEvent = "load" | "error";

class FakeLink {
  rel = "";
  href = "";
  dataset: Record<string, string> = {};
  removed = false;
  private listeners = new Map<LinkEvent, Set<() => void>>();

  addEventListener(type: LinkEvent, listener: () => void) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: LinkEvent, listener: () => void) {
    this.listeners.get(type)?.delete(listener);
  }

  remove() {
    this.removed = true;
  }

  dispatch(type: LinkEvent) {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }
}

const originalDocument = globalThis.document;

afterEach(() => {
  vi.restoreAllMocks();
  if (originalDocument == null) {
    Reflect.deleteProperty(globalThis, "document");
  } else {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: originalDocument,
    });
  }
});

describe("custom theme stylesheet readiness", () => {
  test("shares a link and keeps it until the final consumer leaves", () => {
    const links = installFakeDocument();
    const firstReady = vi.fn();
    const secondReady = vi.fn();

    const releaseFirst = retainDaimoThemeStylesheet(
      "https://example.com/theme.css",
      firstReady,
    );
    const releaseSecond = retainDaimoThemeStylesheet(
      "https://example.com/theme.css",
      secondReady,
    );

    expect(links).toHaveLength(1);
    links[0]?.dispatch("load");
    expect(firstReady).toHaveBeenCalledOnce();
    expect(secondReady).toHaveBeenCalledOnce();

    releaseFirst();
    expect(links[0]?.removed).toBe(false);
    releaseSecond();
    expect(links[0]?.removed).toBe(true);
  });

  test("treats stylesheet failure as ready for built-in theme fallback", () => {
    const links = installFakeDocument();
    const onReady = vi.fn();
    const release = retainDaimoThemeStylesheet(
      "https://example.com/missing.css",
      onReady,
    );

    links[0]?.dispatch("error");

    expect(onReady).toHaveBeenCalledOnce();
    release();
  });
});

function installFakeDocument(): FakeLink[] {
  const links: FakeLink[] = [];
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: () => new FakeLink(),
      head: {
        appendChild: (link: FakeLink) => links.push(link),
      },
    },
  });
  return links;
}
