import type { Address } from "viem";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  arbitrum,
  base,
  bsc,
  ethereum,
  hyperEvm,
  optimism,
  polygon,
  solana,
} from "../../common/chain.js";
import { DAIMO_BASE_URL } from "../../common/constants.js";
import {
  isSessionTerminal,
  type SessionPublicInfo,
} from "../../common/session.js";
import type { DaimoSessionTheme, DaimoThemeMode } from "../../common/theme.js";
import { TokenLogo } from "../../common/token.js";
import {
  daimoWithdrawalDestinationRoutes,
  getDaimoWithdrawalDestinationRoute,
  type DaimoWithdrawalDestination,
  type DaimoWithdrawalDestinationAsset,
  type DaimoWithdrawalDestinationRoute,
  type DaimoWithdrawalFundingMode,
} from "../../common/withdrawal.js";
import { useDaimoClient } from "../hooks/DaimoClientContext.js";
import { formatUserError } from "../hooks/formatUserError.js";
import { autoDetectLocale, t } from "../hooks/locale.js";
import type { EthereumProvider } from "../hooks/walletProvider.js";
import type { DaimoWalletSource } from "../hooks/walletSource.js";
import type { DaimoPayToken, WalletPaymentOption } from "../api/walletTypes.js";
import { detectPlatform } from "../platform.js";
import { resolveDaimoSessionTheme, useDaimoThemeReady } from "../theme.js";
import { getWalletTokenAmount } from "../walletAmount.js";
import { PrimaryButton } from "./buttons.js";
import { ConfirmationSpinner } from "./ConfirmationSpinner.js";
import { DaimoModal } from "./DaimoModal.js";
import { EmbeddedContainer, ModalContainer } from "./containers.js";
import { ExpiredIcon, PlusIcon, TrashIcon } from "./icons.js";
import { ModalChrome, type ModalChromeControls } from "./ModalChrome.js";
import { Skeleton } from "./Skeleton.js";
import { SelectTokenPage } from "./SelectTokenPage.js";
import {
  AmountInput,
  getChainLogoUrl,
  ListRow,
  PageHeader,
  ScrollContent,
  TextInput,
  useScrollBorder,
} from "./shared.js";
import { WalletAmountPage } from "./WalletAmountPage.js";
import {
  ManualWithdrawalSession,
  buildDaimoWithdrawalDestination,
  getContactRoute,
  getDaimoWithdrawalStorage,
  readDaimoWithdrawalContacts,
  removeDaimoWithdrawalContact,
  resolveAndCreateWithdrawalSession,
  resolveWithdrawalIdentifierWithClient,
  saveDaimoWithdrawalContact,
  type DaimoWithdrawalContact,
  type DaimoWithdrawalManualTransferRequest,
  type DaimoWithdrawalManualTransferResult,
  type ManualWithdrawalSubmission,
  type ManualWithdrawalTransfer,
  type ResolvedWithdrawalIdentifier,
} from "../withdrawal.js";

export type {
  DaimoWithdrawalDestination,
  DaimoWithdrawalFundingMode,
  DaimoWithdrawalManualTransferRequest,
  DaimoWithdrawalManualTransferResult,
};
export type DaimoWithdrawalEvmProvider = EthereumProvider;

type DaimoWithdrawalSessionRef = {
  sessionId: string;
  clientSecret: string;
};

type DaimoWithdrawalBaseProps = {
  /** Stable authenticated user/account scope for isolated saved destinations. */
  contactStorageScope: string;
  /** Override Daimo's built-in Ethereum-mainnet ENS resolution. */
  resolveEns?: (name: string) => Promise<{ address: Address }>;
  createSession: (input: {
    destination: DaimoWithdrawalDestination;
    fundingMode: DaimoWithdrawalFundingMode;
  }) => Promise<DaimoWithdrawalSessionRef>;
  /** Limit injected-wallet funding providers. Default: "all". */
  walletSource?: DaimoWalletSource;
  /** Resolved organization theme used before and during the session. */
  theme?: DaimoSessionTheme;
  /** Explicit light/dark/system override for the supplied or session theme. */
  themeMode?: DaimoThemeMode;
  /** Render inline instead of as a floating modal. Default: true. */
  embedded?: boolean;
  /** Called after the floating modal dismisses itself. */
  onClose?: () => void;
  onPaymentStarted?: () => void;
  onPaymentCompleted?: () => void;
};

export type DaimoWithdrawalProps = DaimoWithdrawalBaseProps &
  (
    | {
        fundingMode: "injected-wallet";
        connectToAddress?: Address;
        /** Direct EIP-1193 provider to keep embedded wallets scoped to this widget. */
        evmProvider?: DaimoWithdrawalEvmProvider;
        sendManualTransaction?: never;
      }
    | ({
        fundingMode: "manual";
        evmProvider?: never;
        sendManualTransaction: (
          request: DaimoWithdrawalManualTransferRequest,
        ) => Promise<DaimoWithdrawalManualTransferResult>;
        /** Keep only source tokens the host wallet can submit. */
        sourceTokenFilter?: (token: DaimoPayToken) => boolean;
      } & (
        | {
            /** Fixed destination amount submitted without SDK amount entry. */
            amountUnits: string;
            connectToAddress?: never;
          }
        | {
            /** Collect the destination amount inside the SDK. */
            amountUnits?: never;
            /** EVM source address used for read-only token/balance selection. */
            connectToAddress?: Address;
          }
      ))
  );

