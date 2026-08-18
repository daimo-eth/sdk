<img src="https://daimo.com/og-image.png" alt="Daimo" width="400" />

# Daimo SDK

```
pnpm add @daimo/sdk
```

See [docs.daimo.com](https://docs.daimo.com) for more.

### Entry points

- `@daimo/sdk/common` — session types, API schemas, and constants
- `@daimo/sdk/client` — thin REST client wrapping `/v1/*` Daimo API, useful for custom UI
- `@daimo/sdk/web` — React modal (`<DaimoModal>`) and hooks for the built-in deposit UI
- `@daimo/sdk/native` — React Native deposit UI (`<DaimoFrameRN>`) over `react-native-webview`

### Styles

Import `@daimo/sdk/web/theme.css` for the built-in web UI. The distributed stylesheet namespaces internal classes with `daimo-` so it can coexist with a host app's Tailwind build.

`@daimo/sdk/web/styles.css` remains available as an equivalent alias.

### Withdrawal widget

`DaimoWithdrawal` collects a recipient address or ENS name, destination
stablecoin, and destination network before asking your server to create an
open-amount session. Wrap it in `DaimoSDKProvider` so ENS resolution and session
polling use the provider's configured Daimo API URL.

ENS works without additional configuration. The `createSession` callback must
call your authenticated backend with your Daimo API key; never expose that key
in browser code.

```tsx
import "@daimo/sdk/web/theme.css";
import { DaimoSDKProvider, DaimoWithdrawal } from "@daimo/sdk/web";

export function Withdrawal() {
  return (
    <DaimoSDKProvider>
      <DaimoWithdrawal
        fundingMode="injected-wallet"
        contactStorageScope={currentUser.id}
        theme={accountTheme}
        createSession={(input) =>
          fetch("/api/withdrawal/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          }).then((response) => response.json())
        }
      />
    </DaimoSDKProvider>
  );
}
```

`contactStorageScope` must be a stable authenticated user or account ID. The
widget uses it to isolate saved destinations in local storage. ENS is always
resolved on Ethereum mainnet, regardless of the selected destination network.
Pass the organization theme returned by your backend through `theme`; the
widget waits for a custom stylesheet before showing recipient UI. An explicit
`themeMode` prop overrides the theme's light/dark/system mode while retaining
its stylesheet.

Pass `resolveEns` only when your integration intentionally needs custom ENS
resolution. The callback receives an ENSIP-15-normalized name and takes
precedence over Daimo's hosted resolver. Keep paid RPC credentials behind your
own authenticated backend.
Use `connectToAddress` when the host already has an EVM wallet connected. In
an injected-wallet flow, set `walletSource="evm"` to exclude Solana-only
wallets and use only the EVM provider from a dual-chain wallet. The default is
`"all"`, which preserves mixed EVM and Solana funding.

Manual mode never submits an EIP-1193 provider transaction. The host owns the
transfer through `sendManualTransaction`, while the SDK preserves receiver
reuse, duplicate-submit protection, retries, polling, and lifecycle callbacks.
Choose one manual amount mode:

- Pass `amountUnits` for a positive fixed decimal amount. The SDK submits it
  immediately after destination selection; this variant cannot also take
  `connectToAddress`.
- Omit both `amountUnits` and `connectToAddress` for generic USD entry. The SDK
  accepts `$0.01+` with at most two decimal places.
- Omit `amountUnits` and pass an EVM `connectToAddress` for read-only token and
  balance selection. The callback receives the selected source token and exact
  balance-capped raw amount. The amount page shows and enforces the minimum and
  maximum returned by Daimo wallet options.

```tsx
<DaimoWithdrawal
  fundingMode="manual"
  connectToAddress={embeddedWallet.address}
  contactStorageScope={currentUser.id}
  createSession={createWithdrawalSession}
  sendManualTransaction={async ({ receiverAddress, source }) => {
    if (!source) throw new Error("source token is required");
    const txHash = await embeddedWallet.sendToken({
      chainId: source.token.chainId,
      token: source.token.token,
      to: receiverAddress,
      amount: source.amount,
    });
    return { txHash };
  }}
/>
```

The complete adapter request is:

```ts
type DaimoWithdrawalManualTransferRequest = {
  sessionId: string;
  receiverAddress: Address;
  destination: DaimoWithdrawalDestination;
  expiresAt: number;
  amountUnits: string;
  source?: {
    address: Address;
    token: DaimoPayToken;
    amount: bigint;
  };
};
```

`amountUnits` is the exact fixed or SDK-entered decimal string. `source` is
always present in the address-aware path and omitted for fixed or generic
manual entry. `source.amount` is the exact raw token amount. Resolve only after
the transaction is submitted or handed off, and reject only when retrying the
same session is safe. A retry reuses the same hidden receiver. Returning the
transaction hash lets session polling detect the transfer sooner.

For generic manual entry, omit the address:

```tsx
<DaimoWithdrawal
  fundingMode="manual"
  contactStorageScope={currentUser.id}
  createSession={createWithdrawalSession}
  sendManualTransaction={async ({
    receiverAddress,
    amountUnits,
    expiresAt,
  }) => {
    const txHash = await hostWallet.sendStablecoin({
      to: receiverAddress,
      amountUnits,
      expiresAt,
    });
    return { txHash };
  }}
/>
```

Pass `amountUnits="25.00"` to the same component for fixed manual submission.
`evmProvider` is forbidden in every manual variant.

### Account enrollment interactions

The built-in account flow is a thin renderer over the versioned
`EnrollmentInteraction` contract. The server selects the next semantic
interaction, localized copy, typed form revision, opaque submission action,
hosted return behavior, and bounded polling policy. The SDK exhaustively renders
form, OTP/resend, account-phone verification, hosted action, wait/review,
retry, terminal, and active states without branching on a rail or provider.

`DaimoClient.account.getEnrollmentInteraction` and
`submitEnrollmentAction` are the primary client methods. The older
`startEnrollment` and specialized form/OTP methods remain available during the
supported compatibility window. The built-in renderer falls back to those
legacy routes only when a server does not yet expose the additive generic HTTP
routes; remove that adapter after one full supported release window shows no
route-absence fallback in telemetry.
