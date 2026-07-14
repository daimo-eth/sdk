import { t } from "../../hooks/locale.js";
import { SecondaryButton } from "../buttons.js";
import { ExpiredIcon } from "../icons.js";
import { ContactSupportButton } from "../shared.js";

type AccountRequestToPayExpiredContentProps = {
  sessionId: string;
  message: string;
  supportSubject: string;
  onRetry: () => void | Promise<void>;
  isRetrying?: boolean;
};

/** Recovery UI for an expired one-time payment request. */
export function AccountRequestToPayExpiredContent({
  sessionId,
  message,
  supportSubject,
  onRetry,
  isRetrying = false,
}: AccountRequestToPayExpiredContentProps) {
  return (
    <div className="daimo-flex daimo-flex-col daimo-items-center daimo-gap-6">
      <div
        className="daimo-w-20 daimo-h-20 daimo-rounded-full daimo-flex daimo-items-center daimo-justify-center"
        style={{ backgroundColor: "var(--daimo-error-light)" }}
      >
        <ExpiredIcon />
      </div>
      <p className="daimo-text-center daimo-text-sm daimo-leading-relaxed daimo-text-[var(--daimo-text-secondary)]">
        {message}
      </p>
      <SecondaryButton onClick={onRetry} disabled={isRetrying}>
        {t.tryAgain}
      </SecondaryButton>
      <ContactSupportButton
        subject={supportSubject}
        info={{ sessionId }}
      />
    </div>
  );
}
