import { useCallback } from "react";

import type { AccountRail } from "../../../common/account.js";
import { useDaimoClient } from "../../hooks/DaimoClientContext.js";
import { formatUserError } from "../../hooks/formatUserError.js";
import { useAccountFlow } from "../../hooks/useAccountFlow.js";
import {
  AccountOtpCodeEntry,
  type OtpVerifyOutcome,
} from "./AccountOtpCodeEntry.js";
import { formatUsPhoneDisplay } from "./phone.js";

type AccountPhoneOtpPageProps = {
  rail: AccountRail;
  onBack: () => void;
  onVerified: () => void;
};

/**
 * OTP entry step for phone-gated enrollments. User enters the SMS code,
 * Privy links the phone, then the SDK re-runs generic enrollment advancement.
 * Providers that care about phone verification ingest it server-side there.
 */
export function AccountPhoneOtpPage({
  rail,
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
      // startEnrollment advances the provider state machine after the Daimo
      // phone verification endpoint stores the Coinbase checkpoint.
      const result = await account.startEnrollment(client, { rail });
      if (!result) {
        return { ok: false, msg: "failed to submit phone verification" };
      }
      switch (result.action) {
        case "active":
          return { ok: true };
        case "phone_required":
          return {
            ok: false,
            msg: result.reason
              ? formatUserError(result.reason)
              : "phone verification not recognized",
          };
        case "error":
          return { ok: false, msg: result.message };
        case "suspended":
        case "not_eligible":
          return { ok: false, msg: result.reason };
        case "kyc_required":
        case "kyc_retry":
        case "enrollment_form_required":
        case "kyc_pending_review":
        case "kyc_rejected_final":
        case "hosted_agreement_required":
        case "hosted_kyc_required":
        case "provider_otp_required":
        case "provider_pending":
        case "provider_account_choice_required":
        case "provider_phone_required":
        case "provider_email_required":
        case "mtpelerin_kyc":
          return { ok: true };
        default:
          return assertUnreachable(result);
      }
    },
    [account, client, rail],
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

function assertUnreachable(value: never): never {
  throw new Error(`unhandled enrollment response: ${JSON.stringify(value)}`);
}
