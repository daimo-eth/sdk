import { useCallback, useEffect, useState } from "react";

type ResendCooldown = {
  canResend: boolean;
  restart: () => void;
};

/** Enforce the server-provided delay between code resend attempts. */
export function useResendCooldown(delayMs: number): ResendCooldown {
  const [version, setVersion] = useState(0);
  const [canResend, setCanResend] = useState(delayMs === 0);

  useEffect(() => {
    if (delayMs === 0) {
      setCanResend(true);
      return;
    }

    setCanResend(false);
    const timeout = window.setTimeout(() => setCanResend(true), delayMs);
    return () => window.clearTimeout(timeout);
  }, [delayMs, version]);

  const restart = useCallback(() => {
    setVersion((current) => current + 1);
  }, []);

  return { canResend, restart };
}
