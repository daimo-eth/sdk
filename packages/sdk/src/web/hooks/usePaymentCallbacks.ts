import { isSessionStarted } from "../../common/session.js";
import { useEffect, useRef } from "react";

import type { SessionWithNav } from "../api/navTree.js";
import type { DaimoModalEventHandlers } from "./types.js";

/**
 * Manages payment lifecycle callbacks:
 * - onOpen: when modal opens
 * - onPaymentStarted: when first fulfillment is detected
 * - onPaymentCompleted: when session completes
 */
export function usePaymentCallbacks(
  session: SessionWithNav,
  isOpen: boolean,
  callbacks: DaimoModalEventHandlers,
) {
  const isStarted = isSessionStarted(session.status);
  const isCompleted = session.status === "succeeded";
  const lastStatusRef = useRef<string | null>(null);
  const lastOpenSessionRef = useRef<string | null>(null);
  const lastStartedSessionRef = useRef<string | null>(null);
  const lastCompletedSessionRef = useRef<string | null>(null);
  const lastBouncedSessionRef = useRef<string | null>(null);
  const lastExpiredSessionRef = useRef<string | null>(null);

  const {
    onOpen,
    onSessionUpdated,
    onPaymentStarted,
    onPaymentCompleted,
    onPaymentBounced,
    onPaymentExpired,
  } = callbacks;

  useEffect(() => {
    const key = `${session.sessionId}:${session.status}`;
    if (lastStatusRef.current === key) return;
    lastStatusRef.current = key;
    onSessionUpdated?.(session);
  }, [session, onSessionUpdated]);
  useEffect(() => {
    if (!isOpen) {
      lastOpenSessionRef.current = null;
      return;
    }
    if (lastOpenSessionRef.current === session.sessionId) return;
    lastOpenSessionRef.current = session.sessionId;
    if (isOpen) onOpen?.();
  }, [session.sessionId, isOpen, onOpen]);
  useEffect(() => {
    if (!isStarted) return;
    if (lastStartedSessionRef.current === session.sessionId) return;
    lastStartedSessionRef.current = session.sessionId;
    if (isStarted) onPaymentStarted?.(session);
  }, [session, isStarted, onPaymentStarted]);
  useEffect(() => {
    if (!isCompleted) return;
    if (lastCompletedSessionRef.current === session.sessionId) return;
    lastCompletedSessionRef.current = session.sessionId;
    if (isCompleted) onPaymentCompleted?.(session);
  }, [session, isCompleted, onPaymentCompleted]);
  useEffect(() => {
    if (session.status !== "bounced") return;
    if (lastBouncedSessionRef.current === session.sessionId) return;
    lastBouncedSessionRef.current = session.sessionId;
    if (session.status === "bounced") onPaymentBounced?.(session);
  }, [session, onPaymentBounced]);
  useEffect(() => {
    if (session.status !== "expired") return;
    if (lastExpiredSessionRef.current === session.sessionId) return;
    lastExpiredSessionRef.current = session.sessionId;
    if (session.status === "expired") onPaymentExpired?.(session);
  }, [session, onPaymentExpired]);
}
