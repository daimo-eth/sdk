import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { Address } from "viem";
import type { AccountDepositStatus } from "../../common/account.js";
import { tron } from "../../common/chain.js";
import { isSessionTerminal } from "../../common/session.js";
import type {
  AccountAuthConfig,
  DaimoCountryCode,
  NavLocation,
  NavLocationOption,
  RecreateSessionWithNavResponse,
} from "../api/index.js";
import { getNavSourceAmount } from "../api/navTree.js";
import type {
  NavExternalPaymentNode,
  NavNode,
  NavNodeChooseOption,
  NavNodeConnectedWallet,
  NavNodeDeeplink,
  NavNodeDepositAddress,
  NavNodeStripe,
  NavNodeTronDeposit,
  SessionWithNav,
} from "../api/navTree.js";
import type { WalletPaymentOption } from "../api/walletTypes.js";

import { useDaimoClient } from "../hooks/DaimoClientContext.js";
import { formatUserError } from "../hooks/formatUserError.js";
import { autoDetectLocale, t } from "../hooks/locale.js";
import { createNavLogger, type NavNodeType } from "../hooks/navEvent.js";
import {
  findNode,
  findNodeByType,
  type AccountNavEntry,
  type DaimoModalEventHandlers,
  type NavEntry,
} from "../hooks/types.js";
import { useDepositAddress } from "../hooks/useDepositAddress.js";
import { useAccountFlow } from "../hooks/useAccountFlow.js";
import { usePaymentCallbacks } from "../hooks/usePaymentCallbacks.js";
import { useSessionNav } from "../hooks/useSessionNav.js";
import { useSessionPolling } from "../hooks/useSessionPolling.js";
import { AccountFlowProvider } from "./account/AccountFlowProvider.js";
import { AccountApprovalPage } from "./account/AccountApprovalPage.js";

import {
  useInjectedWallets,
  type InjectedWallet,
} from "../hooks/useInjectedWallets.js";
import type { DaimoThemeMode } from "../../common/theme.js";
import { detectPlatform, isDesktop, type DaimoPlatform } from "../platform.js";
import { resolveDaimoSessionTheme, useDaimoThemeReady } from "../theme.js";
import { useWalletFlow } from "../hooks/useWalletFlow.js";
import { ExternalLinkIcon, PrimaryButton } from "./buttons.js";
import { ChooseChainPage } from "./ChooseChainPage.js";
import { ChooseOptionPage } from "./ChooseOptionPage.js";
import { ChooseWalletPage } from "./ChooseWalletPage.js";
import { ConfirmationPage } from "./ConfirmationPage.js";
import { EmbeddedContainer, ModalContainer } from "./containers.js";
import { DeeplinkPage } from "./DeeplinkPage.js";
import { ExternalPaymentFlowPage } from "./ExternalPaymentFlowPage.js";
import { ExpiredPage } from "./ExpiredPage.js";
import { AccountPaymentInstructionsPage } from "./account/AccountBankDetailsPage.js";
import { AccountInstitutionPickerPage } from "./account/AccountBankPickerPage.js";
import { AccountEnrollmentUpdatePage } from "./account/AccountEnrollmentUpdatePage.js";
import { AccountCreatingWalletPage } from "./account/AccountCreatingWalletPage.js";
import { AccountDeeplinkPage } from "./account/AccountDeeplinkPage.js";
import { AccountInstitutionReviewPage } from "./account/AccountInteracConfirmPage.js";
import { AccountWalletPayPage } from "./account/AccountApplePayPage.js";
import { FiatPopupPage } from "./account/FiatPopupPage.js";
import { AccountEmailPage } from "./account/AccountEmailPage.js";
import { AccountEnrollmentPage } from "./account/AccountEnrollmentPage.js";
import { AccountOtpPage } from "./account/AccountOtpPage.js";
import { AccountPhonePage } from "./account/AccountPhonePage.js";
import { AccountPhoneOtpPage } from "./account/AccountPhoneOtpPage.js";
import { AccountAmountPage } from "./account/AccountPaymentPage.js";
import { AccountPaymentResumePage } from "./account/AccountPaymentResumePage.js";
import { AccountStatusPage } from "./account/AccountStatusPage.js";
import { AccountRequestToPayPage } from "./account/AccountRequestToPayPage.js";
import {
  getAccountPaymentAdvanceTarget,
  getAccountPaymentEntryTarget,
  getInstitutionSelectionAdvanceTarget,
} from "./account/accountNav.js";
import { SelectAmountPage } from "./SelectAmountPage.js";
import { SelectTokenPage } from "./SelectTokenPage.js";
import { StripeOnrampPage } from "./StripeOnrampPage.js";
import {
  CenteredContent,
  ContactSupportButton,
  PageHeader,
  PageLogo,
  ErrorMessage as SharedErrorMessage,
  resolveIconUrl,
} from "./shared.js";
import { Skeleton, SkeletonText } from "./Skeleton.js";
import { ModalChrome, type ModalChromeControls } from "./ModalChrome.js";
import { QRCode } from "./QRCode.js";
import { WaitingDepositAddressPage } from "./WaitingDepositAddressPage.js";
import { WalletAmountPage } from "./WalletAmountPage.js";

export type DaimoModalLocalizationProps = {
  /** Override country used to localize auto payment-method sessions. */
  countryCode?: DaimoCountryCode;
  /** Called after the modal country picker successfully switches country. */
  onCountryCodeChange?: (countryCode: DaimoCountryCode) => void;
};

type DaimoModalBaseProps = {
  /** Unique session ID. Sessions are created server-side. */
  sessionId: string;
  /** Unique client secret, returned at session creation. */
  clientSecret: string;
  /** Whether the modal starts open. Default: true. */
  defaultOpen?: boolean;
  /** Skip payment method picker. Auto-connect to injected wallets. */
  connectToInjectedWallets?: boolean;
  /** Skip payment method picker. Use already-connected wallet specified. */
  connectToAddress?: Address;
  /** Render inline instead of as a floating modal. */
  embedded?: boolean;
  /**
   * Show the close button even when `embedded`. Set only by the native webview
   * surface (DaimoFrameRN), which has no chrome of its own and needs the flow's
   * own close button. Web embedders own their chrome, so this stays off there.
   */
  embeddedClose?: boolean;
  /** Override the session's light/dark/system theme mode. */
  themeMode?: DaimoThemeMode;
  /** Caller's platform. Prefer "desktop" or "mobile"; legacy values still work. Auto-detected. */
  platform?: DaimoPlatform;
  /** URL to navigate to after successful payment. */
  returnUrl?: string;
  /** Text shown on successful payment. Button label if returnUrl set, otherwise plain text. */
  returnLabel?: string;
  /**
   * Pop out popup-required fiat rails (Apple Pay) to a top-level window
   * when framed. Set only by the daimo webview surface.
   */
  enableFiatPopup?: boolean;
  /** Node to auto-navigate to on load (popup deep-link). */
  startNodeId?: string;
};

