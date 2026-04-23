import { useCallback } from "react";

import type { AccountRail } from "../../../common/account.js";
import { useDaimoClient } from "../../hooks/DaimoClientContext.js";
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
      const verified = await account.verifyPhoneOtp(code);
      if (!verified) return { ok: false };
      // startEnrollment runs the adapter's prepareAdvance hook, which copies
      // the just-verified Privy phone into the enrollment metadata.
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
            msg: result.reason ?? "phone verification not recognized",
          };
        case "error":
          return { ok: false, msg: result.message };
        case "suspended":
        case "not_eligible":
          return { ok: false, msg: result.reason };
        default:
          // Route unexpected states back through the enrollment page so the
          // generic server-driven state machine can handle them.
          return { ok: true };
      }
    },
    [account, client, rail],
  );

  const handleResend = useCallback(async () => {
    if (!account) return;
    await account.sendPhoneOtp();
  }, [account]);

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
