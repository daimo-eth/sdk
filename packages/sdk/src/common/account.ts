import type { Address } from "viem";
import { z } from "zod";

import type { Currency } from "./money.js";
import type { DaimoPayToken } from "./token.js";

/**
 * Fiat method identifier. Exposed publicly as `fiatMethod` on
 * `PaymentMethodFiat` and `NavNodeFiat`; persisted internally as the rail
 * on account deposit rows.
 */
export const zAccountRail = z.enum([
  "interac",
  "ach",
  "sepa",
  "apple_pay",
  "jpyc",
  "ars",
  "breb",
]);
export type AccountRail = z.infer<typeof zAccountRail>;

export const zAccountLegalName = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
});
export type AccountLegalName = z.infer<typeof zAccountLegalName>;

export type StartEnrollmentRequest = {
  rail: AccountRail;
  legalName?: AccountLegalName;
  /** Client UI locale (short code, e.g. "es"). Server localizes step copy. */
  locale?: string;
};

export const zEnrollmentFormValue = z.union([z.string(), z.boolean()]);
export type EnrollmentFormValue = z.infer<typeof zEnrollmentFormValue>;

export type EnrollmentFormTextMask = {
  type: "pattern";
  pattern: string;
  input: "digits";
  placeholder?: string;
};

export type EnrollmentFormTextField = {
  key: string;
  type: "text";
  label: string;
  required: boolean;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  inputMode?: "text" | "numeric" | "tel";
  autoComplete?: string;
  maxLength?: number;
  mask?: EnrollmentFormTextMask;
};

export type EnrollmentFormSelectField = {
  key: string;
  type: "select";
  label: string;
  required: boolean;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
};

export type EnrollmentFormDependentSelectField = {
  key: string;
  type: "dependent-select";
  label: string;
  required: boolean;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  dependsOn: string;
  optionsByValue: Record<string, { value: string; label: string }[]>;
};

export type EnrollmentFormDateField = {
  key: string;
  type: "date";
  label: string;
  required: boolean;
  description?: string;
  defaultValue?: string;
};

export type EnrollmentFormBooleanField = {
  key: string;
  type: "boolean";
  label: string;
  required: boolean;
  description?: string;
  defaultValue?: boolean;
  control?: "checkbox" | "yes_no";
  trueLabel?: string;
  falseLabel?: string;
};

export type EnrollmentFormField =
  | EnrollmentFormTextField
  | EnrollmentFormSelectField
  | EnrollmentFormDependentSelectField
  | EnrollmentFormDateField
  | EnrollmentFormBooleanField;

export type EnrollmentForm = {
  id: string;
  revision: string;
  title: string;
  description?: string;
  submitLabel: string;
  fields: EnrollmentFormField[];
  fieldErrors?: Record<string, string>;
};

export const zEnrollmentFormSubmitRequest = z.object({
  formId: z.string().min(1),
  revision: z.string().min(1),
  values: z.record(z.string(), zEnrollmentFormValue),
  /** Client UI locale (short code, e.g. "es"). Server localizes form errors. */
  locale: z.string().optional(),
});
export type EnrollmentFormSubmitRequest = z.infer<
  typeof zEnrollmentFormSubmitRequest
>;

export type EnrollmentOtpRequest = {
  rail: Extract<AccountRail, "ars">;
  code: string;
  /** Client UI locale (short code, e.g. "es"). Server localizes OTP errors. */
  locale?: string;
};

export type EnrollmentOtpResendRequest = {
  rail: Extract<AccountRail, "ars">;
  /** Client UI locale (short code, e.g. "es"). Server localizes OTP errors. */
  locale?: string;
};

export type ApplePayEnhancedVerificationDateOfBirth = {
  day: string;
  month: string;
  year: string;
};

export type ApplePayEnhancedVerificationStatus =
  | "required"
  | "retry"
  | "pending"
  | "complete"
  | "unavailable";

export type ApplePayEnhancedVerificationField = "ssn_last4" | "date_of_birth";

export type EnrollmentUpdateRequest =
  EnrollmentUpdateRequestApplePayEnhancedVerification;

export type EnrollmentUpdateRequestApplePayEnhancedVerification = {
  type: "apple_pay_enhanced_verification";
  rail: "apple_pay";
  ssnLast4: string;
  dateOfBirth: ApplePayEnhancedVerificationDateOfBirth;
};

