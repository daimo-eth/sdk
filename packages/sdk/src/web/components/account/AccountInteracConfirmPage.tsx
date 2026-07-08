import { t } from "../../hooks/locale.js";
import { useSessionDepositState } from "../../hooks/useAccountFlow.js";
import { isDesktop, type DaimoPlatform } from "../../platform.js";
import { PrimaryButton } from "../buttons.js";
import { ErrorPage } from "../ErrorPage.js";
import { ExternalLinkIcon } from "../icons.js";
import { QRCode } from "../QRCode.js";
import { CenteredContent, PageHeader, resolveIconUrl } from "../shared.js";
import { openDeeplink } from "./openDeeplink.js";

type AccountInteracConfirmPageProps = {
  sessionId: string;
  baseUrl: string;
  platform: DaimoPlatform;
  icon?: string;
  onBack: () => void;
  onAdvance: () => void;
};

export function AccountInteracConfirmPage({
  sessionId,
  baseUrl,
  platform,
  icon,
  onBack,
  onAdvance,
}: AccountInteracConfirmPageProps) {
  const { depositState } = useSessionDepositState(sessionId);
  const started = depositState?.kind === "started" ? depositState : null;
  const payment =
    started?.payment.flow === "bank-picker" ? started.payment : null;
  const bankUrl = payment?.qrUrl ?? null;
  const selectedInstitution = payment?.institutions.find(
    (inst) => inst.id === started?.selectedInstitutionId,
  );
  const requestReference = getInteracRequestReference(bankUrl);
  const amount =
    payment && started
      ? `${payment.currency.symbol}${started.depositAmount} ${payment.currency.code}`
      : null;
  const desktop = isDesktop(platform);

  if (!started || !payment || !bankUrl) {
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
    } else {
      openDeeplink({ type: "redirect", url: bankUrl }, platform, {
        newWindow: true,
      });
    }
    onAdvance();
  };

  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title={t.accountInteracConfirmTitle} onBack={onBack} />
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
            {t.accountInteracConfirmDesc}
          </p>

          <div className="daimo-w-full daimo-rounded-[var(--daimo-radius-md)] daimo-bg-[var(--daimo-surface-secondary)] daimo-p-4 daimo-flex daimo-flex-col daimo-gap-3">
            {amount && (
              <ConfirmRow label={t.accountInteracConfirmAmount} value={amount} />
            )}
            <ConfirmRow
              label={t.accountInteracConfirmSender}
              value="PayTrie AB Inc"
            />
            {requestReference && (
              <ConfirmRow
                label={t.accountInteracConfirmReference}
                value={requestReference}
              />
            )}
            {selectedInstitution && (
              <ConfirmRow
                label={t.accountInteracConfirmBank}
                value={selectedInstitution.name}
              />
            )}
          </div>

          <PrimaryButton
            onClick={openPayment}
            icon={<ExternalLinkIcon size={14} />}
          >
            {selectedInstitution
              ? `${t.open} ${selectedInstitution.name}`
              : t.accountInteracConfirmOpenInterac}
          </PrimaryButton>
        </div>
      </CenteredContent>
    </div>
  );
}

export function getInteracRequestReference(qrUrl: string | null): string | null {
  if (!qrUrl) return null;
  try {
    const url = new URL(qrUrl, "https://interac.invalid");
    const reference = url.searchParams.get("rID");
    return reference && reference.length > 0 ? reference : null;
  } catch {
    return null;
  }
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
