import type {
  AccountRail,
  CreateAccountResponse,
  CreateDepositResponse,
  DepositConstraints,
  EnrollmentOtpRequest,
  EnrollmentOtpResendRequest,
  EnrollmentFormSubmitRequest,
  EnrollmentUpdateRequest,
  AccountEnrollmentUpdate,
  EnrollmentResponse,
  GetAccountResponse,
  GetDepositResponse,
  RoutingSignDataResponse,
  StartEnrollmentRequest,
} from "../common/account.js";
import type {
  CheckSessionRequest,
  CheckSessionResponse,
  CreatePaymentMethodRequest,
  CreatePaymentMethodResponse,
  LogNavEventRequest,
  RetrieveSessionResponse,
  TokenOptionsRequest,
  TokenOptionsResponse,
} from "../common/api.js";
import type {
  RecreateSessionWithNavResponse,
  RetrieveSessionWithNavResponse,
  WalletOptionsResponse,
} from "../web/api/index.js";
import { getLocale } from "../web/hooks/locale.js";

import { createTransport, type TransportConfig } from "./transport.js";

type BearerAuth = { bearerToken: string };

function authHeaders(auth: BearerAuth): Record<string, string> {
  return { Authorization: `Bearer ${auth.bearerToken}` };
}

type SessionContext = { sessionId: string; clientSecret: string };

type AccountRailTarget = { rail: AccountRail };
type AccountPhoneOtpResponse = { ok: true };

/** Request shape for `account.upsertDeposit`. */
export type UpsertDepositRequest = {
  sessionId: string;
  depositAmount: string;
  rail: AccountRail;
  locale?: string;
  deliverySig?: string;
  deliverySigData?: Record<string, unknown>;
  routingSig?: string;
  routingSigData?: Record<string, unknown>;
};

export type DaimoClient = {
  account: {
    /** Look up account state for the current authenticated user. */
    get(
      target: AccountRailTarget,
      session: SessionContext,
      auth: BearerAuth,
    ): Promise<GetAccountResponse>;
    /** Create a new account with an embedded wallet address. */
    create(
      input: { walletAddress: string },
      session: SessionContext,
      auth: BearerAuth,
    ): Promise<CreateAccountResponse>;
    /**
     * Advance the account enrollment state machine after account auth or
     * provider-specific setup changes.
     */
    startEnrollment(
      input: StartEnrollmentRequest,
      auth: BearerAuth,
    ): Promise<EnrollmentResponse>;
    /** Submit a provider-owned OTP for account enrollment. */
    submitEnrollmentOtp(
      input: EnrollmentOtpRequest,
      auth: BearerAuth,
    ): Promise<EnrollmentResponse>;
    /** Submit a backend-driven enrollment form. */
    submitEnrollmentForm(
      input: EnrollmentFormSubmitRequest,
      auth: BearerAuth,
    ): Promise<EnrollmentResponse>;
    /** Resend a provider-owned OTP for account enrollment. */
    resendEnrollmentOtp(
      input: EnrollmentOtpResendRequest,
      auth: BearerAuth,
    ): Promise<EnrollmentResponse>;
    /** Send a Daimo-owned phone OTP for account enrollment. */
    sendPhoneOtp(
      input: { phoneNumber: string },
      auth: BearerAuth,
    ): Promise<AccountPhoneOtpResponse>;
    /** Verify a Daimo-owned phone OTP for account enrollment. */
    verifyPhoneOtp(
      input: { phoneNumber: string; code: string },
      auth: BearerAuth,
    ): Promise<AccountPhoneOtpResponse>;
    /** Poll the provider enrollment update status. */
    getEnrollmentUpdate(auth: BearerAuth): Promise<AccountEnrollmentUpdate>;
    /** Submit transient provider enrollment update fields. */
    submitEnrollmentUpdate(
      input: EnrollmentUpdateRequest,
      auth: BearerAuth,
    ): Promise<AccountEnrollmentUpdate>;
    /** Get currency, min/max amount constraints for a deposit. */
    getDepositConstraints(
      params: { sessionId: string } & AccountRailTarget,
      auth: BearerAuth,
    ): Promise<DepositConstraints>;
    /**
     * Upsert the single deposit row for this session. The backend keeps the
     * row mutable until the provider flow has really started.
     */
    upsertDeposit(
      input: UpsertDepositRequest,
      auth: BearerAuth,
    ): Promise<CreateDepositResponse>;
    /** Get EIP-712 typed data for routing + delivery signatures. */
    prepareDeposit(
      params: {
        sessionId: string;
        depositAmount: string;
      } & AccountRailTarget,
      auth: BearerAuth,
    ): Promise<RoutingSignDataResponse>;
    /** Poll deposit status. No auth required — uses clientSecret. */
    getDeposit(params: {
      sessionId: string;
      clientSecret: string;
      refresh?: boolean;
    }): Promise<GetDepositResponse>;
  };
  sessions: {
    retrieve(sessionId: string): Promise<RetrieveSessionResponse>;
    paymentMethods: {
      create(
        sessionId: string,
        input: CreatePaymentMethodRequest,
      ): Promise<CreatePaymentMethodResponse>;
    };
    check(
      sessionId: string,
      input: CheckSessionRequest,
    ): Promise<CheckSessionResponse>;
    tokenOptions: {
      list(
        sessionId: string,
        input: TokenOptionsRequest,
      ): Promise<TokenOptionsResponse>;
    };
  };
  internal: {
    sessions: {
      retrieveWithNav(
        sessionId: string,
        clientSecret: string,
      ): Promise<RetrieveSessionWithNavResponse>;
      recreate(
        sessionId: string,
        clientSecret: string,
      ): Promise<RecreateSessionWithNavResponse>;
      walletOptions(
        sessionId: string,
        params: {
          clientSecret: string;
          evmAddress?: string;
          solanaAddress?: string;
        },
      ): Promise<WalletOptionsResponse>;
      logNavEvent(sessionId: string, input: LogNavEventRequest): Promise<void>;
    };
  };
};

