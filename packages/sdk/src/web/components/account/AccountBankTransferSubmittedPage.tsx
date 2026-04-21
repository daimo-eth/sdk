import { useDaimoClient } from "../../hooks/DaimoClientContext.js";
import { t } from "../../hooks/locale.js";
import { useDepositPoller } from "../../hooks/useDepositPoller.js";
import { ConfirmationSpinner } from "../ConfirmationSpinner.js";
import { CenteredContent, PageHeader } from "../shared.js";

type AccountBankTransferSubmittedPageProps = {
  sessionId: string;
  clientSecret: string;
  baseUrl: string;
  onAdvance: () => void;
};

/**
 * Async handoff page after the user says they sent the bank transfer. We keep
 * polling in case the provider webhook arrives while the modal is still open.
 */
export function AccountBankTransferSubmittedPage({
  sessionId,
  clientSecret,
  baseUrl,
  onAdvance,
}: AccountBankTransferSubmittedPageProps) {
  const client = useDaimoClient();
  const accountUrl = `${baseUrl}/account?session=${sessionId}`;

  useDepositPoller({
    client,
    sessionId,
    clientSecret,
    onUpdate(deposit) {
      if (
        deposit.status !== "initiated"
        && deposit.status !== "awaiting_payment"
      ) {
        onAdvance();
      }
    },
  });

  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title={t.accountBankTransferSubmittedTitle} />
      <CenteredContent>
        <div className="daimo-flex daimo-flex-col daimo-items-center daimo-gap-5">
          <ConfirmationSpinner done />
          <p className="daimo-max-w-xs daimo-text-center daimo-text-sm daimo-leading-relaxed daimo-text-[var(--daimo-text-secondary)]">
            {t.accountBankTransferSubmittedDesc}
          </p>
          <a
            href={accountUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="daimo-w-full daimo-max-w-xs daimo-min-h-[44px] daimo-py-4 daimo-px-6 daimo-rounded-[var(--daimo-radius-lg)] daimo-font-medium daimo-bg-[var(--daimo-surface-secondary)] daimo-text-[var(--daimo-text)] hover:[@media(hover:hover)]:daimo-bg-[var(--daimo-surface-hover)] daimo-touch-action-manipulation daimo-transition-[background-color] daimo-duration-100 daimo-ease daimo-text-center daimo-flex daimo-items-center daimo-justify-center"
          >
            {t.accountViewAccount}
          </a>
        </div>
      </CenteredContent>
    </div>
  );
}
