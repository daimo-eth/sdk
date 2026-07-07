import { useCallback, useEffect, useRef, useState } from "react";

import type {
  AccountRail,
  DepositConstraints,
  DepositPaymentInfo,
} from "../../../common/account.js";
import { useDaimoClient } from "../../hooks/DaimoClientContext.js";
import { formatUserError } from "../../hooks/formatUserError.js";
import {
  useAccountFlow,
  useSessionDepositState,
} from "../../hooks/useAccountFlow.js";
import { t } from "../../hooks/locale.js";
import { startBankDeposit } from "../../hooks/useDraftDeposit.js";
import type { DaimoPlatform } from "../../platform.js";
import { PrimaryButton } from "../buttons.js";
import { Skeleton } from "../Skeleton.js";
import { PageHeader } from "../shared.js";
import {
  TokenAmountEntry,
  type TokenAmountEntryValue,
} from "../TokenAmountEntry.js";
import { openDeeplink } from "./openDeeplink.js";

type AccountPaymentPageProps = {
  rail: AccountRail;
  sessionId: string;
  initialAmount?: string;
  platform: DaimoPlatform;
  baseUrl: string;
  startDepositOnAdvance: boolean;
  onBack?: (() => void) | null;
  onAdvance: () => void;
};

/**
 * Amount entry for bank-transfer rails. Stores depositAmount and advances.
 * When `startDepositOnAdvance` is set (interac on mobile, where the bank
 * picker is skipped), signs + upserts the deposit and opens Interac first.
 */
export function AccountPaymentPage({
  rail,
  sessionId,
  initialAmount,
  platform,
  baseUrl,
  startDepositOnAdvance,
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
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const handleChange = useCallback(
    (value: { amountUsd: number; nativeAmount: number; isValid: boolean }) => {
      setAmountUsd(value.amountUsd);
      setAmountNative(value.nativeAmount);
      setIsValid(value.isValid);
      setStartError(null);
    },
    [],
  );

  const handleSubmit = useCallback(
    ({ nativeAmount }: TokenAmountEntryValue) => {
      if (!accountFlow || !constraints || isStarting) return;
      const depositAmount = nativeAmount.toFixed(2);
      if (!startDepositOnAdvance) {
        setDepositState({ depositAmount, kind: "idle" });
        onAdvance();
        return;
      }
      // The deeplink page needs a started deposit — reuse one from back-nav
      // if the amount is unchanged, otherwise sign + upsert before advancing.
      if (
        depositState?.kind === "started" &&
        depositState.depositAmount === depositAmount
      ) {
        openInterac(depositState.payment, platform);
        onAdvance();
        return;
      }
      setIsStarting(true);
      setStartError(null);
      void (async () => {
        try {
          const { depositId, payment } = await startBankDeposit({
            client,
            accountFlow,
            sessionId,
            rail,
            depositAmount,
          });
          setDepositState({
            depositAmount,
            kind: "started",
            depositId,
            payment,
          });
          openInterac(payment, platform);
          onAdvance();
        } catch (err) {
          setStartError(formatUserError(err, t.errorDepositFailed));
        } finally {
          setIsStarting(false);
        }
      })();
    },
    [
      accountFlow,
      client,
      constraints,
      depositState,
      isStarting,
      onAdvance,
      platform,
      rail,
      sessionId,
      setDepositState,
      startDepositOnAdvance,
    ],
  );
  const initialAmountUsd =
    depositState?.depositAmount != null
      ? parseFloat(depositState.depositAmount) * (constraints?.destinationToken.usd ?? 1)
      : initialAmount != null
        ? parseFloat(initialAmount)
        : undefined;

  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title={t.accountPayment} onBack={onBack} />
      <div className="daimo-flex-1 daimo-flex daimo-flex-col daimo-items-center daimo-p-6">
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
            initialAmountUsd={initialAmountUsd}
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

        <PrimaryButton
          onClick={() =>
            isValid && handleSubmit({ amountUsd, nativeAmount: amountNative })
          }
          disabled={!isValid || !constraints || isStarting}
        >
          {t.continue}
        </PrimaryButton>
        {startError && (
          <p className="daimo-mt-3 daimo-text-xs daimo-text-[var(--daimo-error)] daimo-text-center daimo-max-w-[320px]">
            {startError}
          </p>
        )}
      </div>
    </div>
  );
}

/** Open the generic Interac request page (mobile bank-picker-skip flow). */
function openInterac(payment: DepositPaymentInfo, platform: DaimoPlatform) {
  if (payment.flow !== "bank-picker" || payment.qrUrl == null) return;
  openDeeplink({ type: "redirect", url: payment.qrUrl }, platform, {
    newWindow: true,
  });
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