export type AccountEnrollmentUpdate =
  AccountEnrollmentUpdateApplePayEnhancedVerification;

export type AccountEnrollmentUpdateApplePayEnhancedVerification = {
  type: "apple_pay_enhanced_verification";
  rail: "apple_pay";
  status: ApplePayEnhancedVerificationStatus;
  fields: ApplePayEnhancedVerificationField[];
};

/** What the user needs to do next in the account onboarding flow. */
export type NextAction =
  | "create_account"
  | "enrollment"
  | "enrollment_update"
  | "ready_for_payment"
  | "suspended";
export type ExistingAccountNextAction = Exclude<NextAction, "create_account">;

/**
 * Legacy enrollment response retained for old-server compatibility.
 *
 * The SDK renders localized copy per action by default. The server may
 * New integrations use `EnrollmentInteraction`, which owns semantic rendering,
 * polling, action identity, and server-localized hosted copy.
 */
type LinkOutEnrollmentResponse = {
  url: string;
  title?: string;
  description?: string;
  openExternalLabel?: string;
};

type HostedEnrollmentResponse = {
  title: string;
  description: string;
  url: string;
  openExternalLabel: string;
  continueLabel: string;
  fallbackDescription: string;
  autoContinueDescription: string;
  checkingDescription: string;
};

export type ProviderOtpCopy = {
  title: string;
  message: string;
  invalidMessage: string;
};

export type VerificationCodeCopy = ProviderOtpCopy & {
  inputLabel: string;
  submitLabel: string;
  resendLabel: string;
};

type VerificationCodeEnrollmentResponse = {
  destination: "email";
  format: "uuid";
  copy: VerificationCodeCopy;
  error?: string;
};

type ProviderOtpEnrollmentResponse = {
  destination: "email";
  copy: ProviderOtpCopy;
};

export type EnrollmentResponse =
  | ({ action: "kyc_required" } & LinkOutEnrollmentResponse)
  | ({ action: "kyc_retry"; reason: string } & LinkOutEnrollmentResponse)
  | { action: "enrollment_form_required"; form: EnrollmentForm }
  | { action: "kyc_pending_review" }
  | { action: "kyc_rejected_final"; reason: string }
  | { action: "not_eligible"; reason: string }
  | ({ action: "hosted_agreement_required" } & HostedEnrollmentResponse)
  | ({ action: "hosted_kyc_required" } & LinkOutEnrollmentResponse)
  | ({ action: "provider_otp_required" } & ProviderOtpEnrollmentResponse)
  | ({
      action: "verification_code_required";
    } & VerificationCodeEnrollmentResponse)
  | { action: "provider_pending" }
  /** User must verify a phone number before continuing. */
  | { action: "phone_required"; reason?: string }
  | { action: "active" }
  | { action: "suspended"; reason: string }
  | { action: "error"; message: string; retryable: boolean }
  | { action: "account_email_change_required" };

// --- Versioned enrollment interaction contract ---

export const ENROLLMENT_INTERACTION_VERSION = 1 as const;
export const ENROLLMENT_INTERACTION_VERSION_V2 = 2 as const;
export const ENROLLMENT_INTERACTION_VERSION_V3 = 3 as const;
export const CURRENT_ENROLLMENT_INTERACTION_VERSION =
  ENROLLMENT_INTERACTION_VERSION_V3;
export const ENROLLMENT_INTERACTION_VERSION_HEADER =
  "x-daimo-enrollment-interaction-version";

export type EnrollmentInteractionAction = {
  /** Opaque identity for exactly one enrollment checkpoint and input kind. */
  id: string;
  /** Semantic action/form revision. Return this unchanged when submitting. */
  revision: string;
};

export type EnrollmentInteractionPolling =
  | { status: "none" }
  | { status: "poll"; delayMs: number };

type EnrollmentInteractionBaseV1 = {
  version: typeof ENROLLMENT_INTERACTION_VERSION;
  polling: EnrollmentInteractionPolling;
};

type EnrollmentInteractionBaseV2 = {
  version: typeof ENROLLMENT_INTERACTION_VERSION_V2;
  polling: EnrollmentInteractionPolling;
};

type EnrollmentInteractionBaseV3 = {
  version: typeof ENROLLMENT_INTERACTION_VERSION_V3;
  polling: EnrollmentInteractionPolling;
};

