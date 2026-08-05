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
import type { DaimoThemeMode } from "../../common/theme.js";
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
import { PrimaryButton } from "./buttons.js";
import { ConfirmationSpinner } from "./ConfirmationSpinner.js";
import { DaimoModal } from "./DaimoModal.js";
import { EmbeddedContainer } from "./containers.js";
import { ExpiredIcon, PlusIcon, TrashIcon } from "./icons.js";
import { Skeleton } from "./Skeleton.js";
import {
  getChainLogoUrl,
  ListRow,
  PageHeader,
  ScrollContent,
  TextInput,
  useScrollBorder,
} from "./shared.js";
import {
  ManualWithdrawalSession,
  buildDaimoWithdrawalDestination,
  getContactRoute,
  readDaimoWithdrawalContacts,
  removeDaimoWithdrawalContact,
  resolveWithdrawalIdentifier,
  saveDaimoWithdrawalContact,
  type DaimoWithdrawalContact,
  type DaimoWithdrawalManualTransferRequest,
  type DaimoWithdrawalManualTransferResult,
  type ManualWithdrawalSubmission,
  type ResolvedWithdrawalIdentifier,
} from "../withdrawal.js";

export type {
  DaimoWithdrawalDestination,
  DaimoWithdrawalFundingMode,
  DaimoWithdrawalManualTransferRequest,
  DaimoWithdrawalManualTransferResult,
};

type DaimoWithdrawalSessionRef = {
  sessionId: string;
  clientSecret: string;
};

type DaimoWithdrawalBaseProps = {
  createSession: (input: {
    destination: DaimoWithdrawalDestination;
    fundingMode: DaimoWithdrawalFundingMode;
  }) => Promise<DaimoWithdrawalSessionRef>;
  themeMode?: DaimoThemeMode;
  onPaymentStarted?: () => void;
  onPaymentCompleted?: () => void;
};

