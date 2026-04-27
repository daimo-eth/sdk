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
  onContinue: (amountUsd: number) => void;
  baseUrl: string;
};

/** Amount entry page for wallet payment flow. */
export function WalletAmountPage({
  token,
  platform,
  onBack,
  onContinue,
  baseUrl,
}: WalletAmountPageProps) {
  const balanceToken = token.balance.token;
  const minimumUsd = token.minimumRequired.usd;
  const maximumUsd = Math.min(token.balance.usd, balanceToken.maxAcceptUsd);
  const balanceNativeUnits = Number(
    formatUnits(BigInt(token.balance.amount), balanceToken.decimals),
  );

  const [amountUsd, setAmountUsd] = useState(0);
  const [isValid, setIsValid] = useState(false);
  const handleChange = useCallback((usd: number, valid: boolean) => {
    setAmountUsd(usd);
    setIsValid(valid);
  }, []);

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
          onContinue={onContinue}
          onChange={handleChange}
          balance={{ usd: token.balance.usd, nativeAmountUnits: balanceNativeUnits }}
          platform={platform}
          baseUrl={baseUrl}
        />
        <PrimaryButton
          onClick={() => isValid && onContinue(amountUsd)}
          disabled={!isValid}
          className="daimo-max-w-none"
        >
          {t.continue}
        </PrimaryButton>
      </div>
    </div>
  );
}