export function createDaimoClient(config: TransportConfig): DaimoClient {
  const transport = createTransport(config);

  return {
    account: {
      get(target, session, auth) {
        return transport.request<GetAccountResponse>({
          method: "GET",
          path: "/v1/internal/account",
          query: { ...target, ...session },
          headers: authHeaders(auth),
        });
      },
      create(input, session, auth) {
        return transport.request<CreateAccountResponse>({
          method: "POST",
          path: "/v1/internal/account",
          body: { ...input, ...session },
          headers: authHeaders(auth),
        });
      },
      startEnrollment(input, auth) {
        return transport.request<EnrollmentResponse>({
          method: "POST",
          path: "/v1/internal/account/enrollment/start",
          body: input,
          headers: authHeaders(auth),
        });
      },
      submitEnrollmentOtp(input, auth) {
        return transport.request<EnrollmentResponse>({
          method: "POST",
          path: "/v1/internal/account/enrollment/otp",
          body: { ...input, locale: input.locale ?? getLocale() },
          headers: authHeaders(auth),
        });
      },
      submitEnrollmentForm(input, auth) {
        return transport.request<EnrollmentResponse>({
          method: "POST",
          path: "/v1/internal/account/enrollment/form",
          body: input,
          headers: authHeaders(auth),
        });
      },
      resendEnrollmentOtp(input, auth) {
        return transport.request<EnrollmentResponse>({
          method: "POST",
          path: "/v1/internal/account/enrollment/otp/resend",
          body: { ...input, locale: input.locale ?? getLocale() },
          headers: authHeaders(auth),
        });
      },
      sendPhoneOtp(input, auth) {
        return transport.request<AccountPhoneOtpResponse>({
          method: "POST",
          path: "/v1/internal/account/phone/send",
          body: input,
          headers: authHeaders(auth),
        });
      },
      verifyPhoneOtp(input, auth) {
        return transport.request<AccountPhoneOtpResponse>({
          method: "POST",
          path: "/v1/internal/account/phone/verify",
          body: input,
          headers: authHeaders(auth),
        });
      },
      getEnrollmentUpdate(auth) {
        return transport.request<AccountEnrollmentUpdate>({
          method: "GET",
          path: "/v1/internal/account/enrollment-update",
          headers: authHeaders(auth),
        });
      },
      submitEnrollmentUpdate(input, auth) {
        return transport.request<AccountEnrollmentUpdate>({
          method: "POST",
          path: "/v1/internal/account/enrollment-update",
          body: input,
          headers: authHeaders(auth),
        });
      },
      getDepositConstraints(params, auth) {
        return transport.request<DepositConstraints>({
          method: "GET",
          path: "/v1/internal/account/deposit/constraints",
          query: {
            sessionId: params.sessionId,
            rail: params.rail,
          },
          headers: authHeaders(auth),
        });
      },
      upsertDeposit(input, auth) {
        return transport.request<CreateDepositResponse>({
          method: "POST",
          path: "/v1/internal/account/deposit",
          body: { ...input, locale: input.locale ?? getLocale() },
          headers: authHeaders(auth),
        });
      },
      prepareDeposit(params, auth) {
        return transport.request<RoutingSignDataResponse>({
          method: "POST",
          path: "/v1/internal/account/deposit/prepare",
          body: {
            sessionId: params.sessionId,
            depositAmount: params.depositAmount,
            rail: params.rail,
          },
          headers: authHeaders(auth),
        });
      },
      getDeposit(params) {
        return transport.request<GetDepositResponse>({
          method: "GET",
          path: "/v1/internal/account/deposit",
          query: {
            sessionId: params.sessionId,
            clientSecret: params.clientSecret,
            refresh: params.refresh ? "1" : undefined,
          },
        });
      },
    },
    sessions: {
      retrieve(sessionId) {
        return transport.request<RetrieveSessionResponse>({
          method: "GET",
          path: `/v1/sessions/${sessionId}`,
        });
      },

      paymentMethods: {
        create(sessionId, input) {
          return transport.request<CreatePaymentMethodResponse>({
            method: "POST",
            path: `/v1/sessions/${sessionId}/paymentMethods`,
            body: { ...input, locale: getLocale() },
          });
        },
      },

      check(sessionId, input) {
        return transport.request<CheckSessionResponse>({
          method: "PUT",
          path: `/v1/sessions/${sessionId}/check`,
          body: input,
        });
      },

      tokenOptions: {
        list(sessionId, input) {
          return transport.request<TokenOptionsResponse>({
            method: "GET",
            path: `/v1/sessions/${sessionId}/tokenOptions`,
            query: {
              evmAddress: input.evmAddress,
              solanaAddress: input.solanaAddress,
              clientSecret: input.clientSecret,
            },
          });
        },
      },
    },

    internal: {
      sessions: {
        async retrieveWithNav(sessionId, clientSecret) {
          return transport.request<RetrieveSessionWithNavResponse>({
            method: "GET",
            path: `/v1/sessions/${sessionId}/internal/nav`,
            query: { clientSecret, locale: getLocale() },
          });
        },
        async recreate(sessionId, clientSecret) {
          return transport.request<RecreateSessionWithNavResponse>({
            method: "POST",
            path: `/v1/sessions/${sessionId}/internal/recreate`,
            body: { clientSecret, locale: getLocale() },
          });
        },
        async walletOptions(sessionId, params) {
          return transport.request<WalletOptionsResponse>({
            method: "GET",
            path: `/v1/sessions/${sessionId}/internal/walletOptions`,
            query: {
              clientSecret: params.clientSecret,
              evmAddress: params.evmAddress,
              solanaAddress: params.solanaAddress,
            },
          });
        },
        async logNavEvent(sessionId, input) {
          await transport.request<void>({
            method: "POST",
            path: `/v1/sessions/${sessionId}/internal/nav`,
            body: input,
          });
        },
      },
    },
  };
}
