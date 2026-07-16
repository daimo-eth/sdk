import { useEffect, useState } from "react";

import type {
  AccountDeposit,
  AccountRail,
} from "../../common/account.js";
import { getRequestToPayContract } from "../components/account/accountPaymentCompatibility.js";
import { useDaimoClient } from "./DaimoClientContext.js";
import { useDepositPoller } from "./useDepositPoller.js";
import { useDraftDeposit } from "./useDraftDeposit.js";
import { useAccountFlow, useSessionDepositState } from "./useAccountFlow.js";

/** Create/replay, promote, and poll one request-to-pay deposit. */
export function useRequestToPayDeposit({
  sessionId,
  clientSecret,
  rail,
  resumePayment,
  onAdvance,
}: {
  sessionId: string;
  clientSecret: string;
  rail: AccountRail;
  resumePayment: boolean;
  onAdvance: (deposit: AccountDeposit) => void;
}) {
  const client = useDaimoClient();
  const accountFlow = useAccountFlow();
  const { depositState, setDepositState, clearDepositState } =
    useSessionDepositState(sessionId);
  const depositAmount = depositState?.depositAmount ?? "";
  const [providerExpired, setProviderExpired] = useState(false);
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
    draftMode: resumePayment ? "plain" : "signed",
  });
  const startedPayment =
    depositState?.kind === "started"
      ? getRequestToPayContract(depositState.payment)
      : null;
  const payment =
    startedPayment ??
    (draftedPayment ? getRequestToPayContract(draftedPayment) : null);
  const candidatePayment =
    depositState?.kind === "started"
      ? depositState.payment
      : draftedPayment;
  const contractMismatch = candidatePayment != null && payment == null;
  const currentDepositId =
    depositState?.kind === "drafted" || depositState?.kind === "started"
      ? depositState.depositId
      : null;

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
      if (deposit.status === "expired") {
        setProviderExpired(true);
        return;
      }
      if (
        deposit.status !== "initiated" &&
        deposit.status !== "awaiting_payment"
      ) {
        clearDepositState();
        onAdvance(deposit);
      }
    },
    shouldStop: (deposit) =>
      deposit.status === "expired" ||
      deposit.status === "failed" ||
      deposit.status === "completed",
  });

  return {
    depositAmount,
    payment,
    providerExpired,
    contractMismatch,
    error,
    retry,
  };
}
