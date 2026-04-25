import { useEffect, useState } from "react";
import type { AccountRail } from "../../../common/account.js";
import { useDaimoClient } from "../../hooks/DaimoClientContext.js";
import { t } from "../../hooks/locale.js";
import {
  useAccountFlow,
  useSessionDepositState,
} from "../../hooks/useAccountFlow.js";
import { useCopyToClipboard } from "../../hooks/useCopyToClipboard.js";
import { useDepositPoller } from "../../hooks/useDepositPoller.js";
import { useDraftDeposit } from "../../hooks/useDraftDeposit.js";
import { PrimaryButton } from "../buttons.js";
import { ErrorPage } from "../ErrorPage.js";
import { CopyIcon } from "../icons.js";
import { ProgressPulse } from "../ProgressPulse.js";
import { PageHeader, ScrollContent } from "../shared.js";

type AccountBankDetailsPageProps = {
  rail: AccountRail;
  sessionId: string;
  clientSecret: string;
  onBack?: (() => void) | null;
  onAdvance: () => void;
};

/** Parsed line from the instructions string. */
type InstructionField = { label: string; value: string };

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

/**
 * Bank-transfer details page — shows formatted transfer instructions with copy
 * buttons. Used when the provider returns direct transfer instructions instead
 * of selectable institutions. Polls deposit status and auto-advances.
 */
export function AccountBankDetailsPage({
  rail,
  sessionId,
  clientSecret,
  onBack,
  onAdvance,
}: AccountBankDetailsPageProps) {
  const client = useDaimoClient();
  const accountFlow = useAccountFlow();
  const { depositState, setDepositState } = useSessionDepositState(sessionId);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const depositAmount = depositState?.depositAmount ?? "";
  const currentDepositId =
    depositState?.depositAmount === depositAmount
    && (depositState.kind === "drafted" || depositState.kind === "started")
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
  const startedPayment =
    depositState?.kind === "started" && depositState.payment.flow === "bank-transfer"
      ? depositState.payment
      : null;
  const payment =
    startedPayment
    ?? (draftedPayment?.flow === "bank-transfer" ? draftedPayment : null);
  const instructions = payment?.instructions ?? "";
  const fields =
    payment?.flow === "bank-transfer"
      ? payment.fields.map((field) => ({
          label: field.label,
          value: field.value,
        }))
      : parseInstructions(instructions);

  useEffect(() => {
    if (instructions) return;
    console.warn("[account-deposit] entered bank details page without drafted deposit", {
      rail,
      sessionId,
      depositStateKind: depositState?.kind ?? null,
    });
  }, [depositState?.kind, instructions, rail, sessionId]);

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

  async function handleSubmitted() {
    if (!accountFlow || !payment || !depositAmount || !currentDepositId) {
      setSubmitError("deposit is not ready");
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);
    try {
      setDepositState({
        depositAmount,
        kind: "started",
        depositId: currentDepositId,
        payment,
      });
      onAdvance();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "failed to update deposit",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const error = submitError ?? draftError;
  if (error) {
    return (
      <ErrorPage
        message={error}
        retryText={t.tryAgain}
        onRetry={() => {
          setSubmitError(null);
          retryDraft();
        }}
      />
    );
  }

  if (!instructions) {
    return (
      <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
        <PageHeader title={t.accountBankDetails} onBack={onBack} />
        <div className="daimo-flex-1 daimo-flex daimo-items-center daimo-justify-center">
          <ProgressPulse label={isCreating ? t.loading : t.loading} />
        </div>
      </div>
    );
  }

  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title={t.accountBankDetails} onBack={onBack} />
      <ScrollContent>
        <div className="daimo-flex daimo-flex-col daimo-gap-2 daimo-px-6 daimo-pt-4 daimo-pb-12">
          {fields.map((field, i) =>
            field.label ? (
              <FieldRow key={i} label={field.label} value={field.value} />
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
      </ScrollContent>

      <div className="daimo-mt-3 daimo-px-6 daimo-pt-2 daimo-pb-6 daimo-flex daimo-justify-center">
        <PrimaryButton onClick={handleSubmitted} disabled={isSubmitting}>
          {isSubmitting ? t.loading : "I've sent the funds"}
        </PrimaryButton>
      </div>
    </div>
  );
}

/** A single labeled field with a copy button. Memo fields are highlighted. */
function FieldRow({ label, value }: { label: string; value: string }) {
  const { copy, copied } = useCopyToClipboard();
  const memo = isMemoField(label);

  return (
    <div
      className="daimo-flex daimo-items-center daimo-justify-between daimo-gap-3 daimo-rounded-[var(--daimo-radius-md)] daimo-px-4 daimo-py-3"
      style={{
        backgroundColor: memo
          ? "var(--daimo-warning-light, var(--daimo-surface-secondary))"
          : "var(--daimo-surface-secondary)",
        border: memo ? "1px solid var(--daimo-warning, #f59e0b)" : "none",
      }}
    >
      <div className="daimo-flex daimo-flex-col daimo-min-w-0 daimo-flex-1">
        <span className="daimo-text-xs daimo-text-[var(--daimo-text-muted)]">
          {label}
        </span>
        <span
          className={`daimo-text-sm daimo-break-all ${memo ? "daimo-font-semibold" : ""}`}
          style={{ color: "var(--daimo-text)" }}
        >
          {value}
        </span>
        {memo && (
          <span className="daimo-text-xs daimo-mt-1" style={{ color: "var(--daimo-warning, #f59e0b)" }}>
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
