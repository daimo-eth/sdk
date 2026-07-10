import { useCallback } from "react";

import { useDaimoClient } from "../../hooks/DaimoClientContext.js";
import { t } from "../../hooks/locale.js";
import { useAccountFlow } from "../../hooks/useAccountFlow.js";
import {
  AccountOtpCodeEntry,
  type OtpVerifyOutcome,
} from "./AccountOtpCodeEntry.js";

type AccountProviderOtpPageProps = {
  returnUrl?: string;
  onBack: () => void;
  onVerified: () => void;
};

export function AccountProviderOtpPage({
  returnUrl,
  onBack,
  onVerified,
}: AccountProviderOtpPageProps) {
  const account = useAccountFlow();
  const client = useDaimoClient();
  const copy = account?.providerOtp?.copy ?? null;
  const invalidMessage = copy?.invalidMessage ?? t.somethingWentWrong;

  const handleVerify = useCallback(
    async (code: string): Promise<OtpVerifyOutcome> => {
      if (!account) return { ok: false, msg: invalidMessage };
      const token = await account.getAccessToken();
      if (!token) return { ok: false, msg: invalidMessage };
      const result = await client.account.submitEnrollmentOtp(
        { rail: "ars", code, ...(returnUrl ? { returnUrl } : {}) },
        { bearerToken: token },
      );
      switch (result.action) {
        case "active":
        case "provider_pending":
          return { ok: true };
        case "provider_otp_required": {
          account.setProviderOtp(result);
          return {
            ok: false,
            msg: result.copy?.invalidMessage ?? invalidMessage,
          };
        }
        case "error":
          return { ok: false, msg: result.message };
        case "suspended":
        case "not_eligible":
        case "kyc_rejected_final":
          return { ok: false, msg: result.reason };
        case "kyc_required":
        case "kyc_retry":
        case "enrollment_form_required":
        case "kyc_pending_review":
        case "hosted_agreement_required":
        case "hosted_kyc_required":
        case "phone_required":
          return { ok: true };
        default:
          return assertUnreachable(result);
      }
    },
    [account, client, invalidMessage, returnUrl],
  );

  const handleResend = useCallback(async () => {
    if (!account) return;
    const token = await account.getAccessToken();
    if (!token) return;
    const result = await client.account.resendEnrollmentOtp(
      { rail: "ars" },
      { bearerToken: token },
    );
    if (result.action === "provider_otp_required") {
      account.setProviderOtp(result);
    }
  }, [account, client]);

  return (
    <AccountOtpCodeEntry
      destination="email"
      title={copy?.title}
      message={copy?.message}
      invalidMessage={invalidMessage}
      onBack={onBack}
      onVerified={onVerified}
      onVerify={handleVerify}
      onResend={handleResend}
    />
  );
}

function assertUnreachable(value: never): never {
  throw new Error(`unhandled enrollment response: ${JSON.stringify(value)}`);
}