export type DaimoModalProps = DaimoModalEventHandlers &
  DaimoModalLocalizationProps &
  DaimoModalBaseProps;

type NodeContext = { nodeId: string | null; nodeType: NavNodeType | null };

type LoadedSession = {
  session: SessionWithNav;
  accountAuth: AccountAuthConfig | null;
  location: NavLocation;
  locationOptions: NavLocationOption[];
};

/** Fallback when the server predates the nav location fields. */
const UNKNOWN_LOCATION: NavLocation = {
  countryCode: null,
  countryName: "Location unknown",
  emoji: "🌐",
};

function useModalCloseHandler(
  sessionId: string,
  clientSecret: string,
  getNodeCtx: () => NodeContext,
  isOpen: boolean,
  setIsOpen: (open: boolean) => void,
  onClose?: () => void,
) {
  const client = useDaimoClient();
  const logNavEvent = createNavLogger(client);

  useEffect(() => {
    if (!isOpen) return;
    logNavEvent(sessionId, clientSecret, {
      ...getNodeCtx(),
      action: "nav_open",
    });
  }, [isOpen, sessionId, getNodeCtx]);

  const handleClose = useCallback(() => {
    logNavEvent(sessionId, clientSecret, {
      ...getNodeCtx(),
      action: "nav_close",
    });
    setIsOpen(false);
    onClose?.();
  }, [sessionId, clientSecret, getNodeCtx, setIsOpen, onClose]);

  return { handleClose };
}

export function DaimoModal(props: DaimoModalProps) {
  const {
    sessionId,
    clientSecret,
    embedded = false,
    defaultOpen = true,
    countryCode,
    onClose,
  } = props;

  // Auto-detect browser language if setLocale() hasn't been called explicitly
  autoDetectLocale();

  const client = useDaimoClient();
  const [loaded, setLoaded] = useState<LoadedSession | null>(null);
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [pageKey, setPageKey] = useState<string>();
  const [showFooterSpacer, setShowFooterSpacer] = useState(true);
  const [showCloseButton, setShowCloseButton] = useState(true);

  const closeRef = useRef(() => {
    setIsOpen(false);
    onClose?.();
  });

  useEffect(() => {
    client.internal.sessions
      .retrieveWithNav(
        sessionId,
        clientSecret,
        countryCode ? { countryCode } : undefined,
      )
      .then((resp) => {
        setLoaded({
          session: { ...resp.session, clientSecret },
          accountAuth: resp.accountAuth ?? null,
          // Defensive defaults: keep the modal working against servers that
          // predate the location fields.
          location: resp.location ?? UNKNOWN_LOCATION,
          locationOptions: resp.locationOptions ?? [],
        });
      })
      .catch((err) => console.error("failed to fetch session:", err));
  }, [sessionId, clientSecret, countryCode]);

  // If the API returned account auth config and no AccountFlowProvider exists
  // upstream (e.g. customer didn't pass privyAppId to DaimoSDKProvider),
  // lazily wrap modal content so fiat flow works automatically.
  const existingAccountFlow = useAccountFlow();
  const accountAuth = loaded?.accountAuth;
  const needsAccountProvider = !!accountAuth && !existingAccountFlow;
  const themeReady = useDaimoThemeReady(
    isOpen ? loaded?.session.display.themeCssUrl : undefined,
  );

  if (!isOpen) return null;

  // While the session and theme load, embedded mode reserves a sized skeleton
  // so the host iframe reports a non-zero height early — but keeps it
  // `visibility: hidden` so default (unthemed) colors never paint. Reveal once
  // the session and org stylesheet are ready.
  if (loaded == null || !themeReady) {
    if (!embedded) return null;
    return (
      <div style={{ visibility: "hidden" }}>
        <EmbeddedContainer showFooterSpacer={false} themeMode={props.themeMode}>
          <SkeletonContent rowCount={3} showFooter={false} />
        </EmbeddedContainer>
      </div>
    );
  }

  const content = (
    <DaimoModalInner
      key={loaded.location.countryCode ?? "unknown"}
      {...props}
      session={loaded.session}
      accountAuth={loaded.accountAuth}
      location={loaded.location}
      locationOptions={loaded.locationOptions}
      setLoaded={setLoaded}
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      closeRef={closeRef}
      setPageKey={setPageKey}
      setShowFooterSpacer={setShowFooterSpacer}
      setShowCloseButton={setShowCloseButton}
    />
  );

  const wrapped =
    needsAccountProvider && accountAuth ? (
      <AccountFlowProvider
        privyAppId={accountAuth.privyAppId}
        signerConfig={accountAuth.signerConfig}
        walletProvisioningClient={client}
      >
        {content}
      </AccountFlowProvider>
    ) : (
      content
    );

  const handleClose = showCloseButton ? () => closeRef.current() : undefined;
  const reserveLoadingHeight =
    pageKey == null || pageKey.startsWith("account-loading-");
  const showLoadingShell = reserveLoadingHeight;
  const modalBody = (
    <>
      {showLoadingShell && (
        <div
          key="loading-shell"
          className="daimo-flex daimo-flex-1 daimo-min-h-0 daimo-flex-col"
        >
          <SkeletonContent rowCount={3} showFooter={false} />
        </div>
      )}
      {wrapped && (
        <div
          key="content"
          className="daimo-flex daimo-flex-1 daimo-min-h-0 daimo-flex-col"
          style={showLoadingShell ? { display: "none" } : undefined}
        >
          {wrapped}
        </div>
      )}
    </>
  );
  const { themeMode } = resolveDaimoSessionTheme(
    loaded.session.display,
    props.themeMode,
  );

  if (embedded) {
    return (
      <EmbeddedContainer
        showFooterSpacer={showFooterSpacer}
        onClose={handleClose}
        themeMode={themeMode}
      >
        {modalBody}
      </EmbeddedContainer>
    );
  }
  return (
    <ModalContainer
      onClose={handleClose}
      pageKey={pageKey}
      reserveLoadingHeight={reserveLoadingHeight}
      showFooterSpacer={showFooterSpacer}
      themeMode={themeMode}
    >
      {modalBody}
    </ModalContainer>
  );
}