type WithdrawalStep = "identifier" | "asset" | "chain" | "review";

const EVM_WITHDRAWAL_CHAIN_IDS = [
  arbitrum.chainId,
  base.chainId,
  bsc.chainId,
  ethereum.chainId,
  hyperEvm.chainId,
  optimism.chainId,
  polygon.chainId,
] as const;

/** Recipient-first stablecoin withdrawal widget. */
export function DaimoWithdrawal(props: DaimoWithdrawalProps) {
  autoDetectLocale();
  return <DaimoWithdrawalFlow key={props.contactStorageScope} {...props} />;
}

function DaimoWithdrawalFlow(props: DaimoWithdrawalProps) {
  const client = useDaimoClient();
  const theme = resolveDaimoSessionTheme(props.theme, props.themeMode);
  const embedded = props.embedded ?? true;
  const themeReady = useDaimoThemeReady(theme.themeCssUrl);
  const [isOpen, setIsOpen] = useState(true);
  const [step, setStep] = useState<WithdrawalStep>("identifier");
  const [identifierInput, setIdentifierInput] = useState("");
  const [identifier, setIdentifier] =
    useState<ResolvedWithdrawalIdentifier | null>(null);
  const [asset, setAsset] = useState<DaimoWithdrawalDestinationAsset | null>(
    null,
  );
  const [route, setRoute] = useState<DaimoWithdrawalDestinationRoute | null>(
    null,
  );
  const [saveContact, setSaveContact] = useState(false);
  const [contacts, setContacts] = useState<DaimoWithdrawalContact[]>([]);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const [showIdentifierInput, setShowIdentifierInput] = useState(false);
  const [removingContact, setRemovingContact] =
    useState<DaimoWithdrawalContact | null>(null);
  const [selectingContact, setSelectingContact] =
    useState<DaimoWithdrawalContact | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolvingIdentifierRef = useRef(false);
  const creatingSessionRef = useRef(false);
  const [session, setSession] = useState<{
    ref: DaimoWithdrawalSessionRef;
    destination: DaimoWithdrawalDestination;
  } | null>(null);

  useEffect(() => {
    setContacts(
      readDaimoWithdrawalContacts(
        props.contactStorageScope,
        getDaimoWithdrawalStorage(),
      ),
    );
    setContactsLoaded(true);
  }, [props.contactStorageScope]);

  const resolveIdentifierValue = useCallback(
    (value: string) =>
      resolveWithdrawalIdentifierWithClient(value, client, props.resolveEns),
    [client, props.resolveEns],
  );

  const resolveIdentifier = useCallback(
    async (value: string) => {
      if (resolvingIdentifierRef.current) return null;
      resolvingIdentifierRef.current = true;
      setBusy(true);
      setError(null);
      try {
        const resolved = await resolveIdentifierValue(value);
        setIdentifier(resolved);
        setIdentifierInput(resolved.identifier);
        setSaveContact(false);
        if (resolved.identifierType === "solana") {
          const solanaRoute = getDaimoWithdrawalDestinationRoute(
            "USDC",
            solana.chainId,
          );
          if (!solanaRoute) {
            throw new Error(t.withdrawalSolanaUnavailable);
          }
          setAsset(solanaRoute.asset);
          setRoute(solanaRoute);
          setStep("review");
        } else {
          setAsset(null);
          setRoute(null);
          setStep("asset");
        }
        return resolved;
      } catch (err) {
        setError(formatWithdrawalUserError(err));
        return null;
      } finally {
        resolvingIdentifierRef.current = false;
        setBusy(false);
      }
    },
    [resolveIdentifierValue],
  );

  const createWithdrawalSession = useCallback(
    async (
      nextIdentifier: ResolvedWithdrawalIdentifier,
      nextRoute: DaimoWithdrawalDestinationRoute,
      contactToSave: DaimoWithdrawalContact | null,
    ) => {
      const destination = buildDaimoWithdrawalDestination(
        nextIdentifier,
        nextRoute,
      );
      const ref = await props.createSession({
        destination,
        fundingMode: props.fundingMode,
      });
      if (contactToSave) {
        setContacts(
          saveDaimoWithdrawalContact(
            {
              ...contactToSave,
              identifier: nextIdentifier.identifier,
              identifierType: nextIdentifier.identifierType,
              asset: nextRoute.asset,
              chainId: nextRoute.chainId,
              lastUsedAt: Date.now(),
            },
            props.contactStorageScope,
            getDaimoWithdrawalStorage(),
          ),
        );
      }
      setSession({ ref, destination });
    },
    [props.contactStorageScope, props.createSession, props.fundingMode],
  );

  const selectContact = useCallback(
    async (contact: DaimoWithdrawalContact) => {
      const contactRoute = getContactRoute(contact);
      if (!contactRoute) {
        setError(t.withdrawalSavedRouteUnsupported);
        return;
      }
      if (creatingSessionRef.current) return;
      creatingSessionRef.current = true;
      setSelectingContact(contact);
      setBusy(true);
      setError(null);
      try {
        await resolveAndCreateWithdrawalSession(
          contact.identifier,
          resolveIdentifierValue,
          (resolved) =>
            createWithdrawalSession(resolved, contactRoute, contact),
        );
      } catch (err) {
        setError(formatWithdrawalUserError(err));
      } finally {
        creatingSessionRef.current = false;
        setSelectingContact(null);
        setBusy(false);
      }
    },
    [createWithdrawalSession, resolveIdentifierValue],
  );

  const continueFromReview = useCallback(async () => {
    if (!identifier || !route || creatingSessionRef.current) return;
    creatingSessionRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const contact = saveContact
        ? {
            identifier: identifier.identifier,
            identifierType: identifier.identifierType,
            asset: route.asset,
            chainId: route.chainId,
            lastUsedAt: Date.now(),
          }
        : null;
      await createWithdrawalSession(identifier, route, contact);
    } catch (err) {
      setError(formatWithdrawalUserError(err));
    } finally {
      creatingSessionRef.current = false;
      setBusy(false);
    }
  }, [createWithdrawalSession, identifier, route, saveContact]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    props.onClose?.();
  }, [props.onClose]);

  if (!isOpen) return null;

  if (!themeReady) {
    return (
      <div style={{ visibility: "hidden" }}>
        <WithdrawalContainer
          embedded={embedded}
          onClose={handleClose}
          themeMode={theme.themeMode}
        >
          <WithdrawalPage title={t.withdrawalAction} compact>
            <Skeleton className="daimo-h-16 daimo-w-full" rounded="lg" />
          </WithdrawalPage>
        </WithdrawalContainer>
      </div>
    );
  }

  if (session) {
    if (props.fundingMode === "manual") {
      return (
        <ManualWithdrawalFlow
          session={session}
          amountUnits={props.amountUnits}
          connectToAddress={props.connectToAddress}
          sendManualTransaction={props.sendManualTransaction}
          sourceTokenFilter={props.sourceTokenFilter}
          embedded={embedded}
          onClose={handleClose}
          themeMode={theme.themeMode}
          onPaymentStarted={props.onPaymentStarted}
          onPaymentCompleted={props.onPaymentCompleted}
        />
      );
    }
    return (
      <DaimoModal
        sessionId={session.ref.sessionId}
        clientSecret={session.ref.clientSecret}
        embedded={embedded}
        connectToInjectedWallets={props.connectToAddress == null}
        connectToAddress={props.connectToAddress}
        connectToEvmProvider={props.evmProvider}
        walletSource={props.walletSource}
        themeMode={theme.themeMode}
        onClose={handleClose}
        onPaymentStarted={props.onPaymentStarted}
        onPaymentCompleted={props.onPaymentCompleted}
        confirmationMode="withdrawal"
      />
    );
  }

  return (
    <WithdrawalContainer
      embedded={embedded}
      onClose={handleClose}
      pageKey={step}
      themeMode={theme.themeMode}
    >
      {step === "identifier" && !contactsLoaded && (
        <WithdrawalPage title={t.withdrawalAction} compact>
          <Skeleton className="daimo-h-16 daimo-w-full" rounded="lg" />
        </WithdrawalPage>
      )}
      {step === "identifier" &&
        contactsLoaded &&
        contacts.length > 0 &&
        !showIdentifierInput && (
          <SavedDestinationsPage
            contacts={contacts}
            removingContact={removingContact}
            selectingContact={selectingContact}
            busy={busy}
            error={error}
            onAdd={() => {
              setIdentifierInput("");
              setIdentifier(null);
              setAsset(null);
              setRoute(null);
              setSaveContact(false);
              setRemovingContact(null);
              setSelectingContact(null);
              setError(null);
              setShowIdentifierInput(true);
            }}
            onSelectContact={(contact) => void selectContact(contact)}
            onRequestRemove={setRemovingContact}
            onCancelRemove={() => setRemovingContact(null)}
            onConfirmRemove={(contact) => {
              setContacts(
                removeDaimoWithdrawalContact(
                  contact,
                  props.contactStorageScope,
                  getDaimoWithdrawalStorage(),
                ),
              );
              setRemovingContact(null);
            }}
          />
        )}
      {step === "identifier" &&
        contactsLoaded &&
        (contacts.length === 0 || showIdentifierInput) && (
          <IdentifierPage
            value={identifierInput}
            busy={busy}
            error={error}
            onBack={
              contacts.length > 0
                ? () => {
                    setError(null);
                    setShowIdentifierInput(false);
                  }
                : undefined
            }
            onChange={(value) => {
              setIdentifierInput(value);
              setError(null);
            }}
            onContinue={() => void resolveIdentifier(identifierInput)}
          />
        )}
      {step === "asset" && identifier && (
        <AssetPage
          identifier={identifier}
          onBack={() => setStep("identifier")}
          onSelect={(nextAsset) => {
            setAsset(nextAsset);
            setRoute(null);
            setStep("chain");
          }}
        />
      )}
      {step === "chain" && identifier && asset && (
        <ChainPage
          identifier={identifier}
          asset={asset}
          onBack={() => setStep("asset")}
          onSelect={(nextRoute) => {
            setRoute(nextRoute);
            setStep("review");
          }}
        />
      )}
      {step === "review" && identifier && route && (
        <ReviewPage
          identifier={identifier}
          route={route}
          saveContact={saveContact}
          busy={busy}
          error={error}
          onBack={() =>
            setStep(
              identifier.identifierType === "solana" ? "identifier" : "chain",
            )
          }
          onSaveContactChange={setSaveContact}
          onContinue={() => void continueFromReview()}
        />
      )}
    </WithdrawalContainer>
  );
}

