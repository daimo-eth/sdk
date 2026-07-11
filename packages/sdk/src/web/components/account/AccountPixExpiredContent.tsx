import { SecondaryButton } from "../buttons.js";
import { ExpiredIcon } from "../icons.js";
import { t } from "../../hooks/locale.js";
import { ContactSupportButton } from "../shared.js";

type AccountPixExpiredContentProps = {
  sessionId: string;
  onRetry: () => void | Promise<void>;
  isRetrying?: boolean;
};

/** Expired PIX ticket recovery: message, retry, and support. */
export function AccountPixExpiredContent({
  sessionId,
  onRetry,
  isRetrying = false,
}: AccountPixExpiredContentProps) {
  return (
    <div className="daimo-flex daimo-flex-col daimo-items-center daimo-gap-6">
      <div
        className="daimo-w-20 daimo-h-20 daimo-rounded-full daimo-flex daimo-items-center daimo-justify-center"
        style={{ backgroundColor: "var(--daimo-error-light)" }}
      >
        <ExpiredIcon />
      </div>
      <p className="daimo-text-center daimo-text-sm daimo-leading-relaxed daimo-text-[var(--daimo-text-secondary)]">
        {t.accountPixExpired}
      </p>
      <SecondaryButton onClick={onRetry} disabled={isRetrying}>
        {t.tryAgain}
      </SecondaryButton>
      <ContactSupportButton
        subject="Expired PIX code"
        info={{ sessionId }}
      />
    </div>
  );
}
