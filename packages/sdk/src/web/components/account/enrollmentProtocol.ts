import type {
  AccountRail,
  EnrollmentActionInput,
  EnrollmentFormValue,
  EnrollmentInteraction,
  EnrollmentResponse,
} from "../../../common/account.js";
import { zEnrollmentInteraction } from "../../../common/account.js";
import type { DaimoClient } from "../../../client/createDaimoClient.js";
import { DaimoRequestError } from "../../../common/errors.js";

const LEGACY_POLL_DELAY_MS = 2_000;
const LEGAL_NAME_FORM_ID = "account-legal-name";

type BearerAuth = { bearerToken: string };

export type EnrollmentProtocol = "generic" | "legacy";

export type EnrollmentStep = {
  interaction: EnrollmentInteraction;
  protocol: EnrollmentProtocol;
};

export type LegacyEnrollmentCopy = {
  verification: {
    title: string;
    description: string;
    openExternalLabel: string;
  };
  liveness: {
    title: string;
    description: string;
    openExternalLabel: string;
  };
};

/** Loads once per authenticated session/rail target, independent of render callbacks. */
export function shouldLoadEnrollmentTarget(args: {
  loadedTarget: string | null;
  target: string;
  canLoad: boolean;
}): boolean {
  return args.canLoad && args.loadedTarget !== args.target;
}

/**
 * The generic route is primary. The legacy branch exists only for servers
 * deployed before the additive HTTP facade and can be removed after one full
 * supported release window shows no route-absence fallback in telemetry.
 */
export async function loadEnrollmentStep(args: {
  client: DaimoClient;
  rail: AccountRail;
  locale: string;
  auth: BearerAuth;
  legacyCopy: LegacyEnrollmentCopy;
}): Promise<EnrollmentStep> {
  try {
    const interaction = await args.client.account.getEnrollmentInteraction(
      { rail: args.rail, locale: args.locale },
      args.auth,
    );
    return { interaction, protocol: "generic" };
  } catch (err) {
    if (!isMissingGenericRoute(err)) throw err;
  }

  const response = await args.client.account.startEnrollment(
    { rail: args.rail, locale: args.locale },
    args.auth,
  );
  return {
    interaction: toLegacyEnrollmentInteraction(response, args.legacyCopy),
    protocol: "legacy",
  };
}

export async function submitEnrollmentStep(args: {
  client: DaimoClient;
  rail: AccountRail;
  locale: string;
  auth: BearerAuth;
  step: EnrollmentStep;
  actionId: string;
  input: EnrollmentActionInput;
  legacyCopy: LegacyEnrollmentCopy;
}): Promise<EnrollmentStep> {
  if (args.step.protocol === "generic") {
    const interaction = await args.client.account.submitEnrollmentAction(
      {
        rail: args.rail,
        actionId: args.actionId,
        input: args.input,
        locale: args.locale,
      },
      args.auth,
    );
    return { interaction, protocol: "generic" };
  }

  const response = await submitLegacyEnrollmentAction(args);
  return {
    interaction: toLegacyEnrollmentInteraction(response, args.legacyCopy),
    protocol: "legacy",
  };
}

