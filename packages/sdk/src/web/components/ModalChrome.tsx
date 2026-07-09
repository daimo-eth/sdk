import {
  type MouseEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

import type { NavLocation, NavLocationOption } from "../api/index.js";
import { t } from "../hooks/locale.js";
import { CloseIcon, PersonIcon } from "./icons.js";

type AccountControl = { email: string; badgeEmoji?: string };
type CloseControl = { onClose: () => void };
type CountryControl = {
  location: NavLocation;
  options: NavLocationOption[];
  loadingCountryCode: string | null;
  onSelect: (countryCode: string) => Promise<void>;
};

export type ModalChromeControls =
  | { type: "account"; account: AccountControl }
  | { type: "account-close"; account: AccountControl; close: CloseControl }
  | { type: "close"; close: CloseControl }
  | { type: "none" };

type ModalChromeProps = {
  controls: ModalChromeControls;
  country?: CountryControl | null;
  account?: AccountControl | null;
  children: (dismissChrome: (() => void) | null) => ReactNode;
};

export function ModalChrome({
  controls,
  country,
  account,
  children,
}: ModalChromeProps) {
  const countryAccount = country ? account : null;
  const accountButton = (account: AccountControl) => (
    <AccountButton account={account} />
  );
  const closeButton = (close: CloseControl) => (
    <ChromeIconButton label={t.close} onClick={close.onClose}>
      <CloseIcon />
    </ChromeIconButton>
  );

  let actions: ReactNode = null;

  switch (controls.type) {
    case "none":
      break;
    case "account":
      actions = countryAccount ? null : accountButton(controls.account);
      break;
    case "close":
      actions = closeButton(controls.close);
      break;
    case "account-close":
      actions = (
        <>
          {countryAccount ? null : accountButton(controls.account)}
          {closeButton(controls.close)}
        </>
      );
      break;
    default:
      assertNever(controls);
  }

  return (
    <>
      {country && (
        <CountryPicker
          location={country.location}
          options={country.options}
          loadingCountryCode={country.loadingCountryCode}
          onSelect={country.onSelect}
          account={countryAccount}
        />
      )}
      {actions && (
        <div className="daimo-absolute daimo-right-[24px] daimo-top-[22px] daimo-z-20 daimo-flex daimo-h-8 daimo-items-center daimo-gap-2">
          {actions}
        </div>
      )}
      {children(null)}
    </>
  );
}

function CountryPicker({
  location,
  options,
  loadingCountryCode,
  onSelect,
  account,
}: CountryControl & { account?: AccountControl | null }) {
  const [open, setOpen] = useState(false);
  const [accountActive, setAccountActive] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const closeOnPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  // Optimistically show the tapped country while its nav loads.
  const displayed =
    options.find((o) => o.countryCode === loadingCountryCode) ?? location;

  return (
    <div
      ref={rootRef}
      className="daimo-pointer-events-none daimo-absolute daimo-inset-x-6 daimo-top-[22px] daimo-z-30"
    >
      {account && (accountActive || open) && (
        <div
          aria-hidden="true"
          className="daimo-pointer-events-none daimo-absolute daimo-left-1/2 -daimo-top-[22px] daimo-z-0 daimo-h-[76px] daimo-w-[320px] -daimo-translate-x-1/2 daimo-bg-[var(--daimo-surface)]"
        />
      )}
      {account ? (
        <AccountCountryButton
          account={account}
          countryName={displayed.countryName}
          emoji={displayed.emoji}
          expanded={open}
          onActiveChange={setAccountActive}
          onClick={() => setOpen((value) => !value)}
        />
      ) : (
        <ChromeIconButton
          label={`${t.changeCountry}: ${displayed.countryName}`}
          title={displayed.countryName}
          expanded={open}
          haspopup="menu"
          className="daimo-pointer-events-auto daimo-bg-[var(--daimo-surface)] daimo-text-[22px] daimo-leading-none hover:[@media(hover:hover)]:daimo-bg-[var(--daimo-surface-hover)] focus-visible:daimo-bg-[var(--daimo-surface-hover)] focus-visible:daimo-outline-none focus-visible:daimo-ring-2 focus-visible:daimo-ring-[var(--daimo-accent)]"
          onClick={() => setOpen((value) => !value)}
        >
          <span aria-hidden="true">{displayed.emoji}</span>
        </ChromeIconButton>
      )}

      {open && (
        <div
          role="menu"
          className="daimo-pointer-events-auto daimo-absolute daimo-inset-x-0 daimo-top-10 daimo-z-20 daimo-grid daimo-grid-cols-5 daimo-gap-2 daimo-rounded-[var(--daimo-radius-lg)] daimo-bg-[var(--daimo-surface)] daimo-p-3 daimo-shadow-lg daimo-ring-1 daimo-ring-black/10 sm:daimo-grid-cols-6"
          onClick={(event) => event.stopPropagation()}
        >
          {options.map((option) => {
            const selected = option.countryCode === location.countryCode;
            const loading = option.countryCode === loadingCountryCode;
            return (
              <button
                key={option.countryCode}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                aria-label={option.countryName}
                title={option.countryName}
                disabled={loadingCountryCode != null}
                onClick={() => {
                  // Close immediately; the modal body shows a skeleton while
                  // the localized nav loads.
                  setOpen(false);
                  void onSelect(option.countryCode);
                }}
                className={`daimo-flex daimo-aspect-square daimo-w-full daimo-touch-action-manipulation daimo-items-center daimo-justify-center daimo-rounded-[var(--daimo-radius-md)] daimo-text-[24px] daimo-leading-none daimo-transition-[background-color,opacity,transform] daimo-duration-100 daimo-ease hover:[@media(hover:hover)]:daimo-bg-[var(--daimo-surface-secondary)] focus-visible:daimo-outline-none focus-visible:daimo-ring-2 focus-visible:daimo-ring-[var(--daimo-accent)] disabled:daimo-cursor-wait disabled:daimo-opacity-60 ${
                  selected ? "daimo-bg-[var(--daimo-brand-green-light)]" : ""
                } ${loading ? "daimo-scale-95" : ""}`}
              >
                <span aria-hidden="true">{option.emoji}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AccountCountryButton({
  account,
  countryName,
  emoji,
  expanded,
  onActiveChange,
  onClick,
}: {
  account: AccountControl;
  countryName: string;
  emoji: string;
  expanded: boolean;
  onActiveChange: (active: boolean) => void;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick(event);
      }}
      onPointerEnter={() => onActiveChange(true)}
      onPointerLeave={() => onActiveChange(false)}
      onFocus={() => onActiveChange(true)}
      onBlur={() => onActiveChange(false)}
      className="daimo-account-country-chip daimo-pointer-events-auto daimo-relative daimo-z-10 daimo-flex daimo-h-8 daimo-max-w-8 daimo-items-center daimo-overflow-visible daimo-rounded-full daimo-bg-[var(--daimo-surface)] daimo-text-[var(--daimo-text)] hover:[@media(hover:hover)]:daimo-bg-[var(--daimo-surface-hover)] daimo-transition-[background-color] daimo-duration-100 daimo-ease daimo-touch-action-manipulation daimo-outline-none focus-visible:daimo-bg-[var(--daimo-surface-hover)] focus-visible:daimo-ring-2 focus-visible:daimo-ring-[var(--daimo-accent)]"
      aria-label={`Account: ${account.email}. ${t.changeCountry}: ${countryName}`}
      aria-expanded={expanded}
      aria-haspopup="menu"
    >
      <span className="daimo-relative daimo-flex daimo-h-8 daimo-w-8 daimo-shrink-0 daimo-items-center daimo-justify-center">
        <PersonIcon size={22} />
        <span className="daimo-absolute -daimo-right-1 -daimo-bottom-1 daimo-flex daimo-h-[18px] daimo-w-[18px] daimo-items-center daimo-justify-center daimo-rounded-full daimo-bg-[var(--daimo-surface)] daimo-text-[12px] daimo-leading-none daimo-ring-2 daimo-ring-[var(--daimo-surface)]">
          <span aria-hidden="true">{emoji}</span>
        </span>
      </span>
      <span className="daimo-account-country-chip-text daimo-min-w-0 daimo-truncate daimo-pl-3 daimo-pr-4 daimo-text-sm daimo-font-medium">
        {account.email}
      </span>
    </button>
  );
}

function AccountButton({ account }: { account: AccountControl }) {
  return (
    <div
      className="daimo-relative daimo-flex daimo-h-8 daimo-w-8 daimo-shrink-0 daimo-items-center daimo-justify-center"
      role="img"
      aria-label={`Account: ${account.email}`}
      title={account.email}
    >
      <PersonIcon size={22} />
      {account.badgeEmoji && (
        <span className="daimo-absolute -daimo-right-1 -daimo-bottom-1 daimo-flex daimo-h-[18px] daimo-w-[18px] daimo-items-center daimo-justify-center daimo-rounded-full daimo-bg-[var(--daimo-surface)] daimo-text-[12px] daimo-leading-none daimo-shadow-sm daimo-ring-2 daimo-ring-[var(--daimo-surface)]">
          <span aria-hidden="true">{account.badgeEmoji}</span>
        </span>
      )}
    </div>
  );
}

function ChromeIconButton({
  label,
  expanded,
  title,
  haspopup,
  children,
  className = "",
  onClick,
}: {
  label: string;
  expanded?: boolean;
  title?: string;
  haspopup?: "menu";
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
      aria-haspopup={haspopup}
      title={title}
    >
      {children}
    </button>
  );
}

function assertNever(value: never): never {
  throw new Error(`unknown modal chrome control: ${JSON.stringify(value)}`);
}
