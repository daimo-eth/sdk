import { useCallback, useMemo, useState } from "react";

import type {
  AccountRail,
  DepositInstitution,
  DepositPaymentInteraction,
} from "../../../common/account.js";
import { useDaimoClient } from "../../hooks/DaimoClientContext.js";
import { formatUserError } from "../../hooks/formatUserError.js";
import { t } from "../../hooks/locale.js";
import {
  useAccountFlow,
  useSessionDepositState,
} from "../../hooks/useAccountFlow.js";
import {
  startBankDeposit,
  useDraftDeposit,
} from "../../hooks/useDraftDeposit.js";
import { ErrorPage } from "../ErrorPage.js";
import { Skeleton } from "../Skeleton.js";
import { PageHeader, ScrollContent, TextInput } from "../shared.js";
import { isPaymentInteractionCompatible } from "./accountNav.js";
import { getInstitutionPaymentContract } from "./accountPaymentCompatibility.js";

type AccountInstitutionPickerPageProps = {
  rail: AccountRail;
  paymentInteraction: DepositPaymentInteraction;
  sessionId: string;
  onBack?: (() => void) | null;
  onSelect: () => void;
};

/**
 * Canada bank picker. Loads institutions via the deposit endpoint.
 * On bank click: writes signatures, opens the institution deeplink, advances
 * to the deeplink page.
 */
export function AccountInstitutionPickerPage({
  rail,
  paymentInteraction,
  sessionId,
  onBack,
  onSelect,
}: AccountInstitutionPickerPageProps) {
  const client = useDaimoClient();
  const accountFlow = useAccountFlow();
  const { depositState, setDepositState } = useSessionDepositState(sessionId);
  const [search, setSearch] = useState("");
  const [startError, setStartError] = useState<string | null>(null);

  const depositAmount = depositState?.depositAmount ?? "";

  const {
    payment: draftPayment,
    isCreating,
    error: draftError,
  } = useDraftDeposit({
    client,
    accountFlow,
    sessionId,
    rail,
    depositAmount,
    enabled: depositAmount !== "",
    draftMode: "plain",
  });

  const candidatePayment =
    depositState?.kind === "started" ? depositState.payment : draftPayment;
  const contractMismatch =
    candidatePayment != null &&
    !isPaymentInteractionCompatible(paymentInteraction, candidatePayment);
  const payment =
    !contractMismatch && candidatePayment?.flow === "bank-picker"
      ? candidatePayment
      : null;
  const paymentContract = payment
    ? getInstitutionPaymentContract(payment, depositAmount)
    : null;
  const institutions: DepositInstitution[] = payment?.institutions ?? [];
  const isLoadingInstitutions = isCreating || payment == null;
  const query = search.toLowerCase();

  const filteredFeatured = useMemo(() => {
    const featured = institutions.filter(
      (i) => i.featured ?? i.logoURI != null,
    );
    return query
      ? featured.filter((i) => i.name.toLowerCase().includes(query))
      : featured;
  }, [institutions, query]);

  const filteredOther = useMemo(() => {
    const other = institutions.filter(
      (i) => !(i.featured ?? i.logoURI != null),
    );
    return query
      ? other.filter((i) => i.name.toLowerCase().includes(query))
      : other;
  }, [institutions, query]);

  const handleSelect = useCallback(
    async (institution: DepositInstitution) => {
      if (
        depositState?.kind === "started" &&
        depositState.depositAmount === depositAmount &&
        depositState.payment.flow === "bank-picker"
      ) {
        setDepositState({
          ...depositState,
          selectedInstitutionId: institution.id,
        });
        onSelect();
        return;
      }

      if (!accountFlow) return;

      setStartError(null);
      try {
        const { depositId, payment } = await startBankDeposit({
          client,
          accountFlow,
          sessionId,
          rail,
          depositAmount,
        });
        if (!isPaymentInteractionCompatible(paymentInteraction, payment)) {
          setStartError(t.errorDepositFailed);
          return;
        }
        setDepositState({
          depositAmount,
          kind: "started",
          depositId,
          payment,
          selectedInstitutionId: institution.id,
        });
        onSelect();
      } catch (err) {
        setStartError(formatUserError(err, t.errorDepositFailed));
      }
    },
    [
      depositState,
      accountFlow,
      client,
      depositAmount,
      onSelect,
      paymentInteraction,
      rail,
      sessionId,
      setDepositState,
    ],
  );

  const error = contractMismatch
    ? t.errorDepositFailed
    : (startError ?? draftError);

  if (error) {
    return (
      <ErrorPage
        message={getBankPickerErrorMessage(error)}
        retryText={t.tryAgain}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader
        title={paymentContract?.ui.picker.title ?? t.accountSelectBank}
        onBack={onBack}
      />

      <ScrollContent>
        <div className="daimo-px-6 daimo-pt-3">
          <TextInput
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              paymentContract?.ui.picker.searchPlaceholder ??
              t.accountSearchInstitutions
            }
          />
        </div>

        {/* Featured banks — logo tiles or skeletons */}
        <div className="daimo-grid daimo-grid-cols-3 daimo-gap-2 daimo-px-6 daimo-py-3">
          {isLoadingInstitutions
            ? Array.from({ length: 15 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="daimo-min-h-[56px]"
                  delayMs={(i % 5) * 80}
                />
              ))
            : filteredFeatured.map((inst) => (
                <InstitutionTile
                  key={inst.id}
                  institution={inst}
                  onSelect={handleSelect}
                />
              ))}
        </div>

        {/* Other banks — text list (hidden while loading) */}
        {!isLoadingInstitutions && filteredOther.length > 0 && (
          <div className="daimo-px-6 daimo-pb-3 daimo-flex daimo-flex-col">
            <p className="daimo-text-xs daimo-text-[var(--daimo-text-muted)] daimo-mb-2">
              {paymentContract?.ui.picker.otherInstitutionsLabel ??
                t.accountOtherInstitutions}
            </p>
            {filteredOther.map((inst) => (
              <InstitutionRow
                key={inst.id}
                institution={inst}
                onSelect={handleSelect}
              />
            ))}
          </div>
        )}
      </ScrollContent>
    </div>
  );
}

