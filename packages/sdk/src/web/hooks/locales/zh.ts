import type { en } from "./en.js";

/** Simplified Chinese translations for DaimoModal UI. */
export const zh: typeof en = {
  // ConfirmationPage
  confirmYourPayment: "确认付款",
  waitingForYourPayment: "等待付款",
  paymentReceived: "已收到付款",
  processingYourPayment: "正在处理付款...",
  paymentCompleted: "付款完成",
  paymentFailed: "付款失败",
  refundingYourPayment: "正在退款",
  paymentRefunded: "付款已退回",
  returnToApp: "返回应用",
  onChain: "在",

  // ExpiredPage
  expired: "已过期",
  paymentSessionExpired: "此付款会话已过期",

  // DeeplinkPage
  continueIn: "继续使用",
  toCompleteYourPayment: "以完成付款",
  openIn: "打开",
  mobileWallets: "移动钱包",
  scanWithPhone: "用手机扫码打开钱包",

  // PaymentActionPage
  continueTo: "前往",
  toCompleteYourDeposit: "以完成充值",
  depositExactlyWith: (amount: string, provider: string) =>
    `请使用${provider}准确存入${amount}，然后返回此页面。`,
  open: "打开",
  refreshInvoice: "刷新",
  estimatedOutput: "预计到账金额",
  serviceFee: "服务费",
  networkFee: "网络费",
  partnerFee: "合作伙伴费用",

  // SelectAmountPage
  selectAmount: "选择金额",
  loading: "加载中",
  continue: "继续",

  // SelectTokenPage
  selectToken: "选择代币",
  noTokensFound: "未找到代币",
  minimum: "最小",
  maximum: "最大",

  // WaitingDepositAddressPage
  deposit: "充值",
  depositOn: "充值到",
  generateNewAddress: "生成新地址",
  showQR: "显示二维码",
  hideQR: "隐藏二维码",
  oneTimeAddress: "一次性地址",
  amount: "金额",
  expiresIn: "剩余时间：",
  minutes: (min: number) => `${min}分钟`,

  // WalletAmountPage
  enterAmount: "输入金额",
  max: "最大",
  balance: "余额：",

  // ErrorPage
  error: "错误",
  reload: "重新加载",
  unknownError: "未知错误",

  // shared
  contactSupport: "联系客服",
  tellUsHowWeCanHelp: "告诉我们如何帮助您",
  showReceipt: "查看收据",
  poweredByDaimo: "Powered by Daimo",

  // containers
  close: "关闭",
  changeCountry: "更改国家/地区",

  // flows
  flowError: "错误：",
  back: "返回",
  tryAgain: "重试",

  // hooks/useSessionNav
  tronUnavailable: "Tron 暂不可用，请稍后再试。",

  // formatUserError
  networkErrorOffline: "网络错误，是否已断开连接？",
  somethingWentWrong: "出了点问题",
  applePayRegionUnsupported: "你所在的地区不支持 Apple Pay 入金。",
  applePayUsPhoneRequired: "Apple Pay 入金需要美国电话号码。",
  applePayUnavailable: "Apple Pay 不可用",

  // embed page
  missingSessionParam: "缺少会话参数",
  failedToLoadSession: "无法加载会话",

  // account flow
  accountEmail: "邮箱",
  accountEmailDesc: "输入您的邮箱以继续。",
  accountEmailMethodDesc: (method: string) =>
    `输入您的邮箱以继续使用 ${method}。`,
  accountEmailPlaceholder: "email@example.com",
  accountOtp: "输入验证码",
  accountOtpSent: "我们已通过 Daimo 发送验证码到",
  accountOtpSentViaDaimo: (destination: string) =>
    `我们已通过 Daimo 向 ${destination} 发送验证码。`,
  accountCreatingWallet: "正在准备您的账户",
  accountWalletConsent: "验证即表示您同意：",
  accountEnrollment: "账户设置",
  accountEnrollmentRetry: "重新提交文件",
  accountEnrollmentPending: "正在审核您的信息",
  accountEnrollmentPendingDesc:
    "感谢你提交信息。如需更多信息，我们会与你联系。",
  accountProviderPending: "正在完成账户设置",
  accountProviderPendingDesc: "这可能需要一点时间",
  accountLegalNameTitle: "您的法定姓名",
  accountLegalNameDesc: "请按银行账户或身份证件上的姓名准确填写。",
  accountLegalNameFirst: "名字",
  accountLegalNameLast: "姓氏",
  accountEnrollmentRejected: "无法完成验证",
  accountSuspended: "账户已暂停",
  accountEnrollmentError: "账户设置失败",
  accountRegionUnavailableTitle: "地区不可用",
  accountRegionUnavailableHeading: "您不符合该地区的条件",
  accountRegionUnavailableDescription: "此账户无法在该地区使用。",
  accountRegionUnavailableCta: "返回",
  accountPayment: "输入金额",
  accountResendCode: "重新发送验证码",
  accountVerify: "验证",
  accountPhone: "验证您的手机号",
  accountPhoneDesc:
    "我们将发送6位验证码。请使用美国手机号码；不支持 VoIP 号码。",
  accountSubmit: "提交",
  accountFieldRequired: "必填",
  accountPhoneInvalid: "请输入有效的电话号码",
  accountBooleanYes: "是",
  accountBooleanNo: "否",
  accountSelectBank: "选择银行",
  accountSearchInstitutions: "搜索机构...",
  accountOtherInstitutions: "其他机构",
  accountBankTransfer: "银行转账",
  accountInteracConfirmTitle: "确认 Interac 请求",
  accountInteracConfirmDesc:
    "您的银行会显示来自 PayTrie AB Inc 的请求，它是本次存款在加拿大的 Interac 支付合作伙伴。",
  accountInteracConfirmAmount: "金额",
  accountInteracConfirmSender: "发送方",
  accountInteracConfirmBank: "银行",
  accountInteracConfirmProcessingTime: "处理时间",
  accountInteracConfirmOpenInterac: "打开 Interac",
  accountInteracWaitingInstructions: (amount: string, processingTime: string) =>
    `请在您的银行批准来自 PayTrie AB Inc 的 ${amount} 请求。PayTrie 是本次存款在加拿大的 Interac 支付合作伙伴。批准后，转账可能需要 ${processingTime} 才会到账。这是正常情况；请保持此页面打开，它会自动继续。`,
  accountBankDetails: "转账详情",
  accountDirections: "操作指南",
  accountDirectionsStep: (current: number, total: number) =>
    `第 ${current} 步，共 ${total} 步`,
  accountDirectionsPrevious: "上一步",
  accountDirectionsNext: "下一步",
  accountDirectionsGoToStep: (step: number) => `转到第 ${step} 步`,
  accountDirectionsShowInstructions: "查看存款说明",
  accountBankDetailsCopied: "已复制",
  accountBankDetailsMemoWarning: "请在转账中包含此备注",
  accountBankDetailsAutoDetect: (amount: string) =>
    `请通过银行转账准确发送 ${amount}，然后返回此页面。`,
  accountTosTitle: "服务条款",
  accountTosDesc: "继续前，请同意服务条款和隐私政策。",
  accountTosTerms: "服务条款",
  accountTosPrivacy: "隐私政策",
  accountTosCta: "继续",
  accountKycIntroTitle: "验证您的身份",
  accountKycIntroDesc:
    "请确认一些信息以使用此充值方式。您的信息会保持加密和私密。",
  accountKycIntroCta: "继续",
  accountHostedKycDesktopDesc: "请在单独窗口完成身份验证，然后返回此页面。",
  accountHostedKycMobileDesc: "请在此弹窗外完成身份验证，然后返回此页面。",
  accountHostedKycTitle: "身份验证",
  accountHostedKycCta: "打开验证",
  accountHostedLivenessTitle: "活体检测",
  accountHostedLivenessDesc: "请拍摄自拍以完成身份验证，然后返回此页面。",
  accountHostedLivenessCta: "开始活体检测",
  accountHostedActionDesktopSuffix: "请在单独窗口打开，然后返回此页面。",
  accountHostedActionMobileSuffix: "请在此弹窗外打开，然后返回此页面。",
  accountKycTrustEncrypted: "已加密",
  accountKycTrustPrivate: "私密",
  accountKycTrustQuick: "2分钟",
  accountDepositReceived: "已收到充值",
  accountDepositComplete: "充值完成",
  accountViewAccount: "在账户中查看",

  // account status
  depositDetected: "检测到充值",
  depositProcessing: "正在处理充值",
  depositFinalizing: "正在完成充值",

  // error states
  errorGeneric: "出了点问题，请重试。",
  errorDepositFailed: "无法处理您的充值，请重试。",
  errorAccountSetup: "无法设置您的账户，请重试。",
  errorConnectionLost: "连接已断开，请检查网络后重试。",

  // session page
  connect: "连接",
  connectWallet: "连接钱包",
  noWalletsFound: "未找到钱包",
  walletUnavailable: "钱包不可用",
  walletDisconnected: "钱包已断开",
  switchToChain: (chain: string) => `请切换到 ${chain}`,
  transactionFailed: "交易失败",
  insufficientGas: "Gas 不足。请通过下方联系客服。",
  paymentCancelled: "付款已取消",
  confirmInWallet: "在钱包中确认",
  retryPayment: "重试付款",
  closeAndReturn: "关闭此页面并返回应用",

  // FiatPopupPage / popup surface
  popupCloseThisPage: "您可以关闭此页面。",
};
