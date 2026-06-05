import {
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";

import { t } from "../hooks/locale.js";
import { useCopyToClipboard } from "../hooks/useCopyToClipboard.js";
import {
  CloseIcon,
  CopyIcon,
  EllipsisIcon,
  EmailIcon,
  LogoutIcon,
} from "./icons.js";

type AccountControl = { email: string; onLogout: () => Promise<void> };
type CloseControl = { onClose: () => void };

export type ModalChromeControls =
  | { type: "account"; account: AccountControl }
  | { type: "account-close"; account: AccountControl; close: CloseControl }
  | { type: "close"; close: CloseControl }
  | { type: "none" };

type ModalChromeProps = {
  controls: ModalChromeControls;
  children: (dismissAccount: (() => void) | null) => ReactNode;
};

export function ModalChrome({ controls, children }: ModalChromeProps) {
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    if (controls.type === "none" || controls.type === "close") {
      setAccountOpen(false);
    }
  }, [controls.type]);

  const dismissAccount = useCallback(() => setAccountOpen(false), []);
  const accountButton = () => (
    <ChromeIconButton
      label="Account"
      expanded={accountOpen}
      onClick={() => setAccountOpen(true)}
    >
      <EllipsisIcon />
    </ChromeIconButton>
  );
  const closeButton = (close: CloseControl) => (
    <ChromeIconButton label={t.close} onClick={close.onClose}>
      <CloseIcon />
    </ChromeIconButton>
  );

  let actions: ReactNode = null;
  let banner: ReactNode = null;
  let hasAccount = false;

  switch (controls.type) {
    case "none":
      break;
    case "account":
      hasAccount = true;
      actions = accountButton();
      banner = (
        <AccountBanner
          account={controls.account}
          open={accountOpen}
          onDismiss={dismissAccount}
        />
      );
      break;
    case "close":
      actions = closeButton(controls.close);
      break;
    case "account-close":
      hasAccount = true;
      actions = (
        <>
          {accountButton()}
          {closeButton(controls.close)}
        </>
      );
      banner = (
        <AccountBanner
          account={controls.account}
          open={accountOpen}
          onDismiss={dismissAccount}
        />
      );
      break;
    default:
      assertNever(controls);
  }

  return (
    <>
      {actions && (
        <div className="daimo-absolute daimo-right-[17px] daimo-top-[22px] daimo-z-20 daimo-flex daimo-h-8 daimo-items-center daimo-gap-0">
          {actions}
        </div>
      )}
      {banner}
      {children(hasAccount && accountOpen ? dismissAccount : null)}
    </>
  );
}

function AccountBanner({
  account,
  open,
  onDismiss,
}: {
  account: AccountControl;
  open: boolean;
  onDismiss: () => void;
}) {
  const { copy, copied } = useCopyToClipboard(1200);
  const [emailOpen, setEmailOpen] = useState(false);

  useEffect(() => {
    if (!open) setEmailOpen(false);
  }, [open]);

  const handleCopy = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (!emailOpen) {
        setEmailOpen(true);
        return;
      }
      void copy(account.email);
    },
    [account.email, copy, emailOpen],
  );

  const handleLogout = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      await account.onLogout();
      onDismiss();
    },
    [account, onDismiss],
  );

  return (
    <div
      onClick={onDismiss}
      className={`daimo-account-banner daimo-absolute daimo-inset-x-0 daimo-top-0 daimo-z-30 daimo-h-[76px] daimo-bg-[var(--daimo-surface)] ${
        open
          ? "daimo-translate-y-0 daimo-opacity-100 daimo-pointer-events-auto"
          : "-daimo-translate-y-full daimo-opacity-0 daimo-pointer-events-none"
      }`}
    >
      <button
        type="button"
        onClick={handleCopy}
        className={`daimo-account-email-chip daimo-absolute daimo-left-[17px] daimo-top-[22px] daimo-flex daimo-h-8 daimo-items-center daimo-overflow-hidden daimo-rounded-full daimo-bg-transparent daimo-text-[var(--daimo-text)] hover:[@media(hover:hover)]:daimo-bg-[var(--daimo-surface-secondary)] daimo-touch-action-manipulation daimo-outline-none focus-visible:daimo-bg-[var(--daimo-surface-secondary)] focus-visible:daimo-ring-2 focus-visible:daimo-ring-[var(--daimo-accent)] focus-visible:daimo-ring-offset-2 focus-visible:daimo-ring-offset-[var(--daimo-surface)] ${
          emailOpen ? "daimo-account-email-chip-open" : ""
        }`}
        aria-label={copied ? "Copied email" : "Copy account email"}
        aria-expanded={emailOpen}
        title={account.email}
      >
        <span className="daimo-flex daimo-h-8 daimo-w-8 daimo-shrink-0 daimo-items-center daimo-justify-center">
          <EmailIcon size={22} />
        </span>
        <span className="daimo-account-email-chip-text daimo-min-w-0 daimo-truncate daimo-pr-2 daimo-text-sm daimo-font-medium">
          {account.email}
        </span>
        <span className="daimo-account-email-chip-copy daimo-flex daimo-shrink-0 daimo-items-center daimo-pr-3 daimo-text-[var(--daimo-text-muted)]">
          <CopyIcon size={14} copied={copied} />
        </span>
      </button>
      <ChromeIconButton
        label="Log out"
        className="daimo-absolute daimo-right-[17px] daimo-top-[22px] daimo-z-10 daimo-bg-transparent hover:[@media(hover:hover)]:daimo-bg-[var(--daimo-surface-secondary)]"
        onClick={handleLogout}
      >
        <LogoutIcon size={22} />
      </ChromeIconButton>
    </div>
  );
}

function ChromeIconButton({
  label,
  expanded,
  children,
  className = "",
  onClick,
}: {
  label: string;
  expanded?: boolean;
  children: ReactNode;
  className?: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick(event);
      }}
      className={`daimo-flex daimo-h-8 daimo-w-8 daimo-shrink-0 daimo-items-center daimo-justify-center daimo-rounded-full daimo-bg-[var(--daimo-surface)] daimo-text-[var(--daimo-text-muted)] hover:[@media(hover:hover)]:daimo-bg-[var(--daimo-surface-secondary)] active:daimo-scale-[0.9] daimo-transition-[background-color,transform] daimo-[transition-duration:200ms,100ms] daimo-ease daimo-touch-action-manipulation ${className}`}
      aria-label={label}
      aria-expanded={expanded}
    >
      {children}
    </button>
  );
}

function assertNever(value: never): never {
  throw new Error(`unknown modal chrome control: ${JSON.stringify(value)}`);
}
