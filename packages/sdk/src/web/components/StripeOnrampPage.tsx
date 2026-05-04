import { useEffect, useRef, useState } from "react";

import type { NavNodeStripe } from "../api/navTree.js";
import { t } from "../hooks/locale.js";
import { PrimaryButton } from "./buttons.js";
import { ErrorPage } from "./ErrorPage.js";
import { SwitchArrowsIcon } from "./icons.js";
import { QRCode } from "./QRCode.js";
import { CenteredContent, PageHeader, resolveIconUrl } from "./shared.js";

type StripeOnrampPageProps = {
  node: NavNodeStripe;
  amountUsd: number;
  onrampSessionClientSecret?: string;
  publishableKey?: string;
  redirectUrl?: string;
  isLoading?: boolean;
  error?: string;
  onBack: () => void;
  onRetry?: () => void;
  baseUrl: string;
};

type StripeOnrampEvent = {
  payload?: {
    session?: {
      status?: string;
    };
  };
};

type StripeOnrampSession = {
  mount: (target: HTMLElement | string) => void;
  addEventListener: (
    type: string,
    listener: (event: StripeOnrampEvent) => void,
  ) => void;
};

type StripeOnramp = {
  createSession: (args: {
    clientSecret: string;
    appearance?: { theme: "light" | "dark" };
  }) => StripeOnrampSession;
};

declare global {
  interface Window {
    StripeOnramp?: (publishableKey: string) => StripeOnramp;
  }
}

let stripeOnrampScriptsPromise: Promise<void> | null = null;
type StripeOnrampTheme = "light" | "dark";