const CONNECTED_WALLET_NODE: NavNode = {
  type: "ConnectedWallet",
  id: "ConnectedWallet",
  title: "Connected Wallet",
};
const AUTOCONNECT_NAV: NavNode[] = [
  { ...CONNECTED_WALLET_NODE, autoconnect: true },
];
const CONNECT_TO_ADDRESS_NAV: NavNode[] = [CONNECTED_WALLET_NODE];

type DaimoModalInnerProps = DaimoModalProps & {
  session: SessionWithNav;
  accountAuth: AccountAuthConfig | null;
  location: NavLocation;
  locationOptions: NavLocationOption[];
  setLoaded: React.Dispatch<React.SetStateAction<LoadedSession | null>>;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  closeRef: { current: () => void };
  setPageKey: (key: string | undefined) => void;
  setShowFooterSpacer: (show: boolean) => void;
  setShowCloseButton: (show: boolean) => void;
};

function DaimoModalInner({
  session: initialSession,
  accountAuth,
  location,
  locationOptions,
  setLoaded,
  isOpen,
  setIsOpen,
  closeRef,
  setPageKey,
  setShowFooterSpacer,
  setShowCloseButton,
  embedded = false,
  embeddedClose = false,
  connectToInjectedWallets = false,
  connectToAddress,
  platform,
  returnUrl,
  returnLabel,
  enableFiatPopup = false,
  startNodeId,
  onPaymentStarted,
  onPaymentCompleted,
  onCountryCodeChange,
  onOpen,
  onClose,
}: DaimoModalInnerProps) {
  const effectiveInitial = connectToAddress
    ? { ...initialSession, navTree: CONNECT_TO_ADDRESS_NAV }
    : connectToInjectedWallets
      ? { ...initialSession, navTree: AUTOCONNECT_NAV }
      : initialSession;

  const [pendingTxHash, setPendingTxHash] = useState<string | undefined>();
  const [pageCloseVisible, setPageCloseVisible] = useState(true);
  const [loadingCountryCode, setLoadingCountryCode] =
    useState<DaimoCountryCode | null>(null);
  const client = useDaimoClient();
  const { session, setSession } = useSessionPolling(
    effectiveInitial,
    isOpen,
    pendingTxHash,
  );

  const depositAddress = useDepositAddress(session);

  const cwNode = findNodeByType(
    "ConnectedWallet",
    session.navTree,
  ) as NavNodeConnectedWallet | null;
  const connectMode: "auto" | "passive" | "none" = cwNode
    ? cwNode.autoconnect
      ? "auto"
      : "passive"
    : "none";
  const { wallets: injectedWallets, isLoading: isLoadingWallets } =
    useInjectedWallets();
  const walletFlow = useWalletFlow(
    session.sessionId,
    depositAddress ?? "",
    connectMode,
    session.clientSecret,
    injectedWallets,
    connectToAddress,
  );

  const accountFlow = useAccountFlow();
  const resolvedPlatform = platform ?? detectPlatform();
  const desktop = isDesktop(resolvedPlatform);
  const handleRecreate = useCallback(
    (resp: RecreateSessionWithNavResponse) => {
      setLoaded({
        session: resp.session,
        accountAuth: resp.accountAuth ?? null,
        location: resp.location ?? UNKNOWN_LOCATION,
        locationOptions: resp.locationOptions ?? [],
      });
    },
    [setLoaded],
  );
  const nav = useSessionNav(
    session,
    setSession,
    isOpen,
    accountAuth,
    resolvedPlatform,
    walletFlow,
    accountFlow,
    {
      enableFiatPopup,
      startNodeId,
      countryCode: location.countryCode ?? undefined,
      onRecreate: handleRecreate,
    },
  );
  const { handleReset } = nav;

  useEffect(() => {
    const top = nav.topEntry;
    if (top?.type === "wallet-sending" && top.txHash) {
      setPendingTxHash(top.txHash);
    }
  }, [nav.topEntry]);

  const { handleClose } = useModalCloseHandler(
    session.sessionId,
    session.clientSecret,
    nav.getNodeCtx,
    isOpen,
    setIsOpen,
    onClose,
  );

  closeRef.current = handleClose;

  const handleCountrySelect = useCallback(
    async (countryCode: DaimoCountryCode) => {
      if (countryCode === location.countryCode || loadingCountryCode != null) {
        return;
      }

      setLoadingCountryCode(countryCode);
      try {
        const resp = await client.internal.sessions.retrieveWithNav(
          session.sessionId,
          session.clientSecret,
          { countryCode },
        );
        const nextSession = {
          ...resp.session,
          clientSecret: session.clientSecret,
        };
        handleReset();
        setSession(nextSession);
        setLoaded({
          session: nextSession,
          accountAuth: resp.accountAuth ?? null,
          location: resp.location ?? UNKNOWN_LOCATION,
          locationOptions: resp.locationOptions ?? [],
        });
        if (resp.location.countryCode != null) {
          onCountryCodeChange?.(resp.location.countryCode);
        }
      } catch (error) {
        console.error("failed to switch country:", error);
      } finally {
        setLoadingCountryCode(null);
      }
    },
    [
      client,
      session.sessionId,
      session.clientSecret,
      location.countryCode,
      loadingCountryCode,
      handleReset,
      setSession,
      setLoaded,
      onCountryCodeChange,
    ],
  );

  usePaymentCallbacks(session, isOpen, {
    onOpen,
    onPaymentStarted,
    onPaymentCompleted,
  });

  const isTerminal = isSessionTerminal(session.status);
  const isAccountFlow = nav.topEntry?.type?.startsWith("account-") ?? false;
  const navKey = `${nav.topEntry?.type ?? "root"}-${nav.topEntry?.nodeId ?? ""}`;
  // Account flows manage their own terminal states — don't remount on session status change
  const pageKey = isTerminal && !isAccountFlow ? session.status : navKey;

  let content: React.ReactNode;
  let showFooterSpacer = true;
  let showClose = true;

  if (session.status === "expired") {
    content = (
      <ExpiredPage sessionId={session.sessionId} onClose={handleClose} />
    );
  } else if (
    !isAccountFlow &&
    (session.status === "processing" ||
      session.status === "succeeded" ||
      session.status === "bounced")
  ) {
    content = (
      <ConfirmationPage
        sessionId={session.sessionId}
        sessionState={session.status}
        returnUrl={returnUrl}
        returnLabel={returnLabel}
        baseUrl={session.baseUrl}
      />
    );
  } else {
    showFooterSpacer = !(
      !nav.topEntry ||
      (nav.topEntry.type === "choose-option" && !nav.canGoBack) ||
      nav.topEntry.type === "account-payment-instructions"
    );
    content = renderEntry(nav.topEntry, {
      session,
      displayVerb: session.display.verb,
      canGoBack: nav.canGoBack,
      onNavigate: nav.handleNavigate,
      onBack: nav.handleBack,
      onAmountContinue: nav.handleAmountContinue,
      onRetry: nav.handleRetry,
      onRefresh: nav.handleRefresh,
      onAccountSessionRecreate: nav.handleAccountSessionRecreate,
      injectedWallets,
      isLoadingWallets,
      platform: resolvedPlatform,
      isDesktop: desktop,
      onInjectedWalletSelect: nav.handleInjectedWalletSelect,
      onChainSelect: nav.handleChainSelect,
      onShowMobileWallets: nav.handleShowMobileWallets,
      walletFlow,
      onWalletSelectToken: nav.handleWalletSelectToken,
      onWalletSending: nav.handleWalletSending,
      onAccountAdvance: nav.handleAccountAdvance,
      setModalCloseVisible: setPageCloseVisible,
    });
  }

  const closeVisible =
    (!embedded || embeddedClose) && showClose && pageCloseVisible;
  const close = closeVisible ? { onClose: handleClose } : null;
  const showCountryPicker =
    // Server sends locations only when switching affects the nav
    // (paymentMethods auto sessions); empty means hide the picker.
    locationOptions.length > 0 &&
    (embedded || closeVisible) &&
    !connectToInjectedWallets &&
    !connectToAddress &&
    !startNodeId &&
    (!nav.topEntry ||
      (nav.topEntry.type === "choose-option" && !nav.canGoBack));
  let chrome: ModalChromeControls = { type: "none" };
  if (close) {
    chrome = { type: "close", close };
  }
  const isFirstPage = useRef(true);
  useLayoutEffect(() => setPageKey(pageKey), [pageKey, setPageKey]);
  useLayoutEffect(
    () => setShowFooterSpacer(showFooterSpacer),
    [showFooterSpacer, setShowFooterSpacer],
  );
  useLayoutEffect(
    () => setShowCloseButton(closeVisible),
    [closeVisible, setShowCloseButton],
  );

  // Skip page-enter animation on first render — container animation handles it
  const animate = !isFirstPage.current;
  useEffect(() => {
    isFirstPage.current = false;
  }, []);

  return (
    <ModalChrome
      controls={chrome}
      country={
        showCountryPicker
          ? {
              location,
              options: locationOptions,
              loadingCountryCode,
              onSelect: handleCountrySelect,
            }
          : null
      }
    >
      {(dismissAccount) =>
        loadingCountryCode != null ? (
          // Country switch in flight: skeleton the method list for a smooth
          // swap instead of freezing the old list until the new nav lands.
          <SkeletonContent rowCount={4} showFooter={false} />
        ) : (
          <div
            key={pageKey}
            onClick={dismissAccount ?? undefined}
            className={`${animate ? "daimo-page-enter " : ""}daimo-flex-1 daimo-min-h-0 daimo-flex daimo-flex-col`}
          >
            {content}
          </div>
        )
      }
    </ModalChrome>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

type RenderContext = {
  session: {
    sessionId: string;
    clientSecret: string;
    navTree: NavNode[];
    baseUrl: string;
    destination: { amountUnits?: string };
  };
  displayVerb: string;
  canGoBack: boolean;
  onNavigate: (nodeId: string) => void;
  onBack: () => void;
  onAmountContinue: (amountUsd: number) => void;
  onRetry: () => void;
  onRefresh: () => Promise<void>;
  onAccountSessionRecreate: (depositAmount: string) => Promise<void>;
  injectedWallets: InjectedWallet[];
  isLoadingWallets: boolean;
  platform: DaimoPlatform;
  isDesktop: boolean;
  onInjectedWalletSelect: (wallet: InjectedWallet) => void;
  onChainSelect: (chain: "evm" | "solana") => void;
  onShowMobileWallets: (nodeId: string) => void;
  walletFlow: {
    wallet: { evmAddress: string | null; solAddress: string | null } | null;
    connectedAddress: string | null;
    balances: WalletPaymentOption[] | null;
    isConnecting: boolean;
    isLoadingBalances: boolean;
    connectError: string | null;
    connect: () => Promise<void>;
    retryConnect: () => Promise<void>;
  };
  onWalletSelectToken: (token: WalletPaymentOption) => void;
  onWalletSending: (token: WalletPaymentOption, amountUsd: number) => void;
  onAccountAdvance: (
    nextType: AccountNavEntry["type"],
    options?: { initialStatus?: AccountDepositStatus },
  ) => void;
  setModalCloseVisible: (show: boolean) => void;
};

function renderEntry(
  entry: NavEntry | null,
  ctx: RenderContext,
): React.ReactNode {
  if (!entry) {
    const rootNode = ctx.session.navTree[0];
    if (!rootNode) return <LoadingMessage />;
    if (rootNode.type === "ChooseOption") {
      return (
        <ChooseOptionPage
          node={rootNode as NavNodeChooseOption}
          injectedWallets={ctx.injectedWallets}
          connectedAddress={ctx.walletFlow.connectedAddress}
          actionVerb={ctx.displayVerb}
          onNavigate={ctx.onNavigate}
          onBack={null}
          baseUrl={ctx.session.baseUrl}
        />
      );
    }
    return null;
  }

  switch (entry.type) {
    case "choose-option": {
      const node = findNode(
        entry.nodeId,
        ctx.session.navTree,
      ) as NavNodeChooseOption | null;
      if (!node) return null;
      if (node.id === "SelectWallet") {
        return (
          <ChooseWalletPage
            node={node}
            variant="wallet-list"
            injectedWallets={ctx.injectedWallets}
            isDesktop={ctx.isDesktop}
            onInjectedWalletSelect={ctx.onInjectedWalletSelect}
            onShowMobileWallets={() => ctx.onShowMobileWallets(node.id)}
            onNavigate={ctx.onNavigate}
            onBack={ctx.canGoBack ? ctx.onBack : null}
            baseUrl={ctx.session.baseUrl}
          />
        );
      }
      return (
        <ChooseOptionPage
          node={node}
          injectedWallets={ctx.injectedWallets}
          connectedAddress={ctx.walletFlow.connectedAddress}
          actionVerb={ctx.displayVerb}
          onNavigate={ctx.onNavigate}
          onBack={ctx.canGoBack ? ctx.onBack : null}
          baseUrl={ctx.session.baseUrl}
        />
      );
    }
    case "wallet-mobile-grid": {
      const node = findNode(
        entry.nodeId,
        ctx.session.navTree,
      ) as NavNodeChooseOption | null;
      if (!node) return null;
      return (
        <ChooseWalletPage
          node={node}
          variant="mobile-wallet-grid"
          injectedWallets={ctx.injectedWallets}
          isDesktop={ctx.isDesktop}
          onInjectedWalletSelect={ctx.onInjectedWalletSelect}
          onNavigate={ctx.onNavigate}
          onBack={ctx.canGoBack ? ctx.onBack : null}
          baseUrl={ctx.session.baseUrl}
        />
      );
    }
    case "deeplink": {
      const node = findNode(
        entry.nodeId,
        ctx.session.navTree,
      ) as NavNodeDeeplink | null;
      if (!node) return null;
      return (
        <DeeplinkPage
          node={node}
          platform={ctx.platform}
          onBack={ctx.canGoBack ? ctx.onBack : null}
          baseUrl={ctx.session.baseUrl}
        />
      );
    }
    case "select-amount":
      return renderSelectAmount(entry, ctx);
    case "waiting-deposit":
      return renderWaitingDeposit(entry, ctx);
    case "waiting-tron":
      return renderWaitingTron(entry, ctx);
    case "external-payment":
      return renderExternalPayment(entry, ctx);
    case "stripe-onramp":
      return renderStripeOnramp(entry, ctx);
    case "wallet-choose-chain":
      return (
        <ChooseChainPage
          walletName={entry.walletName}
          walletIcon={entry.walletIcon}
          onSelectChain={ctx.onChainSelect}
          onBack={ctx.canGoBack ? ctx.onBack : null}
          baseUrl={ctx.session.baseUrl}
        />
      );
    case "wallet-connect":
      return renderWalletConnect(entry, ctx);
    case "wallet-select-token":
      return renderWalletSelectToken(ctx);
    case "wallet-select-amount":
      return renderWalletSelectAmount(entry, ctx);
    case "wallet-sending":
      return renderWalletSending(entry, ctx);
    case "fiat-popup": {
      const node = findNode(entry.nodeId, ctx.session.navTree);
      if (node?.type !== "Fiat") return null;
      return (
        <FiatPopupPage
          node={node}
          sessionId={ctx.session.sessionId}
          clientSecret={ctx.session.clientSecret}
          platform={ctx.platform}
          baseUrl={ctx.session.baseUrl}
          onBack={ctx.canGoBack ? ctx.onBack : null}
        />
      );
    }
    case "account-loading":
      return <LoadingMessage />;
    case "account-email": {
      const node = findNode(entry.nodeId, ctx.session.navTree);
      if (node?.type !== "Fiat") return null;
      return (
        <AccountEmailPage
          methodLabel={node.title}
          onBack={ctx.canGoBack ? ctx.onBack : null}
          onOtpSent={() => ctx.onAccountAdvance("account-otp")}
        />
      );
    }
    case "account-otp":
      return (
        <AccountOtpPage
          onBack={ctx.onBack}
          onVerified={() => ctx.onAccountAdvance("account-creating-wallet")}
        />
      );
    case "account-creating-wallet":
      return (
        <AccountCreatingWalletPage
          sessionId={ctx.session.sessionId}
          clientSecret={ctx.session.clientSecret}
          rail={entry.rail}
          onDone={() => ctx.onAccountAdvance("account-enrollment")}
        />
      );
    case "account-enrollment": {
      const node = findNode(entry.nodeId, ctx.session.navTree);
      if (node?.type !== "Fiat") return null;
      return (
        <AccountEnrollmentPage
          node={node}
          sessionId={ctx.session.sessionId}
          clientSecret={ctx.session.clientSecret}
          platform={ctx.platform}
          onBack={ctx.onBack}
          onReady={() =>
            ctx.onAccountAdvance(
              getAccountPaymentEntryTarget(entry.paymentInteraction),
            )
          }
          onPhoneRequired={() => ctx.onAccountAdvance("account-phone")}
        />
      );
    }
    case "account-phone":
      return (
        <AccountPhonePage
          onBack={ctx.onBack}
          onOtpSent={() => ctx.onAccountAdvance("account-phone-otp")}
        />
      );
    case "account-phone-otp":
      return (
        <AccountPhoneOtpPage
          onBack={ctx.onBack}
          onVerified={() => ctx.onAccountAdvance("account-enrollment")}
        />
      );
    case "account-enrollment-update":
      return (
        <AccountEnrollmentUpdatePage
          update={entry.update}
          sessionId={ctx.session.sessionId}
          onBack={ctx.canGoBack ? ctx.onBack : null}
          onReady={() =>
            ctx.onAccountAdvance(
              getAccountPaymentEntryTarget(entry.paymentInteraction),
            )
          }
        />
      );
    case "account-amount": {
      const advanceTarget = getAccountPaymentAdvanceTarget(
        entry.paymentInteraction,
        ctx.platform,
      );
      return (
        <AccountAmountPage
          rail={entry.rail}
          paymentInteraction={entry.paymentInteraction}
          sessionId={ctx.session.sessionId}
          initialAmount={ctx.session.destination.amountUnits}
          platform={ctx.platform}
          baseUrl={ctx.session.baseUrl}
          startDepositOnAdvance={advanceTarget === "account-institution-review"}
          onBack={ctx.canGoBack ? ctx.onBack : null}
          onAdvance={() => ctx.onAccountAdvance(advanceTarget)}
        />
      );
    }
    case "account-request-to-pay":
      return (
        <AccountRequestToPayPage
          sessionId={ctx.session.sessionId}
          clientSecret={ctx.session.clientSecret}
          rail={entry.rail}
          resumePayment={entry.resumePayment ?? false}
          onAdvance={(deposit) =>
            ctx.onAccountAdvance("account-status", {
              initialStatus: deposit.status,
            })
          }
          onRetry={ctx.onAccountSessionRecreate}
        />
      );
    case "account-approval":
      return (
        <AccountApprovalPage
          sessionId={ctx.session.sessionId}
          clientSecret={ctx.session.clientSecret}
          rail={entry.rail}
          platform={ctx.platform}
          resumePayment={entry.resumePayment ?? false}
          onAdvance={(deposit) =>
            ctx.onAccountAdvance("account-status", {
              initialStatus: deposit.status,
            })
          }
          onRetry={ctx.onAccountSessionRecreate}
        />
      );
    case "account-payment-resume":
      return (
        <AccountPaymentResumePage
          sessionId={ctx.session.sessionId}
          rail={entry.rail}
          onReady={(payment) =>
            ctx.onAccountAdvance(
              getAccountPaymentAdvanceTarget(payment.flow, ctx.platform),
            )
          }
        />
      );
    case "account-institution-picker":
      return (
        <AccountInstitutionPickerPage
          rail={entry.rail}
          paymentInteraction={entry.paymentInteraction}
          sessionId={ctx.session.sessionId}
          onBack={
            entry.paymentInteraction === "institution-picker" && ctx.canGoBack
              ? ctx.onBack
              : null
          }
          onSelect={(payment) =>
            ctx.onAccountAdvance(
              getInstitutionSelectionAdvanceTarget(payment.flow, ctx.platform),
            )
          }
        />
      );
    case "account-institution-review": {
      const accountNode = findNode(entry.nodeId, ctx.session.navTree);
      return (
        <AccountInstitutionReviewPage
          sessionId={ctx.session.sessionId}
          paymentInteraction={entry.paymentInteraction}
          baseUrl={ctx.session.baseUrl}
          platform={ctx.platform}
          icon={accountNode?.type === "Fiat" ? accountNode.icon : undefined}
          onBack={ctx.onBack}
          onAdvance={() => ctx.onAccountAdvance("account-deeplink")}
        />
      );
    }
    case "account-wallet-pay":
      return (
        <AccountWalletPayPage
          rail={entry.rail}
          paymentInteraction={entry.paymentInteraction}
          sessionId={ctx.session.sessionId}
          clientSecret={ctx.session.clientSecret}
          actionVerb={ctx.displayVerb}
          initialAmount={ctx.session.destination.amountUnits}
          onBack={ctx.canGoBack ? ctx.onBack : null}
          onAdvance={() => ctx.onAccountAdvance("account-status")}
        />
      );
    case "account-payment-instructions":
      return (
        <AccountPaymentInstructionsPage
          rail={entry.rail}
          paymentInteraction={entry.paymentInteraction}
          sessionId={ctx.session.sessionId}
          clientSecret={ctx.session.clientSecret}
          baseUrl={ctx.session.baseUrl}
          onBack={null}
          onAdvance={() => ctx.onAccountAdvance("account-status")}
        />
      );
    case "account-deeplink": {
      const accountNode = findNode(entry.nodeId, ctx.session.navTree);
      return (
        <AccountDeeplinkPage
          sessionId={ctx.session.sessionId}
          paymentInteraction={entry.paymentInteraction}
          clientSecret={ctx.session.clientSecret}
          baseUrl={ctx.session.baseUrl}
          platform={ctx.platform}
          icon={accountNode?.type === "Fiat" ? accountNode.icon : undefined}
          onBack={ctx.onBack}
          onAdvance={() => ctx.onAccountAdvance("account-status")}
        />
      );
    }
    case "account-status":
      return (
        <AccountStatusPage
          sessionId={ctx.session.sessionId}
          clientSecret={ctx.session.clientSecret}
          baseUrl={ctx.session.baseUrl}
          initialStatus={entry.initialStatus}
        />
      );
    case "account-error":
      return (
        <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
          <PageHeader
            title={t.error}
            onBack={ctx.canGoBack ? ctx.onBack : null}
          />
          <CenteredContent>
            <SharedErrorMessage message={entry.message} />
          </CenteredContent>
        </div>
      );
    default:
      return null;
  }
}

function renderSelectAmount(
  entry: NavEntry & { type: "select-amount" },
  ctx: RenderContext,
): React.ReactNode {
  const node = findNode(entry.nodeId, ctx.session.navTree);
  if (!node) return null;

  if (entry.flowType === "deposit") {
    const depositNode = node as NavNodeDepositAddress;
    return (
      <SelectAmountPage
        node={depositNode}
        minimum={depositNode.minimumUsd}
        maximum={depositNode.maximumUsd}
        tokenSuffix={depositNode.tokenSuffix}
        chainId={depositNode.chainId}
        onBack={ctx.canGoBack ? ctx.onBack : undefined}
        onContinue={ctx.onAmountContinue}
        baseUrl={ctx.session.baseUrl}
      />
    );
  }
  if (entry.flowType === "tron") {
    const tronNode = node as NavNodeTronDeposit;
    return (
      <SelectAmountPage
        node={{ icon: tronNode.icon, title: tronNode.title }}
        minimum={tronNode.minimumUsd}
        maximum={tronNode.maximumUsd}
        tokenSuffix="USDT"
        chainId={tron.chainId}
        onBack={ctx.canGoBack ? ctx.onBack : undefined}
        onContinue={ctx.onAmountContinue}
        baseUrl={ctx.session.baseUrl}
      />
    );
  }
  if (
    entry.flowType === "exchange" ||
    entry.flowType === "cashapp" ||
    entry.flowType === "external"
  ) {
    if (
      node.type !== "Exchange" &&
      node.type !== "CashApp" &&
      node.type !== "ExternalPayment"
    ) {
      return null;
    }
    const sourceAmount = getNavSourceAmount(node);
    return (
      <SelectAmountPage
        node={{ icon: node.icon, title: node.title }}
        minimum={sourceAmount.minimum}
        maximum={sourceAmount.maximum}
        decimals={sourceAmount.decimals}
        currencySymbol={sourceAmount.currencySymbol}
        onBack={ctx.canGoBack ? ctx.onBack : undefined}
        onContinue={ctx.onAmountContinue}
        baseUrl={ctx.session.baseUrl}
      />
    );
  }
  if (entry.flowType === "stripe") {
    const stripeNode = node as NavNodeStripe;
    return (
      <SelectAmountPage
        node={{ icon: stripeNode.icon, title: stripeNode.title }}
        minimum={stripeNode.minimumUsd}
        maximum={stripeNode.maximumUsd}
        onBack={ctx.canGoBack ? ctx.onBack : undefined}
        onContinue={ctx.onAmountContinue}
        baseUrl={ctx.session.baseUrl}
      />
    );
  }
  return null;
}

function renderWaitingDeposit(
  entry: NavEntry & { type: "waiting-deposit" },
  ctx: RenderContext,
): React.ReactNode {
  const node = findNode(
    entry.nodeId,
    ctx.session.navTree,
  ) as NavNodeDepositAddress | null;
  if (!node) return null;
  const selectedToken =
    node.tokenSuffix === "USDC" || node.tokenSuffix === "USDT"
      ? node.tokenSuffix
      : undefined;
  return (
    <WaitingDepositAddressPage
      node={node}
      amountUsd={entry.amountUsd}
      selectedToken={selectedToken}
      sessionId={ctx.session.sessionId}
      clientSecret={ctx.session.clientSecret}
      onBack={ctx.onBack}
      onRefresh={ctx.onRefresh}
      baseUrl={ctx.session.baseUrl}
    />
  );
}

function renderWaitingTron(
  entry: NavEntry & { type: "waiting-tron" },
  ctx: RenderContext,
): React.ReactNode {
  const node = findNode(
    entry.nodeId,
    ctx.session.navTree,
  ) as NavNodeTronDeposit | null;
  if (!node) return null;
  if (entry.error)
    return (
      <FlowErrorMessage
        error={entry.error}
        sessionId={ctx.session.sessionId}
        onBack={ctx.onBack}
        onRetry={ctx.onRetry}
      />
    );
  if (node.id === "Trust-Tron") {
    return (
      <TrustWalletTronPage
        title={node.title}
        deeplink={entry.trustWalletDeeplink}
        onBack={ctx.onBack}
        baseUrl={ctx.session.baseUrl}
        isDesktop={ctx.isDesktop}
      />
    );
  }
  return (
    <WaitingDepositAddressPage
      node={{
        type: "DepositAddress",
        id: entry.nodeId,
        title: node.title,
        address: (entry.address as `0x${string}`) ?? ("" as `0x${string}`),
        chainId: tron.chainId,
        icon: node.icon,
        minimumUsd: node.minimumUsd,
        maximumUsd: node.maximumUsd,
        expiresAt: entry.expiresAt ?? 0,
        tokenSuffix: "USDT",
      }}
      amountUsd={entry.amountUsd}
      selectedToken="USDT"
      loading={!entry.address}
      sessionId={ctx.session.sessionId}
      clientSecret={ctx.session.clientSecret}
      onBack={ctx.onBack}
      onRefresh={ctx.onRetry}
      baseUrl={ctx.session.baseUrl}
    />
  );
}

function TrustWalletTronPage({
  title,
  deeplink,
  onBack,
  baseUrl,
  isDesktop,
}: {
  title: string;
  deeplink?: { url: string; label: "USDT on Tron" };
  onBack: () => void;
  baseUrl: string;
  isDesktop: boolean;
}): React.ReactNode {
  const trustLogo = (
    <img
      src={resolveIconUrl("/wallet-logos/trust-wallet-logo.png", baseUrl)}
      alt="Trust"
      className="daimo-w-full daimo-h-full daimo-object-contain daimo-rounded-[25%]"
    />
  );

  if (isDesktop) {
    return (
      <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
        <PageHeader title={title} onBack={onBack} />
        <CenteredContent>
          <div className="daimo-w-full daimo-max-w-[200px] sm:daimo-max-w-[260px]">
            <QRCode
              value={deeplink?.url}
              image={trustLogo}
              placeholderDensity="long"
            />
          </div>
          <p className="daimo-text-[var(--daimo-text-secondary)] daimo-text-center daimo-max-w-xs daimo-text-sm">
            {t.scanWithPhone}
          </p>
        </CenteredContent>
      </div>
    );
  }

  const openDeeplink = () => {
    if (deeplink) {
      window.open(deeplink.url, "_blank");
    }
  };

  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title={title} onBack={onBack} />
      <CenteredContent>
        {deeplink == null ? (
          <TrustWalletTronLoading />
        ) : (
          <>
            <PageLogo
              icon="/wallet-logos/trust-wallet-logo.png"
              alt="Trust"
              baseUrl={baseUrl}
            />
            <p className="daimo-text-[var(--daimo-text-secondary)] daimo-text-center daimo-max-w-xs">
              {t.continueIn} Trust {t.toCompleteYourPayment}
            </p>
          </>
        )}
        {deeplink != null ? (
          <PrimaryButton onClick={openDeeplink} icon={<ExternalLinkIcon />}>
            {t.openIn} Trust
          </PrimaryButton>
        ) : (
          <Skeleton
            className="daimo-h-[56px] daimo-w-full daimo-max-w-xs"
            rounded="lg"
            delayMs={200}
          />
        )}
      </CenteredContent>
    </div>
  );
}

function TrustWalletTronLoading(): React.ReactNode {
  return (
    <>
      <Skeleton className="daimo-h-20 daimo-w-20" rounded="full" />
      <SkeletonText
        lines={2}
        widths={["72%", "48%"]}
        className="daimo-max-w-xs"
      />
    </>
  );
}

function renderExternalPayment(
  entry: NavEntry & { type: "external-payment" },
  ctx: RenderContext,
): React.ReactNode {
  const node = findNode(
    entry.nodeId,
    ctx.session.navTree,
  ) as NavExternalPaymentNode | null;
  if (
    node == null ||
    (node.type !== "Exchange" &&
      node.type !== "CashApp" &&
      node.type !== "ExternalPayment")
  ) {
    return null;
  }
  if (entry.error)
    return (
      <FlowErrorMessage
        error={entry.error}
        sessionId={ctx.session.sessionId}
        onBack={ctx.onBack}
        onRetry={ctx.onRetry}
      />
    );
  return (
    <ExternalPaymentFlowPage
      node={node}
      platform={ctx.platform}
      paymentUrl={entry.paymentUrl}
      waitingMessage={entry.waitingMessage}
      expiresAt={entry.expiresAt}
      quote={entry.quote}
      isLoading={!entry.paymentUrl}
      onBack={ctx.onBack}
      onRetry={ctx.onRetry}
      baseUrl={ctx.session.baseUrl}
    />
  );
}

function renderStripeOnramp(
  entry: NavEntry & { type: "stripe-onramp" },
  ctx: RenderContext,
): React.ReactNode {
  const node = findNode(
    entry.nodeId,
    ctx.session.navTree,
  ) as NavNodeStripe | null;
  if (!node) return null;

  return (
    <StripeOnrampPage
      node={node}
      platform={ctx.platform}
      amountUsd={entry.amountUsd}
      redirectUrl={entry.redirectUrl}
      isLoading={!entry.redirectUrl && !entry.error}
      error={entry.error}
      onBack={ctx.onBack}
      onRetry={ctx.onRetry}
      baseUrl={ctx.session.baseUrl}
    />
  );
}

function renderWalletConnect(
  entry: NavEntry & { type: "wallet-connect" },
  ctx: RenderContext,
): React.ReactNode {
  const { walletFlow } = ctx;
  const title = entry.walletName
    ? `${t.connect} ${entry.walletName}`
    : t.connectWallet;

  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader
        title={title}
        onBack={ctx.canGoBack ? ctx.onBack : undefined}
      />

      <CenteredContent>
        {entry.walletIcon && (
          <img
            src={entry.walletIcon}
            alt={entry.walletName ?? ""}
            className="daimo-w-20 daimo-h-20 daimo-object-contain daimo-rounded-[25%]"
          />
        )}
        {walletFlow.isConnecting && !entry.walletName && (
          <SkeletonText lines={1} widths={["7rem"]} />
        )}
      </CenteredContent>

      {/* Fixed bottom: error + retry, contact support */}
      <div className="daimo-px-6 daimo-pb-6 daimo-flex daimo-flex-col daimo-items-center daimo-gap-3 daimo-min-h-[100px]">
        {walletFlow.connectError && (
          <>
            <SharedErrorMessage message={walletFlow.connectError} />
            <PrimaryButton onClick={walletFlow.retryConnect}>
              {t.tryAgain}
            </PrimaryButton>
          </>
        )}
        {!entry.walletName &&
          !walletFlow.isConnecting &&
          !walletFlow.connectError && (
            <PrimaryButton onClick={walletFlow.connect}>
              {t.connectWallet}
            </PrimaryButton>
          )}
        <ContactSupportButton
          subject="Wallet connection"
          info={{
            sessionId: ctx.session.sessionId,
            error: walletFlow.connectError ?? t.walletUnavailable,
          }}
        />
      </div>
    </div>
  );
}

