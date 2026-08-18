import type {
  EnrollmentInteraction,
  EnrollmentResponse,
} from "../../../common/account.js";
import {
  zEnrollmentActionInput,
  zEnrollmentInteraction,
} from "../../../common/account.js";
import { DaimoRequestError } from "../../../common/errors.js";
import { createDaimoClient } from "../../../client/createDaimoClient.js";
import { describe, expect, expectTypeOf, test } from "vitest";

import {
  enrollmentFormActionInput,
  enrollmentHostedReturnTiming,
  enrollmentInteractionIdentity,
  enrollmentNavigationEffect,
  enrollmentPollingDelay,
  enrollmentRequestFailureBehavior,
  isRetryableEnrollmentRefreshError,
  isEnrollmentResponseCurrent,
  loadEnrollmentStep,
  retryEnrollmentRefresh,
  shouldLoadEnrollmentTarget,
  submitEnrollmentStep,
  toLegacyEnrollmentInteraction,
  type EnrollmentStep,
  type LegacyEnrollmentCopy,
} from "./enrollmentProtocol.js";

const legacyCopy: LegacyEnrollmentCopy = {
  verification: {
    title: "Verification",
    description: "Complete verification",
    openExternalLabel: "Open verification",
  },
  liveness: {
    title: "Liveness",
    description: "Complete liveness",
    openExternalLabel: "Open liveness",
  },
};

const form = {
  id: "identity",
  revision: "2",
  title: "Identity",
  submitLabel: "Continue",
  fields: [],
};

const hosted = {
  version: 1,
  kind: "hosted",
  polling: { status: "none" },
  mode: "hosted",
  purpose: "agreement",
  url: "https://example.test/agreement",
  copy: {
    title: "Agreement",
    description: "Accept terms",
    openExternalLabel: "Open",
  },
  returnBehavior: {
    kind: "submit",
    action: { id: "ea1_action", revision: "1" },
    autoSubmitDelayMs: 900,
  },
} as const satisfies EnrollmentInteraction;