export function StripeOnrampPage({
  node,
  amountUsd,
  onrampSessionClientSecret,
  publishableKey,
  redirectUrl,
  isLoading,
  error,
  onBack,
  onRetry,
  baseUrl,
}: StripeOnrampPageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mountedClientSecretRef = useRef<string | null>(null);
  const [widgetError, setWidgetError] = useState<string | null>(null);
  const [isWidgetLoading, setIsWidgetLoading] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [stripeTheme] = useState<StripeOnrampTheme>(getStripeOnrampTheme);

  useEffect(() => {
    if (
      showQR ||
      !onrampSessionClientSecret ||
      !publishableKey ||
      !containerRef.current
    ) {
      return;
    }
    if (
      mountedClientSecretRef.current === onrampSessionClientSecret &&
      containerRef.current.childElementCount > 0
    ) {
      return;
    }

    mountedClientSecretRef.current = onrampSessionClientSecret;
    setWidgetError(null);
    setIsWidgetLoading(true);
    const container = containerRef.current;
    container.innerHTML = "";

    void (async () => {
      try {
        await loadStripeOnrampScripts();
        const stripeOnramp = window.StripeOnramp?.(publishableKey);
        if (!stripeOnramp) throw new Error("stripe onramp failed to load");

        const session = stripeOnramp.createSession({
          clientSecret: onrampSessionClientSecret,
          appearance: { theme: stripeTheme },
        });
        session.addEventListener("onramp_ui_loaded", () => {
          setIsWidgetLoading(false);
        });
        session.mount(container);
      } catch (err) {
        mountedClientSecretRef.current = null;
        setIsWidgetLoading(false);
        setWidgetError(
          err instanceof Error ? err.message : "failed to load stripe onramp",
        );
      }
    })();

    return () => {
      container.innerHTML = "";
      mountedClientSecretRef.current = null;
    };
  }, [showQR, onrampSessionClientSecret, publishableKey, stripeTheme]);

  const message = error ?? widgetError;
  if (message) {
    return (
      <ErrorPage
        message={message}
        retryText={t.tryAgain}
        onRetry={onRetry ?? (() => window.location.reload())}
      />
    );
  }

  if (showQR) {
    return (
      <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
        <PageHeader title={node.title} onBack={() => setShowQR(false)} />
        <CenteredContent>
          <div className="daimo-w-full daimo-max-w-[200px] sm:daimo-max-w-[260px]">
            <QRCode
              value={redirectUrl}
              image={
                node.icon ? (
                  <img
                    src={resolveIconUrl(node.icon, baseUrl)}
                    alt={node.title}
                    className="daimo-w-full daimo-h-full daimo-object-contain daimo-rounded-[25%]"
                  />
                ) : undefined
              }
            />
          </div>
          {redirectUrl && (
            <p className="daimo-text-[var(--daimo-text-secondary)] daimo-text-center daimo-max-w-xs daimo-text-sm">
              Scan to complete ${amountUsd.toFixed(2)} with Stripe on your
              phone, then return to this page.
            </p>
          )}
          <PrimaryButton
            onClick={() => setShowQR(false)}
            icon={<SwitchArrowsIcon />}
          >
            Desktop
          </PrimaryButton>
        </CenteredContent>
      </div>
    );
  }

  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title={node.title} onBack={onBack} borderVisible />

      <div
        className="daimo-min-h-0 daimo-overflow-y-auto daimo-px-3"
        style={{ maxHeight: "calc(90vh - 104px)" }}
      >
        <div
          className="daimo-relative daimo-overflow-hidden daimo-bg-[var(--daimo-surface)]"
          style={{ height: "594px" }}
        >
          {(isLoading || isWidgetLoading || !onrampSessionClientSecret) && (
            <StripeOnrampSkeleton />
          )}
          <div
            ref={containerRef}
            className="daimo-relative daimo-h-full daimo-w-full"
            style={{
              opacity:
                onrampSessionClientSecret && !isWidgetLoading && !isLoading
                  ? 1
                  : 0,
              transition: "opacity 160ms ease",
            }}
          />
        </div>
        <div className="daimo-sticky daimo-bottom-0 daimo-flex daimo-justify-center daimo-py-3 daimo-bg-[var(--daimo-surface)]">
          <PrimaryButton
            onClick={() => setShowQR(true)}
            disabled={!redirectUrl || isLoading || isWidgetLoading}
            icon={<SwitchArrowsIcon />}
          >
            Mobile
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

function StripeOnrampSkeleton() {
  return (
    <div className="daimo-absolute daimo-inset-0 daimo-p-5 daimo-bg-[var(--daimo-surface)]">
      <div className="daimo-h-full daimo-rounded-[var(--daimo-radius-md)] daimo-border daimo-border-[var(--daimo-border)] daimo-p-5 daimo-flex daimo-flex-col daimo-gap-6">
        <div className="daimo-flex daimo-items-center daimo-gap-4">
          <div
            className="daimo-h-12 daimo-w-12 daimo-shrink-0 daimo-rounded-full daimo-animate-daimo-pulse"
            style={{ backgroundColor: "var(--daimo-skeleton)" }}
          />
          <div className="daimo-flex daimo-min-w-0 daimo-flex-1 daimo-flex-col daimo-gap-2">
            <SkeletonBlock className="daimo-h-5 daimo-w-32" />
            <SkeletonBlock className="daimo-h-4 daimo-w-full daimo-max-w-56" />
          </div>
        </div>

        <div className="daimo-overflow-hidden daimo-rounded-[var(--daimo-radius-lg)] daimo-border daimo-border-[var(--daimo-border)]">
          <SkeletonPanel height="200px" />
          <div className="daimo-border-t daimo-border-[var(--daimo-border)]">
            <SkeletonPanel height="190px" />
          </div>
        </div>

        <div className="daimo-mt-auto daimo-flex daimo-flex-col daimo-gap-3">
          <SkeletonBlock className="daimo-h-4 daimo-w-full" />
          <SkeletonBlock className="daimo-h-[54px] daimo-w-full daimo-rounded-[var(--daimo-radius-lg)]" />
        </div>
      </div>
    </div>
  );
}

function SkeletonPanel({ height }: { height: string }) {
  return (
    <div
      className="daimo-flex daimo-flex-col daimo-justify-center daimo-gap-4 daimo-p-5"
      style={{ height }}
    >
      <SkeletonBlock className="daimo-h-4 daimo-w-20" />
      <SkeletonBlock className="daimo-h-12 daimo-w-36" />
    </div>
  );
}

function SkeletonBlock({ className }: { className: string }) {
  return (
    <div
      className={`${className} daimo-rounded daimo-animate-daimo-pulse`}
      style={{ backgroundColor: "var(--daimo-skeleton)" }}
    />
  );
}

function getStripeOnrampTheme(): StripeOnrampTheme {
  if (typeof window === "undefined") return "light";
  const documentTheme = document.documentElement.dataset.theme;
  if (documentTheme === "dark" || documentTheme === "light") {
    return documentTheme;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

async function loadStripeOnrampScripts(): Promise<void> {
  if (window.StripeOnramp) return;
  stripeOnrampScriptsPromise ??= loadScript(
    "https://js.stripe.com/dahlia/stripe.js",
  ).then(() =>
    loadScript("https://crypto-js.stripe.com/crypto-onramp-outer.js"),
  );
  await stripeOnrampScriptsPromise;
}

function loadScript(src: string): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>(
    `script[src="${src}"]`,
  );
  if (existing) {
    return existing.dataset.loaded === "true"
      ? Promise.resolve()
      : new Promise((resolve, reject) => {
          existing.addEventListener("load", () => resolve(), { once: true });
          existing.addEventListener(
            "error",
            () => reject(new Error("script load failed")),
            { once: true },
          );
        });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true },
    );
    script.addEventListener(
      "error",
      () => reject(new Error("script load failed")),
      { once: true },
    );
    document.head.appendChild(script);
  });
}