function IdentifierPage({
  value,
  busy,
  error,
  onBack,
  onChange,
  onContinue,
}: {
  value: string;
  busy: boolean;
  error: string | null;
  onBack?: () => void;
  onChange: (value: string) => void;
  onContinue: () => void;
}) {
  return (
    <WithdrawalPage title={t.withdrawalAction} onBack={onBack} compact>
      <label className="daimo-grid daimo-gap-2">
        <span className="daimo-text-sm daimo-font-medium daimo-text-[var(--daimo-text)]">
          {t.withdrawalDestinationQuestion}
        </span>
        <TextInput
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && value.trim() && !busy) onContinue();
          }}
          disabled={busy}
          placeholder={t.withdrawalIdentifierPlaceholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </label>
      {error && <WithdrawalError message={error} />}
      <PrimaryButton
        className="daimo-mx-auto"
        onClick={onContinue}
        disabled={!value.trim() || busy}
      >
        {busy ? t.withdrawalResolving : t.continue}
      </PrimaryButton>
    </WithdrawalPage>
  );
}

function SavedDestinationsPage({
  contacts,
  removingContact,
  selectingContact,
  busy,
  error,
  onAdd,
  onSelectContact,
  onRequestRemove,
  onCancelRemove,
  onConfirmRemove,
}: {
  contacts: DaimoWithdrawalContact[];
  removingContact: DaimoWithdrawalContact | null;
  selectingContact: DaimoWithdrawalContact | null;
  busy: boolean;
  error: string | null;
  onAdd: () => void;
  onSelectContact: (contact: DaimoWithdrawalContact) => void;
  onRequestRemove: (contact: DaimoWithdrawalContact) => void;
  onCancelRemove: () => void;
  onConfirmRemove: (contact: DaimoWithdrawalContact) => void;
}) {
  return (
    <WithdrawalOptionsPage title={t.withdrawalAction} maxHeight="360px">
      <ListRow
        label={
          <span className="daimo-flex daimo-items-center daimo-gap-2">
            <PlusIcon className="daimo-text-[var(--daimo-text)]" />
            <span>{t.withdrawalAddDestination}</span>
          </span>
        }
        onClick={onAdd}
        disabled={busy}
      />
      <h2 className="daimo-text-sm daimo-font-medium daimo-text-[var(--daimo-text-secondary)]">
        {t.withdrawalSavedDestinations}
      </h2>
      {contacts.map((contact) => {
        const key = getContactDisplayKey(contact);
        const removing = removingContact === contact;
        const selecting = selectingContact === contact;
        return removing ? (
          <div
            key={key}
            className="daimo-flex daimo-min-h-16 daimo-items-center daimo-justify-between daimo-gap-3 daimo-rounded-[var(--daimo-radius-lg)] daimo-bg-[var(--daimo-surface-secondary)] daimo-px-5"
          >
            <span className="daimo-text-sm daimo-text-[var(--daimo-text)]">
              {t.withdrawalRemoveDestinationConfirm}
            </span>
            <span className="daimo-flex daimo-items-center daimo-gap-1">
              <button
                type="button"
                className="daimo-min-h-11 daimo-px-2 daimo-text-sm daimo-text-[var(--daimo-text-secondary)]"
                onClick={onCancelRemove}
              >
                {t.withdrawalCancel}
              </button>
              <button
                type="button"
                className="daimo-min-h-11 daimo-px-2 daimo-text-sm daimo-font-medium daimo-text-[var(--daimo-error)]"
                onClick={() => onConfirmRemove(contact)}
              >
                {t.withdrawalRemove}
              </button>
            </span>
          </div>
        ) : (
          <div key={key} className="daimo-relative">
            <ListRow
              label={
                <span title={contact.identifier}>
                  {formatIdentifier(contact.identifier, contact.identifierType)}
                </span>
              }
              subtitle={`${contact.asset} ${t.onChain} ${getContactRoute(contact)?.chainName ?? t.withdrawalUnsupported}`}
              right={
                selecting ? (
                  <span
                    role="status"
                    aria-label={t.withdrawalCreating}
                    className="daimo-flex daimo-h-8 daimo-w-8 daimo-items-center daimo-justify-center"
                  >
                    <WithdrawalSpinner />
                  </span>
                ) : (
                  <span aria-hidden="true" className="daimo-h-8 daimo-w-8" />
                )
              }
              onClick={() => onSelectContact(contact)}
              disabled={busy}
            />
            <button
              type="button"
              aria-label={t.withdrawalRemoveDestinationLabel(
                contact.identifier,
              )}
              className="daimo-absolute daimo-right-2 daimo-top-1/2 daimo-z-10 daimo-flex daimo-h-11 daimo-w-11 -daimo-translate-y-1/2 daimo-items-center daimo-justify-center daimo-rounded-full daimo-text-[var(--daimo-text-muted)] daimo-transition-colors daimo-duration-150 hover:[@media(hover:hover)]:daimo-bg-[var(--daimo-surface-hover)] hover:[@media(hover:hover)]:daimo-text-[var(--daimo-error)] focus-visible:daimo-outline-none focus-visible:daimo-ring-2 focus-visible:daimo-ring-[var(--daimo-text-muted)]"
              disabled={busy}
              onClick={(event) => {
                event.stopPropagation();
                onRequestRemove(contact);
              }}
            >
              <TrashIcon className="" />
            </button>
          </div>
        );
      })}
      {error && <WithdrawalError message={error} />}
    </WithdrawalOptionsPage>
  );
}