export type EnrollmentHostedCopy = {
  title: string;
  description: string;
  openExternalLabel: string;
};

export type EnrollmentInteraction =
  | (EnrollmentInteractionBaseV1 & {
      kind: "form";
      action: EnrollmentInteractionAction;
      form: EnrollmentForm;
    })
  | (EnrollmentInteractionBaseV1 & {
      kind: "otp";
      destination: "email";
      copy: ProviderOtpCopy;
      submitAction: EnrollmentInteractionAction;
      resend: {
        status: "available";
        delayMs: number;
        action: EnrollmentInteractionAction;
      };
    })
  | (EnrollmentInteractionBaseV1 & {
      kind: "account-phone-verification";
      reason?: string;
      returnBehavior: { kind: "refresh" };
    })
  | (EnrollmentInteractionBaseV1 & {
      kind: "hosted";
      mode: "link" | "hosted";
      purpose: "identity-verification" | "agreement";
      url: string;
      copy: EnrollmentHostedCopy;
      returnBehavior: {
        kind: "submit";
        action: EnrollmentInteractionAction;
        autoSubmitDelayMs?: number;
      };
    })
  | (EnrollmentInteractionBaseV1 & {
      kind: "wait";
      reason: "processing" | "review";
    })
  | (EnrollmentInteractionBaseV1 & {
      kind: "retry";
      reason: string;
      action: EnrollmentInteractionAction;
      link?: { url: string; copy: EnrollmentHostedCopy };
    })
  | (EnrollmentInteractionBaseV1 & { kind: "rejection"; reason: string })
  | (EnrollmentInteractionBaseV1 & { kind: "ineligible"; reason: string })
  | (EnrollmentInteractionBaseV1 & { kind: "suspended"; reason: string })
  | (EnrollmentInteractionBaseV1 & {
      kind: "error";
      message: string;
      retryable: boolean;
      retryAction?: EnrollmentInteractionAction;
    })
  | (EnrollmentInteractionBaseV1 & { kind: "active" })
  | (EnrollmentInteractionBaseV2 & { kind: "account-email-change" })
  | (EnrollmentInteractionBaseV3 & {
      kind: "code";
      destination: "email";
      format: "uuid";
      copy: VerificationCodeCopy;
      error?: string;
      submitAction: EnrollmentInteractionAction;
      resend: {
        status: "available";
        delayMs: number;
        action: EnrollmentInteractionAction;
      };
    });

const zEnrollmentAction = z
  .object({
    id: z.string().trim().min(1).max(128),
    revision: z.string().trim().min(1).max(64),
  })
  .strict();

const zEnrollmentPolling = z.discriminatedUnion("status", [
  z.object({ status: z.literal("none") }).strict(),
  z
    .object({
      status: z.literal("poll"),
      delayMs: z.number().int().min(500).max(60_000),
    })
    .strict(),
]);

const zEnrollmentHostedCopy = z
  .object({
    title: z.string(),
    description: z.string(),
    openExternalLabel: z.string(),
  })
  .strict();

const zEnrollmentFormField = z.discriminatedUnion("type", [
  z
    .object({
      key: z.string(),
      type: z.literal("text"),
      label: z.string(),
      required: z.boolean(),
      description: z.string().optional(),
      placeholder: z.string().optional(),
      defaultValue: z.string().optional(),
      inputMode: z.enum(["text", "numeric", "tel"]).optional(),
      autoComplete: z.string().optional(),
      maxLength: z.number().int().positive().optional(),
      mask: z
        .object({
          type: z.literal("pattern"),
          pattern: z.string(),
          input: z.literal("digits"),
          placeholder: z.string().optional(),
        })
        .strict()
        .optional(),
    })
    .strict(),
  z
    .object({
      key: z.string(),
      type: z.literal("dependent-select"),
      label: z.string(),
      required: z.boolean(),
      description: z.string().optional(),
      placeholder: z.string().optional(),
      defaultValue: z.string().optional(),
      dependsOn: z.string().min(1).max(64),
      optionsByValue: z
        .record(
          z.string(),
          z
            .array(z.object({ value: z.string(), label: z.string() }).strict())
            .min(1)
            .max(256),
        )
        .refine((options) => Object.keys(options).length <= 256),
    })
    .strict(),
  z
    .object({
      key: z.string(),
      type: z.literal("select"),
      label: z.string(),
      required: z.boolean(),
      description: z.string().optional(),
      placeholder: z.string().optional(),
      defaultValue: z.string().optional(),
      options: z
        .array(z.object({ value: z.string(), label: z.string() }).strict())
        .min(1),
    })
    .strict(),
  z
    .object({
      key: z.string(),
      type: z.literal("date"),
      label: z.string(),
      required: z.boolean(),
      description: z.string().optional(),
      defaultValue: z.string().optional(),
    })
    .strict(),
  z
    .object({
      key: z.string(),
      type: z.literal("boolean"),
      label: z.string(),
      required: z.boolean(),
      description: z.string().optional(),
      defaultValue: z.boolean().optional(),
      control: z.enum(["checkbox", "yes_no"]).optional(),
      trueLabel: z.string().optional(),
      falseLabel: z.string().optional(),
    })
    .strict(),
]);

