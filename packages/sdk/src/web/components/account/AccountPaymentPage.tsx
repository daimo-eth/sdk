import { useCallback, useEffect, useRef, useState } from "react";

import type {
  AccountRail,
  DepositConstraints,
} from "../../../common/account.js";
import { useDaimoClient } from "../../hooks/DaimoClientContext.js";
import {
  useAccountFlow,
  useSessionDepositState,
} from "../../hooks/useAccountFlow.js";
import { t } from "../../hooks/locale.js";
import type { DaimoPlatform } from "../../platform.js";
import { PrimaryButton } from "../buttons.js";
import { Skeleton } from "../Skeleton.js";
import { CenteredContent, PageHeader } from "../shared.js";
import {
  TokenAmountEntry,
  type TokenAmountEntryValue,
} from "../TokenAmountEntry.js";

type AccountPaymentPageProps = {
  rail: AccountRail;
  sessionId: string;
  platform: DaimoPlatform;
  baseUrl: string;
  onBack?: (() => void) | null;
  onAdvance: () => void;
};

/** Amount entry for bank-transfer rails. Stores depositAmount and advances. */
export function AccountPaymentPage({
  rail,
  sessionId,
  platform,
  baseUrl,
  onBack,
  onAdvance,
}: AccountPaymentPageProps) {
  const client = useDaimoClient();
  const accountFlow = useAccountFlow();
  const { depositState, setDepositState } = useSessionDepositState(sessionId);
  const [constraints, setConstraints] = useState<DepositConstraints | null>(
    null,
  );
  const constraintsFetched = useRef(false);

  useEffect(() => {
    if (constraintsFetched.current || !accountFlow?.isAuthenticated) return;
    constraintsFetched.current = true;

    void (async () => {
      try {
        const token = await accountFlow.getAccessToken();
        if (!token) {
          constraintsFetched.current = false;
          return;
        }
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
  const [amountNative, setAmountNative] = useState(0);
  const [isValid, setIsValid] = useState(false);
  const handleChange = useCallback(
    (value: { amountUsd: number; nativeAmount: number; isValid: boolean }) => {
      setAmountUsd(value.amountUsd);
      setAmountNative(value.nativeAmount);
      setIsValid(value.isValid);
    },
    [],
  );

  const handleSubmit = useCallback(
    ({ nativeAmount }: TokenAmountEntryValue) => {
      if (!accountFlow || !constraints) return;
      setDepositState({
        depositAmount: nativeAmount.toFixed(2),
        kind: "idle",
      });
      onAdvance();
    },
    [accountFlow, constraints, onAdvance, setDepositState],
  );

  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title={t.accountPayment} onBack={onBack} />
      <CenteredContent>
        {constraints ? (
          <TokenAmountEntry
            token={constraints.destinationToken}
            minimumUsd={
              parseFloat(constraints.minAmount) *
              constraints.destinationToken.usd
            }
            maximumUsd={
              parseFloat(constraints.maxAmount) *
              constraints.destinationToken.usd
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
            platform={platform}
            baseUrl={baseUrl}
          />
        ) : (
          <AmountEntrySkeleton />
        )}
      </CenteredContent>

      <div className="daimo-px-6 daimo-pb-6 daimo-flex daimo-flex-col daimo-items-center">
        <PrimaryButton
          onClick={() =>
            isValid && handleSubmit({ amountUsd, nativeAmount: amountNative })
          }
          disabled={!isValid || !constraints}
        >
          {t.continue}
        </PrimaryButton>
      </div>
    </div>
  );
}

function AmountEntrySkeleton() {
  return (
    <div className="daimo-flex daimo-flex-col daimo-items-center">
      <div className="daimo-mb-3">
        <Skeleton className="daimo-h-20 daimo-w-20" rounded="full" />
      </div>
      <div className="daimo-flex daimo-h-10 daimo-items-center daimo-justify-center">
        <Skeleton className="daimo-h-10 daimo-w-40" rounded="lg" />
      </div>
      <div className="daimo-flex daimo-items-center daimo-justify-center daimo-py-3 daimo-px-4">
        <Skeleton
          className="daimo-h-[21px] daimo-w-20"
          rounded="sm"
          delayMs={100}
        />
      </div>
      <div className="daimo-min-h-[21px] daimo-mb-6" />
    </div>
  );
}