function AssetPage({
  identifier,
  onBack,
  onSelect,
}: {
  identifier: ResolvedWithdrawalIdentifier;
  onBack: () => void;
  onSelect: (asset: DaimoWithdrawalDestinationAsset) => void;
}) {
  const assets = (["USDC", "USDT"] as const).filter(
    (asset) => getCompatibleRoutes(identifier, asset).length,
  );
  return (
    <WithdrawalOptionsPage
      title={t.withdrawalChooseStablecoin}
      onBack={onBack}
      maxHeight="156px"
    >
      {assets.map((asset) => (
        <ListRow
          key={asset}
          label={asset}
          right={
            <WithdrawalOptionIcon
              src={asset === "USDC" ? TokenLogo.USDC : TokenLogo.USDT}
            />
          }
          onClick={() => onSelect(asset)}
        />
      ))}
    </WithdrawalOptionsPage>
  );
}

function ChainPage({
  identifier,
  asset,
  onBack,
  onSelect,
}: {
  identifier: ResolvedWithdrawalIdentifier;
  asset: DaimoWithdrawalDestinationAsset;
  onBack: () => void;
  onSelect: (route: DaimoWithdrawalDestinationRoute) => void;
}) {
  const routes = getCompatibleRoutes(identifier, asset);
  return (
    <WithdrawalOptionsPage
      title={t.withdrawalChooseNetwork}
      onBack={onBack}
      maxHeight="308px"
    >
      {routes.map((route) => (
        <ListRow
          key={`${route.chainId}-${route.tokenAddress}`}
          label={getWithdrawalChainLabel(route)}
          right={
            <WithdrawalOptionIcon
              src={getChainLogoUrl(route.chainId, DAIMO_BASE_URL)}
            />
          }
          onClick={() => onSelect(route)}
        />
      ))}
    </WithdrawalOptionsPage>
  );
}