function renderWalletSelectToken(ctx: RenderContext): React.ReactNode {
  const { walletFlow } = ctx;
  const isLoading =
    ctx.isLoadingWallets ||
    walletFlow.isConnecting ||
    walletFlow.isLoadingBalances;

  // Error: connection or balance fetch failed
  if (!isLoading && walletFlow.balances === null && walletFlow.connectError) {
    return (
      <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
        <PageHeader
          title={t.selectToken}
          onBack={ctx.canGoBack ? ctx.onBack : null}
          borderVisible={false}
        />
        <CenteredContent>
          <SharedErrorMessage message={walletFlow.connectError} />
          <PrimaryButton onClick={walletFlow.retryConnect}>
            {t.tryAgain}
          </PrimaryButton>
        </CenteredContent>
      </div>
    );
  }

  // Loading: discovery, connection, or balance fetch in progress
  if (isLoading) {
    return (
      <SelectTokenPage
        options={null}
        isLoading
        showRequired={!!ctx.session.destination.amountUnits}
        onSelect={ctx.onWalletSelectToken}
        onBack={ctx.canGoBack ? ctx.onBack : null}
        baseUrl={ctx.session.baseUrl}
        sessionId={ctx.session.sessionId}
      />
    );
  }

  // No wallet connected and nothing loading — no wallets available
  if (walletFlow.balances === null) {
    return (
      <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
        <PageHeader
          title={t.selectToken}
          onBack={ctx.canGoBack ? ctx.onBack : null}
          borderVisible={false}
        />
        <CenteredContent>
          <SharedErrorMessage message={t.noWalletsFound} />
          <PrimaryButton onClick={walletFlow.retryConnect}>
            {t.tryAgain}
          </PrimaryButton>
        </CenteredContent>
      </div>
    );
  }

  // Loaded — show token list
  const showRequired = !!ctx.session.destination.amountUnits;
  return (
    <SelectTokenPage
      options={walletFlow.balances}
      isLoading={false}
      showRequired={showRequired}
      onSelect={ctx.onWalletSelectToken}
      onBack={ctx.canGoBack ? ctx.onBack : null}
      baseUrl={ctx.session.baseUrl}
      sessionId={ctx.session.sessionId}
    />
  );
}