describe("legacy enrollment compatibility", () => {
  test("parses provider-agnostic dependent form options", () => {
    const interaction = zEnrollmentInteraction.parse({
      version: 1,
      kind: "form",
      polling: { status: "none" },
      action: { id: "ea1_form", revision: "1" },
      form: {
        ...form,
        fields: [
          {
            key: "municipality",
            type: "dependent-select",
            label: "Municipality",
            required: true,
            dependsOn: "department",
            optionsByValue: {
              "CO.DC": [{ value: "11001", label: "11001" }],
            },
          },
        ],
      },
    });

    expect(interaction.kind).toBe("form");
    if (interaction.kind !== "form") return;
    expect(interaction.form.fields[0]).toMatchObject({
      type: "dependent-select",
      dependsOn: "department",
    });
  });

  test.each<{
    response: EnrollmentResponse;
    kind: EnrollmentInteraction["kind"];
    polls: boolean;
  }>([
    {
      response: { action: "enrollment_form_required", form },
      kind: "form",
      polls: false,
    },
    {
      response: {
        action: "provider_otp_required",
        destination: "email",
        copy: {
          title: "Code",
          message: "Check email",
          invalidMessage: "Invalid code",
        },
      },
      kind: "otp",
      polls: false,
    },
    {
      response: { action: "phone_required", reason: "verify phone" },
      kind: "account-phone-verification",
      polls: false,
    },
    {
      response: {
        action: "kyc_required",
        url: "https://example.test/kyc",
      },
      kind: "hosted",
      polls: true,
    },
    {
      response: {
        action: "hosted_kyc_required",
        url: "https://example.test/liveness",
      },
      kind: "hosted",
      polls: true,
    },
    {
      response: {
        action: "hosted_agreement_required",
        title: "Agreement",
        description: "Accept terms",
        url: "https://example.test/terms",
        openExternalLabel: "Open",
        continueLabel: "Continue",
        fallbackDescription: "Return",
        autoContinueDescription: "Continuing",
        checkingDescription: "Checking",
      },
      kind: "hosted",
      polls: true,
    },
    {
      response: {
        action: "kyc_retry",
        reason: "try again",
        url: "https://example.test/retry",
      },
      kind: "retry",
      polls: true,
    },
    {
      response: { action: "kyc_pending_review" },
      kind: "wait",
      polls: true,
    },
    {
      response: { action: "provider_pending" },
      kind: "wait",
      polls: true,
    },
    {
      response: { action: "kyc_rejected_final", reason: "rejected" },
      kind: "rejection",
      polls: false,
    },
    {
      response: { action: "not_eligible", reason: "not eligible" },
      kind: "ineligible",
      polls: false,
    },
    {
      response: { action: "suspended", reason: "suspended" },
      kind: "suspended",
      polls: false,
    },
    {
      response: { action: "error", message: "retry", retryable: true },
      kind: "error",
      polls: false,
    },
    {
      response: { action: "account_email_change_required" },
      kind: "account-email-change",
      polls: false,
    },
    { response: { action: "active" }, kind: "active", polls: false },
  ])("maps $response.action to $kind", ({ response, kind, polls }) => {
    const interaction = toLegacyEnrollmentInteraction(response, legacyCopy);
    expect(interaction.kind).toBe(kind);
    expect(interaction.polling.status === "poll").toBe(polls);
    expect(
      enrollmentInteractionIdentity({ interaction, protocol: "legacy" }),
    ).toBeTypeOf("string");
  });

  test("falls back only when the generic HTTP route is absent", async () => {
    const requests: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      requests.push(url);
      if (url.endsWith("/enrollment/interaction")) {
        return new Response("not found", { status: 404 });
      }
      return jsonResponse({ action: "active" });
    };
    const client = createDaimoClient({
      baseUrl: "https://api.example.test",
      fetchImpl,
    });

    const result = await loadEnrollmentStep({
      client,
      rail: "interac",
      locale: "en",
      auth: { bearerToken: "token" },
      legacyCopy,
    });

    expect(result).toEqual({
      protocol: "legacy",
      interaction: { version: 1, kind: "active", polling: { status: "none" } },
    });
    expect(requests).toEqual([
      "https://api.example.test/v1/internal/account/enrollment/interaction",
      "https://api.example.test/v1/internal/account/enrollment/start",
    ]);
  });

  test("requests interaction version 2 on the generic route", async () => {
    let versionHeader = "";
    const fetchImpl: typeof fetch = async (_input, init) => {
      versionHeader = new Headers(init?.headers).get(
        "x-daimo-enrollment-interaction-version",
      ) ?? "";
      return jsonResponse({
        version: 2,
        kind: "account-email-change",
        polling: { status: "none" },
      });
    };
    const client = createDaimoClient({
      baseUrl: "https://api.example.test",
      fetchImpl,
    });

    const result = await loadEnrollmentStep({
      client,
      rail: "interac",
      locale: "en",
      auth: { bearerToken: "token" },
      legacyCopy,
    });

    expect(versionHeader).toBe("2");
    expect(result.interaction).toEqual({
      version: 2,
      kind: "account-email-change",
      polling: { status: "none" },
    });
  });

  test("submits the legacy legal-name form without a rail gate", async () => {
    let requestBody: unknown;
    let requestUrl = "";
    const fetchImpl: typeof fetch = async (input, init) => {
      requestUrl = String(input);
      requestBody = JSON.parse(String(init?.body));
      return jsonResponse({ action: "active" });
    };
    const client = createDaimoClient({
      baseUrl: "https://api.example.test",
      fetchImpl,
    });
    const interaction = toLegacyEnrollmentInteraction(
      {
        action: "enrollment_form_required",
        form: { ...form, id: "account-legal-name", revision: "1" },
      },
      legacyCopy,
    );
    const step: EnrollmentStep = { interaction, protocol: "legacy" };

    const result = await submitEnrollmentStep({
      client,
      rail: "sepa",
      locale: "en",
      auth: { bearerToken: "token" },
      step,
      actionId: "legacy:form:account-legal-name",
      input: {
        kind: "form",
        formId: "account-legal-name",
        revision: "1",
        values: { firstName: "Ada", lastName: "Lovelace" },
      },
      legacyCopy,
    });

    expect(result.interaction.kind).toBe("active");
    expect(requestUrl).toBe(
      "https://api.example.test/v1/internal/account/enrollment/start",
    );
    expect(requestBody).toEqual({
      rail: "sepa",
      legalName: { firstName: "Ada", lastName: "Lovelace" },
      locale: "en",
    });
  });
});

