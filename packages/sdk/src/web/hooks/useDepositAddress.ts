import { useCallback, useEffect, useState } from "react";
import { getAddress, isAddress, type Address } from "viem";

import { useDaimoClient } from "./DaimoClientContext.js";
import type { SessionWithNav, NavNode } from "../api/navTree.js";

type AddressResult = {
  sessionId: string;
  clientSecret: string;
  address: Address | null;
  error: string | null;
};

/** Load a validated EVM receiver; setup failures remain visible until retried. */
export function useDepositAddress(session: SessionWithNav) {
  const client = useDaimoClient();
  const { sessionId, clientSecret } = session;
  const initialAddress =
    session.paymentMethod?.type === "evm"
      ? session.paymentMethod.receiverAddress
      : null;
  const [result, setResult] = useState<AddressResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setResult(null);
    setAttempt((current) => current + 1);
  }, []);
  const needsAddress = navTreeNeedsEvmPaymentMethod(session.navTree);

  useEffect(() => {
    if (!needsAddress) return;
    let active = true;
    const load = async () => {
      try {
        const paymentMethod = initialAddress
          ? { type: "evm" as const, receiverAddress: initialAddress }
          : (
              await client.sessions.paymentMethods.create(sessionId, {
                clientSecret,
                paymentMethod: { type: "evm" },
              })
            ).session.paymentMethod;
        if (
          paymentMethod?.type !== "evm" ||
          !isAddress(paymentMethod.receiverAddress)
        ) {
          throw new Error("invalid deposit address");
        }
        if (active)
          setResult({
            sessionId,
            clientSecret,
            address: getAddress(paymentMethod.receiverAddress),
            error: null,
          });
      } catch (err) {
        if (active)
          setResult({
            sessionId,
            clientSecret,
            address: null,
            error:
              err instanceof Error ? err.message : "failed to prepare payment",
          });
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [sessionId, clientSecret, initialAddress, needsAddress, client, attempt]);

  const current =
    result?.sessionId === sessionId && result.clientSecret === clientSecret
      ? result
      : null;
  return {
    address: current?.address ?? null,
    error: current?.error ?? null,
    retry,
  };
}

function navTreeNeedsEvmPaymentMethod(nodes: NavNode[]): boolean {
  return nodes.some(
    (node) =>
      node.type === "DepositAddress" ||
      node.type === "ConnectedWallet" ||
      node.type === "Deeplink" ||
      (node.type === "ChooseOption" &&
        navTreeNeedsEvmPaymentMethod(node.options)),
  );
}