function renderWalletSelectAmount(
  entry: NavEntry & { type: "wallet-select-amount" },
  ctx: RenderContext,
): React.ReactNode {
  return (
    <WalletAmountPage
      token={entry.token}
      platform={ctx.platform}
      onBack={ctx.onBack}
      onContinue={(amountUsd) => ctx.onWalletSending(entry.token, amountUsd)}
      baseUrl={ctx.session.baseUrl}
    />
  );
}

function renderWalletSending(
  entry: NavEntry & { type: "wallet-sending" },
  ctx: RenderContext,
): React.ReactNode {
  if (entry.error)
    return (
      <FlowErrorMessage
        error={entry.error}
        sessionId={ctx.session.sessionId}
        onBack={ctx.onBack}
        onRetry={ctx.onBack}
      />
    );
  return (
    <ConfirmationPage
      sessionId={ctx.session.sessionId}
      sourceChainId={entry.token.balance.token.chainId}
      sourceTokenSymbol={entry.token.balance.token.symbol}
      sourceTokenLogoURI={entry.token.balance.token.logoURI}
      sourceAmountUsd={entry.amountUsd}
      pendingTxHash={entry.txHash}
      rejected={entry.rejected}
      onRetry={ctx.onRetry}
      onBack={!entry.txHash ? ctx.onBack : undefined}
      baseUrl={ctx.session.baseUrl}
    />
  );
}