function ReviewPage({
  identifier,
  route,
  saveContact,
  busy,
  error,
  onBack,
  onSaveContactChange,
  onContinue,
}: {
  identifier: ResolvedWithdrawalIdentifier;
  route: DaimoWithdrawalDestinationRoute;
  saveContact: boolean;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onSaveContactChange: (checked: boolean) => void;
  onContinue: () => void;
}) {
  return (
    <WithdrawalPage title={t.withdrawalReview} onBack={onBack}>
      <div className="daimo-grid daimo-gap-4 daimo-rounded-[var(--daimo-radius-lg)] daimo-bg-[var(--daimo-surface-secondary)] daimo-p-5">
        <ReviewRow
          label={t.withdrawalRecipient}
          value={formatIdentifier(
            identifier.identifier,
            identifier.identifierType,
          )}
          fullValue={identifier.identifier}
        />
        {identifier.identifierType === "ens" && (
          <ReviewRow
            label={t.withdrawalResolvedAddress}
            value={formatIdentifier(identifier.address, "evm")}
            fullValue={identifier.address}
          />
        )}
        <ReviewRow label={t.withdrawalStablecoin} value={route.asset} />
        <ReviewRow label={t.withdrawalNetwork} value={route.chainName} />
      </div>
      <label className="daimo-flex daimo-min-h-11 daimo-cursor-pointer daimo-items-center daimo-justify-center daimo-gap-3 daimo-text-sm daimo-text-[var(--daimo-text-secondary)]">
        <input
          type="checkbox"
          checked={saveContact}
          onChange={(event) => onSaveContactChange(event.target.checked)}
          className="daimo-h-4 daimo-w-4 daimo-rounded daimo-accent-[var(--daimo-accent)]"
        />
        {t.withdrawalSaveRoute}
      </label>
      {error && <WithdrawalError message={error} />}
      <PrimaryButton
        className="daimo-mx-auto"
        onClick={onContinue}
        disabled={busy}
      >
        {busy ? t.withdrawalCreating : t.continue}
      </PrimaryButton>
    </WithdrawalPage>
  );
}

