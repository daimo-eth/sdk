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

### Payment methods

Payment method identity, product category, and client execution are separate
concepts:

- `PaymentMethodId` is the stable identity selected by a customer, such as
  `CashApp`, `MtPelerin`, or `Stripe`.
- `PaymentMethodCategory` is derived product metadata such as `paymentApp`,
  `onramp`, or `exchange`.
- `PaymentAction` tells a client what to do next, such as open a URL or render
  an embedded widget.

Custom UIs create action-based methods through the same request shape:

```ts
const result = await client.sessions.paymentMethods.create(sessionId, {
  clientSecret,
  paymentMethod: {
    id: "CashApp",
    sourceAmount: { currency: "USD", units: "25.00" },
    platform: "ios",
  },
});

switch (result.action?.type) {
  case "openUrl":
    window.open(result.action.url, "_blank");
    break;
  case "embeddedWidget":
    // Mount result.action.sdk with its scoped client credentials.
    break;
}
```

The built-in modal performs this call and renders the action automatically.
Provider-shaped exchange and Stripe request/response fields remain accepted as
deprecated compatibility adapters.

### Styles

Import `@daimo/sdk/web/theme.css` for the built-in web UI. The distributed stylesheet namespaces internal classes with `daimo-` so it can coexist with a host app's Tailwind build.

`@daimo/sdk/web/styles.css` remains available as an equivalent alias.

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
