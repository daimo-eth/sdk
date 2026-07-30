import { useEffect, useMemo } from "react";

import type { AccountAuthFailure } from "../../accountAuthFailure.js";
import { useAccountFlow } from "../../hooks/useAccountFlow.js";
import { useDaimoClient } from "../../hooks/DaimoClientContext.js";
import { createNavLogger } from "../../hooks/navEvent.js";
import { ErrorMessage } from "../shared.js";

type AccountAuthErrorMessageProps = {
  sessionId?: string;
  clientSecret?: string;
};

/** Inline auth error with privacy-safe, stage-specific session telemetry. */
export function AccountAuthErrorMessage({
  sessionId,
  clientSecret = "",
}: AccountAuthErrorMessageProps) {
  const account = useAccountFlow();
  const error = account?.authError ?? null;
  const details = account?.authErrorDetails ?? null;

  if (!error) return null;
  return (
    <>
      {sessionId && details && (
        <AccountAuthErrorTelemetry
          sessionId={sessionId}
          clientSecret={clientSecret}
          details={details}
        />
      )}
      <ErrorMessage message={error} />
    </>
  );
}

function AccountAuthErrorTelemetry({
  sessionId,
  clientSecret,
  details,
}: {
  sessionId: string;
  clientSecret: string;
  details: AccountAuthFailure;
}) {
  const client = useDaimoClient();
  const logNavEvent = useMemo(() => createNavLogger(client), [client]);

  useEffect(() => {
    logNavEvent(sessionId, clientSecret, {
      nodeId: null,
      nodeType: null,
      action: "error_shown",
      error: details.eventError,
      errorCode: details.errorCode,
      errorStage: details.stage,
    });
  }, [clientSecret, details, logNavEvent, sessionId]);

  return null;
}