/** Converts the closed legacy response union into the same semantic renderer. */
export function toLegacyEnrollmentInteraction(
  response: EnrollmentResponse,
  copy: LegacyEnrollmentCopy,
): EnrollmentInteraction {
  const version = 1 as const;
  const noPolling = { status: "none" as const };
  const poll = {
    status: "poll" as const,
    delayMs: LEGACY_POLL_DELAY_MS,
  };
  let interaction: EnrollmentInteraction;

  switch (response.action) {
    case "enrollment_form_required":
      interaction = {
        version,
        kind: "form",
        polling: noPolling,
        action: legacyAction(
          `form:${response.form.id}`,
          response.form.revision,
        ),
        form: response.form,
      };
      break;
    case "provider_otp_required":
      interaction = {
        version,
        kind: "otp",
        polling: noPolling,
        destination: response.destination,
        copy: response.copy,
        submitAction: legacyAction("otp:submit"),
        resend: {
          status: "available",
          delayMs: 0,
          action: legacyAction("otp:resend"),
        },
      };
      break;
    case "phone_required":
      interaction = {
        version,
        kind: "account-phone-verification",
        polling: noPolling,
        ...(response.reason ? { reason: response.reason } : {}),
        returnBehavior: { kind: "refresh" },
      };
      break;
    case "kyc_required":
    case "hosted_kyc_required": {
      const fallback =
        response.action === "hosted_kyc_required"
          ? copy.liveness
          : copy.verification;
      interaction = {
        version,
        kind: "hosted",
        polling: poll,
        mode: response.action === "kyc_required" ? "link" : "hosted",
        purpose: "identity-verification",
        url: response.url,
        copy: {
          title: response.title ?? fallback.title,
          description: response.description ?? fallback.description,
          openExternalLabel:
            response.openExternalLabel ?? fallback.openExternalLabel,
        },
        returnBehavior: {
          kind: "submit",
          action: legacyAction(`hosted:${response.action}`),
        },
      };
      break;
    }
    case "hosted_agreement_required":
      interaction = {
        version,
        kind: "hosted",
        polling: poll,
        mode: "hosted",
        purpose: "agreement",
        url: response.url,
        copy: {
          title: response.title,
          description: response.description,
          openExternalLabel: response.openExternalLabel,
        },
        returnBehavior: {
          kind: "submit",
          action: legacyAction("hosted:agreement"),
        },
      };
      break;
    case "kyc_retry":
      interaction = {
        version,
        kind: "retry",
        polling: poll,
        reason: response.reason,
        action: legacyAction("retry:identity-verification"),
        link: {
          url: response.url,
          copy: {
            title: response.title ?? copy.verification.title,
            description: response.description ?? copy.verification.description,
            openExternalLabel:
              response.openExternalLabel ?? copy.verification.openExternalLabel,
          },
        },
      };
      break;
    case "kyc_pending_review":
      interaction = {
        version,
        kind: "wait",
        polling: poll,
        reason: "review",
      };
      break;
    case "provider_pending":
      interaction = {
        version,
        kind: "wait",
        polling: poll,
        reason: "processing",
      };
      break;
    case "kyc_rejected_final":
      interaction = {
        version,
        kind: "rejection",
        polling: noPolling,
        reason: response.reason,
      };
      break;
    case "not_eligible":
      interaction = {
        version,
        kind: "ineligible",
        polling: noPolling,
        reason: response.reason,
      };
      break;
    case "suspended":
      interaction = {
        version,
        kind: "suspended",
        polling: noPolling,
        reason: response.reason,
      };
      break;
    case "error":
      interaction = {
        version,
        kind: "error",
        polling: noPolling,
        message: response.message,
        retryable: response.retryable,
        ...(response.retryable
          ? { retryAction: legacyAction("retry:error") }
          : {}),
      };
      break;
    case "account_email_change_required":
      interaction = {
        version: 2,
        kind: "account-email-change",
        polling: noPolling,
      };
      break;
    case "active":
      interaction = { version, kind: "active", polling: noPolling };
      break;
  }

  return zEnrollmentInteraction.parse(interaction);
}

export function enrollmentInteractionIdentity(
  step: EnrollmentStep | null,
): string | null {
  if (!step) return null;
  const interaction = step.interaction;
  switch (interaction.kind) {
    case "form":
      return `${step.protocol}:form:${interaction.action.id}`;
    case "otp":
      return `${step.protocol}:otp:${interaction.submitAction.id}:${interaction.resend.action.id}`;
    case "account-phone-verification":
      return `${step.protocol}:account-phone-verification`;
    case "hosted":
      return `${step.protocol}:hosted:${interaction.returnBehavior.action.id}`;
    case "retry":
      return `${step.protocol}:retry:${interaction.action.id}`;
    case "wait":
      return `${step.protocol}:wait:${interaction.reason}:${pollingIdentity(interaction)}`;
    case "rejection":
    case "ineligible":
    case "suspended":
      return `${step.protocol}:${interaction.kind}:${interaction.reason}`;
    case "error":
      return `${step.protocol}:error:${interaction.retryAction?.id ?? "terminal"}`;
    case "account-email-change":
      return `${step.protocol}:account-email-change`;
    case "active":
      return `${step.protocol}:active`;
  }
}

