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
open-amount session. Wrap it in `DaimoSDKProvider` so session polling uses the
Daimo API.

The callbacks should call your authenticated backend, which resolves ENS and
creates the session with your Daimo API key; never expose that key or a paid RPC
endpoint in browser code.

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
        resolveEns={resolveWithdrawalEns}
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
widget uses it to isolate saved destinations in local storage. `resolveEns`
must authenticate the caller before forwarding a name to an upstream resolver.
Pass the organization theme returned by your backend through `theme`; the
widget waits for a custom stylesheet before showing recipient UI. An explicit
`themeMode` prop overrides the theme's light/dark/system mode while retaining
its stylesheet.
Use `connectToAddress` when the host already has an EVM wallet connected. In
manual mode, provide `sendManualTransaction`; it receives a receiver address
that the widget deliberately never renders:

```tsx
<DaimoWithdrawal
  fundingMode="manual"
  contactStorageScope={currentUser.id}
  resolveEns={resolveWithdrawalEns}
  createSession={createWithdrawalSession}
  sendManualTransaction={async ({ receiverAddress, expiresAt }) => {
    const txHash = await hostWallet.sendStablecoin({
      to: receiverAddress,
      expiresAt,
    });
    return { txHash };
  }}
/>
```

The manual adapter owns source token, source network, amount selection, and
transaction construction. It should send supported USDC or USDT from a
supported EVM network, resolve only after the transaction is submitted or
handed off, and reject only when retrying that same session is safe. Returning
the transaction hash lets session polling detect the transfer sooner.

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
