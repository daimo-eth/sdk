import type { Address } from "viem";
import { z } from "zod";

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
 * Enrollment state machine response from startEnrollment.
 *
 * The SDK renders localized copy per action by default. The server may
 * optionally override the title, description, or button label for a specific
 * hosted step (e.g. partner-specific wording). Overrides are not localized, so
 * prefer leaving them unset and adding copy to the SDK locale files.
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
  | { action: "provider_pending" }
  /** User must verify a phone number before continuing. */
  | { action: "phone_required"; reason?: string }
  | { action: "active" }
  | { action: "suspended"; reason: string }
  | { action: "error"; message: string; retryable: boolean };

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

/** GET /v1/internal/account/deposit/constraints response. */
export type DepositConstraints = {
  currency: { code: string; symbol: string };
  minAmount: string;
  maxAmount: string;
  /**
   * Destination stablecoin for this rail.
   */
  destinationToken: DaimoPayToken;
  /** Primary fiat-region icon rendered on the amount-entry screen. */
  icon: { logoURI: string; alt: string };
  /** Rail-specific badge (rendered over the destination token icon). */
  badge: { logoURI: string; alt: string };
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

/** POST /v1/internal/account/deposit/prepare response. */
export type RoutingSignDataResponse = {
  /** Typed data for the on-chain routing authorization (relayer permission). */
  routingSignData: EIP712TypedData;
  /** Typed data for the delivery commitment (destination chain/token/amount). */
  deliverySignData: EIP712TypedData;
};

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

/** A financial institution the user can pay through. */
export type DepositInstitution = {
  /** Stable institution identifier. Server must always provide this. */
  id: string;
  name: string;
  /** Absolute URL to institution logo, or null for text-only display. */
  logoURI: string | null;
  /** When true, shown as a prominent tile (vs. text-only list item). */
  featured?: boolean;
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
  "wallet-pay-widget",
] as const;
export type DepositPaymentInteraction =
  (typeof depositPaymentInteractions)[number];

/** Server-owned copy and actions for an institution-picker payment surface. */
export type DepositInstitutionPaymentUi = {
  picker: {
    title: string;
    searchPlaceholder: string;
    otherInstitutionsLabel: string;
  };
  review: {
    title: string;
    description: string;
    fields: DepositPaymentField[];
    institutionLabel: string;
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

/**
 * Server-provided payment flow configuration.
 * - `bank-picker`: user picks an institution, then continues in their bank flow
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
    })
  | (DepositConstraints & {
      flow: Extract<DepositPaymentInteraction, "directions">;
      instructions: string;
      steps: DepositPaymentStep[];
      onchainTransfer: DepositPaymentOnchainTransfer;
      reference?: DepositPaymentReference;
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
