import { useCallback } from "react";

import { useDaimoClient } from "../../hooks/DaimoClientContext.js";
import { useAccountFlow } from "../../hooks/useAccountFlow.js";
import {
  AccountOtpCodeEntry,
  type OtpVerifyOutcome,
} from "./AccountOtpCodeEntry.js";

type AccountRipioOtpPageProps = {
  onBack: () => void;
  onVerified: () => void;
};

const RIPIO_INVALID_CODE =
  "El código de Ripio no es válido. Revisalo e intentalo de nuevo.";

export function AccountRipioOtpPage({
  onBack,
  onVerified,
}: AccountRipioOtpPageProps) {
  const account = useAccountFlow();
  const client = useDaimoClient();

  const handleVerify = useCallback(
    async (code: string): Promise<OtpVerifyOutcome> => {
      if (!account) return { ok: false, msg: RIPIO_INVALID_CODE };
      const token = await account.getAccessToken();
      if (!token) return { ok: false, msg: "No pudimos verificar tu sesión." };
      const result = await client.account.submitEnrollmentOtp(
        { rail: "ars", code },
        { bearerToken: token },
      );
      switch (result.action) {
        case "active":
        case "provider_pending":
          return { ok: true };
        case "provider_otp_required":
          return { ok: false, msg: RIPIO_INVALID_CODE };
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
    [account, client],
  );

  const handleResend = useCallback(async () => {
    if (!account) return;
    const token = await account.getAccessToken();
    if (!token) return;
    await client.account.resendEnrollmentOtp(
      { rail: "ars" },
      { bearerToken: token },
    );
  }, [account, client]);

  return (
    <AccountOtpCodeEntry
      destination="email"
      title="Ya tenés una cuenta de Ripio"
      message="Vamos a conectar tu cuenta de Ripio para terminar el flujo. Ingresá el código que Ripio envió a tu email."
      invalidMessage={RIPIO_INVALID_CODE}
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
