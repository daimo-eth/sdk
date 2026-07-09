import { useCallback } from "react";

import { t } from "../../hooks/locale.js";
import { useAccountFlow } from "../../hooks/useAccountFlow.js";
import {
  AccountOtpCodeEntry,
  type OtpVerifyOutcome,
} from "./AccountOtpCodeEntry.js";

type AccountOtpPageProps = {
  onBack: () => void;
  onVerified: () => void;
};

export function AccountOtpPage({
  onBack,
  onVerified,
}: AccountOtpPageProps) {
  const account = useAccountFlow();
  const destination = account?.email ?? "";

  const handleVerify = useCallback(
    async (code: string): Promise<OtpVerifyOutcome> => {
      if (!account) return { ok: false };
      const ok = await account.verifyOtp(code);
      return ok ? { ok: true } : { ok: false };
    },
    [account],
  );

  const handleResend = useCallback(async () => {
    if (!account) return;
    await account.sendOtp();
  }, [account]);

  return (
    <AccountOtpCodeEntry
      destination={destination}
      title={t.accountOtp}
      message={t.accountOtpSentViaDaimo(destination)}
      onBack={onBack}
      onVerified={onVerified}
      onVerify={handleVerify}
      onResend={handleResend}
    />
  );
}
