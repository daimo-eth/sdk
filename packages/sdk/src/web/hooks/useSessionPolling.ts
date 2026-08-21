import {
  isSessionActive,
  isSessionTerminal,
  type SessionPublicInfo,
} from "../../common/session.js";
import { useEffect, useState } from "react";

import { useDaimoClient } from "./DaimoClientContext.js";
import { createNavLogger } from "./navEvent.js";
import type { SessionWithNav } from "../api/navTree.js";

const POLL_INTERVAL_MS = 3000;

type SessionCredentials = Pick<SessionWithNav, "sessionId" | "clientSecret">;

const terminalAction = {
  expired: "session_expired",
  succeeded: "session_completed",
  bounced: "session_bounced",
} as const;

/**
 * Polls session status from the server while modal is open until terminal.
 * Terminal = expired or completed.
 */
export function useSessionPolling(
  initialSession: SessionWithNav,
  isOpen: boolean,
  txHash?: string,
) {
  const client = useDaimoClient();
  const logNavEvent = createNavLogger(client);

  const [session, setSession] = useState(initialSession);

  useEffect(() => {
    if (!isSessionTerminal(session.status)) return;
    const action =
      terminalAction[session.status as keyof typeof terminalAction];
    if (action) {
      logNavEvent(session.sessionId, session.clientSecret, {
        nodeId: null,
        nodeType: null,
        action,
      });
    }
  }, [session.status, session.sessionId]);

  useEffect(() => {
    if (!isOpen || !isSessionActive(session.status)) return;

    const poll = async () => {
      const credentials = {
        sessionId: session.sessionId,
        clientSecret: session.clientSecret,
      };
      try {
        const result = await client.sessions.check(credentials.sessionId, {
          clientSecret: credentials.clientSecret,
          txHash,
        });
        setSession((current) =>
          mergeSessionPollResult(current, credentials, result.session),
        );
      } catch (error) {
        console.error("failed to poll session:", error);
      }
    };

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isOpen, session.sessionId, session.status, session.clientSecret, client, txHash]);

  return { session, setSession };
}

/** Ignore a poll result when session credentials changed during the request. */
export function mergeSessionPollResult(
  current: SessionWithNav,
  credentials: SessionCredentials,
  update: SessionPublicInfo,
): SessionWithNav {
  if (
    current.sessionId !== credentials.sessionId ||
    current.clientSecret !== credentials.clientSecret ||
    update.sessionId !== credentials.sessionId
  ) {
    return current;
  }

  return {
    ...current,
    ...update,
    navTree: current.navTree,
  };
}
