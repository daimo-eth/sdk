import {
  isSessionActive,
  isSessionTerminal,
  type SessionPublicInfo,
} from "../../common/session.js";
import { useEffect, useRef, useState } from "react";

import { useDaimoClient } from "./DaimoClientContext.js";
import { createNavLogger } from "./navEvent.js";
import type { SessionWithNav } from "../api/navTree.js";

const POLL_INTERVAL_MS = 3000;
const MAX_WAITING_POLL_INTERVAL_MS = 15000;
const MAX_ERROR_POLL_INTERVAL_MS = 30000;

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
  const pollInFlight = useRef(false);

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

    let stopped = false;
    let delay = POLL_INTERVAL_MS;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      if (stopped) return;
      if (pollInFlight.current || document.visibilityState === "hidden") {
        timer = setTimeout(poll, POLL_INTERVAL_MS);
        return;
      }
      pollInFlight.current = true;
      const credentials = {
        sessionId: session.sessionId,
        clientSecret: session.clientSecret,
      };
      try {
        const result = await client.sessions.check(credentials.sessionId, {
          clientSecret: credentials.clientSecret,
          txHash,
        });
        if (stopped) return;
        setSession((current) =>
          mergeSessionPollResult(current, credentials, result.session),
        );
        if (isSessionTerminal(result.session.status)) {
          stopped = true;
          return;
        }
        delay =
          !txHash &&
          result.session.status === session.status &&
          result.session.status !== "processing"
            ? Math.min(delay * 2, MAX_WAITING_POLL_INTERVAL_MS)
            : POLL_INTERVAL_MS;
      } catch (error) {
        console.error("failed to poll session:", error);
        delay = Math.min(delay * 2, MAX_ERROR_POLL_INTERVAL_MS);
      } finally {
        pollInFlight.current = false;
        if (!stopped) timer = setTimeout(poll, delay);
      }
    };

    timer = setTimeout(poll, POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [
    isOpen,
    session.sessionId,
    session.status,
    session.clientSecret,
    client,
    txHash,
  ]);

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
