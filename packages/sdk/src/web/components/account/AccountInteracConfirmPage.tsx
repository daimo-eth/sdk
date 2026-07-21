import type { DepositPaymentInteraction } from "../../../common/account.js";
import { t } from "../../hooks/locale.js";
import { useSessionDepositState } from "../../hooks/useAccountFlow.js";
import { isDesktop, type DaimoPlatform } from "../../platform.js";
import { PrimaryButton } from "../buttons.js";
import { ErrorPage } from "../ErrorPage.js";
import { ExternalLinkIcon } from "../icons.js";
import { QRCode } from "../QRCode.js";
import { CenteredContent, PageHeader, resolveIconUrl } from "../shared.js";
import { openDeeplink } from "./openDeeplink.js";
import { isPaymentInteractionCompatible } from "./accountNav.js";
import { getInstitutionPaymentContract } from "./accountPaymentCompatibility.js";

type AccountInstitutionReviewPageProps = {
  sessionId: string;
  paymentInteraction: DepositPaymentInteraction;
  baseUrl: string;
  platform: DaimoPlatform;
  icon?: string;
  onBack: () => void;
  onAdvance: () => void;
};

export function AccountInstitutionReviewPage({
  sessionId,
  paymentInteraction,
  baseUrl,
  platform,
  icon,
  onBack,
  onAdvance,
}: AccountInstitutionReviewPageProps) {
  const { depositState } = useSessionDepositState(sessionId);
  const started = depositState?.kind === "started" ? depositState : null;
  const payment =
    started?.payment.flow === "bank-picker" &&
    isPaymentInteractionCompatible(paymentInteraction, started.payment)
      ? started.payment
      : null;
  const bankUrl = payment?.qrUrl ?? null;
  const selectedInstitution = payment?.institutions.find(
    (inst) => inst.id === started?.selectedInstitutionId,
  );
  const paymentContract =
    payment && started
      ? getInstitutionPaymentContract(payment, started.depositAmount)
      : null;
  const desktop = isDesktop(platform);

  if (!started || !payment || !paymentContract || !bankUrl) {
    return (
      <ErrorPage
        message={t.errorDepositFailed}
        retryText={t.back}
        onRetry={onBack}
      />
    );
  }

  const openPayment = () => {
    if (selectedInstitution) {
      openDeeplink(selectedInstitution.deeplink, platform);
    } else if (paymentContract.fallbackDeeplink) {
      openDeeplink(paymentContract.fallbackDeeplink, platform, {
        newWindow: true,
      });
    }
    onAdvance();
  };

  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title={paymentContract.ui.review.title} onBack={onBack} />
      <CenteredContent>
        <div className="daimo-flex daimo-flex-col daimo-items-center daimo-gap-5 daimo-w-full daimo-max-w-xs">
          {desktop && !selectedInstitution && (
            <div className="daimo-w-full daimo-max-w-[180px]">
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

          <p className="daimo-text-sm daimo-text-[var(--daimo-text-secondary)] daimo-text-center daimo-leading-5">
            {paymentContract.ui.review.description}
          </p>

          <div className="daimo-w-full daimo-rounded-[var(--daimo-radius-md)] daimo-bg-[var(--daimo-surface-secondary)] daimo-p-4 daimo-flex daimo-flex-col daimo-gap-3">
            {paymentContract.ui.review.fields.map((field) => (
              <ConfirmRow
                key={field.key}
                label={field.label}
                value={field.value}
              />
            ))}
            {selectedInstitution && (
              <ConfirmRow
                label={paymentContract.ui.review.institutionLabel}
                value={selectedInstitution.name}
              />
            )}
            {paymentContract.ui.review.fieldsAfterInstitution?.map((field) => (
              <ConfirmRow
                key={field.key}
                label={field.label}
                value={field.value}
              />
            ))}
          </div>

          <PrimaryButton
            onClick={openPayment}
            icon={<ExternalLinkIcon size={14} />}
          >
            {selectedInstitution
              ? `${paymentContract.ui.review.openInstitutionLabel} ${selectedInstitution.name}`
              : paymentContract.ui.review.openFallbackLabel}
          </PrimaryButton>
        </div>
      </CenteredContent>
    </div>
  );
}

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="daimo-flex daimo-items-start daimo-justify-between daimo-gap-3">
      <span className="daimo-shrink-0 daimo-text-xs daimo-text-[var(--daimo-text-muted)] daimo-leading-5">
        {label}
      </span>
      <span className="daimo-min-w-0 daimo-text-sm daimo-font-medium daimo-text-[var(--daimo-text)] daimo-text-right daimo-leading-5 daimo-break-words">
        {value}
      </span>
    </div>
  );
}
