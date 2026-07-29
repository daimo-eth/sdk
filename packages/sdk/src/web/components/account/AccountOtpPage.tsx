import { useCallback } from "react";

import { t } from "../../hooks/locale.js";
import { useAccountFlow } from "../../hooks/useAccountFlow.js";
import {
  AccountOtpCodeEntry,
  type OtpVerifyOutcome,
} from "./AccountOtpCodeEntry.js";

type AccountOtpPageProps = {
  sessionId: string;
  clientSecret: string;
  onBack: () => void;
  onVerified: () => void;
};

export function AccountOtpPage({
  sessionId,
  clientSecret,
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
      sessionId={sessionId}
      clientSecret={clientSecret}
      title={t.accountOtp}
      message={t.accountOtpSentViaDaimo(destination)}
      consent={<AccountWalletConsent />}
      onBack={onBack}
      onVerified={onVerified}
      onVerify={handleVerify}
      onResend={handleResend}
    />
  );
}

function AccountWalletConsent() {
  return (
    <p className="daimo-max-w-xs daimo-text-center daimo-text-xs daimo-leading-relaxed daimo-text-[var(--daimo-text-muted)]">
      {t.accountWalletConsent}{" "}
      <a
        href="https://daimo.com/terms-of-use"
        target="_blank"
        rel="noreferrer"
        className="daimo-underline daimo-underline-offset-2"
      >
        {t.accountTosTerms}
      </a>
      {" · "}
      <a
        href="https://daimo.com/privacy"
        target="_blank"
        rel="noreferrer"
        className="daimo-underline daimo-underline-offset-2"
      >
        {t.accountTosPrivacy}
      </a>
    </p>
  );
}
