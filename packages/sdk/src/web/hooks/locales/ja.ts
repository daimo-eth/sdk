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
  loading: "読み込み中",
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
  minutes: (min: number) => `${min}分`,

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
  changeCountry: "国を変更",

  // flows
  flowError: "エラー：",
  back: "戻る",
  tryAgain: "再試行",

  // hooks/useSessionNav
  tronUnavailable: "Tronは現在利用できません。後でもう一度お試しください。",

  // formatUserError
  networkErrorOffline: "ネットワークエラー。オフラインですか？",
  somethingWentWrong: "問題が発生しました",
  applePayRegionUnsupported:
    "お住まいの地域ではApple Pay入金をご利用いただけません。",
  applePayUsPhoneRequired: "Apple Pay入金には米国の電話番号が必要です。",
  applePayUnavailable: "Apple Payは利用できません",

  // embed page
  missingSessionParam: "セッションパラメータがありません",
  failedToLoadSession: "セッションの読み込みに失敗しました",

  // account flow
  accountEmail: "メールアドレス",
  accountEmailDesc: "続行するにはメールアドレスを入力してください。",
  accountEmailMethodDesc: (method: string) =>
    `${method}を続行するにはメールアドレスを入力してください。`,
  accountEmailPlaceholder: "email@example.com",
  accountOtp: "確認コードを入力",
  accountOtpSent: "Daimo経由で確認コードを送信しました：",
  accountOtpSentViaDaimo: (destination: string) =>
    `Daimo経由で${destination}に確認コードを送信しました。`,
  accountCreatingWallet: "アカウントを準備中",
  accountEnrollment: "アカウント設定",
  accountEnrollmentRetry: "書類を再提出",
  accountEnrollmentPending: "情報を確認中",
  accountEnrollmentPendingDesc:
    "情報をご提出いただきありがとうございます。追加情報が必要な場合はご連絡します。",
  accountProviderPending: "アカウントを仕上げています",
  accountProviderPendingDesc: "少し時間がかかる場合があります",
  accountLegalNameTitle: "法的氏名",
  accountLegalNameDesc:
    "銀行口座または身分証明書に記載されている通りに氏名を入力してください。",
  accountLegalNameFirst: "名",
  accountLegalNameLast: "姓",
  accountEnrollmentRejected: "確認を完了できませんでした",
  accountSuspended: "アカウントが停止されました",
  accountEnrollmentError: "アカウント設定に失敗しました",
  accountRegionUnavailableTitle: "地域が利用できません",
  accountRegionUnavailableHeading: "この地域ではご利用いただけません",
  accountRegionUnavailableDescription:
    "このアカウントではこの地域をご利用いただけません。",
  accountRegionUnavailableCta: "戻る",
  accountPayment: "金額を入力",
  accountResendCode: "コードを再送信",
  accountVerify: "確認",
  accountPhone: "電話番号の確認",
  accountPhoneDesc:
    "6桁の確認コードをSMSでお送りします。米国の携帯電話番号を使用してください。VoIP番号はご利用いただけません。",
  accountSubmit: "送信",
  accountFieldRequired: "必須",
  accountBooleanYes: "はい",
  accountBooleanNo: "いいえ",
  accountSelectBank: "銀行を選択",
  accountSearchInstitutions: "金融機関を検索...",
  accountOtherInstitutions: "その他の金融機関",
  accountBankTransfer: "銀行振込",
  accountInteracConfirmTitle: "Interacリクエストを確認",
  accountInteracConfirmDesc:
    "銀行には、この入金のカナダ向けInterac決済パートナーであるPayTrie AB Incからのリクエストとして表示されます。",
  accountInteracConfirmAmount: "金額",
  accountInteracConfirmSender: "送信者",
  accountInteracConfirmBank: "銀行",
  accountInteracConfirmProcessingTime: "処理時間",
  accountInteracConfirmOpenInterac: "Interacを開く",
  accountInteracWaitingInstructions: (
    amount: string,
    processingTime: string,
  ) =>
    `銀行でPayTrie AB Incからの${amount}のリクエストを承認してください。PayTrieはこの入金のカナダ向けInterac決済パートナーです。承認後、送金が届くまで${processingTime}かかることがあります。これは通常の動作です。このページを開いたままにすると、自動的に続行します。`,
  accountBankDetails: "振込詳細",
  accountDirections: "手順",
  accountDirectionsStep: (current: number, total: number) =>
    `ステップ ${current} / ${total}`,
  accountDirectionsPrevious: "前のステップ",
  accountDirectionsNext: "次のステップ",
  accountDirectionsGoToStep: (step: number) => `ステップ ${step}へ移動`,
  accountDirectionsShowInstructions: "入金手順を見る",
  accountBankDetailsCopied: "コピーしました",
  accountBankDetailsMemoWarning: "振込時にこのメモを含めてください",
  accountBankDetailsAutoDetect: (amount: string) =>
    `銀行振込で正確に${amount}を送金し、このページに戻ってください。`,
  accountTosTitle: "利用規約",
  accountTosDesc:
    "続行するには、利用規約とプライバシーポリシーに同意してください。",
  accountTosTerms: "利用規約",
  accountTosPrivacy: "プライバシーポリシー",
  accountTosCta: "続ける",
  accountKycIntroTitle: "本人確認",
  accountKycIntroDesc:
    "この入金方法を利用するために、いくつかの情報を確認します。情報は暗号化され、非公開で扱われます。",
  accountKycIntroCta: "続ける",
  accountHostedKycDesktopDesc:
    "別ウィンドウで本人確認を完了し、このページに戻ってください。",
  accountHostedKycMobileDesc:
    "このモーダルの外で本人確認を完了し、このページに戻ってください。",
  accountHostedKycTitle: "本人確認",
  accountHostedKycCta: "本人確認を開く",
  accountHostedLivenessTitle: "ライブネスチェック",
  accountHostedLivenessDesc:
    "セルフィーを撮影して本人確認を完了し、このページに戻ってください。",
  accountHostedLivenessCta: "ライブネスチェックを開始",
  accountHostedActionDesktopSuffix:
    "別ウィンドウで開き、このページに戻ってください。",
  accountHostedActionMobileSuffix:
    "このモーダルの外で開き、このページに戻ってください。",
  accountKycTrustEncrypted: "暗号化",
  accountKycTrustPrivate: "非公開",
  accountKycTrustQuick: "2分",
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
  noWalletsFound: "ウォレットが見つかりません",
  walletUnavailable: "ウォレットが利用できません",
  walletDisconnected: "ウォレットが切断されました",
  switchToChain: (chain: string) => `${chain}に切り替えてください`,
  transactionFailed: "トランザクション失敗",
  insufficientGas:
    "ガス代が不足しています。以下からサポートにお問い合わせください。",
  paymentCancelled: "支払いがキャンセルされました",
  confirmInWallet: "ウォレットで確認",
  retryPayment: "支払いを再試行",
  closeAndReturn: "このページを閉じてアプリに戻る",

  // FiatPopupPage / popup surface
  popupCloseThisPage: "このページを閉じてください。",
};
