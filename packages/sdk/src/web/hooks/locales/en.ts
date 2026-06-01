/** English (default) strings for DaimoModal UI. */
export const en = {
  // ConfirmationPage
  confirmYourPayment: "Confirm Your Payment",
  waitingForYourPayment: "Waiting for Your Payment",
  paymentReceived: "Payment Received",
  processingYourPayment: "Processing Your Payment...",
  paymentCompleted: "Payment Completed",
  paymentFailed: "Payment Failed",
  refundingYourPayment: "Refunding Your Payment",
  paymentRefunded: "Payment Bounced",
  returnToApp: "Return to App",
  onChain: "on",

  // ExpiredPage
  expired: "Expired",
  paymentSessionExpired: "This payment session has expired",

  // DeeplinkPage
  continueIn: "Continue in",
  toCompleteYourPayment: "to complete your payment",
  openIn: "Open in",
  mobileWallets: "Mobile Wallets",
  scanWithPhone: "Scan with your phone to open wallet",

  // ExchangePage
  continueTo: "Continue to",
  toCompleteYourDeposit: "to complete your deposit",
  open: "Open",
  refreshInvoice: "Refresh",

  // SelectAmountPage
  selectAmount: "Select Amount",
  loading: "Loading",
  continue: "Continue",

  // SelectTokenPage
  selectToken: "Select Token",
  noTokensFound: "No tokens found",
  minimum: "Minimum",
  maximum: "Maximum",

  // WaitingDepositAddressPage
  deposit: "Deposit",
  depositOn: "Deposit on",
  generateNewAddress: "Generate New Address",
  showQR: "Show QR",
  hideQR: "Hide QR",
  oneTimeAddress: "One-Time Address",
  amount: "Amount",
  expiresIn: "Expires in:",

  // WalletAmountPage
  enterAmount: "Enter Amount",
  max: "Max",
  balance: "Balance:",

  // ErrorPage
  error: "Error",
  reload: "Reload",
  unknownError: "unknown error",

  // shared
  contactSupport: "Contact Support",
  tellUsHowWeCanHelp: "Tell us how we can help",
  showReceipt: "Show Receipt",
  poweredByDaimo: "Powered by Daimo",

  // containers
  close: "Close",

  // flows
  flowError: "Error:",
  back: "Back",
  tryAgain: "Try again",

  // hooks/useSessionNav
  tronUnavailable: "Tron unavailable. Try again later.",

  // formatUserError
  networkErrorOffline: "Network error. Offline?",
  somethingWentWrong: "Something went wrong",
  applePayRegionUnsupported:
    "Apple Pay deposits are not supported in your region.",
  applePayUsPhoneRequired: "Apple Pay deposits require a US phone number.",

  // embed page
  missingSessionParam: "missing session parameter",
  failedToLoadSession: "failed to load session",

  // account flow
  accountEmail: "Sign in to Daimo",
  accountEmailDesc: "Enter your email to get started",
  accountEmailPlaceholder: "email@example.com",
  accountOtp: "Enter verification code",
  accountOtpSent: "We sent a code to",
  accountCreatingWallet: "Preparing your account",
  accountEnrollment: "Account setup",
  accountEnrollmentRetry: "Resubmit documents",
  accountEnrollmentPending: "Reviewing your information",
  accountEnrollmentPendingDesc:
    "Thanks for submitting your information. We'll be in touch if we need anything else.",
  accountProviderPending: "Finalizing account",
  accountProviderPendingDesc: "This may take a moment",
  accountEnrollmentRejected: "Verification could not be completed",
  accountSuspended: "Account suspended",
  accountEnrollmentError: "Account setup failed",
  accountRegionUnavailableTitle: "Region unavailable",
  accountRegionUnavailableHeading: "You are not eligible for this region",
  accountRegionUnavailableDescription: "This account cannot use this region.",
  accountRegionUnavailableCta: "Go back",
  accountPayment: "Enter amount",
  accountResendCode: "Resend code",
  accountVerify: "Verify",
  accountPhone: "Verify your phone",
  accountPhoneDesc: "We'll text you a 6-digit code to verify your number.",
  accountSubmit: "Submit",
  accountSelectBank: "Select Bank",
  accountSearchInstitutions: "Search institutions...",
  accountOtherInstitutions: "Other institutions",
  accountBankTransfer: "Bank Transfer",
  accountBankDetails: "Transfer Details",
  accountDirections: "Directions",
  accountDirectionsStep: (current: number, total: number) =>
    `Step ${current} of ${total}`,
  accountDirectionsPrevious: "Previous step",
  accountDirectionsNext: "Next step",
  accountDirectionsGoToStep: (step: number) => `Go to step ${step}`,
  accountDirectionsShowInstructions: "Show deposit instructions",
  accountBankDetailsCopied: "Copied",
  accountBankDetailsMemoWarning: "Include this memo in your transfer",
  accountBankDetailsAutoDetect: (amount: string) =>
    `Send exactly ${amount} via bank transfer and return to this page.`,
  accountTosTitle: "Terms of Service",
  accountTosDesc:
    "To continue, please agree to the terms of service and privacy policy.",
  accountTosTerms: "Terms of Service",
  accountTosPrivacy: "Privacy Policy",
  accountTosCta: "Continue",
  accountKycIntroTitle: "Verify your identity",
  accountKycIntroDesc:
    "Confirm a few details so you can use this deposit method. Your information stays encrypted and private.",
  accountKycIntroCta: "Continue",
  accountKycTrustEncrypted: "Encrypted",
  accountKycTrustPrivate: "Private",
  accountKycTrustQuick: "2 min",
  accountDepositReceived: "Deposit received",
  accountDepositComplete: "Deposit complete",
  accountViewAccount: "View in Account",

  // account status
  depositDetected: "Deposit Detected",
  depositProcessing: "Deposit Processing",
  depositFinalizing: "Deposit Finalizing",

  // error states
  errorGeneric: "Something went wrong. Please try again.",
  errorDepositFailed: "We couldn't process your deposit. Please try again.",
  errorAccountSetup: "We couldn't set up your account. Please try again.",
  errorConnectionLost:
    "Connection lost. Please check your network and try again.",

  // session page
  connect: "Connect",
  connectWallet: "Connect Wallet",
  noWalletsFound: "No wallets found",
  walletUnavailable: "Wallet unavailable",
  walletDisconnected: "Wallet disconnected",
  switchToChain: (chain: string) => `Please switch to ${chain}`,
  transactionFailed: "Transaction Failed",
  paymentCancelled: "Payment Cancelled",
  confirmInWallet: "Confirm In Wallet",
  retryPayment: "Retry Payment",
  closeAndReturn: "Close this page and return to app",
};
