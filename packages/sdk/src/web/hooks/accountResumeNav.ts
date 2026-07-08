import type { AccountRail } from "../../common/account.js";
import type { SessionStatus } from "../../common/session.js";
import type { NavNode, NavNodeFiat, SessionWithNav } from "../api/navTree.js";

export type AccountResumeTarget = {
  nodeId: string;
  rail: AccountRail;
};

const ACCOUNT_RESUME_SESSION_STATUSES = new Set<SessionStatus>([
  "waiting_payment",
  "processing",
  "succeeded",
  "bounced",
]);

export function getAccountResumeTarget(
  session: Pick<SessionWithNav, "status" | "paymentMethod" | "navTree">,
): AccountResumeTarget | null {
  if (!ACCOUNT_RESUME_SESSION_STATUSES.has(session.status)) return null;
  if (session.paymentMethod?.type !== "fiat") return null;

  const rail = session.paymentMethod.fiatMethod;
  if (!rail) return null;

  const node = findFiatNodeByRail(session.navTree, rail);
  if (!node) return null;

  return { nodeId: node.id, rail };
}

function findFiatNodeByRail(
  nodes: NavNode[],
  rail: AccountRail,
): NavNodeFiat | null {
  for (const node of nodes) {
    if (node.type === "Fiat" && node.fiatMethod === rail) return node;
    if (node.type !== "ChooseOption") continue;

    const child = findFiatNodeByRail(node.options, rail);
    if (child) return child;
  }

  return null;
}
