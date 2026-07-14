import type {
  AccountEnrollmentUpdate,
  GetAccountResponse,
} from "../../../common/account.js";
import type { DepositStateInput } from "../../hooks/useAccountFlow.js";
import type { NavEntry } from "../../hooks/types.js";
import type { RecreateSessionWithNavResponse } from "../../api/index.js";

export type PixRetryNavTarget = NavEntry | "normal-navigation";

export type PixRetryFlowResult =
  | {
      ok: true;
      response: RecreateSessionWithNavResponse;
      nav: PixRetryNavTarget;
    }
  | { ok: false };

type PixRetryAccountState = {
  hasAuth: boolean;
  account: GetAccountResponse | null;
};

type PixRetryNavContext = {
  nodeId: string;
};

/**
 * Decide where to land after recreating a PIX session and linking the account.
 * Only `ready_for_payment` opens PIX directly; other states re-enter normal nav.
 */
export function resolvePixRetryNavTarget(
  state: PixRetryAccountState,
  ctx: PixRetryNavContext,
): PixRetryNavTarget {
  const { nodeId } = ctx;
  const rail = "pix" as const;
  const autoNav = true;

  if (!state.hasAuth || !state.account) {
    return "normal-navigation";
  }

  const { nextAction } = state.account;

  if (nextAction === "ready_for_payment") {
    return { type: "account-request-to-pay", nodeId, rail, autoNav };
  }

  if (nextAction === "enrollment") {
    return {
      type: "account-payment",
      nodeId,
      rail,
      autoNav,
      requireEnrollment: true,
    };
  }

  if (nextAction === "enrollment_update") {
    return {
      type: "account-enrollment-update",
      nodeId,
      rail,
      autoNav,
      update: state.account.enrollmentUpdate as AccountEnrollmentUpdate,
    };
  }

  return "normal-navigation";
}

/** Recreate session, preserve amount, and link the new session to the account. */
export async function runPixRetryFlow(params: {
  depositAmount: string;
  nodeId: string;
  recreate: () => Promise<RecreateSessionWithNavResponse>;
  waitForAuthReady: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  getAccount: (session: {
    sessionId: string;
    clientSecret: string;
  }) => Promise<GetAccountResponse | null>;
  setDepositState: (sessionId: string, state: DepositStateInput) => void;
}): Promise<PixRetryFlowResult> {
  try {
    const response = await params.recreate();
    const session = response.session;

    params.setDepositState(session.sessionId, {
      depositAmount: params.depositAmount,
      kind: "idle",
    });

    await params.waitForAuthReady();
    const token = await params.getAccessToken();
    const account = token
      ? await params.getAccount({
          sessionId: session.sessionId,
          clientSecret: session.clientSecret,
        })
      : null;

    const nav = resolvePixRetryNavTarget(
      { hasAuth: token != null, account },
      { nodeId: params.nodeId },
    );

    return { ok: true, response, nav };
  } catch {
    return { ok: false };
  }
}
