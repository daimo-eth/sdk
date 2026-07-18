import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type {
  AccountRail,
  DepositPaymentInfo,
  DepositPaymentInteraction,
  DepositPaymentReference,
  DepositPaymentStep,
} from "../../../common/account.js";
import { useDaimoClient } from "../../hooks/DaimoClientContext.js";
import { getLocale, t } from "../../hooks/locale.js";
import {
  useAccountFlow,
  useSessionDepositState,
} from "../../hooks/useAccountFlow.js";
import { useCopyToClipboard } from "../../hooks/useCopyToClipboard.js";
import { useDepositPoller } from "../../hooks/useDepositPoller.js";
import { useDraftDeposit } from "../../hooks/useDraftDeposit.js";
import { ErrorPage } from "../ErrorPage.js";
import {
  ChevronIcon,
  CopyIcon,
  DepositInstructionsIcon,
  ExternalLinkIcon,
  WarningIcon,
  YouTubeLogoIcon,
} from "../icons.js";
import { DepositAddressContent } from "../WaitingDepositAddressPage.js";
import { PageHeader, resolveIconUrl } from "../shared.js";
import { Skeleton } from "../Skeleton.js";
import { isPaymentInteractionCompatible } from "./accountNav.js";

type AccountPaymentInstructionsPageProps = {
  rail: AccountRail;
  paymentInteraction: DepositPaymentInteraction;
  sessionId: string;
  clientSecret: string;
  baseUrl: string;
  onBack?: (() => void) | null;
  onAdvance: () => void;
};

/** Parsed line from the instructions string. */
type InstructionField = {
  label: string;
  value: string;
  emphasized?: boolean;
};

type DirectionsView =
  | { type: "steps"; stepIndex: number }
  | { type: "deposit"; stepIndex: number };

/** Parse instruction lines like "Bank: Lead Bank" into label/value pairs.
 *  The first line (e.g. "Send exactly $100 USD via ACH bank transfer.")
 *  is treated as a header — returned with an empty label. */
function parseInstructions(instructions: string): InstructionField[] {
  return instructions
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) return { label: "", value: line };
      return {
        label: line.slice(0, colonIdx).trim(),
        value: line.slice(colonIdx + 1).trim(),
      };
    });
}

/** Returns true if this field is a memo / reference that the user must include. */
function isMemoField(label: string): boolean {
  const lower = label.toLowerCase();
  return lower === "memo" || lower === "reference" || lower === "message";
}

