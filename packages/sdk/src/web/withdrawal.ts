import type { Address, Hex } from "viem";
import { getAddress, isAddress } from "viem";
import { normalize } from "viem/ens";

import type { DaimoClient } from "../client/createDaimoClient.js";
import { solana } from "../common/chain.js";
import type { SessionPublicInfo } from "../common/session.js";
import {
  getDaimoWithdrawalDestinationRoute,
  type DaimoWithdrawalDestination,
  type DaimoWithdrawalDestinationAsset,
  type DaimoWithdrawalDestinationRoute,
} from "../common/withdrawal.js";
import { zSolanaAddress, type SolanaAddress } from "../common/primitives.js";

export type DaimoWithdrawalIdentifierType = "evm" | "ens" | "solana";

export type ResolvedWithdrawalIdentifier =
  | { identifier: string; identifierType: "evm"; address: Address }
  | { identifier: string; identifierType: "ens"; address: Address }
  | {
      identifier: string;
      identifierType: "solana";
      address: SolanaAddress;
    };

export type DaimoWithdrawalContact = {
  identifier: string;
  identifierType: DaimoWithdrawalIdentifierType;
  asset: DaimoWithdrawalDestinationAsset;
  chainId: number;
  lastUsedAt: number;
};

export type DaimoWithdrawalManualTransferRequest = {
  sessionId: string;
  receiverAddress: Address;
  destination: DaimoWithdrawalDestination;
  expiresAt: number;
};

export type DaimoWithdrawalManualTransferResult = void | {
  txHash?: Hex;
};

type WithdrawalStorage = Pick<Storage, "getItem" | "setItem">;
type WithdrawalStorageHost = { readonly localStorage: WithdrawalStorage };
type EnsResolver = (name: string) => Promise<{ address: Address }>;
type ManualTransferAdapter = (
  request: DaimoWithdrawalManualTransferRequest,
) => Promise<DaimoWithdrawalManualTransferResult>;

const CONTACTS_STORAGE_KEY = "daimo.withdrawal.contacts";
const CONTACTS_VERSION = 1;
const MAX_CONTACTS = 12;

/** Normalize an EVM address, Solana address, or ENS name for review. */
export async function resolveWithdrawalIdentifier(
  input: string,
  resolveEns: EnsResolver,
): Promise<ResolvedWithdrawalIdentifier> {
  const identifier = input.trim();
  if (isAddress(identifier)) {
    return {
      identifier: getAddress(identifier),
      identifierType: "evm",
      address: getAddress(identifier),
    };
  }

  if (zSolanaAddress.safeParse(identifier).success) {
    return { identifier, identifierType: "solana", address: identifier };
  }

  if (!identifier.includes(".")) {
    throw new Error("enter a valid EVM address, Solana address, or ENS name");
  }

  let name: string;
  try {
    name = normalize(identifier);
  } catch {
    throw new Error("enter a valid ENS name");
  }
  const result = await resolveEns(name);
  return {
    identifier: name,
    identifierType: "ens",
    address: getAddress(result.address),
  };
}

export function buildDaimoWithdrawalDestination(
  identifier: ResolvedWithdrawalIdentifier,
  route: DaimoWithdrawalDestinationRoute,
): DaimoWithdrawalDestination {
  if (identifier.identifierType === "solana") {
    if (route.chainId !== solana.chainId) {
      throw new Error("Solana recipients require the Solana network");
    }
    return {
      type: "solana",
      address: identifier.address,
      tokenAddress: route.tokenAddress,
    };
  }

  if (route.chainId === solana.chainId) {
    throw new Error("EVM and ENS recipients require an EVM network");
  }
  return {
    type: "evm",
    address: getAddress(identifier.address),
    chainId: route.chainId,
    tokenAddress: getAddress(route.tokenAddress),
  };
}

export function readDaimoWithdrawalContacts(
  storageScope: string,
  storage: WithdrawalStorage | null,
): DaimoWithdrawalContact[] {
  const storageKey = getContactsStorageKey(storageScope);
  if (!storage || !storageKey) return [];
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== CONTACTS_VERSION) return [];
    if (!Array.isArray(parsed.contacts)) return [];
    const seen = new Set<string>();
    return parsed.contacts
      .filter(isDaimoWithdrawalContact)
      .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
      .filter((contact) => {
        const key = getContactKey(contact);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, MAX_CONTACTS);
  } catch {
    return [];
  }
}

export function saveDaimoWithdrawalContact(
  contact: DaimoWithdrawalContact,
  storageScope: string,
  storage: WithdrawalStorage | null,
): DaimoWithdrawalContact[] {
  const key = getContactKey(contact);
  const contacts = [
    contact,
    ...readDaimoWithdrawalContacts(storageScope, storage).filter(
      (candidate) => getContactKey(candidate) !== key,
    ),
  ].slice(0, MAX_CONTACTS);
  writeContacts(contacts, storageScope, storage);
  return contacts;
}

export function removeDaimoWithdrawalContact(
  contact: DaimoWithdrawalContact,
  storageScope: string,
  storage: WithdrawalStorage | null,
): DaimoWithdrawalContact[] {
  const key = getContactKey(contact);
  const contacts = readDaimoWithdrawalContacts(storageScope, storage).filter(
    (candidate) => getContactKey(candidate) !== key,
  );
  writeContacts(contacts, storageScope, storage);
  return contacts;
}