/** Falls back to the generic deposit-failure copy when the error is empty. */
export function getBankPickerErrorMessage(error: string): string {
  return error || t.errorDepositFailed;
}

type InstitutionProps = {
  institution: DepositInstitution;
  onSelect: (inst: DepositInstitution) => void;
};

/** Featured institution as a logo tile. Falls back to name text if logo fails. */
function InstitutionTile({ institution, onSelect }: InstitutionProps) {
  return (
    <button
      onClick={() => onSelect(institution)}
      className="daimo-flex daimo-items-center daimo-justify-center daimo-p-3 daimo-rounded-[var(--daimo-radius-md)] daimo-bg-[var(--daimo-surface-secondary)] hover:daimo-bg-[var(--daimo-surface-hover)] daimo-transition-colors daimo-min-h-[56px]"
    >
      {institution.logoURI ? (
        <img
          src={institution.logoURI}
          alt={institution.name}
          className="daimo-h-8 daimo-max-w-[88px] daimo-object-contain"
          onError={(e) => {
            const el = e.target as HTMLImageElement;
            el.style.display = "none";
            if (el.parentElement)
              el.parentElement.textContent = institution.name;
          }}
        />
      ) : (
        <span className="daimo-text-xs daimo-font-medium daimo-text-[var(--daimo-text)]">
          {institution.name}
        </span>
      )}
    </button>
  );
}

/** Non-featured institution as a text row. */
function InstitutionRow({ institution, onSelect }: InstitutionProps) {
  return (
    <button
      onClick={() => onSelect(institution)}
      className="daimo-text-left daimo-py-2 daimo-px-3 daimo-text-sm daimo-text-[var(--daimo-text)] daimo-rounded-[var(--daimo-radius-sm)] hover:daimo-bg-[var(--daimo-surface-hover)] daimo-transition-colors"
    >
      {institution.name}
    </button>
  );
}