function formatFiatAmount(
  amount: string,
  currency: DepositPaymentInfo["currency"],
  locale: string,
): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return `${currency.symbol}${amount}`;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency.symbol}${value.toFixed(2)}`;
  }
}

/**
 * Bank-transfer details page — shows formatted transfer instructions with copy
 * buttons. Used when the provider returns direct transfer instructions instead
 * of selectable institutions. Polls deposit status and auto-advances.
 */
export function AccountPaymentInstructionsPage({
  rail,
  paymentInteraction,
  sessionId,
  clientSecret,
  baseUrl,
  onBack,
  onAdvance,
}: AccountPaymentInstructionsPageProps) {
  const client = useDaimoClient();
  const accountFlow = useAccountFlow();
  const { depositState, setDepositState } = useSessionDepositState(sessionId);
  const [directionsView, setDirectionsView] = useState<DirectionsView>({
    type: "steps",
    stepIndex: 0,
  });
  const depositAmount = depositState?.depositAmount ?? "";
  const currentDepositId =
    depositState?.depositAmount === depositAmount &&
    (depositState.kind === "drafted" || depositState.kind === "started")
      ? depositState.depositId
      : null;
  const {
    payment: draftedPayment,
    isCreating,
    error: draftError,
    retry: retryDraft,
  } = useDraftDeposit({
    client,
    accountFlow,
    sessionId,
    rail,
    depositAmount,
    enabled: depositAmount !== "",
    draftMode: "signed",
  });
  const candidatePayment =
    depositState?.kind === "started" ? depositState.payment : draftedPayment;
  const contractMismatch =
    candidatePayment != null &&
    !isPaymentInteractionCompatible(paymentInteraction, candidatePayment);
  const payment =
    !contractMismatch &&
    candidatePayment &&
    isTransferInstructionFlow(candidatePayment)
      ? candidatePayment
      : null;
  const retryDraftRef = useRef(retryDraft);
  retryDraftRef.current = retryDraft;
  const instructionPollIntervalMs =
    payment?.flow === "bank-transfer"
      ? payment.instructionReadiness?.pollIntervalMs
      : undefined;
  const instructions = payment?.instructions ?? "";
  const bankTransferFields =
    payment?.flow === "bank-transfer"
      ? payment.fields.map((field) => ({
          label: field.label,
          value: field.value,
          emphasized: field.emphasized === true,
        }))
      : parseInstructions(instructions);
  const directionsPayment = payment?.flow === "directions" ? payment : null;
  const directionsLocale = getLocale();
  const bankTransferAmount =
    payment && !directionsPayment
      ? formatFiatAmount(depositAmount, payment.currency, directionsLocale)
      : "";
  const directionsStepIndex = directionsView.stepIndex;
  const directionsDeposit =
    directionsView.type === "deposit" && directionsPayment
      ? {
          payment: directionsPayment,
          transfer: directionsPayment.onchainTransfer,
        }
      : null;
  const pageTitle = directionsDeposit
    ? `${t.deposit} ${directionsDeposit.payment.destinationToken.symbol}`
    : payment?.flow === "directions"
      ? t.accountDirections
      : t.accountBankDetails;

  useEffect(() => {
    if (!payment || !depositAmount || !currentDepositId) return;
    if (
      payment.flow === "bank-transfer" &&
      payment.instructionReadiness?.status === "pending"
    ) {
      return;
    }
    if (depositState?.kind === "started") return;
    setDepositState({
      depositAmount,
      kind: "started",
      depositId: currentDepositId,
      payment,
    });
  }, [
    currentDepositId,
    depositAmount,
    depositState?.kind,
    payment,
    setDepositState,
  ]);

  useEffect(() => {
    if (!instructionPollIntervalMs) return;
    const timer = window.setTimeout(() => {
      retryDraftRef.current();
    }, instructionPollIntervalMs);
    return () => window.clearTimeout(timer);
  }, [instructionPollIntervalMs]);

  useDepositPoller({
    client,
    sessionId,
    clientSecret,
    onUpdate(deposit) {
      if (
        deposit.status !== "initiated" &&
        deposit.status !== "awaiting_payment"
      ) {
        onAdvance();
      }
    },
  });

  const paymentError = contractMismatch ? t.errorDepositFailed : draftError;
  if (paymentError) {
    return (
      <ErrorPage
        message={paymentError}
        retryText={t.tryAgain}
        onRetry={retryDraft}
      />
    );
  }

  if (!instructions) {
    return <BankDetailsSkeleton title={pageTitle} onBack={onBack} />;
  }

  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader
        title={pageTitle}
        onBack={
          directionsDeposit
            ? () =>
                setDirectionsView({
                  type: "steps",
                  stepIndex: directionsView.stepIndex,
                })
            : onBack
        }
      />
      {directionsDeposit ? (
        <div className="daimo-flex-1 daimo-min-h-0 daimo-flex daimo-flex-col">
          <DepositAddressContent
            address={directionsDeposit.transfer.address}
            addressLabel={directionsDeposit.transfer.addressLabel}
            amount={directionsDeposit.transfer.amount}
            tokenSuffix={directionsDeposit.transfer.token}
            chainId={directionsDeposit.transfer.chainId}
            title={directionsDeposit.payment.destinationToken.symbol}
            icon={{
              kind: "token",
              symbol: directionsDeposit.payment.destinationToken.symbol,
              logoURI: directionsDeposit.payment.destinationToken.logoURI,
            }}
            expiry={{
              kind: "countdown",
              expiresAt: directionsDeposit.transfer.expiresAt,
            }}
            loading={false}
            baseUrl={baseUrl}
          />
        </div>
      ) : directionsPayment ? (
        <div className="daimo-flex-1 daimo-min-h-0 daimo-overflow-y-auto daimo-flex daimo-flex-col daimo-gap-2 daimo-px-6 daimo-pt-3 daimo-pb-4">
          <DirectionsCard
            steps={directionsPayment.steps}
            activeIndex={directionsStepIndex}
            locale={directionsLocale}
            onActiveIndexChange={(stepIndex) =>
              setDirectionsView({ type: "steps", stepIndex })
            }
            baseUrl={baseUrl}
          />
          <DirectionsActions
            reference={directionsPayment.reference}
            locale={directionsLocale}
            onShowInstructions={() =>
              setDirectionsView({
                type: "deposit",
                stepIndex: directionsStepIndex,
              })
            }
          />
        </div>
      ) : (
        <div className="daimo-flex daimo-flex-col daimo-gap-2 daimo-px-6 daimo-pt-4 daimo-pb-12">
          <div className="daimo-flex daimo-flex-col daimo-gap-2">
            {bankTransferFields.map((field, i) =>
              field.label ? (
                <FieldRow
                  key={i}
                  label={field.label}
                  value={field.value}
                  emphasized={field.emphasized}
                />
              ) : (
                <p
                  key={i}
                  className="daimo-text-sm daimo-text-[var(--daimo-text-secondary)] daimo-leading-relaxed daimo-pb-2"
                >
                  {field.value}
                </p>
              ),
            )}
          </div>
          <p className="daimo-mx-auto daimo-mt-10 daimo-max-w-xs daimo-text-center daimo-text-sm daimo-leading-relaxed daimo-text-[var(--daimo-text-secondary)]">
            {t.accountBankDetailsAutoDetect(bankTransferAmount)}
          </p>
        </div>
      )}
    </div>
  );
}

function BankDetailsSkeleton({
  title,
  onBack,
}: {
  title: string;
  onBack?: (() => void) | null;
}) {
  return (
    <div
      className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0"
      aria-busy="true"
      aria-label={t.loading}
    >
      <PageHeader title={title} onBack={onBack} />
      <div className="daimo-flex daimo-flex-col daimo-gap-2 daimo-px-6 daimo-pt-4 daimo-pb-12">
        {["daimo-w-28", "daimo-w-44", "daimo-w-24", "daimo-w-52"].map(
          (widthClass, index) => (
            <div
              key={index}
              className="daimo-flex daimo-items-center daimo-justify-between daimo-gap-3 daimo-rounded-[var(--daimo-radius-md)] daimo-px-4 daimo-py-3"
              style={{ backgroundColor: "var(--daimo-surface-secondary)" }}
            >
              <div className="daimo-flex daimo-min-w-0 daimo-flex-1 daimo-flex-col">
                <SkeletonBlock className="daimo-h-3 daimo-w-20" />
                <SkeletonBlock
                  className={`daimo-mt-2 daimo-h-4 ${widthClass}`}
                />
              </div>
              <SkeletonBlock className="daimo-h-8 daimo-w-8 daimo-shrink-0" />
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function SkeletonBlock({
  className,
  rounded = "sm",
}: {
  className: string;
  rounded?: "sm" | "lg";
}) {
  return <Skeleton className={className} rounded={rounded} />;
}

function DirectionsActions({
  reference,
  locale,
  onShowInstructions,
}: {
  reference: DepositPaymentReference | undefined;
  locale: string;
  onShowInstructions: () => void;
}) {
  return (
    <div className="daimo-grid daimo-grid-cols-2 daimo-gap-2">
      <button
        type="button"
        onClick={onShowInstructions}
        className="daimo-flex daimo-min-h-20 daimo-w-full daimo-touch-action-manipulation daimo-flex-col daimo-justify-between daimo-gap-3 daimo-rounded-[var(--daimo-radius-md)] daimo-bg-[var(--daimo-surface-secondary)] daimo-p-3 daimo-text-left daimo-text-sm daimo-font-medium daimo-leading-snug daimo-text-[var(--daimo-text)] daimo-transition-[background-color] daimo-duration-100 daimo-ease hover:[@media(hover:hover)]:daimo-bg-[var(--daimo-surface-hover)]"
      >
        <span className="daimo-flex daimo-w-full daimo-items-start daimo-justify-between daimo-gap-2">
          <span className="daimo-flex daimo-h-8 daimo-w-8 daimo-shrink-0 daimo-items-center daimo-justify-center daimo-rounded-full daimo-bg-[var(--daimo-surface)] daimo-text-[var(--daimo-accent)]">
            <DepositInstructionsIcon size={18} />
          </span>
          <ChevronIcon className="daimo-shrink-0 daimo-text-[var(--daimo-text-muted)]" />
        </span>
        <span>{t.accountDirectionsShowInstructions}</span>
      </button>
      {reference && (
        <DirectionsReferenceLink reference={reference} locale={locale} />
      )}
    </div>
  );
}

function DirectionsCard({
  steps,
  activeIndex,
  locale,
  onActiveIndexChange,
  baseUrl,
}: {
  steps: DepositPaymentStep[];
  activeIndex: number;
  locale: string;
  onActiveIndexChange: (index: number) => void;
  baseUrl: string;
}) {
  const activeStep = steps[activeIndex] ?? steps[0];
  if (!activeStep) return null;

  const lastIndex = steps.length - 1;
  const canGoBack = activeIndex > 0;
  const canGoForward = activeIndex < lastIndex;
  const displayStep = getLocalizedStep(activeStep, locale);
  const warning = getLocalizedStepWarning(activeStep, locale);

  function goBack() {
    onActiveIndexChange(Math.max(0, activeIndex - 1));
  }

  function goForward() {
    onActiveIndexChange(Math.min(lastIndex, activeIndex + 1));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goBack();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goForward();
    }
  }

  return (
    <div
      className="daimo-pb-3"
      role="group"
      aria-roledescription="carousel"
      aria-label={t.accountDirections}
      onKeyDown={handleKeyDown}
    >
      <div className="daimo-rounded-[var(--daimo-radius-lg)] daimo-bg-[var(--daimo-surface-secondary)] daimo-p-4">
        <div className="daimo-flex daimo-min-h-[320px] daimo-flex-col daimo-justify-between daimo-gap-4">
          <div className="daimo-flex daimo-items-center daimo-justify-between daimo-gap-3">
            <div className="daimo-text-xs daimo-font-medium daimo-text-[var(--daimo-text-muted)]">
              {t.accountDirectionsStep(activeIndex + 1, steps.length)}
            </div>
          </div>

          {activeStep.media?.type === "image" && (
            <div className="daimo-flex daimo-h-36 daimo-items-center daimo-justify-center daimo-overflow-hidden daimo-rounded-[var(--daimo-radius-md)] daimo-border daimo-border-[var(--daimo-border)] daimo-bg-white">
              <img
                src={resolveIconUrl(activeStep.media.src, baseUrl)}
                alt={activeStep.media.alt}
                loading="lazy"
                className="daimo-h-full daimo-w-full daimo-object-contain"
              />
            </div>
          )}

          <div className="daimo-flex daimo-flex-1 daimo-flex-col daimo-justify-center daimo-gap-3">
            <div className="daimo-flex daimo-flex-col daimo-gap-1.5">
              <h2 className="daimo-text-base daimo-font-semibold daimo-leading-snug daimo-text-[var(--daimo-text)]">
                {displayStep.title}
              </h2>
              <p className="daimo-text-sm daimo-leading-relaxed daimo-text-[var(--daimo-text-secondary)]">
                {displayStep.description}
              </p>
              {activeStep.action && (
                <StepActionLink action={activeStep.action} locale={locale} />
              )}
              {warning && (
                <StepWarning
                  title={warning.title}
                  description={warning.description}
                />
              )}
            </div>
          </div>

          <div className="daimo-flex daimo-items-center daimo-justify-between daimo-gap-3">
            <button
              type="button"
              onClick={goBack}
              disabled={!canGoBack}
              className="daimo-flex daimo-h-11 daimo-w-11 daimo-touch-action-manipulation daimo-items-center daimo-justify-center daimo-rounded-full daimo-bg-[var(--daimo-surface)] daimo-transition-[background-color,opacity] daimo-duration-100 daimo-ease hover:[@media(hover:hover)]:daimo-bg-[var(--daimo-surface-hover)] disabled:daimo-cursor-not-allowed disabled:daimo-opacity-40"
              aria-label={t.accountDirectionsPrevious}
            >
              <ChevronIcon direction="left" />
            </button>
            <div className="daimo-flex daimo-items-center daimo-justify-center daimo-gap-1">
              {steps.map((step, index) => (
                <button
                  key={`${step.title}-${index}`}
                  type="button"
                  onClick={() => onActiveIndexChange(index)}
                  className="daimo-flex daimo-h-11 daimo-w-7 daimo-touch-action-manipulation daimo-items-center daimo-justify-center"
                  aria-label={t.accountDirectionsGoToStep(index + 1)}
                  aria-current={index === activeIndex ? "step" : undefined}
                >
                  <span
                    className={`daimo-h-1.5 daimo-rounded-full daimo-transition-[width,background-color] daimo-duration-150 daimo-ease-out ${
                      index === activeIndex
                        ? "daimo-w-5 daimo-bg-[var(--daimo-text)]"
                        : "daimo-w-1.5 daimo-bg-[var(--daimo-placeholder)]"
                    }`}
                  />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={goForward}
              disabled={!canGoForward}
              className="daimo-flex daimo-h-11 daimo-w-11 daimo-touch-action-manipulation daimo-items-center daimo-justify-center daimo-rounded-full daimo-bg-[var(--daimo-surface)] daimo-transition-[background-color,opacity] daimo-duration-100 daimo-ease hover:[@media(hover:hover)]:daimo-bg-[var(--daimo-surface-hover)] disabled:daimo-cursor-not-allowed disabled:daimo-opacity-40"
              aria-label={t.accountDirectionsNext}
            >
              <ChevronIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepWarning({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      className="daimo-mt-2 daimo-flex daimo-gap-3 daimo-rounded-[var(--daimo-radius-md)] daimo-px-3 daimo-py-3"
      style={{
        backgroundColor: "var(--daimo-warning-light, #fff7ed)",
        border: "1px solid var(--daimo-warning, #f97316)",
      }}
    >
      <span
        className="daimo-mt-0.5 daimo-shrink-0"
        style={{ color: "var(--daimo-warning, #f97316)" }}
      >
        <WarningIcon size={18} />
      </span>
      <div className="daimo-min-w-0">
        <div
          className="daimo-text-sm daimo-font-semibold daimo-leading-snug"
          style={{ color: "var(--daimo-warning, #f97316)" }}
        >
          {title}
        </div>
        <div className="daimo-mt-1 daimo-text-xs daimo-leading-relaxed daimo-text-[var(--daimo-text-secondary)]">
          {description}
        </div>
      </div>
    </div>
  );
}

function StepActionLink({
  action,
  locale,
}: {
  action: DepositPaymentReference;
  locale: string;
}) {
  const label =
    locale === "ja"
      ? (action.translations?.ja?.label ?? action.label)
      : action.label;

  return (
    <a
      href={action.url}
      target="_blank"
      rel="noreferrer"
      className="daimo-mt-2 daimo-inline-flex daimo-min-h-11 daimo-touch-action-manipulation daimo-items-center daimo-justify-center daimo-gap-2 daimo-rounded-full daimo-bg-[var(--daimo-surface)] daimo-px-4 daimo-py-2 daimo-text-sm daimo-font-medium daimo-text-[var(--daimo-text)] daimo-transition-[background-color] daimo-duration-100 daimo-ease hover:[@media(hover:hover)]:daimo-bg-[var(--daimo-surface-hover)]"
    >
      <span>{label}</span>
      <ExternalLinkIcon className="daimo-shrink-0 daimo-text-[var(--daimo-text-muted)]" />
    </a>
  );
}

function DirectionsReferenceLink({
  reference,
  locale,
}: {
  reference: DepositPaymentReference;
  locale: string;
}) {
  const label =
    locale === "ja"
      ? (reference.translations?.ja?.label ?? reference.label)
      : reference.label;

  return (
    <a
      href={reference.url}
      target="_blank"
      rel="noreferrer"
      className="daimo-flex daimo-min-h-20 daimo-touch-action-manipulation daimo-flex-col daimo-justify-between daimo-gap-3 daimo-rounded-[var(--daimo-radius-md)] daimo-bg-[var(--daimo-surface-secondary)] daimo-p-3 daimo-text-sm daimo-font-medium daimo-leading-snug daimo-text-[var(--daimo-text)] daimo-transition-[background-color] daimo-duration-100 daimo-ease hover:[@media(hover:hover)]:daimo-bg-[var(--daimo-surface-hover)]"
    >
      <span className="daimo-flex daimo-w-full daimo-items-start daimo-justify-between daimo-gap-2">
        <span className="daimo-flex daimo-h-8 daimo-w-8 daimo-shrink-0 daimo-items-center daimo-justify-center daimo-rounded-full daimo-bg-white">
          <YouTubeLogoIcon size={20} />
        </span>
        <ExternalLinkIcon className="daimo-shrink-0 daimo-text-[var(--daimo-text-muted)]" />
      </span>
      <span>{label}</span>
    </a>
  );
}

/** A single labeled field with a copy button. Memo fields are highlighted. */
function FieldRow({
  label,
  value,
  emphasized,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  const { copy, copied } = useCopyToClipboard();
  const memo = isMemoField(label);
  const highlight = memo || emphasized === true;

  return (
    <div
      className="daimo-flex daimo-items-center daimo-justify-between daimo-gap-3 daimo-rounded-[var(--daimo-radius-md)] daimo-px-4 daimo-py-3"
      style={{
        backgroundColor: memo
          ? "var(--daimo-warning-light, var(--daimo-surface-secondary))"
          : "var(--daimo-surface-secondary)",
        border: highlight ? "1px solid var(--daimo-warning, #f59e0b)" : "none",
      }}
    >
      <div className="daimo-flex daimo-flex-col daimo-min-w-0 daimo-flex-1">
        <span className="daimo-text-xs daimo-text-[var(--daimo-text-muted)]">
          {label}
        </span>
        <span
          className={`daimo-text-sm daimo-break-all ${highlight ? "daimo-font-semibold" : ""}`}
          style={{ color: "var(--daimo-text)" }}
        >
          {value}
        </span>
        {memo && (
          <span
            className="daimo-text-xs daimo-mt-1"
            style={{ color: "var(--daimo-warning, #f59e0b)" }}
          >
            {t.accountBankDetailsMemoWarning}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => copy(value)}
        className="daimo-shrink-0 daimo-p-1.5 daimo-rounded-[var(--daimo-radius-sm)] hover:daimo-bg-[var(--daimo-surface-hover)] daimo-transition-colors"
        aria-label={copied ? t.accountBankDetailsCopied : `Copy ${label}`}
      >
        <CopyIcon size={16} copied={copied} />
      </button>
    </div>
  );
}

function getLocalizedStep(step: DepositPaymentStep, locale: string) {
  if (locale === "ja" && step.translations?.ja) return step.translations.ja;
  return { title: step.title, description: step.description };
}

function getLocalizedStepWarning(step: DepositPaymentStep, locale: string) {
  if (!step.warning) return null;
  if (locale === "ja" && step.warning.translations?.ja) {
    return step.warning.translations.ja;
  }
  return {
    title: step.warning.title,
    description: step.warning.description,
  };
}

function isTransferInstructionFlow(
  payment: DepositPaymentInfo,
): payment is Extract<
  DepositPaymentInfo,
  { flow: "bank-transfer" | "directions" }
> {
  return payment.flow === "bank-transfer" || payment.flow === "directions";
}
