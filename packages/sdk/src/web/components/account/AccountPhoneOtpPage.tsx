import { useCallback } from "react";

import { useDaimoClient } from "../../hooks/DaimoClientContext.js";
import { useAccountFlow } from "../../hooks/useAccountFlow.js";
import {
  AccountOtpCodeEntry,
  type OtpVerifyOutcome,
} from "./AccountOtpCodeEntry.js";
import { formatUsPhoneDisplay } from "./phone.js";

type AccountPhoneOtpPageProps = {
  onBack: () => void;
  onVerified: () => void;
};

/**
 * OTP entry step for phone-gated enrollments. User enters the SMS code,
 * Privy links the phone, then the SDK re-runs generic enrollment advancement.
 * Providers that care about phone verification ingest it server-side there.
 */
export function AccountPhoneOtpPage({
  onBack,
  onVerified,
}: AccountPhoneOtpPageProps) {
  const account = useAccountFlow();
  const client = useDaimoClient();

  const handleVerify = useCallback(
    async (code: string): Promise<OtpVerifyOutcome> => {
      if (!account) return { ok: false };
      const verified = await account.verifyPhoneOtp(code, client);
      if (!verified) return { ok: false };
      return { ok: true };
    },
    [account, client],
  );

  const handleResend = useCallback(async () => {
    if (!account) return;
    await account.sendPhoneOtp(undefined, client);
  }, [account, client]);

  const destination = account?.phoneNumber
    ? formatUsPhoneDisplay(account.phoneNumber)
    : "";

  return (
    <AccountOtpCodeEntry
      destination={destination}
      onBack={onBack}
      onVerified={onVerified}
      onVerify={handleVerify}
      onResend={handleResend}
    />
  );
}
