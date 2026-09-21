import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { DaimoClient } from "../../client/createDaimoClient.js";
import type {
  AccountEnrollmentUpdate,
  AccountRail,
  CreateDepositResponse,
  DepositPaymentInfo,
  DepositPreCreatePaymentInput,
} from "../../common/account.js";
import {
  type AccountFlowState,
  useSessionDepositState,
} from "./useAccountFlow.js";
import { formatUserError } from "./formatUserError.js";
import { getLocale, t } from "./locale.js";
import {
  getAuthorizedRoutingAmount,
  isExpiredRequestToPay,
} from "../components/account/accountPaymentCompatibility.js";

const useBrowserLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

type UseDraftDepositArgs = {
  client: DaimoClient;
  accountFlow: AccountFlowState | null;
  sessionId: string;
  rail: AccountRail;
  depositAmount: string;
  enabled: boolean;
  draftMode: "plain" | "signed";
};

type UseDraftDepositResult = {
  payment: DepositPaymentInfo | null;
  enrollmentUpdate: AccountEnrollmentUpdate | null;
  isCreating: boolean;
  error: string | null;
  retry: () => void;
};

/**
 * Debounced draft-deposit upsert. Fires `upsertDeposit` each time the amount
 * settles, stores the result on the session deposit state. Used by every
 * rail: Apple Pay shows the hosted widget, bank rails render institutions.
 */