function ManualWithdrawalFlow({
  session,
  amountUnits,
  connectToAddress,
  sendManualTransaction,
  sourceTokenFilter,
  embedded,
  onClose,
  themeMode,
  onPaymentStarted,
  onPaymentCompleted,
}: {
  session: {
    ref: DaimoWithdrawalSessionRef;
    destination: DaimoWithdrawalDestination;
  };
  amountUnits?: string;
  connectToAddress?: Address;
  sendManualTransaction: (
    request: DaimoWithdrawalManualTransferRequest,
  ) => Promise<DaimoWithdrawalManualTransferResult>;
  sourceTokenFilter?: (token: DaimoPayToken) => boolean;
  embedded: boolean;
  onClose: () => void;
  themeMode?: DaimoThemeMode;
  onPaymentStarted?: () => void;
  onPaymentCompleted?: () => void;
}) {
  const client = useDaimoClient();
  const sendManualTransactionRef = useRef(sendManualTransaction);
  const sourceTokenFilterRef = useRef(sourceTokenFilter);
  const onPaymentStartedRef = useRef(onPaymentStarted);
  const onPaymentCompletedRef = useRef(onPaymentCompleted);
  sendManualTransactionRef.current = sendManualTransaction;
  sourceTokenFilterRef.current = sourceTokenFilter;
  onPaymentStartedRef.current = onPaymentStarted;
  onPaymentCompletedRef.current = onPaymentCompleted;
  const { sessionId, clientSecret } = session.ref;
  const destination = session.destination;
  const controller = useMemo(
    () =>
      new ManualWithdrawalSession(
        client,
        sessionId,
        clientSecret,
        destination,
        (request) => sendManualTransactionRef.current(request),
      ),
    [client, clientSecret, destination, sessionId],
  );
  const [submission, setSubmission] =
    useState<ManualWithdrawalSubmission | null>(null);
  const [currentSession, setCurrentSession] =
    useState<SessionPublicInfo | null>(null);
  const [adapterError, setAdapterError] = useState<string | null>(null);
  const [adapterPending, setAdapterPending] = useState(false);
  const [transfer, setTransfer] = useState<ManualWithdrawalTransfer | null>(
    null,
  );
  const [walletOptions, setWalletOptions] = useState<
    WalletPaymentOption[] | null
  >(null);
  const [walletOptionsError, setWalletOptionsError] = useState<string | null>(
    null,
  );
  const [selectedToken, setSelectedToken] =
    useState<WalletPaymentOption | null>(null);
  const startedRef = useRef(false);
  const completedRef = useRef(false);
  const fixedAmountStartedRef = useRef(false);
  const currentStatus = currentSession?.status;

  const submit = useCallback(
    async (nextTransfer: ManualWithdrawalTransfer) => {
      setTransfer(nextTransfer);
      setAdapterPending(true);
      setAdapterError(null);
      try {
        const next = await controller.start(nextTransfer);
        setSubmission(next);
        setCurrentSession(next.session);
        if (!startedRef.current) {
          startedRef.current = true;
          onPaymentStartedRef.current?.();
        }
      } catch (err) {
        setAdapterError(formatWithdrawalUserError(err));
      } finally {
        setAdapterPending(false);
      }
    },
    [controller],
  );

  useEffect(() => {
    if (amountUnits == null || fixedAmountStartedRef.current) return;
    fixedAmountStartedRef.current = true;
    void submit({ amountUnits });
  }, [amountUnits, submit]);

  const loadWalletOptions = useCallback(async () => {
    if (!connectToAddress) return;
    setWalletOptions(null);
    setWalletOptionsError(null);
    try {
      const options = await client.internal.sessions.walletOptions(sessionId, {
        clientSecret,
        evmAddress: connectToAddress,
      });
      setWalletOptions(
        filterWithdrawalWalletOptions(options, sourceTokenFilterRef.current),
      );
    } catch (err) {
      setWalletOptionsError(formatWithdrawalUserError(err));
    }
  }, [client, clientSecret, connectToAddress, sessionId]);

  useEffect(() => {
    void loadWalletOptions();
  }, [loadWalletOptions]);

  useEffect(() => {
    if (!submission || !currentStatus) return;
    if (isSessionTerminal(currentStatus)) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const result = await client.sessions.check(sessionId, {
          clientSecret,
          txHash: submission.txHash,
        });
        if (!cancelled) setCurrentSession(result.session);
      } catch {
        // Session polling is best-effort; the next interval retries.
      }
    };
    void poll();
    const interval = window.setInterval(poll, 3_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [client, clientSecret, currentStatus, sessionId, submission]);

  useEffect(() => {
    if (currentSession?.status !== "succeeded" || completedRef.current) return;
    completedRef.current = true;
    onPaymentCompletedRef.current?.();
  }, [currentSession?.status]);

  const showFooterSpacer =
    connectToAddress != null &&
    amountUnits == null &&
    transfer == null &&
    adapterError == null &&
    walletOptionsError == null;

  let content: React.ReactNode;
  if (amountUnits != null || transfer || adapterError) {
    content = (
      <ManualStatusPage
        session={currentSession}
        adapterPending={adapterPending || transfer == null}
        adapterError={adapterError}
        onRetry={() => transfer && void submit(transfer)}
      />
    );
  } else if (!connectToAddress) {
    content = (
      <ManualWithdrawalAmountPage
        onContinue={(nextAmountUnits) =>
          void submit({ amountUnits: nextAmountUnits })
        }
      />
    );
  } else if (walletOptionsError) {
    content = (
      <WithdrawalPage title={t.selectToken}>
        <WithdrawalError message={walletOptionsError} />
        <PrimaryButton
          className="daimo-mx-auto"
          onClick={() => void loadWalletOptions()}
        >
          {t.tryAgain}
        </PrimaryButton>
      </WithdrawalPage>
    );
  } else if (selectedToken) {
    content = (
      <WalletAmountPage
        token={selectedToken}
        platform={detectPlatform()}
        onBack={() => setSelectedToken(null)}
        onContinue={(amountUsd, nextAmountUnits) =>
          void submit({
            amountUnits: nextAmountUnits,
            source: {
              address: connectToAddress,
              token: selectedToken.balance.token,
              amount: getWalletTokenAmount(selectedToken, amountUsd),
            },
          })
        }
        baseUrl={DAIMO_BASE_URL}
        showLimits
      />
    );
  } else {
    content = (
      <SelectTokenPage
        options={walletOptions}
        showRequired={false}
        isLoading={walletOptions === null}
        skeletonCount={1}
        onSelect={setSelectedToken}
        onBack={null}
        baseUrl={DAIMO_BASE_URL}
        sessionId={sessionId}
      />
    );
  }

  return (
    <WithdrawalContainer
      embedded={embedded}
      onClose={onClose}
      pageKey={
        amountUnits != null || transfer || adapterError
          ? "status"
          : walletOptionsError
            ? "error"
            : selectedToken
              ? "amount"
              : "token"
      }
      showFooterSpacer={showFooterSpacer}
      themeMode={themeMode}
    >
      {content}
    </WithdrawalContainer>
  );
}

