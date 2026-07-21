import type { DepositPaymentInteraction } from "../../../common/account.js";
import { useDaimoClient } from "../../hooks/DaimoClientContext.js";
import { t } from "../../hooks/locale.js";
import { useSessionDepositState } from "../../hooks/useAccountFlow.js";
import { useDepositPoller } from "../../hooks/useDepositPoller.js";
import { isDesktop, type DaimoPlatform } from "../../platform.js";
import { PrimaryButton } from "../buttons.js";
import { ErrorPage } from "../ErrorPage.js";
import { ExternalLinkIcon } from "../icons.js";
import { QRCode } from "../QRCode.js";
import { CenteredContent, PageHeader, resolveIconUrl } from "../shared.js";
import { openDeeplink } from "./openDeeplink.js";
import { isPaymentInteractionCompatible } from "./accountNav.js";
import { getInstitutionPaymentContract } from "./accountPaymentCompatibility.js";

type AccountDeeplinkPageProps = {
  sessionId: string;
  paymentInteraction: DepositPaymentInteraction;
  clientSecret: string;
  baseUrl: string;
  platform: DaimoPlatform;
  icon?: string;
  onBack: () => void;
  onAdvance: () => void;
};

/** Waiting screen — bank was already opened. Polls deposit status. */
export function AccountDeeplinkPage({
  sessionId,
  paymentInteraction,
  clientSecret,
  baseUrl,
  platform,
  icon,
  onBack,
  onAdvance,
}: AccountDeeplinkPageProps) {
  const client = useDaimoClient();
  const { depositState } = useSessionDepositState(sessionId);
  const started = depositState?.kind === "started" ? depositState : null;
  const payment =
    started?.payment.flow === "bank-picker" &&
    isPaymentInteractionCompatible(paymentInteraction, started.payment)
      ? started.payment
      : null;
  const bankUrl = payment?.qrUrl;
  const desktop = isDesktop(platform);

  // Find the selected institution's deeplink for the "Open" button
  const selectedInstitution = payment?.institutions.find(
    (inst) => inst.id === started?.selectedInstitutionId,
  );
  const paymentContract =
    payment && started
      ? getInstitutionPaymentContract(payment, started.depositAmount)
      : null;
  const contractMismatch = started != null && payment == null;

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

  if (contractMismatch) {
    return (
      <ErrorPage
        message={t.errorDepositFailed}
        retryText={t.back}
        onRetry={onBack}
      />
    );
  }

  const fallbackDeeplink = paymentContract?.fallbackDeeplink;

  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader
        title={paymentContract?.ui.waiting.title ?? t.accountBankTransfer}
        onBack={onBack}
      />
      <CenteredContent>
        <div className="daimo-flex daimo-flex-col daimo-items-center daimo-gap-4">
          {desktop && bankUrl && (
            <div className="daimo-w-full daimo-max-w-[200px]">
              <QRCode
                value={bankUrl}
                image={
                  icon ? (
                    <img
                      src={resolveIconUrl(icon, baseUrl)}
                      alt=""
                      className="daimo-w-full daimo-h-full daimo-object-contain"
                    />
                  ) : undefined
                }
              />
            </div>
          )}
          <p className="daimo-text-sm daimo-text-[var(--daimo-text-secondary)] daimo-text-center daimo-max-w-xs">
            {paymentContract?.ui.waiting.instructions ?? payment?.instructions}
          </p>
          {selectedInstitution && (
            <PrimaryButton
              onClick={() =>
                openDeeplink(selectedInstitution.deeplink, platform)
              }
              icon={<ExternalLinkIcon size={14} />}
            >
              {paymentContract?.ui.waiting.openInstitutionLabel ?? t.open}{" "}
              {selectedInstitution.name}
            </PrimaryButton>
          )}
          {!selectedInstitution && !desktop && fallbackDeeplink && (
            <PrimaryButton
              onClick={() =>
                openDeeplink(fallbackDeeplink, platform, {
                  newWindow: true,
                })
              }
              icon={<ExternalLinkIcon size={14} />}
            >
              {paymentContract.ui.waiting.openFallbackLabel}
            </PrimaryButton>
          )}
        </div>
      </CenteredContent>
    </div>
  );
}