describe("generic enrollment contract", () => {
  test("preserves only background polls", () => {
    expect(enrollmentRequestFailureBehavior("poll", true)).toBe(
      "retry-poll",
    );
    expect(enrollmentRequestFailureBehavior("poll", false)).toBe(
      "show-error",
    );
    expect(enrollmentRequestFailureBehavior("user-action", true)).toBe(
      "show-error",
    );
  });

  test("retries an idempotent refresh after transient 400 responses", async () => {
    let attempts = 0;
    const waits: number[] = [];
    const client = createDaimoClient({
      baseUrl: "https://api.example.test",
      fetchImpl: async () => {
        attempts += 1;
        if (attempts < 3) {
          return new Response("bad request", { status: 400 });
        }
        return jsonResponse({
          version: 1,
          kind: "active",
          polling: { status: "none" },
        });
      },
    });

    const result = await retryEnrollmentRefresh(
      () =>
        loadEnrollmentStep({
          client,
          rail: "sepa",
          locale: "en",
          auth: { bearerToken: "token" },
          legacyCopy,
        }),
      async (delayMs) => {
        waits.push(delayMs);
      },
    );

    expect(result.interaction.kind).toBe("active");
    expect(attempts).toBe(3);
    expect(waits).toEqual([500, 1_500]);
  });

  test("does not retry authentication or missing-route errors", () => {
    expect(
      isRetryableEnrollmentRefreshError(
        new DaimoRequestError({ status: 401, message: "unauthorized" }),
      ),
    ).toBe(false);
    expect(
      isRetryableEnrollmentRefreshError(
        new DaimoRequestError({ status: 404, message: "not found" }),
      ),
    ).toBe(false);
    expect(
      isRetryableEnrollmentRefreshError(
        new DaimoRequestError({ status: 400, message: "bad request" }),
      ),
    ).toBe(true);
  });

  test.each<{
    interaction: EnrollmentInteraction;
    navigation: "render" | "phone" | "ready";
    pollDelay: number | null;
  }>([
    {
      interaction: {
        version: 1,
        kind: "form",
        polling: { status: "none" },
        action: { id: "ea1_form", revision: "2" },
        form,
      },
      navigation: "render",
      pollDelay: null,
    },
    {
      interaction: {
        version: 1,
        kind: "otp",
        polling: { status: "none" },
        destination: "email",
        copy: {
          title: "Code",
          message: "Check email",
          invalidMessage: "Invalid",
        },
        submitAction: { id: "ea1_otp", revision: "1" },
        resend: {
          status: "available",
          delayMs: 5_000,
          action: { id: "ea1_resend", revision: "1" },
        },
      },
      navigation: "render",
      pollDelay: null,
    },
    {
      interaction: {
        version: 1,
        kind: "account-phone-verification",
        polling: { status: "none" },
        returnBehavior: { kind: "refresh" },
      },
      navigation: "phone",
      pollDelay: null,
    },
    { interaction: hosted, navigation: "render", pollDelay: null },
    {
      interaction: {
        version: 1,
        kind: "wait",
        polling: { status: "poll", delayMs: 2_000 },
        reason: "review",
      },
      navigation: "render",
      pollDelay: 2_000,
    },
    {
      interaction: {
        version: 1,
        kind: "retry",
        polling: { status: "none" },
        reason: "try again",
        action: { id: "ea1_retry", revision: "1" },
      },
      navigation: "render",
      pollDelay: null,
    },
    {
      interaction: {
        version: 1,
        kind: "rejection",
        polling: { status: "none" },
        reason: "rejected",
      },
      navigation: "render",
      pollDelay: null,
    },
    {
      interaction: {
        version: 1,
        kind: "ineligible",
        polling: { status: "none" },
        reason: "ineligible",
      },
      navigation: "render",
      pollDelay: null,
    },
    {
      interaction: {
        version: 1,
        kind: "suspended",
        polling: { status: "none" },
        reason: "suspended",
      },
      navigation: "render",
      pollDelay: null,
    },
    {
      interaction: {
        version: 1,
        kind: "error",
        polling: { status: "none" },
        message: "retry",
        retryable: true,
        retryAction: { id: "ea1_error_retry", revision: "1" },
      },
      navigation: "render",
      pollDelay: null,
    },
    {
      interaction: {
        version: 2,
        kind: "account-email-change",
        polling: { status: "none" },
      },
      navigation: "render",
      pollDelay: null,
    },
    {
      interaction: { version: 1, kind: "active", polling: { status: "none" } },
      navigation: "ready",
      pollDelay: null,
    },
  ])(
    "drives $interaction.kind navigation and polling from semantics",
    ({ interaction, navigation, pollDelay }) => {
      const parsed = zEnrollmentInteraction.parse(interaction);
      expect(enrollmentNavigationEffect(parsed)).toBe(navigation);
      expect(enrollmentPollingDelay(parsed)).toBe(pollDelay);
    },
  );

  test("uses server timing for hosted auto-submit and return focus otherwise", () => {
    expect(enrollmentHostedReturnTiming(900)).toEqual({
      kind: "auto",
      delayMs: 900,
    });
    expect(enrollmentHostedReturnTiming(undefined)).toEqual({ kind: "focus" });
  });

  test("submits hosted continuation through the generic action route", async () => {
    let requestBody: unknown;
    let requestUrl = "";
    const fetchImpl: typeof fetch = async (input, init) => {
      requestUrl = String(input);
      requestBody = JSON.parse(String(init?.body));
      return jsonResponse({
        version: 1,
        kind: "active",
        polling: { status: "none" },
      });
    };
    const client = createDaimoClient({
      baseUrl: "https://api.example.test",
      fetchImpl,
    });

    const result = await submitEnrollmentStep({
      client,
      rail: "ach",
      locale: "en",
      auth: { bearerToken: "token" },
      step: { interaction: hosted, protocol: "generic" },
      actionId: hosted.returnBehavior.action.id,
      input: { kind: "continue" },
      legacyCopy,
    });

    expect(result.interaction.kind).toBe("active");
    expect(requestUrl).toBe(
      "https://api.example.test/v1/internal/account/enrollment/action",
    );
    expect(requestBody).toEqual({
      rail: "ach",
      actionId: "ea1_action",
      input: { kind: "continue" },
      locale: "en",
    });
  });

  test("enforces bounded polling and a closed interaction vocabulary", () => {
    expect(zEnrollmentInteraction.safeParse(hosted).success).toBe(true);
    expect(
      zEnrollmentInteraction.safeParse({
        version: 1,
        kind: "wait",
        polling: { status: "poll", delayMs: 499 },
        reason: "review",
      }).success,
    ).toBe(false);
    expect(
      zEnrollmentInteraction.safeParse({
        version: 1,
        kind: "provider-widget",
        polling: { status: "none" },
      }).success,
    ).toBe(false);
    expect(
      zEnrollmentInteraction.safeParse({
        version: 2,
        kind: "account-email-change",
        polling: { status: "none" },
        email: "user@example.com",
      }).success,
    ).toBe(false);
    expect(
      zEnrollmentInteraction.safeParse({
        version: 1,
        kind: "account-email-change",
        polling: { status: "none" },
      }).success,
    ).toBe(false);
  });

  test("submits resend through its opaque generic action", async () => {
    let requestBody: unknown;
    const fetchImpl: typeof fetch = async (_input, init) => {
      requestBody = JSON.parse(String(init?.body));
      return jsonResponse({
        version: 1,
        kind: "wait",
        polling: { status: "poll", delayMs: 2_000 },
        reason: "processing",
      });
    };
    const client = createDaimoClient({
      baseUrl: "https://api.example.test",
      fetchImpl,
    });
    const interaction = zEnrollmentInteraction.parse({
      version: 1,
      kind: "otp",
      polling: { status: "none" },
      destination: "email",
      copy: {
        title: "Code",
        message: "Check email",
        invalidMessage: "Invalid",
      },
      submitAction: { id: "ea1_otp", revision: "1" },
      resend: {
        status: "available",
        delayMs: 0,
        action: { id: "ea1_resend", revision: "1" },
      },
    });

    await submitEnrollmentStep({
      client,
      rail: "ars",
      locale: "es",
      auth: { bearerToken: "token" },
      step: { interaction, protocol: "generic" },
      actionId: "ea1_resend",
      input: { kind: "resend-otp" },
      legacyCopy,
    });

    expect(requestBody).toEqual({
      rail: "ars",
      actionId: "ea1_resend",
      input: { kind: "resend-otp" },
      locale: "es",
    });
  });

  test("rejects invalid OTP input and mismatched form revisions", () => {
    expect(
      zEnrollmentActionInput.safeParse({ kind: "otp", code: "12ab" }).success,
    ).toBe(false);
    const interaction = zEnrollmentInteraction.parse({
      version: 1,
      kind: "form",
      polling: { status: "none" },
      action: { id: "ea1_form", revision: "3" },
      form,
    });
    if (interaction.kind !== "form") throw new Error("expected form");
    expect(() => enrollmentFormActionInput(interaction, {})).toThrow(
      "enrollment form revision mismatch",
    );
  });

  test("keeps the public interaction union exhaustive", () => {
    expectTypeOf(
      zEnrollmentInteraction.parse({
        version: 1,
        kind: "active",
        polling: { status: "none" },
      }),
    ).toEqualTypeOf<EnrollmentInteraction>();
  });
});

