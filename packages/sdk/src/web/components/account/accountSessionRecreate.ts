import type { RecreateSessionWithNavResponse } from "../../api/index.js";
import type { DepositStateInput } from "../../hooks/useAccountFlow.js";

type AccountSessionRecreateState = {
  current: Promise<void> | null;
};

/** Recreate a session and seed the exact prior amount before normal nav runs. */
export async function recreateAccountPaymentSession(params: {
  depositAmount: string;
  recreate: () => Promise<RecreateSessionWithNavResponse>;
  setDepositState: (sessionId: string, state: DepositStateInput) => void;
}): Promise<RecreateSessionWithNavResponse> {
  const response = await params.recreate();
  params.setDepositState(response.session.sessionId, {
    depositAmount: params.depositAmount,
    kind: "idle",
  });
  return response;
}

/** Share one in-flight recreation and allow a fresh attempt after it settles. */
export async function runAccountSessionRecreateOnce(
  state: AccountSessionRecreateState,
  recreate: () => Promise<void>,
): Promise<void> {
  if (state.current) return state.current;

  const operation = Promise.resolve().then(recreate);
  state.current = operation;
  try {
    await operation;
  } finally {
    if (state.current === operation) state.current = null;
  }
}