/** Filter address-aware manual sources before they are rendered. */
export function filterWithdrawalWalletOptions(
  options: WalletPaymentOption[],
  sourceTokenFilter?: (token: DaimoPayToken) => boolean,
): WalletPaymentOption[] {
  return options.filter(
    (option) =>
      option.balance.token.chainId !== solana.chainId &&
      (sourceTokenFilter?.(option.balance.token) ?? true),
  );
}

function WithdrawalContainer({
  children,
  embedded,
  onClose,
  pageKey,
  showFooterSpacer,
  themeMode,
}: {
  children: React.ReactNode;
  embedded: boolean;
  onClose: () => void;
  pageKey?: string;
  showFooterSpacer?: boolean;
  themeMode?: DaimoThemeMode;
}) {
  if (embedded) {
    return (
      <EmbeddedContainer
        showFooterSpacer={showFooterSpacer}
        themeMode={themeMode}
      >
        {children}
      </EmbeddedContainer>
    );
  }

  const controls: ModalChromeControls = { type: "close", close: { onClose } };
  return (
    <ModalContainer
      onClose={onClose}
      pageKey={pageKey}
      showFooterSpacer={showFooterSpacer}
      themeMode={themeMode}
    >
      <ModalChrome controls={controls}>{() => children}</ModalChrome>
    </ModalContainer>
  );
}

export function ManualWithdrawalAmountPage({
  onContinue,
}: {
  onContinue: (amountUnits: string) => void;
}) {
  const [amountUnits, setAmountUnits] = useState("");
  const [isValid, setIsValid] = useState(false);
  return (
    <div className="daimo-flex daimo-min-h-[360px] daimo-flex-col">
      <PageHeader title={t.enterAmount} />
      <div className="daimo-flex daimo-flex-1 daimo-flex-col daimo-items-center daimo-justify-center daimo-gap-6 daimo-p-6">
        <AmountInput
          minimum={0.01}
          maximum={Number.MAX_SAFE_INTEGER}
          decimals={2}
          onSubmit={(_amount, nextAmountUnits) => onContinue(nextAmountUnits)}
          onChange={(_amount, nextIsValid, nextAmountUnits) => {
            setAmountUnits(nextAmountUnits);
            setIsValid(nextIsValid);
          }}
        />
        <PrimaryButton
          onClick={() => isValid && onContinue(amountUnits)}
          disabled={!isValid}
          className="daimo-max-w-none"
        >
          {t.continue}
        </PrimaryButton>
      </div>
    </div>
  );
}

function ManualStatusPage({
  session,
  adapterPending,
  adapterError,
  onRetry,
}: {
  session: SessionPublicInfo | null;
  adapterPending: boolean;
  adapterError: string | null;
  onRetry: () => void;
}) {
  if (adapterError) {
    return (
      <WithdrawalPage title={t.withdrawalNotSubmitted}>
        <WithdrawalError message={adapterError} />
        <PrimaryButton className="daimo-mx-auto" onClick={onRetry}>
          {t.tryAgain}
        </PrimaryButton>
      </WithdrawalPage>
    );
  }

  const status = session?.status;
  const expired = status === "expired";
  const done = status === "succeeded" || status === "bounced";
  const title = adapterPending
    ? t.withdrawalConfirmInWallet
    : status === "processing"
      ? t.withdrawalInProgress
      : status === "succeeded"
        ? t.withdrawalCompleted
        : status === "bounced"
          ? t.withdrawalRefunded
          : expired
            ? t.withdrawalExpired
            : t.withdrawalWaitingForTransfer;
  const description = adapterPending
    ? t.withdrawalCompleteTransferInWallet
    : status === "processing"
      ? t.withdrawalFundsBeingDelivered
      : status === "succeeded"
        ? t.withdrawalReachedDestination
        : status === "bounced"
          ? t.withdrawalDeliveryFailedRefunded
          : expired
            ? t.withdrawalNoTransferBeforeExpiry
            : t.withdrawalAutoUpdate;

  return (
    <div className="daimo-flex daimo-min-h-[360px] daimo-flex-col">
      <PageHeader title={title} />
      <div className="daimo-flex daimo-flex-1 daimo-flex-col daimo-items-center daimo-justify-center daimo-gap-6 daimo-p-6 daimo-text-center">
        {expired ? (
          <div className="daimo-flex daimo-h-20 daimo-w-20 daimo-items-center daimo-justify-center daimo-rounded-full daimo-bg-[var(--daimo-error-light)]">
            <ExpiredIcon />
          </div>
        ) : (
          <ConfirmationSpinner done={done} bounced={status === "bounced"} />
        )}
        <p className="daimo-max-w-xs daimo-text-base daimo-leading-relaxed daimo-text-[var(--daimo-text-secondary)]">
          {description}
        </p>
      </div>
    </div>
  );
}

