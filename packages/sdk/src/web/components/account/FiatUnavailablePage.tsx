import { t } from "../../hooks/locale.js";
import { SecondaryButton } from "../buttons.js";
import { CenteredContent, PageHeader } from "../shared.js";

/** A rail outage is independent of the user's account verification. */
export function FiatUnavailablePage({ onBack }: { onBack?: () => void }) {
  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title={t.fiatUnavailableTitle} onBack={onBack} />
      <CenteredContent>
        <p
          role="status"
          className="daimo-text-sm daimo-text-center daimo-text-[var(--daimo-text-secondary)] daimo-max-w-xs daimo-px-6"
        >
          {t.fiatUnavailableMessage}
        </p>
        {onBack && (
          <SecondaryButton onClick={onBack}>
            {t.fiatUnavailableBack}
          </SecondaryButton>
        )}
      </CenteredContent>
    </div>
  );
}