const zEnrollmentForm = z
  .object({
    id: z.string(),
    revision: z.string(),
    title: z.string(),
    description: z.string().optional(),
    submitLabel: z.string(),
    fields: z.array(zEnrollmentFormField).max(64),
    fieldErrors: z.record(z.string(), z.string()).optional(),
  })
  .strict();

const enrollmentInteractionBaseV1 = {
  version: z.literal(ENROLLMENT_INTERACTION_VERSION),
  polling: zEnrollmentPolling,
};

const enrollmentInteractionBaseV2 = {
  version: z.literal(ENROLLMENT_INTERACTION_VERSION_V2),
  polling: zEnrollmentPolling,
};

const enrollmentInteractionBaseV3 = {
  version: z.literal(ENROLLMENT_INTERACTION_VERSION_V3),
  polling: zEnrollmentPolling,
};

/** Runtime validation for the closed, server-provided interaction vocabulary. */
export const zEnrollmentInteraction: z.ZodType<EnrollmentInteraction> =
  z.discriminatedUnion("kind", [
    z
      .object({
        ...enrollmentInteractionBaseV1,
        kind: z.literal("form"),
        action: zEnrollmentAction,
        form: zEnrollmentForm,
      })
      .strict(),
    z
      .object({
        ...enrollmentInteractionBaseV1,
        kind: z.literal("otp"),
        destination: z.literal("email"),
        copy: z
          .object({
            title: z.string(),
            message: z.string(),
            invalidMessage: z.string(),
          })
          .strict(),
        submitAction: zEnrollmentAction,
        resend: z
          .object({
            status: z.literal("available"),
            delayMs: z.number().int().min(0).max(60_000),
            action: zEnrollmentAction,
          })
          .strict(),
      })
      .strict(),
    z
      .object({
        ...enrollmentInteractionBaseV1,
        kind: z.literal("account-phone-verification"),
        reason: z.string().optional(),
        returnBehavior: z.object({ kind: z.literal("refresh") }).strict(),
      })
      .strict(),
    z
      .object({
        ...enrollmentInteractionBaseV1,
        kind: z.literal("hosted"),
        mode: z.enum(["link", "hosted"]),
        purpose: z.enum(["identity-verification", "agreement"]),
        url: z.string().url(),
        copy: zEnrollmentHostedCopy,
        returnBehavior: z
          .object({
            kind: z.literal("submit"),
            action: zEnrollmentAction,
            autoSubmitDelayMs: z.number().int().min(0).max(60_000).optional(),
          })
          .strict(),
      })
      .strict(),
    z
      .object({
        ...enrollmentInteractionBaseV1,
        kind: z.literal("wait"),
        reason: z.enum(["processing", "review"]),
      })
      .strict(),
    z
      .object({
        ...enrollmentInteractionBaseV1,
        kind: z.literal("retry"),
        reason: z.string(),
        action: zEnrollmentAction,
        link: z
          .object({ url: z.string().url(), copy: zEnrollmentHostedCopy })
          .strict()
          .optional(),
      })
      .strict(),
    z
      .object({
        ...enrollmentInteractionBaseV1,
        kind: z.literal("rejection"),
        reason: z.string(),
      })
      .strict(),
    z
      .object({
        ...enrollmentInteractionBaseV1,
        kind: z.literal("ineligible"),
        reason: z.string(),
      })
      .strict(),
    z
      .object({
        ...enrollmentInteractionBaseV1,
        kind: z.literal("suspended"),
        reason: z.string(),
      })
      .strict(),
    z
      .object({
        ...enrollmentInteractionBaseV1,
        kind: z.literal("error"),
        message: z.string(),
        retryable: z.boolean(),
        retryAction: zEnrollmentAction.optional(),
      })
      .strict(),
    z
      .object({
        ...enrollmentInteractionBaseV1,
        kind: z.literal("active"),
      })
      .strict(),
    z
      .object({
        ...enrollmentInteractionBaseV2,
        kind: z.literal("account-email-change"),
      })
      .strict(),
    z
      .object({
        ...enrollmentInteractionBaseV3,
        kind: z.literal("code"),
        destination: z.literal("email"),
        format: z.literal("uuid"),
        copy: z
          .object({
            title: z.string(),
            message: z.string(),
            invalidMessage: z.string(),
            inputLabel: z.string(),
            submitLabel: z.string(),
            resendLabel: z.string(),
          })
          .strict(),
        error: z.string().optional(),
        submitAction: zEnrollmentAction,
        resend: z
          .object({
            status: z.literal("available"),
            delayMs: z.number().int().min(0).max(60_000),
            action: zEnrollmentAction,
          })
          .strict(),
      })
      .strict(),
  ]);