function WithdrawalPage({
  title,
  onBack,
  compact = false,
  children,
}: {
  title: string;
  onBack?: () => void;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`daimo-flex daimo-flex-col ${compact ? "" : "daimo-min-h-[360px]"}`}
    >
      <PageHeader title={title} onBack={onBack} />
      <div
        className={`daimo-grid daimo-flex-1 daimo-content-start daimo-gap-4 daimo-px-6 daimo-pb-6 ${compact ? "daimo-pt-2" : "daimo-pt-6"}`}
      >
        {children}
      </div>
    </div>
  );
}

function WithdrawalOptionsPage({
  title,
  onBack,
  maxHeight,
  children,
}: {
  title: string;
  onBack?: () => void;
  maxHeight: string;
  children: React.ReactNode;
}) {
  const { scrolled, onScroll } = useScrollBorder();
  return (
    <div className="daimo-flex daimo-min-h-0 daimo-flex-1 daimo-flex-col">
      <PageHeader title={title} onBack={onBack} borderVisible={scrolled} />
      <ScrollContent onScroll={onScroll} grow={false} maxHeight={maxHeight}>
        <div className="daimo-flex daimo-flex-col daimo-gap-3">{children}</div>
      </ScrollContent>
    </div>
  );
}

function ReviewRow({
  label,
  value,
  fullValue,
}: {
  label: string;
  value: string;
  fullValue?: string;
}) {
  return (
    <div className="daimo-flex daimo-items-center daimo-justify-between daimo-gap-4 daimo-text-sm">
      <span className="daimo-text-[var(--daimo-text-secondary)]">{label}</span>
      <span
        className="daimo-min-w-0 daimo-truncate daimo-font-medium daimo-text-[var(--daimo-text)]"
        title={fullValue}
        aria-label={fullValue}
      >
        {value}
      </span>
    </div>
  );
}

function WithdrawalOptionIcon({ src }: { src: string }) {
  return (
    <img
      src={src}
      alt=""
      className="daimo-relative daimo-h-8 daimo-w-8 daimo-rounded-[25%] daimo-object-contain"
    />
  );
}

function WithdrawalError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="daimo-mx-auto daimo-w-full daimo-max-w-xs daimo-text-center daimo-text-sm daimo-text-[var(--daimo-error)]"
    >
      {message}
    </p>
  );
}

function WithdrawalSpinner() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="daimo-animate-spin"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function formatWithdrawalUserError(err: unknown): string {
  const message = err instanceof Error ? err.message : null;
  switch (message) {
    case "enter a valid EVM address, Solana address, or ENS name":
      return t.withdrawalInvalidIdentifier;
    case "enter a valid ENS name":
      return t.withdrawalInvalidEns;
    case "Solana recipients require the Solana network":
      return t.withdrawalSolanaNetworkRequired;
    case "EVM and ENS recipients require an EVM network":
      return t.withdrawalEvmNetworkRequired;
    case "failed to initialize withdrawal":
      return t.withdrawalInitializationFailed;
    default:
      return formatUserError(err);
  }
}

function getCompatibleRoutes(
  identifier: ResolvedWithdrawalIdentifier,
  asset: DaimoWithdrawalDestinationAsset,
) {
  const wantsSolana = identifier.identifierType === "solana";
  const compatibleRoutes = daimoWithdrawalDestinationRoutes.filter(
    (route) =>
      route.asset === asset &&
      (route.chainId === solana.chainId) === wantsSolana,
  );
  if (wantsSolana) return compatibleRoutes;
  return EVM_WITHDRAWAL_CHAIN_IDS.flatMap((chainId) =>
    compatibleRoutes.filter((route) => route.chainId === chainId),
  );
}

function getWithdrawalChainLabel(route: DaimoWithdrawalDestinationRoute) {
  return route.chainId === bsc.chainId ? "BNB" : route.chainName;
}

function getContactDisplayKey(contact: DaimoWithdrawalContact) {
  return `${contact.identifier}-${contact.asset}-${contact.chainId}`;
}

function formatIdentifier(
  value: string,
  identifierType: DaimoWithdrawalContact["identifierType"],
) {
  const visibleStart = identifierType === "ens" ? 12 : 6;
  const visibleEnd = identifierType === "ens" ? 8 : 4;
  if (value.length <= visibleStart + visibleEnd + 1) return value;
  return `${value.slice(0, visibleStart)}…${value.slice(-visibleEnd)}`;
}
