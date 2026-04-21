import type { en } from "./en.js";

/** Japanese translations for DaimoModal UI. */
export const ja: typeof en = {
  // ConfirmationPage
  confirmYourPayment: "お支払いの確認",
  waitingForYourPayment: "お支払いをお待ちしています",
  paymentReceived: "支払いを受け取りました",
  processingYourPayment: "お支払いを処理中...",
  paymentCompleted: "支払い完了",
  paymentFailed: "支払い失敗",
  refundingYourPayment: "返金処理中",
  paymentRefunded: "支払いが返却されました",
  returnToApp: "アプリに戻る",
  onChain: "（",

  // ExpiredPage
  expired: "期限切れ",
  paymentSessionExpired: "この支払いセッションは期限切れです",

  // DeeplinkPage
  continueIn: "",
  toCompleteYourPayment: "で支払いを完了してください",
  openIn: "",
  mobileWallets: "モバイルウォレット",
  scanWithPhone: "スマートフォンでスキャンしてウォレットを開く",

  // ExchangePage
  continueTo: "",
  toCompleteYourDeposit: "で入金を完了してください",
  open: "開く",
  refreshInvoice: "更新",

  // SelectAmountPage
  selectAmount: "金額を選択",
  loading: "読み込み中...",
  continue: "続ける",

  // SelectTokenPage
  selectToken: "トークンを選択",
  noTokensFound: "トークンが見つかりません",
  minimum: "最小",
  maximum: "最大",

  // WaitingDepositAddressPage
  deposit: "入金",
  depositOn: "入金先：",
  generateNewAddress: "新しいアドレスを生成",
  showQR: "QRコードを表示",
  hideQR: "QRコードを隠す",
  oneTimeAddress: "ワンタイムアドレス",
  amount: "金額",
  expiresIn: "残り時間：",

  // WalletAmountPage
  enterAmount: "金額を入力",
  max: "最大",
  balance: "残高：",

  // ErrorPage
  error: "エラー",
  reload: "再読み込み",
  unknownError: "不明なエラー",

  // shared
  contactSupport: "サポートに連絡",
  tellUsHowWeCanHelp: "お困りの内容をお聞かせください",
  showReceipt: "領収書を表示",
  poweredByDaimo: "Powered by Daimo",

  // containers
  close: "閉じる",

  // flows
  flowError: "エラー：",
  back: "戻る",
  tryAgain: "再試行",

  // hooks/useSessionNav
  tronUnavailable: "Tronは現在利用できません。後でもう一度お試しください。",

  // formatUserError
  networkErrorOffline: "ネットワークエラー。オフラインですか？",
  somethingWentWrong: "問題が発生しました",

  // embed page
  missingSessionParam: "セッションパラメータがありません",
  failedToLoadSession: "セッションの読み込みに失敗しました",

  // account flow
  accountEmail: "Daimoにログイン",
  accountEmailDesc: "メールアドレスを入力してください",
  accountEmailPlaceholder: "email@example.com",
  accountOtp: "確認コードを入力",
  accountOtpSent: "確認コードを送信しました：",
  accountCreatingWallet: "アカウントを設定中",
  accountEnrollment: "本人確認",
  accountEnrollmentRetry: "書類を再提出",
  accountEnrollmentPending: "書類を確認中",
  accountEnrollmentPendingDesc: "通常数分で完了します",
  accountProviderPending: "アカウントを登録中",
  accountProviderPendingDesc: "プロバイダーの設定を完了しています",
  accountEnrollmentRejected: "本人確認が拒否されました",
  accountSuspended: "アカウントが停止されました",
  accountEnrollmentError: "本人確認に失敗しました",
  accountRegionUnavailableTitle: "地域が利用できません",
  accountRegionUnavailableHeading: "この地域ではご利用いただけません",
  accountRegionUnavailableDescription:
    "このアカウントではこの地域をご利用いただけません。",
  accountRegionUnavailableCta: "戻る",
  accountPayment: "金額を入力",
  accountResendCode: "コードを再送信",
  accountVerify: "確認",
  accountPhone: "電話番号の確認",
  accountPhoneDesc: "6桁の確認コードをSMSでお送りします。",
  accountSubmit: "送信",
  accountSelectBank: "銀行を選択",
  accountSearchInstitutions: "金融機関を検索...",
  accountOtherInstitutions: "その他の金融機関",
  accountBankTransfer: "銀行振込",
  accountBankDetails: "振込詳細",
  accountBankDetailsCopied: "コピーしました",
  accountBankDetailsMemoWarning: "振込時にこのメモを含めてください",
  accountBankTransferSubmittedTitle: "送金手続き中",
  accountBankTransferSubmittedDesc:
    "銀行振込には1〜3営業日かかる場合があります。このウィンドウを閉じて、アカウントページで進捗を確認できます。",
  accountTosTitle: "利用規約",
  accountTosDesc: "続行するには、利用規約とプライバシーポリシーに同意してください。",
  accountTosTerms: "利用規約",
  accountTosPrivacy: "プライバシーポリシー",
  accountTosCta: "続ける",
  accountKycIntroTitle: "本人確認",
  accountKycIntroDesc:
    "銀行振込には法規制により本人確認が必要です。データは暗号化され、第三者と共有されることはありません。",
  accountKycIntroCta: "続ける",
  accountDepositReceived: "入金を受け取りました",
  accountDepositComplete: "入金完了",
  accountViewAccount: "アカウントで確認",

  // account status
  depositDetected: "入金を検出",
  depositProcessing: "入金処理中",
  depositFinalizing: "入金完了処理中",

  // error states
  errorGeneric: "問題が発生しました。もう一度お試しください。",
  errorDepositFailed: "入金を処理できませんでした。もう一度お試しください。",
  errorAccountSetup:
    "アカウントを設定できませんでした。もう一度お試しください。",
  errorConnectionLost:
    "接続が切れました。ネットワークを確認してもう一度お試しください。",

  // session page
  connect: "接続",
  connectWallet: "ウォレットを接続",
  walletUnavailable: "ウォレットが利用できません",
  walletDisconnected: "ウォレットが切断されました",
  switchToChain: (chain: string) => `${chain}に切り替えてください`,
  transactionFailed: "トランザクション失敗",
  paymentCancelled: "支払いがキャンセルされました",
  retryPayment: "支払いを再試行",
  closeAndReturn: "このページを閉じてアプリに戻る",
};
