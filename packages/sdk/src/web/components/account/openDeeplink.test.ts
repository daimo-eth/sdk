import type { Mock } from "vitest";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { DepositDeeplink } from "../../../common/account.js";
import { openDeeplink } from "./openDeeplink.js";

type NativeHandler = { postMessage(message: unknown): void };
type FakePopup = {
  closed: boolean;
  location: { href: string };
  document: {
    open: Mock;
    write: Mock<(html: string) => void>;
    close: Mock;
  };
};
type FakeWindow = {
  location: { href: string; search: string };
  parent: unknown;
  open: (
    url?: string | URL,
    target?: string,
    features?: string,
  ) => FakePopup | null;
  webkit?: { messageHandlers?: { daimoPay?: NativeHandler } };
};

const redirectDeeplink: DepositDeeplink = {
  type: "redirect",
  url: "https://bank.example/redirect",
};

const formPostDeeplink: DepositDeeplink = {
  type: "form-post",
  warmUrl: "https://etransfer.interac.ca/acceptPaymentRequest.do?rID=req-1",
  warmDelayMs: 2500,
  formAction: "https://etransfer.interac.ca/fulfilPaymentRequest.do",
  formFields: {
    fiId: "bank-1",
    rID: "req-1",
  },
};

describe("openDeeplink", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test("navigates mobile form-post deeplinks to the warm url outside a frame", () => {
    const { fakeWindow, open } = stubWindow({ frameChild: false });

    openDeeplink(formPostDeeplink, "mobile");

    expect(fakeWindow.location.href).toBe(formPostDeeplink.warmUrl);
    expect(open).not.toHaveBeenCalled();
  });

  test("opens mobile form-post deeplinks to the warm url inside DaimoFrame", () => {
    vi.useFakeTimers();
    const popup = createPopup();
    const { open } = stubWindow({ frameChild: true, popup });

    openDeeplink(formPostDeeplink, "mobile");
    vi.runAllTimers();

    expect(open).toHaveBeenCalledExactlyOnceWith(
      formPostDeeplink.warmUrl,
      "_blank",
    );
    expect(popup.location.href).toBe("");
    expect(popup.document.write).not.toHaveBeenCalled();
  });

  test("keeps desktop form-post deeplinks on delayed form submit", () => {
    vi.useFakeTimers();
    const popup = createPopup();
    const { open } = stubWindow({ frameChild: false, popup });

    openDeeplink(formPostDeeplink, "desktop");

    expect(open).toHaveBeenCalledExactlyOnceWith(
      formPostDeeplink.warmUrl,
      "_blank",
    );
    expect(popup.document.write).not.toHaveBeenCalled();

    vi.advanceTimersByTime(formPostDeeplink.warmDelayMs);

    expect(popup.location.href).toBe("about:blank");
    expect(popup.document.write).toHaveBeenCalledOnce();
    expect(popup.document.write.mock.calls[0]?.[0]).toContain(
      formPostDeeplink.formAction,
    );
  });

  test("keeps redirect behavior unchanged", () => {
    const mobile = stubWindow({ frameChild: false });
    openDeeplink(redirectDeeplink, "mobile");

    expect(mobile.fakeWindow.location.href).toBe(redirectDeeplink.url);
    expect(mobile.open).not.toHaveBeenCalled();

    vi.unstubAllGlobals();

    const desktop = stubWindow({ frameChild: false });
    openDeeplink(redirectDeeplink, "desktop");

    expect(desktop.open).toHaveBeenCalledExactlyOnceWith(
      redirectDeeplink.url,
      "_blank",
    );
    expect(desktop.fakeWindow.location.href).toBe("https://daimo.com/webview");
  });
});

function stubWindow({
  frameChild,
  popup = null,
}: {
  frameChild: boolean;
  popup?: FakePopup | null;
}) {
  const open = vi.fn<
    (url?: string | URL, target?: string, features?: string) => FakePopup | null
  >(() => popup);
  const fakeWindow: FakeWindow = {
    location: {
      href: "https://daimo.com/webview",
      search: frameChild
        ? "?parentOrigin=https%3A%2F%2Fmerchant.example"
        : "",
    },
    parent: null,
    open,
  };
  fakeWindow.parent = frameChild
    ? { origin: "https://merchant.example" }
    : fakeWindow;
  vi.stubGlobal("window", fakeWindow);
  return { fakeWindow, open };
}

function createPopup() {
  return {
    closed: false,
    location: { href: "" },
    document: {
      open: vi.fn(),
      write: vi.fn<(html: string) => void>(),
      close: vi.fn(),
    },
  };
}
