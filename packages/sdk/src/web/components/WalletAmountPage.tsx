import { useCallback, useState } from "react";
import { formatUnits } from "viem";

import type { WalletPaymentOption } from "../api/walletTypes.js";
import { t } from "../hooks/locale.js";
import type { DaimoPlatform } from "../platform.js";
import { PrimaryButton } from "./buttons.js";
import { PageHeader } from "./shared.js";
import { TokenAmountEntry } from "./TokenAmountEntry.js";

type WalletAmountPageProps = {
  token: WalletPaymentOption;
  platform: DaimoPlatform;
  onBack: () => void;
  onContinue: (amountUsd: number, amountUnits: string) => void;
  baseUrl: string;
  /** Show the server-provided range below the amount input. */
  showLimits?: boolean;
};

/** Amount entry page for wallet payment flow. */
export function WalletAmountPage({
  token,
  platform,
  onBack,
  onContinue,
  baseUrl,
  showLimits = false,
}: WalletAmountPageProps) {
  const balanceToken = token.balance.token;
  const minimumUsd = token.minimumRequired.usd;
  const maximumUsd = Math.min(token.balance.usd, balanceToken.maxAcceptUsd);
  const balanceNativeUnits = Number(
    formatUnits(BigInt(token.balance.amount), balanceToken.decimals),
  );

  const [amountUsd, setAmountUsd] = useState(0);
  const [amountUnits, setAmountUnits] = useState("");
  const [isValid, setIsValid] = useState(false);
  const handleChange = useCallback(
    (value: { amountUsd: number; amountUnits: string; isValid: boolean }) => {
      setAmountUsd(value.amountUsd);
      setAmountUnits(value.amountUnits);
      setIsValid(value.isValid);
    },
    [],
  );

  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title={t.enterAmount} onBack={onBack} />
      <div className="daimo-flex-1 daimo-flex daimo-flex-col daimo-items-center daimo-justify-center daimo-p-6">
        <TokenAmountEntry
          token={balanceToken}
          minimumUsd={minimumUsd}
          maximumUsd={maximumUsd}
          nativeDisplay={{ kind: "suffix", symbol: balanceToken.symbol }}
          initialMode="usd"
          onContinue={(value) => onContinue(value.amountUsd, value.amountUnits)}
          onChange={handleChange}
          balance={{
            usd: token.balance.usd,
            nativeAmountUnits: balanceNativeUnits,
          }}
          limitMaximumUsd={showLimits ? balanceToken.maxAcceptUsd : undefined}
          showMax
          platform={platform}
          baseUrl={baseUrl}
        />
        <PrimaryButton
          onClick={() => isValid && onContinue(amountUsd, amountUnits)}
          disabled={!isValid}
          className="daimo-max-w-none"
        >
          {t.continue}
        </PrimaryButton>
      </div>
    </div>
  );
}
