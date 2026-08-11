// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AccountFlowContext,
  type AccountFlowState,
} from "../../hooks/useAccountFlow.js";
import { AccountEmailPage } from "./AccountEmailPage.js";

const roots: Root[] = [];

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("AccountEmailPage auth preparation", () => {
  afterEach(() => {
    for (const root of roots.splice(0)) {
      act(() => root.unmount());
    }
    document.body.replaceChildren();
  });

  it("does not start a second logout after explicit logout", async () => {
    const logout = vi.fn(() => new Promise<void>(() => {}));
    const account = {
      authError: null,
      authErrorDetails: null,
      email: "",
      isAuthenticated: false,
      isLoggingIn: false,
      logout,
      sendOtp: vi.fn(async () => false),
      setEmail: vi.fn(),
    } as unknown as AccountFlowState;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(
        createElement(AccountFlowContext.Provider, {
          value: account,
          children: createElement(AccountEmailPage, {
            methodLabel: "Apple Pay",
            sessionId: "session-1",
            clientSecret: "secret-1",
            onBack: null,
            onOtpSent: vi.fn(),
          }),
        }),
      );
    });

    expect(logout).not.toHaveBeenCalled();
    expect(container.querySelector('button[type="submit"]')?.textContent).toBe(
      "Continue",
    );
  });
});