const zEnrollmentActionFormValues = z
  .record(
    z.string().trim().min(1).max(64),
    z.union([z.string().max(1024), z.boolean()]),
  )
  .refine((values) => Object.keys(values).length <= 64, {
    message: "too many enrollment form values",
  });

export const zEnrollmentActionInput = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("form"),
      formId: z.string().trim().min(1).max(128),
      revision: z.string().trim().min(1).max(64),
      values: zEnrollmentActionFormValues,
    })
    .strict(),
  z
    .object({
      kind: z.literal("otp"),
      code: z
        .string()
        .trim()
        .regex(/^\d{4,10}$/),
    })
    .strict(),
  z.object({ kind: z.literal("resend-otp") }).strict(),
  z
    .object({
      kind: z.literal("code"),
      code: z.string().trim().uuid(),
    })
    .strict(),
  z.object({ kind: z.literal("resend-code") }).strict(),
  z.object({ kind: z.literal("continue") }).strict(),
  z.object({ kind: z.literal("retry") }).strict(),
]);
export type EnrollmentActionInput = z.infer<typeof zEnrollmentActionInput>;

export const zEnrollmentActionSubmitRequest = z
  .object({
    rail: zAccountRail,
    actionId: z.string().trim().min(1).max(128),
    input: zEnrollmentActionInput,
    locale: z.string().trim().max(64).optional(),
  })
  .strict();
export type EnrollmentActionSubmitRequest = z.infer<
  typeof zEnrollmentActionSubmitRequest
>;

/** Account public info returned by the API. */
export interface AccountInfo {
  id: string;
  email: string;
  walletAddress: Address;
}

/** GET /v1/internal/account response. */
export type GetAccountResponse =
  | {
      account: null;
      nextAction: "create_account";
    }
  | {
      account: AccountInfo;
      nextAction: "enrollment_update";
      enrollmentUpdate: AccountEnrollmentUpdate;
    }
  | {
      account: AccountInfo;
      nextAction: Exclude<ExistingAccountNextAction, "enrollment_update">;
      enrollmentUpdate?: never;
    };

/** POST /v1/internal/account response. */
export type CreateAccountResponse = {
  account: AccountInfo;
};

/** POST /v1/internal/account/wallet response. */
export type EnsureAccountWalletResponse = {
  walletAddress: Address;
};

/** GET /v1/internal/account/deposit/constraints response. */
export type DepositConstraints = {
  currency: Currency;
  /** Static per-deposit amount bounds in fiat units. */
  amountRange: { min: string; max: string };
  /** Dynamic rail/account quotas with remaining capacity. */
  usageLimits?: DepositLimit[];
  /**
   * Destination stablecoin for this rail.
   */
  destinationToken: DaimoPayToken;
  /** Primary fiat-region icon rendered on the amount-entry screen. */
  icon: { logoURI: string; alt: string };
  /** Rail-specific badge (rendered over the destination token icon). */
  badge: { logoURI: string; alt: string };
};

export type DepositLimitUnit = "fiat" | "count";

