import {
  type MouseEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  DaimoCountryCode,
  NavLocation,
  NavLocationOption,
} from "../api/index.js";
import { t } from "../hooks/locale.js";
import { CloseIcon } from "./icons.js";

type CloseControl = { onClose: () => void };
type CountryControl = {
  location: NavLocation;
  options: NavLocationOption[];
  loadingCountryCode: DaimoCountryCode | null;
  onSelect: (countryCode: DaimoCountryCode) => Promise<void>;
};

export type ModalChromeControls =
  | { type: "close"; close: CloseControl }
  | { type: "none" };

type ModalChromeProps = {
  controls: ModalChromeControls;
  country?: CountryControl | null;
  children: (dismissAccount: (() => void) | null) => ReactNode;
};

export function ModalChrome({ controls, country, children }: ModalChromeProps) {
  const closeButton = (close: CloseControl) => (
    <ChromeIconButton label={t.close} onClick={close.onClose}>
      <CloseIcon />
    </ChromeIconButton>
  );

  let actions: ReactNode = null;

  switch (controls.type) {
    case "none":
      break;
    case "close":
      actions = closeButton(controls.close);
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
        />
      )}
      {actions && (
        <div className="daimo-absolute daimo-right-[24px] daimo-top-[22px] daimo-z-20 daimo-flex daimo-h-8 daimo-items-center daimo-gap-0">
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
}: CountryControl) {
  const [open, setOpen] = useState(false);
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
      <ChromeIconButton
        label={`${t.changeCountry}: ${displayed.countryName}`}
        title={displayed.countryName}
        expanded={open}
        haspopup="menu"
        className="daimo-pointer-events-auto daimo-text-[22px] daimo-leading-none focus-visible:daimo-outline-none focus-visible:daimo-ring-2 focus-visible:daimo-ring-[var(--daimo-accent)]"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">{displayed.emoji}</span>
      </ChromeIconButton>

      {open && (
        <div
          role="menu"
          className="daimo-pointer-events-auto daimo-absolute daimo-inset-x-0 daimo-top-10 daimo-grid daimo-grid-cols-5 daimo-gap-2 daimo-rounded-[var(--daimo-radius-lg)] daimo-bg-[var(--daimo-surface)] daimo-p-3 daimo-shadow-lg daimo-ring-1 daimo-ring-black/10 sm:daimo-grid-cols-6"
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