export type DaimoWithdrawalProps = DaimoWithdrawalBaseProps &
  (
    | {
        fundingMode: "injected-wallet";
        connectToAddress?: Address;
        sendManualTransaction?: never;
      }
    | {
        fundingMode: "manual";
        connectToAddress?: never;
        sendManualTransaction: (
          request: DaimoWithdrawalManualTransferRequest,
        ) => Promise<DaimoWithdrawalManualTransferResult>;
      }
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
  const client = useDaimoClient();
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const creatingSessionRef = useRef(false);
  const [session, setSession] = useState<{
    ref: DaimoWithdrawalSessionRef;
    destination: DaimoWithdrawalDestination;
  } | null>(null);

  useEffect(() => {
    setContacts(readDaimoWithdrawalContacts(window.localStorage));
    setContactsLoaded(true);
  }, []);

  const resolveIdentifierValue = useCallback(
    (value: string) =>
      resolveWithdrawalIdentifier(value, (name) => client.ens.resolve(name)),
    [client],
  );

  const resolveIdentifier = useCallback(
    async (value: string) => {
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
            throw new Error("usdc withdrawals on solana are unavailable");
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
        setError(formatUserError(err));
        return null;
      } finally {
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
            window.localStorage,
          ),
        );
      }
      setSession({ ref, destination });
    },
    [props.createSession, props.fundingMode],
  );

  const selectContact = useCallback(
    async (contact: DaimoWithdrawalContact) => {
      const contactRoute = getContactRoute(contact);
      if (!contactRoute) {
        setError("this saved route is no longer supported");
        return;
      }
      if (creatingSessionRef.current) return;
      creatingSessionRef.current = true;
      setBusy(true);
      setError(null);
      try {
        const resolved = await resolveIdentifierValue(contact.identifier);
        await createWithdrawalSession(resolved, contactRoute, contact);
      } catch (err) {
        setError(formatUserError(err));
      } finally {
        creatingSessionRef.current = false;
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
      setError(formatUserError(err));
    } finally {
      creatingSessionRef.current = false;
      setBusy(false);
    }
  }, [createWithdrawalSession, identifier, route, saveContact]);

  if (session) {
    if (props.fundingMode === "manual") {
      return (
        <ManualWithdrawalFlow
          session={session}
          sendManualTransaction={props.sendManualTransaction}
          themeMode={props.themeMode}
          onPaymentStarted={props.onPaymentStarted}
          onPaymentCompleted={props.onPaymentCompleted}
        />
      );
    }
    return (
      <DaimoModal
        sessionId={session.ref.sessionId}
        clientSecret={session.ref.clientSecret}
        embedded
        connectToInjectedWallets={props.connectToAddress == null}
        connectToAddress={props.connectToAddress}
        themeMode={props.themeMode}
        onPaymentStarted={props.onPaymentStarted}
        onPaymentCompleted={props.onPaymentCompleted}
        confirmationMode="withdrawal"
      />
    );
  }

  return (
    <EmbeddedContainer themeMode={props.themeMode}>
      {step === "identifier" && !contactsLoaded && (
        <WithdrawalPage title="Withdraw" compact>
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
            error={error}
            onAdd={() => {
              setIdentifierInput("");
              setIdentifier(null);
              setAsset(null);
              setRoute(null);
              setSaveContact(false);
              setRemovingContact(null);
              setError(null);
              setShowIdentifierInput(true);
            }}
            onSelectContact={(contact) => void selectContact(contact)}
            onRequestRemove={setRemovingContact}
            onCancelRemove={() => setRemovingContact(null)}
            onConfirmRemove={(contact) => {
              setContacts(
                removeDaimoWithdrawalContact(contact, window.localStorage),
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
    </EmbeddedContainer>
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
    <WithdrawalPage title="Withdraw" onBack={onBack} compact>
      <label className="daimo-grid daimo-gap-2">
        <span className="daimo-text-sm daimo-font-medium daimo-text-[var(--daimo-text)]">
          Where do you want to withdraw?
        </span>
        <TextInput
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && value.trim()) onContinue();
          }}
          placeholder="EVM address, ENS, or Solana address"
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
        {busy ? "Resolving…" : "Continue"}
      </PrimaryButton>
    </WithdrawalPage>
  );
}

function SavedDestinationsPage({
  contacts,
  removingContact,
  error,
  onAdd,
  onSelectContact,
  onRequestRemove,
  onCancelRemove,
  onConfirmRemove,
}: {
  contacts: DaimoWithdrawalContact[];
  removingContact: DaimoWithdrawalContact | null;
  error: string | null;
  onAdd: () => void;
  onSelectContact: (contact: DaimoWithdrawalContact) => void;
  onRequestRemove: (contact: DaimoWithdrawalContact) => void;
  onCancelRemove: () => void;
  onConfirmRemove: (contact: DaimoWithdrawalContact) => void;
}) {
  return (
    <WithdrawalOptionsPage title="Withdraw" maxHeight="360px">
      <ListRow
        label={
          <span className="daimo-flex daimo-items-center daimo-gap-2">
            <PlusIcon className="daimo-text-[var(--daimo-text)]" />
            <span>Add a new destination</span>
          </span>
        }
        onClick={onAdd}
      />
      <h2 className="daimo-text-sm daimo-font-medium daimo-text-[var(--daimo-text-secondary)]">
        Saved
      </h2>
      {contacts.map((contact) => {
        const key = getContactDisplayKey(contact);
        const removing = removingContact === contact;
        return removing ? (
          <div
            key={key}
            className="daimo-flex daimo-min-h-16 daimo-items-center daimo-justify-between daimo-gap-3 daimo-rounded-[var(--daimo-radius-lg)] daimo-bg-[var(--daimo-surface-secondary)] daimo-px-5"
          >
            <span className="daimo-text-sm daimo-text-[var(--daimo-text)]">
              Remove this destination?
            </span>
            <span className="daimo-flex daimo-items-center daimo-gap-1">
              <button
                type="button"
                className="daimo-min-h-11 daimo-px-2 daimo-text-sm daimo-text-[var(--daimo-text-secondary)]"
                onClick={onCancelRemove}
              >
                Cancel
              </button>
              <button
                type="button"
                className="daimo-min-h-11 daimo-px-2 daimo-text-sm daimo-font-medium daimo-text-[var(--daimo-error)]"
                onClick={() => onConfirmRemove(contact)}
              >
                Remove
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
              subtitle={`${contact.asset} on ${getContactRoute(contact)?.chainName ?? "Unsupported"}`}
              right={
                <span aria-hidden="true" className="daimo-h-8 daimo-w-8" />
              }
              onClick={() => onSelectContact(contact)}
            />
            <button
              type="button"
              aria-label={`Remove ${contact.identifier}`}
              className="daimo-absolute daimo-right-2 daimo-top-1/2 daimo-z-10 daimo-flex daimo-h-11 daimo-w-11 -daimo-translate-y-1/2 daimo-items-center daimo-justify-center daimo-rounded-full daimo-text-[var(--daimo-text-muted)] daimo-transition-colors daimo-duration-150 hover:[@media(hover:hover)]:daimo-bg-[var(--daimo-surface-hover)] hover:[@media(hover:hover)]:daimo-text-[var(--daimo-error)] focus-visible:daimo-outline-none focus-visible:daimo-ring-2 focus-visible:daimo-ring-[var(--daimo-text-muted)]"
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
      title="Choose stablecoin"
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
      title="Choose network"
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
    <WithdrawalPage title="Review withdrawal" onBack={onBack}>
      <div className="daimo-grid daimo-gap-4 daimo-rounded-[var(--daimo-radius-lg)] daimo-bg-[var(--daimo-surface-secondary)] daimo-p-5">
        <ReviewRow
          label="Recipient"
          value={formatIdentifier(
            identifier.identifier,
            identifier.identifierType,
          )}
          fullValue={identifier.identifier}
        />
        {identifier.identifierType === "ens" && (
          <ReviewRow
            label="Resolved address"
            value={formatIdentifier(identifier.address, "evm")}
            fullValue={identifier.address}
          />
        )}
        <ReviewRow label="Stablecoin" value={route.asset} />
        <ReviewRow label="Network" value={route.chainName} />
      </div>
      <label className="daimo-flex daimo-min-h-11 daimo-cursor-pointer daimo-items-center daimo-justify-center daimo-gap-3 daimo-text-sm daimo-text-[var(--daimo-text-secondary)]">
        <input
          type="checkbox"
          checked={saveContact}
          onChange={(event) => onSaveContactChange(event.target.checked)}
          className="daimo-h-4 daimo-w-4 daimo-rounded daimo-accent-[var(--daimo-accent)]"
        />
        Save this route for next time
      </label>
      {error && <WithdrawalError message={error} />}
      <PrimaryButton
        className="daimo-mx-auto"
        onClick={onContinue}
        disabled={busy}
      >
        {busy ? "Creating withdrawal…" : "Continue"}
      </PrimaryButton>
    </WithdrawalPage>
  );
}

function ManualWithdrawalFlow({
  session,
  sendManualTransaction,
  themeMode,
  onPaymentStarted,
  onPaymentCompleted,
}: {
  session: {
    ref: DaimoWithdrawalSessionRef;
    destination: DaimoWithdrawalDestination;
  };
  sendManualTransaction: (
    request: DaimoWithdrawalManualTransferRequest,
  ) => Promise<DaimoWithdrawalManualTransferResult>;
  themeMode?: DaimoThemeMode;
  onPaymentStarted?: () => void;
  onPaymentCompleted?: () => void;
}) {
  const client = useDaimoClient();
  const controller = useMemo(
    () =>
      new ManualWithdrawalSession(
        client,
        session.ref.sessionId,
        session.ref.clientSecret,
        session.destination,
        sendManualTransaction,
      ),
    [client, sendManualTransaction, session],
  );
  const [submission, setSubmission] =
    useState<ManualWithdrawalSubmission | null>(null);
  const [currentSession, setCurrentSession] =
    useState<SessionPublicInfo | null>(null);
  const [adapterError, setAdapterError] = useState<string | null>(null);
  const [adapterPending, setAdapterPending] = useState(true);
  const startedRef = useRef(false);
  const completedRef = useRef(false);
  const currentStatus = currentSession?.status;
  const { sessionId, clientSecret } = session.ref;

  const submit = useCallback(async () => {
    setAdapterPending(true);
    setAdapterError(null);
    try {
      const next = await controller.start();
      setSubmission(next);
      setCurrentSession(next.session);
      if (!startedRef.current) {
        startedRef.current = true;
        onPaymentStarted?.();
      }
    } catch (err) {
      setAdapterError(formatUserError(err));
    } finally {
      setAdapterPending(false);
    }
  }, [controller, onPaymentStarted]);

  useEffect(() => {
    void submit();
  }, [submit]);

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
    onPaymentCompleted?.();
  }, [currentSession?.status, onPaymentCompleted]);

  return (
    <EmbeddedContainer showFooterSpacer={false} themeMode={themeMode}>
      <ManualStatusPage
        session={currentSession}
        adapterPending={adapterPending}
        adapterError={adapterError}
        onRetry={() => void submit()}
      />
    </EmbeddedContainer>
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
      <WithdrawalPage title="Withdrawal not submitted">
        <WithdrawalError message={adapterError} />
        <PrimaryButton className="daimo-mx-auto" onClick={onRetry}>
          Try again
        </PrimaryButton>
      </WithdrawalPage>
    );
  }

  const status = session?.status;
  const expired = status === "expired";
  const done = status === "succeeded" || status === "bounced";
  const title = adapterPending
    ? "Confirm in your wallet"
    : status === "processing"
      ? "Withdrawal in progress"
      : status === "succeeded"
        ? "Withdrawal completed"
        : status === "bounced"
          ? "Withdrawal refunded"
          : expired
            ? "Withdrawal expired"
            : "Waiting for your transfer";
  const description = adapterPending
    ? "Complete the transfer in your wallet to continue."
    : status === "processing"
      ? "Funds were received and are being delivered."
      : status === "succeeded"
        ? "The stablecoins reached the selected destination."
        : status === "bounced"
          ? "The transfer could not be delivered and was refunded."
          : expired
            ? "No transfer was detected before this session expired."
            : "Your withdrawal will update automatically when funds arrive.";

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