export function useDraftDeposit({
  client,
  accountFlow,
  sessionId,
  rail,
  depositAmount,
  enabled,
  draftMode,
}: UseDraftDepositArgs): UseDraftDepositResult {
  const { depositState, setDepositState } = useSessionDepositState(sessionId);
  const [error, setError] = useState<string | null>(null);
  const requestControllerRef = useRef<AbortController | null>(null);
  const setDepositStateRef = useRef(setDepositState);
  useBrowserLayoutEffect(() => {
    setDepositStateRef.current = setDepositState;
  }, [setDepositState]);
  const hasAccountFlow = accountFlow != null;
  const walletAddress = accountFlow?.walletAddress;
  const isAuthenticated = accountFlow?.isAuthenticated;
  const hasStartedDeposit = depositState?.kind === "started";

  // Cancel on input changes, not on the workflow's own drafting-state render.
  useBrowserLayoutEffect(() => {
    requestControllerRef.current = new AbortController();
    setError(null);
    if (!hasStartedDeposit) {
      setDepositStateRef.current({ depositAmount, kind: "idle" });
    }
    return () => requestControllerRef.current?.abort();
  }, [
    client,
    sessionId,
    rail,
    depositAmount,
    enabled,
    draftMode,
    hasAccountFlow,
    walletAddress,
    isAuthenticated,
    hasStartedDeposit,
  ]);

  const matchesAmount =
    depositState != null && depositState.depositAmount === depositAmount;
  const isCreating = matchesAmount && depositState?.kind === "drafting";
  const payment =
    matchesAmount && depositState?.kind === "drafted"
      ? depositState.payment
      : null;
  const enrollmentUpdate =
    matchesAmount && depositState?.kind === "drafted"
      ? (depositState.enrollmentUpdate ?? null)
      : null;

  useEffect(() => {
    if (!enabled || hasStartedDeposit) {
      setError(null);
      return;
    }
    if (matchesAmount && depositState?.kind !== "idle") return;
    // Hold the failed amount in-place until the user edits it or explicitly
    // retries. Otherwise the hook re-enters drafting immediately and the UI
    // flashes between loading and error states.
    if (matchesAmount && error != null) return;
    if (!accountFlow || !depositAmount) return;

    setError(null);
    const signal = requestControllerRef.current?.signal;
    const timeout = window.setTimeout(() => {
      if (signal?.aborted) return;
      setDepositState({ depositAmount, kind: "drafting" });

      void (async () => {
        try {
          const result =
            draftMode === "signed"
              ? await createSignedDraftDeposit({
                  client,
                  accountFlow,
                  sessionId,
                  rail,
                  depositAmount,
                  signal,
                })
              : await upsertPlainDraftDeposit({
                  client,
                  accountFlow,
                  sessionId,
                  rail,
                  depositAmount,
                  signal,
                });
          if (signal?.aborted) return;
          if (result.payment === null) {
            setDepositState({
              depositAmount,
              kind: "drafted",
              depositId: result.deposit.id,
              payment: null,
              enrollmentUpdate: result.enrollmentUpdate,
            });
            return;
          }
          setDepositState({
            depositAmount,
            kind: "drafted",
            depositId: result.deposit.id,
            payment: result.payment,
          });
        } catch (err) {
          if (signal?.aborted) return;
          console.error("[account-deposit] failed to draft deposit", {
            sessionId,
            rail,
            depositAmount,
            draftMode,
            error: err instanceof Error ? err.message : String(err),
          });
          setDepositState({ depositAmount, kind: "idle" });
          setError(formatUserError(err, t.errorDepositFailed));
        }
      })();
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [
    accountFlow,
    client,
    depositAmount,
    depositState,
    enabled,
    error,
    hasStartedDeposit,
    matchesAmount,
    rail,
    sessionId,
    setDepositState,
    draftMode,
  ]);

  return {
    payment,
    enrollmentUpdate,
    isCreating,
    error,
    retry: () => {
      requestControllerRef.current?.abort();
      requestControllerRef.current = new AbortController();
      setError(null);
      setDepositState({ depositAmount, kind: "idle" });
    },
  };
}

type SignAndUpsertDepositArgs = {
  client: DaimoClient;
  accountFlow: AccountFlowState;
  sessionId: string;
  depositAmount: string;
  authorizedAmount?: string;
  expectedProviderOrderId?: string;
  signal?: AbortSignal;
  paymentInput?: DepositPreCreatePaymentInput;
  rail: AccountRail;
};

export async function signAndUpsertDeposit({
  client,
  accountFlow,
  sessionId,
  depositAmount,
  authorizedAmount,
  paymentInput,
  rail,
  signal,
  expectedProviderOrderId,
}: SignAndUpsertDepositArgs): Promise<CreateDepositResponse> {
  assertActiveRequest(signal);
  const token = await accountFlow.getAccessToken();
  assertActiveRequest(signal);
  if (!token) throw new Error("not authenticated");
  const auth = { bearerToken: token };
  const signedAmount = authorizedAmount ?? depositAmount;
  const authorization = await client.account.prepareDeposit(
    { sessionId, rail, depositAmount: signedAmount, authorizationVersion: 2 },
    auth,
  );
  assertActiveRequest(signal);
  if (authorization.kind === "direct") {
    return client.account.upsertDeposit(
      {
        sessionId,
        rail,
        depositAmount,
        locale: getLocale(),
        authorizationVersion: 2,
        expectedProviderOrderId,
        paymentInput,
      },
      auth,
    );
  }
  if (authorization.kind === "transaction") {
    const transactionHash = authorization.transaction
      ? await accountFlow.sendSponsoredTransaction(authorization.transaction)
      : undefined;
    assertActiveRequest(signal);
    const deliverySig = await accountFlow.signTypedData({
      ...authorization.deliverySignData,
    });
    assertActiveRequest(signal);
    return client.account.upsertDeposit(
      {
        sessionId,
        rail,
        depositAmount,
        locale: getLocale(),
        authorizationVersion: 2,
        expectedProviderOrderId,
        deliverySig,
        deliverySigData: authorization.deliverySignData,
        routingApproval: { transactionHash },
        paymentInput,
      },
      auth,
    );
  }
  const { routingSignData, deliverySignData } = authorization;
  const routingSig = await accountFlow.signTypedData({
    ...routingSignData,
  });
  assertActiveRequest(signal);
  const deliverySig = await accountFlow.signTypedData({
    ...deliverySignData,
  });
  assertActiveRequest(signal);
  return client.account.upsertDeposit(
    {
      sessionId,
      rail,
      depositAmount,
      locale: getLocale(),
      authorizationVersion: 2,
      expectedProviderOrderId,
      deliverySig,
      deliverySigData: deliverySignData,
      routingSig,
      routingSigData: routingSignData,
      paymentInput,
    },
    auth,
  );
}

/** Sign + upsert a deposit and require payment info (bank rails). */
export async function startBankDeposit(
  args: SignAndUpsertDepositArgs,
): Promise<{ depositId: string; payment: DepositPaymentInfo }> {
  const result = await signAndUpsertDeposit(args);
  if (!result.payment) throw new Error("deposit payment info missing");
  return { depositId: result.deposit.id, payment: result.payment };
}

async function upsertPlainDraftDeposit({
  client,
  accountFlow,
  sessionId,
  rail,
  depositAmount,
  signal,
}: SignAndUpsertDepositArgs): Promise<CreateDepositResponse> {
  assertActiveRequest(signal);
  const token = await accountFlow.getAccessToken();
  assertActiveRequest(signal);
  if (!token) throw new Error("not authenticated");
  return client.account.upsertDeposit(
    {
      sessionId,
      rail,
      depositAmount,
      locale: getLocale(),
      authorizationVersion: 2,
    },
    { bearerToken: token },
  );
}

async function createSignedDraftDeposit({
  client,
  accountFlow,
  sessionId,
  rail,
  depositAmount,
  signal,
}: SignAndUpsertDepositArgs): Promise<CreateDepositResponse> {
  const preview = await upsertPlainDraftDeposit({
    client,
    accountFlow,
    sessionId,
    rail,
    depositAmount,
    signal,
  });
  assertActiveRequest(signal);
  if (preview.payment === null) return preview;
  if (preview.payment.flow === "institution-picker") return preview;
  if (isExpiredRequestToPay(preview.payment)) {
    return preview;
  }
  const signedAmount = getAuthorizedRoutingAmount(
    preview.payment,
    depositAmount,
  );
  return signAndUpsertDeposit({
    client,
    accountFlow,
    sessionId,
    rail,
    depositAmount,
    authorizedAmount: signedAmount,
    signal,
    expectedProviderOrderId:
      preview.payment.flow === "wallet-pay-widget"
        ? preview.payment.providerOrderId
        : undefined,
  });
}

function assertActiveRequest(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error("deposit request cancelled");
}
