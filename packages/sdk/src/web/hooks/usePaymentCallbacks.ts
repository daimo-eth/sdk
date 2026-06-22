import { getChainExplorerTxUrl, solana } from "../../common/chain.js";
import { isSessionStarted } from "../../common/session.js";
import { useEffect } from "react";

import type { SessionWithNav } from "../api/navTree.js";
import type {
  DaimoModalPaymentEvent,
  DaimoModalPaymentEventType,
} from "./types.js";

type PaymentCallbacks = {
  onOpen?: () => void;
  onPaymentStarted?: (event: DaimoModalPaymentEvent) => void;
  onPaymentCompleted?: (event: DaimoModalPaymentEvent) => void;
  onPaymentBounced?: (event: DaimoModalPaymentEvent) => void;
};

/**
 * Manages payment lifecycle callbacks:
 * - onOpen: when modal opens
 * - onPaymentStarted: when first fulfillment is detected
 * - onPaymentCompleted: when session completes
 * - onPaymentBounced: when session bounces
 */
export function usePaymentCallbacks(
  session: SessionWithNav,
  isOpen: boolean,
  callbacks: PaymentCallbacks,
) {
  const isStarted = isSessionStarted(session.status);
  const isCompleted = session.status === "succeeded";
  const isBounced = session.status === "bounced";

  const { onOpen, onPaymentStarted, onPaymentCompleted, onPaymentBounced } =
    callbacks;

  useEffect(() => {
    if (isOpen) onOpen?.();
  }, [session.sessionId, isOpen, onOpen]);
  useEffect(() => {
    if (isStarted)
      onPaymentStarted?.(createPaymentEvent("paymentStarted", session));
  }, [session.sessionId, isStarted, onPaymentStarted]);
  useEffect(() => {
    if (isCompleted) {
      onPaymentCompleted?.(createPaymentEvent("paymentCompleted", session));
    }
  }, [session.sessionId, isCompleted, onPaymentCompleted]);
  useEffect(() => {
    if (isBounced) {
      onPaymentBounced?.(createPaymentEvent("paymentBounced", session));
    }
  }, [session.sessionId, isBounced, onPaymentBounced]);
}

function createPaymentEvent(
  type: DaimoModalPaymentEventType,
  session: SessionWithNav,
): DaimoModalPaymentEvent {
  const { chainId, txHash } =
    type === "paymentStarted"
      ? getSourcePaymentMetadata(session)
      : getDestinationPaymentMetadata(session);
  const transactionUrl =
    chainId != null && txHash
      ? getChainExplorerTxUrl(chainId, txHash)
      : undefined;

  return {
    type,
    paymentId: session.sessionId,
    sessionId: session.sessionId,
    ...(chainId != null && { chainId }),
    ...(txHash && { txHash }),
    ...(transactionUrl && { transactionUrl }),
    payment: session,
  };
}

function getSourcePaymentMetadata(session: SessionWithNav) {
  const method = session.paymentMethod;
  if (!method || !("source" in method) || !method.source) return {};
  return {
    chainId: method.source.chainId,
    txHash: method.source.txHash,
  };
}

function getDestinationPaymentMetadata(session: SessionWithNav) {
  const { destination } = session;
  if (!destination.delivery) return getSourcePaymentMetadata(session);

  return {
    chainId: destination.type === "evm" ? destination.chainId : solana.chainId,
    txHash: destination.delivery.txHash,
  };
}
