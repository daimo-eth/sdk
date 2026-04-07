import { useCallback, useEffect, useRef, useState } from "react";

import type {
  AccountRail,
  DepositConstraints,
} from "../../../common/account.js";
import type { UserFeeRule } from "../../../common/session.js";
import { useDaimoClient } from "../../hooks/DaimoClientContext.js";
import {
  useAccountFlow,
  useSessionDepositState,
} from "../../hooks/useAccountFlow.js";
import { t } from "../../hooks/locale.js";
import type { DaimoPlatform } from "../../platform.js";
import { PrimaryButton } from "../buttons.js";
import { CenteredContent, PageHeader } from "../shared.js";
import { TokenAmountEntry } from "../TokenAmountEntry.js";

type AccountPaymentPageProps = {
  rail: AccountRail;
  sessionId: string;
  platform: DaimoPlatform;
  baseUrl: string;
  userFeeRule?: UserFeeRule;
  onBack: () => void;
  onAdvance: () => void;
};

/** Amount entry for bank-transfer rails. Stores depositAmount and advances. */
export function AccountPaymentPage({
  rail,
  sessionId,
  platform,
  baseUrl,
  userFeeRule,
  onBack,
  onAdvance,
}: AccountPaymentPageProps) {
  const client = useDaimoClient();
  const accountFlow = useAccountFlow();
  const { depositState, setDepositState } = useSessionDepositState(sessionId);
  const [constraints, setConstraints] = useState<DepositConstraints | null>(null);
  const constraintsFetched = useRef(false);

  useEffect(() => {
    if (constraintsFetched.current || !accountFlow?.isAuthenticated) return;
    constraintsFetched.current = true;

    void (async () => {
      try {
        const token = await accountFlow.getAccessToken();
        if (!token) { constraintsFetched.current = false; return; }
        const result = await client.account.getDepositConstraints(
          { sessionId, rail },
          { bearerToken: token },
        );
        setConstraints(result);
      } catch (error) {
        constraintsFetched.current = false;
        console.error("failed to load deposit constraints:", error);
      }
    })();
  }, [accountFlow, client, rail, sessionId]);

  const [amountUsd, setAmountUsd] = useState(0);
  const [isValid, setIsValid] = useState(false);
  const handleChange = useCallback((usd: number, valid: boolean) => {
    setAmountUsd(usd);
    setIsValid(valid);
  }, []);

  const handleSubmit = useCallback(
    (usd: number) => {
      if (!accountFlow || !constraints) return;
      const fiat = usd / constraints.destinationToken.usd;
      setDepositState({ depositAmount: fiat.toFixed(2), kind: "idle" });
      onAdvance();
    },
    [accountFlow, constraints, onAdvance, setDepositState],
  );

  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title={t.accountPayment} onBack={onBack} />
      <CenteredContent>
        {constraints && (
          <TokenAmountEntry
            token={constraints.destinationToken}
            minimumUsd={
              parseFloat(constraints.minAmount) * constraints.destinationToken.usd
            }
            maximumUsd={
              parseFloat(constraints.maxAmount) * constraints.destinationToken.usd
            }
            nativeDisplay={{
              kind: "prefix",
              symbol: constraints.currency.symbol,
            }}
            initialMode="native"
            initialAmountUsd={
              depositState?.depositAmount
                ? parseFloat(depositState.depositAmount) *
                  constraints.destinationToken.usd
                : undefined
            }
            onContinue={handleSubmit}
            onChange={handleChange}
            iconLogoURI={constraints.icon.logoURI}
            iconAlt={constraints.icon.alt}
            badgeLogoURI={
              constraints.badge.logoURI === constraints.icon.logoURI
                ? null
                : constraints.badge.logoURI
            }
            badgeAlt={constraints.badge.alt}
            userFeeRule={userFeeRule}
            platform={platform}
            baseUrl={baseUrl}
          />
        )}
      </CenteredContent>

      <div className="daimo-px-6 daimo-pb-6 daimo-flex daimo-flex-col daimo-items-center">
        <PrimaryButton
          onClick={() => isValid && handleSubmit(amountUsd)}
          disabled={!isValid || !constraints}
        >
          {t.continue}
        </PrimaryButton>
      </div>
    </div>
  );
}