export type DepositLimitPeriod =
  | "transaction"
  | "day"
  | "week"
  | "month"
  | "lifetime";

export type DepositLimitUpgradeStatus =
  | "available"
  | "retry"
  | "pending"
  | "complete"
  | "unavailable";

export type DepositLimit = {
  /** Stable machine key, e.g. "amount.weekly". */
  key: string;
  label: string;
  unit: DepositLimitUnit;
  /** Limit in display units, or null when unbounded. */
  limit: string | null;
  /** Remaining amount/count in display units, or null when unbounded. */
  remaining: string | null;
  period?: DepositLimitPeriod;
  currency?: Currency;
  checkedAt?: string;
  upgrade?: {
    status: DepositLimitUpgradeStatus;
    fields?: string[];
  };
};

/** Deposit status progression. */
export type AccountDepositStatus =
  | "initiated"
  | "awaiting_payment"
  | "payment_received"
  | "token_delivered"
  | "completed"
  | "expired"
  | "failed";

/** User-facing ETA strings for each account deposit phase. */
export type AccountDepositEta = {
  /** ETA while the fiat/provider payment is being received and settled. */
  payment: string;
  /** ETA once funds are on-chain and Daimo routing is finalizing. */
  finalizing: string;
};

/** Deposit record returned by the API. */
export interface AccountDeposit {
  id: string;
  sessionId: string;
  fiatAmount: string;
  fiatCurrency: string;
  status: AccountDepositStatus;
  errorMessage: string | null;
  /** User-facing ETA strings for this deposit's rail. */
  eta: AccountDepositEta;
}

/** EIP-712 typed data structure. Extends Record so it can be passed to signTypedData directly. */
export type EIP712TypedData = Record<string, unknown> & {
  domain: Record<string, unknown>;
  types: Record<string, { name: string; type: string }[]>;
  primaryType: string;
  message: Record<string, unknown>;
};

/** Typed-data authorization for a wallet -> deposit-address delivery. */
export type SignatureDepositAuthorization = {
  kind: "signatures";
  /** Typed data for the on-chain routing authorization (relayer permission). */
  routingSignData: EIP712TypedData;
  /** Typed data for the delivery commitment (destination chain/token/amount). */
  deliverySignData: EIP712TypedData;
};

/** Headless transaction authorization for a wallet -> deposit-address pull. */
export type TransactionDepositAuthorization = {
  kind: "transaction";
  transaction: {
    chainId: number;
    to: `0x${string}`;
    data: `0x${string}`;
  } | null;
  /** Typed data for the delivery commitment (destination chain/token/amount). */
  deliverySignData: EIP712TypedData;
};

/** Normalized authorization required to start an account deposit. */
export type DepositAuthorizationResponse =
  | { kind: "direct" }
  | SignatureDepositAuthorization
  | TransactionDepositAuthorization;

/** Legacy wire response returned by servers before authorization protocol v2. */
export type RoutingSignDataResponse = Omit<
  SignatureDepositAuthorization,
  "kind"
>;

/**
 * Discriminated union for deposit deeplink strategies.
 * - `redirect`: open a URL directly.
 * - `form-post`: warm a URL first, then POST a form.
 */
export type DepositDeeplink =
  | { type: "redirect"; url: string }
  | {
      type: "form-post";
      /** URL to open first, allowing WAF/JS challenges to complete. */
      warmUrl: string;
      /** Delay (ms) before submitting the form, to let warmUrl finish loading. */
      warmDelayMs: number;
      /** Form POST target URL. */
      formAction: string;
      /** Hidden form fields to submit. */
      formFields: Record<string, string>;
    };

/** One opaque institution option from a server-owned pre-create catalog. */
export type DepositInstitutionCatalogEntry = {
  /** Stable institution identifier. Server must always provide this. */
  id: string;
  name: string;
  /** Absolute URL to institution logo, or null for text-only display. */
  logoURI: string | null;
  /** When true, shown as a prominent tile (vs. text-only list item). */
  featured?: boolean;
};

/** A financial institution the user can pay through after provider creation. */
export type DepositInstitution = DepositInstitutionCatalogEntry & {
  deeplink: DepositDeeplink;
};

export type DepositPaymentField = {
  key: string;
  label: string;
  value: string;
  emphasized?: boolean;
};