/** Access browser storage without assuming the localStorage getter is usable. */
export function getDaimoWithdrawalStorage(
  host: WithdrawalStorageHost = globalThis,
): WithdrawalStorage | null {
  try {
    return host.localStorage || null;
  } catch {
    return null;
  }
}

/** Manual-mode controller that keeps the hidden receiver stable across retry. */
export class ManualWithdrawalSession {
  private paymentMethodPromise: Promise<{
    receiverAddress: Address;
    expiresAt: number;
    session: SessionPublicInfo;
  }> | null = null;
  private submissionPromise: Promise<ManualWithdrawalSubmission> | null = null;
  private submission: ManualWithdrawalSubmission | null = null;

  constructor(
    private client: DaimoClient,
    private sessionId: string,
    private clientSecret: string,
    private destination: DaimoWithdrawalDestination,
    private sendManualTransaction: ManualTransferAdapter,
  ) {}

  start(): Promise<ManualWithdrawalSubmission> {
    if (this.submission) return Promise.resolve(this.submission);
    if (this.submissionPromise) return this.submissionPromise;

    const promise = this.submit();
    this.submissionPromise = promise;
    void promise
      .then(
        (submission) => {
          this.submission = submission;
        },
        () => undefined,
      )
      .finally(() => {
        if (this.submissionPromise === promise) this.submissionPromise = null;
      });
    return promise;
  }

  private async submit(): Promise<ManualWithdrawalSubmission> {
    const paymentMethod = await this.getPaymentMethod();
    const result = await this.sendManualTransaction({
      sessionId: this.sessionId,
      receiverAddress: paymentMethod.receiverAddress,
      destination: this.destination,
      expiresAt: paymentMethod.expiresAt,
    });
    return { session: paymentMethod.session, txHash: result?.txHash };
  }

  private getPaymentMethod() {
    if (!this.paymentMethodPromise) {
      const promise = this.client.sessions.paymentMethods
        .create(this.sessionId, {
          clientSecret: this.clientSecret,
          paymentMethod: { type: "evm" },
        })
        .then(({ session }) => {
          if (session.paymentMethod?.type !== "evm") {
            throw new Error("failed to initialize withdrawal");
          }
          return {
            receiverAddress: session.paymentMethod.receiverAddress,
            expiresAt: session.expiresAt,
            session,
          };
        });
      this.paymentMethodPromise = promise;
      void promise.catch(() => {
        if (this.paymentMethodPromise === promise) {
          this.paymentMethodPromise = null;
        }
      });
    }
    return this.paymentMethodPromise;
  }
}

export type ManualWithdrawalSubmission = {
  session: SessionPublicInfo;
  txHash?: Hex;
};

export function getContactRoute(
  contact: DaimoWithdrawalContact,
): DaimoWithdrawalDestinationRoute | undefined {
  return getDaimoWithdrawalDestinationRoute(contact.asset, contact.chainId);
}

function writeContacts(
  contacts: DaimoWithdrawalContact[],
  storageScope: string,
  storage: WithdrawalStorage | null,
) {
  const storageKey = getContactsStorageKey(storageScope);
  if (!storage || !storageKey) return;
  try {
    storage.setItem(
      storageKey,
      JSON.stringify({ version: CONTACTS_VERSION, contacts }),
    );
  } catch {
    // Contacts are optional; storage failures must not block a withdrawal.
  }
}

function getContactsStorageKey(storageScope: string): string | null {
  const scope = storageScope.trim();
  if (!scope) return null;
  return `${CONTACTS_STORAGE_KEY}.${encodeURIComponent(scope)}`;
}

function getContactKey(contact: DaimoWithdrawalContact): string {
  const identifier =
    contact.identifierType === "solana"
      ? contact.identifier
      : contact.identifier.toLowerCase();
  return `${identifier}-${contact.asset}-${contact.chainId}`;
}

function isDaimoWithdrawalContact(
  value: unknown,
): value is DaimoWithdrawalContact {
  if (!isRecord(value)) return false;
  if (
    !(
      typeof value.identifier === "string" &&
      (value.identifierType === "evm" ||
        value.identifierType === "ens" ||
        value.identifierType === "solana") &&
      (value.asset === "USDC" || value.asset === "USDT") &&
      typeof value.chainId === "number" &&
      Number.isInteger(value.chainId) &&
      typeof value.lastUsedAt === "number" &&
      Number.isFinite(value.lastUsedAt)
    )
  ) {
    return false;
  }
  const route = getDaimoWithdrawalDestinationRoute(value.asset, value.chainId);
  if (!route) return false;
  if (
    (value.identifierType === "solana") !==
    (route.chainId === solana.chainId)
  ) {
    return false;
  }
  return isValidContactIdentifier(value.identifier, value.identifierType);
}

function isValidContactIdentifier(
  identifier: string,
  identifierType: DaimoWithdrawalIdentifierType,
): boolean {
  if (identifierType === "evm") return isAddress(identifier);
  if (identifierType === "solana") {
    return zSolanaAddress.safeParse(identifier).success;
  }
  if (!identifier.includes(".")) return false;
  try {
    normalize(identifier);
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null;
}