describe("stale enrollment response guards", () => {
  const current = {
    requestId: 2,
    latestRequestId: 2,
    requestTarget: "session:ach",
    currentTarget: "session:ach",
    expectedInteraction: "generic:wait:review:2000",
    currentInteraction: "generic:wait:review:2000",
  };

  test("accepts only the latest response for the same target and interaction", () => {
    expect(isEnrollmentResponseCurrent(current)).toBe(true);
    expect(isEnrollmentResponseCurrent({ ...current, requestId: 1 })).toBe(
      false,
    );
    expect(
      isEnrollmentResponseCurrent({
        ...current,
        currentTarget: "other:ach",
      }),
    ).toBe(false);
    expect(
      isEnrollmentResponseCurrent({
        ...current,
        currentInteraction: "generic:active",
      }),
    ).toBe(false);
  });
});

describe("enrollment target loading", () => {
  test("does not reset the same target after unrelated parent renders", () => {
    const target = "session:ach";

    expect(
      shouldLoadEnrollmentTarget({
        loadedTarget: null,
        target,
        canLoad: true,
      }),
    ).toBe(true);
    expect(
      shouldLoadEnrollmentTarget({
        loadedTarget: target,
        target,
        canLoad: true,
      }),
    ).toBe(false);
    expect(
      shouldLoadEnrollmentTarget({
        loadedTarget: target,
        target: "other:ach",
        canLoad: true,
      }),
    ).toBe(true);
  });

  test("waits for authentication before marking the target loaded", () => {
    expect(
      shouldLoadEnrollmentTarget({
        loadedTarget: null,
        target: "session:sepa",
        canLoad: false,
      }),
    ).toBe(false);
  });
});

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