/** Closed semantic vocabulary shared by pre-create navigation and payment info. */
export const depositPaymentInteractions = [
  "bank-picker",
  "bank-transfer",
  "directions",
  "external-app-approval",
  "hosted-approval",
  "institution-picker",
  "request-to-pay",
  "wallet-pay-widget",
] as const;
export type DepositPaymentInteraction =
  (typeof depositPaymentInteractions)[number];

/** Server-owned copy and actions for an institution-picker payment surface. */
export type DepositInstitutionPaymentUi = {
  picker: DepositInstitutionPickerUi;
  review: {
    title: string;
    description: string;
    fields: DepositPaymentField[];
    institutionLabel: string;
    /** Optional fields rendered after the client-selected institution. */
    fieldsAfterInstitution?: DepositPaymentField[];
    openInstitutionLabel: string;
    openFallbackLabel: string;
  };
  waiting: {
    title: string;
    instructions: string;
    openInstitutionLabel: string;
    openFallbackLabel: string;
  };
};

/** Server-owned copy for a required pre-create institution selection. */
export type DepositInstitutionPickerUi = {
  title: string;
  searchPlaceholder: string;
  otherInstitutionsLabel: string;
};

/** Opaque action binding issued with one exact institution catalog. */
export type DepositPreCreateAction = {
  id: string;
  revision: string;
  inputKind: "institution";
  catalogRevision: string;
};

/** Typed user input submitted with the signed provider-create attempt. */
export type DepositPreCreatePaymentInput = {
  kind: "institution";
  actionId: string;
  revision: string;
  catalogRevision: string;
  institutionId: string;
};

/** Server-owned semantic copy for an expiring request-to-pay surface. */
export type DepositRequestToPayUi = {
  title: string;
  codeLabel: string;
  actionLabel: string;
  actionCompletedLabel: string;
  expiredTitle: string;
  expiredInstructions: string;
  retryLabel: string;
  retryingLabel: string;
};

/** Closed recovery behavior for an expired request-to-pay interaction. */
export type DepositRequestToPayRetry = {
  type: "recreate-session";
};

export type DepositApprovalPolling = {
  type: "poll";
  delayMs: number;
};

export type DepositHostedApprovalUi = {
  title: string;
  instructions: string;
  openLabel: string;
  reopenLabel: string;
  expiredTitle: string;
  expiredInstructions: string;
  retryLabel: string;
  retryingLabel: string;
};

export type DepositExternalAppApprovalUi = {
  title: string;
  instructions: string;
  destinationLabel: string;
  expiredTitle: string;
  expiredInstructions: string;
  retryLabel: string;
  retryingLabel: string;
};

export type DepositExternalApprovalAction = {
  type: "open-url";
  url: string;
  label: string;
};

export type DepositPaymentStep = {
  title: string;
  description: string;
  translations?: {
    ja?: {
      title: string;
      description: string;
    };
  };
  action?: DepositPaymentReference;
  warning?: {
    title: string;
    description: string;
    translations?: {
      ja?: {
        title: string;
        description: string;
      };
    };
  };
  media?: {
    type: "image";
    src: string;
    alt: string;
  };
};

export type DepositPaymentReference = {
  label: string;
  url: string;
  translations?: {
    ja?: {
      label: string;
    };
  };
};

export type DepositPaymentOnchainTransfer = {
  address: string;
  addressLabel: string;
  amount: string;
  token: string;
  chainId: number;
  expiresAt: number;
};

/** Server-owned copy for a direct bank-transfer acknowledgement flow. */
export type DepositBankTransferUi = {
  arrivalNotice: string;
  providerDisclosure: string;
  actionLabel: string;
  confirmation: {
    title: string;
    description: string;
  };
};

/**
 * Server-provided payment flow configuration.
 * - `bank-picker`: user picks an institution, then continues in their bank flow
 * - `institution-picker`: user chooses an opaque institution before creation
 * - `hosted-approval`: user approves through a provider-hosted URL
 * - `external-app-approval`: user approves in an external app, optionally linked
 * - `request-to-pay`: user pays an exact expiring fiat request by QR or code
 * - `wallet-pay-widget`: user completes payment in an embedded wallet-pay widget
 */