function LoadingMessage() {
  return <SkeletonContent rowCount={3} />;
}

/** Full-page error with retry + contact support. Use for failed transport flows (wallet send, exchange, Tron). */
function FlowErrorMessage({
  error,
  sessionId,
  onBack,
  onRetry,
}: {
  error: string;
  sessionId?: string;
  onBack: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title={t.error} onBack={onBack} />
      <CenteredContent>
        <SharedErrorMessage message={formatUserError(error)} />
        <PrimaryButton onClick={onRetry}>{t.tryAgain}</PrimaryButton>
        <ContactSupportButton
          subject={t.error}
          info={{
            ...(sessionId ? { sessionId } : {}),
            error,
          }}
        />
      </CenteredContent>
    </div>
  );
}

function SkeletonContent({
  rowCount = 4,
  showFooter = true,
}: {
  rowCount?: number;
  showFooter?: boolean;
}) {
  return (
    <div className="daimo-flex daimo-flex-col">
      <div className="daimo-flex daimo-items-center daimo-justify-center daimo-p-6">
        <Skeleton className="daimo-h-5 daimo-w-32" rounded="sm" />
      </div>
      <div className="daimo-px-6 daimo-pb-4 daimo-flex daimo-flex-col daimo-gap-3">
        {[...Array(rowCount)].map((_, i) => (
          <Skeleton
            key={i}
            className="daimo-h-16"
            rounded="lg"
            delayMs={i * 100}
          />
        ))}
      </div>
      {showFooter && (
        <div className="daimo-py-4 daimo-text-center">
          <SkeletonText lines={1} widths={["7rem"]} />
        </div>
      )}
    </div>
  );
}
