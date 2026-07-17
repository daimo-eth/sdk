import { useEffect, useRef, useState } from "react";

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
  const requestSeqRef = useRef(0);

  const matchesAmount =
    depositState != null && depositState.depositAmount === depositAmount;
  const hasStartedCurrentAmount =
    matchesAmount && depositState?.kind === "started";
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
    if (!enabled || hasStartedCurrentAmount) {
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
    const timeout = window.setTimeout(() => {
      const seq = ++requestSeqRef.current;
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
                })
              : await upsertPlainDraftDeposit({
                  client,
                  accountFlow,
                  sessionId,
                  rail,
                  depositAmount,
                });
          if (seq !== requestSeqRef.current) return;
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
          if (seq !== requestSeqRef.current) return;
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
    hasStartedCurrentAmount,
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
}: SignAndUpsertDepositArgs): Promise<CreateDepositResponse> {
  const token = await accountFlow.getAccessToken();
  if (!token) throw new Error("not authenticated");
  const auth = { bearerToken: token };
  const signedAmount = authorizedAmount ?? depositAmount;
  const { routingSignData, deliverySignData } =
    await client.account.prepareDeposit(
      { sessionId, rail, depositAmount: signedAmount },
      auth,
    );
  const routingSig = await accountFlow.signTypedData({
    ...routingSignData,
  });
  const deliverySig = await accountFlow.signTypedData({
    ...deliverySignData,
  });
  return client.account.upsertDeposit(
    {
      sessionId,
      rail,
      depositAmount,
      locale: getLocale(),
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
}: SignAndUpsertDepositArgs): Promise<CreateDepositResponse> {
  const token = await accountFlow.getAccessToken();
  if (!token) throw new Error("not authenticated");
  return client.account.upsertDeposit(
    {
      sessionId,
      rail,
      depositAmount,
      locale: getLocale(),
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
}: SignAndUpsertDepositArgs): Promise<CreateDepositResponse> {
  const preview = await upsertPlainDraftDeposit({
    client,
    accountFlow,
    sessionId,
    rail,
    depositAmount,
  });
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
  });
}