export type DepositPaymentInfo =
  | (DepositConstraints & {
      flow: Extract<DepositPaymentInteraction, "bank-picker">;
      instructions: string;
      institutions: DepositInstitution[];
      qrUrl: string | null;
      /** Added by interaction-driven servers; absent only for compatibility. */
      institutionPaymentUi?: DepositInstitutionPaymentUi;
      /** Provider-defined fallback action; old servers only return `qrUrl`. */
      fallbackDeeplink?: DepositDeeplink;
    })
  | (DepositConstraints & {
      flow: Extract<DepositPaymentInteraction, "bank-transfer">;
      instructions: string;
      fields: DepositPaymentField[];
      /** Optional acknowledgement and confirmation copy for this transfer. */
      ui?: DepositBankTransferUi;
      /** Present while provider-owned transfer instructions are not ready yet. */
      instructionReadiness?: {
        status: "pending";
        pollIntervalMs: number;
      };
    })
  | (DepositConstraints & {
      flow: Extract<DepositPaymentInteraction, "directions">;
      instructions: string;
      steps: DepositPaymentStep[];
      onchainTransfer: DepositPaymentOnchainTransfer;
      reference?: DepositPaymentReference;
    })
  | (DepositConstraints & {
      flow: Extract<DepositPaymentInteraction, "institution-picker">;
      instructions: string;
      institutions: DepositInstitutionCatalogEntry[];
      ui: DepositInstitutionPickerUi;
      /** Exact fiat amount the user will approve, in decimal fiat units (F). */
      payableAmount: string;
      /** Exact settlement-token amount covered by routing signatures (S). */
      expectedSettlementAmount: string;
      action: DepositPreCreateAction;
    })
  | (DepositConstraints & {
      flow: Extract<DepositPaymentInteraction, "hosted-approval">;
      ui: DepositHostedApprovalUi;
      /** Absolute provider-hosted approval URL. */
      approvalUrl: string;
      payableAmount: string;
      expectedSettlementAmount: string;
      expiresAt: number;
      returnBehavior: { type: "poll" };
      reopen: { type: "same-url" };
      polling: DepositApprovalPolling;
      retry: DepositRequestToPayRetry;
    })
  | (DepositConstraints & {
      flow: Extract<DepositPaymentInteraction, "external-app-approval">;
      ui: DepositExternalAppApprovalUi;
      payableAmount: string;
      expectedSettlementAmount: string;
      /** Display-safe masked phone, handle, or destination. */
      maskedDestination: string;
      action?: DepositExternalApprovalAction;
      expiresAt: number;
      polling: DepositApprovalPolling;
      retry: DepositRequestToPayRetry;
    })
  | (DepositConstraints & {
      flow: Extract<DepositPaymentInteraction, "request-to-pay">;
      ui: DepositRequestToPayUi;
      instructions: string;
      /** Exact fiat amount to pay, in decimal fiat units (F). */
      payableAmount: string;
      /** Opaque provider payment code. Render only in the active payment view. */
      paymentCode: string;
      /** Absolute request expiry as Unix seconds. No client default applies. */
      expiresAt: number;
      /**
       * Expected destination-token settlement in token units (S). Routing
       * signatures must authorize exactly this amount, never payableAmount.
       */
      expectedSettlementAmount: string;
      retry: DepositRequestToPayRetry;
    })
  | (DepositConstraints & {
      flow: Extract<DepositPaymentInteraction, "wallet-pay-widget">;
      instructions: string;
      paymentLinkUrl: string;
      paymentLinkKind: "apple_pay" | "google_pay";
      /** Total fee in fiat units (e.g. "0.12"). */
      totalFeeUnits: string;
      /** Amount charged to card, inclusive of fees. */
      paymentTotal: string;
      /**
       * Amount of crypto that lands on-chain. Routing signatures must
       * authorize exactly this amount.
       */
      purchaseAmount: string;
      /**
       * Display-only receive amount. For 1:1 orgs this is the full fiat
       * amount. Defaults to purchaseAmount.
       */
      receiveUnits?: string;
    });

/** POST /v1/internal/account/deposit response. */
export type CreateDepositResponse =
  | {
      deposit: AccountDeposit;
      payment: DepositPaymentInfo;
      enrollmentUpdate?: never;
    }
  | {
      deposit: AccountDeposit;
      payment: null;
      enrollmentUpdate: AccountEnrollmentUpdate;
    };

/** GET /v1/internal/account/deposit response. */
export type GetDepositResponse = {
  deposit: AccountDeposit | null;
};