export function enrollmentNavigationEffect(
  interaction: EnrollmentInteraction,
): "render" | "phone" | "ready" {
  switch (interaction.kind) {
    case "account-phone-verification":
      return "phone";
    case "active":
      return "ready";
    case "form":
    case "otp":
    case "hosted":
    case "wait":
    case "retry":
    case "rejection":
    case "ineligible":
    case "suspended":
    case "error":
    case "account-email-change":
      return "render";
  }
}

export function enrollmentPollingDelay(
  interaction: EnrollmentInteraction,
): number | null {
  return interaction.polling.status === "poll"
    ? interaction.polling.delayMs
    : null;
}

export function enrollmentHostedReturnTiming(
  autoSubmitDelayMs: number | undefined,
): { kind: "auto"; delayMs: number } | { kind: "focus" } {
  return autoSubmitDelayMs == null
    ? { kind: "focus" }
    : { kind: "auto", delayMs: autoSubmitDelayMs };
}

export function isEnrollmentResponseCurrent(args: {
  requestId: number;
  latestRequestId: number;
  requestTarget: string;
  currentTarget: string;
  expectedInteraction: string | null;
  currentInteraction: string | null;
}): boolean {
  return (
    args.requestId === args.latestRequestId &&
    args.requestTarget === args.currentTarget &&
    (args.expectedInteraction == null ||
      args.expectedInteraction === args.currentInteraction)
  );
}

export function enrollmentFormActionInput(
  interaction: Extract<EnrollmentInteraction, { kind: "form" }>,
  values: Record<string, EnrollmentFormValue>,
): Extract<EnrollmentActionInput, { kind: "form" }> {
  if (interaction.action.revision !== interaction.form.revision) {
    throw new Error("enrollment form revision mismatch");
  }
  return {
    kind: "form",
    formId: interaction.form.id,
    revision: interaction.form.revision,
    values,
  };
}

async function submitLegacyEnrollmentAction(
  args: Parameters<typeof submitEnrollmentStep>[0],
): Promise<EnrollmentResponse> {
  switch (args.input.kind) {
    case "form": {
      const legalName = legacyLegalName(args.input);
      if (legalName) {
        return args.client.account.startEnrollment(
          { rail: args.rail, legalName, locale: args.locale },
          args.auth,
        );
      }
      return args.client.account.submitEnrollmentForm(
        {
          formId: args.input.formId,
          revision: args.input.revision,
          values: args.input.values,
          locale: args.locale,
        },
        args.auth,
      );
    }
    case "otp":
      return args.client.account.submitEnrollmentOtp(
        { rail: "ars", code: args.input.code, locale: args.locale },
        args.auth,
      );
    case "resend-otp":
      return args.client.account.resendEnrollmentOtp(
        { rail: "ars", locale: args.locale },
        args.auth,
      );
    case "continue":
    case "retry":
      return args.client.account.startEnrollment(
        { rail: args.rail, locale: args.locale },
        args.auth,
      );
  }
}

function legacyLegalName(
  input: Extract<EnrollmentActionInput, { kind: "form" }>,
): { firstName: string; lastName: string } | null {
  if (input.formId !== LEGAL_NAME_FORM_ID) return null;
  const firstName = input.values.firstName;
  const lastName = input.values.lastName;
  if (typeof firstName !== "string" || typeof lastName !== "string") {
    return null;
  }
  return { firstName, lastName };
}

function legacyAction(source: string, revision = "1") {
  return { id: `legacy:${source}`, revision };
}

function isMissingGenericRoute(err: unknown): boolean {
  return (
    err instanceof DaimoRequestError &&
    (err.status === 404 || err.status === 405)
  );
}

function pollingIdentity(interaction: EnrollmentInteraction): string {
  return interaction.polling.status === "poll"
    ? String(interaction.polling.delayMs)
    : "none";
}
