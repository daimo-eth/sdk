/** Error raised by a wallet provider (connect or transaction), tagged with the wallet's display name for user-facing prefixing. */
export class WalletError extends Error {
  constructor(
    readonly walletName: string | null,
    readonly walletCause: unknown,
  ) {
    super(
      walletCause instanceof Error ? walletCause.message : String(walletCause),
    );
    this.name = "WalletError";
  }
}

/** Prefix a message with the wallet name, e.g. "Rabby error: ...". No-op when the wallet is unknown. */
export function prefixWalletError(
  walletName: string | null,
  message: string,
): string {
  return walletName ? `${walletName} error: ${message}` : message;
}
