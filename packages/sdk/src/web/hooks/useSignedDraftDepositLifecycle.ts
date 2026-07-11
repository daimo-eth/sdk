import { useEffect } from "react";

import type {
  AccountDeposit,
  AccountRail,
  DepositPaymentInfo,
} from "../../common/account.js";
import { useDaimoClient } from "./DaimoClientContext.js";
import { useAccountFlow, useSessionDepositState } from "./useAccountFlow.js";
import { useDepositPoller } from "./useDepositPoller.js";
import { useDraftDeposit } from "./useDraftDeposit.js";

type SignedDraftDepositLifecycleArgs<TPayment extends DepositPaymentInfo> = {
  sessionId: string;
  clientSecret: string;
  rail: AccountRail;
  isPayment: (payment: DepositPaymentInfo) => payment is TPayment;
  onAdvance: (deposit: AccountDeposit) => void;
};

/** Creates, promotes, and polls a signed account-deposit draft. */
export function useSignedDraftDepositLifecycle<
  TPayment extends DepositPaymentInfo,
>({
  sessionId,
  clientSecret,
  rail,
  isPayment,
  onAdvance,
}: SignedDraftDepositLifecycleArgs<TPayment>) {
  const client = useDaimoClient();
  const accountFlow = useAccountFlow();
  const { depositState, setDepositState } = useSessionDepositState(sessionId);
  const depositAmount = depositState?.depositAmount ?? "";
  const currentDepositId =
    depositState?.depositAmount === depositAmount &&
    (depositState.kind === "drafted" || depositState.kind === "started")
      ? depositState.depositId
      : null;
  const {
    payment: draftedPayment,
    error,
    retry,
  } = useDraftDeposit({
    client,
    accountFlow,
    sessionId,
    rail,
    depositAmount,
    enabled: depositAmount !== "",
    draftMode: "signed",
  });
  const startedPayment =
    depositState?.kind === "started" && isPayment(depositState.payment)
      ? depositState.payment
      : null;
  const payment =
    startedPayment ??
    (draftedPayment && isPayment(draftedPayment) ? draftedPayment : null);

  useEffect(() => {
    if (!payment || !depositAmount || !currentDepositId) return;
    if (depositState?.kind === "started") return;
    setDepositState({
      depositAmount,
      kind: "started",
      depositId: currentDepositId,
      payment,
    });
  }, [
    currentDepositId,
    depositAmount,
    depositState?.kind,
    payment,
    setDepositState,
  ]);

  useDepositPoller({
    client,
    sessionId,
    clientSecret,
    onUpdate(deposit) {
      if (
        deposit.status !== "initiated" &&
        deposit.status !== "awaiting_payment"
      ) {
        onAdvance(deposit);
      }
    },
  });

  return { depositAmount, payment, error, retry };
}
