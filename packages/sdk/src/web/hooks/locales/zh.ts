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

  // ExchangePage
  continueTo: "前往",
  toCompleteYourDeposit: "以完成充值",
  open: "打开",
  refreshInvoice: "刷新",

  // SelectAmountPage
  selectAmount: "选择金额",
  loading: "加载中...",
  continue: "继续",

  // SelectTokenPage
  selectToken: "选择代币",
  noTokensFound: "未找到代币",
  minimum: "最小",
  maximum: "最大",
  fee: "费用",

  // WaitingDepositAddressPage
  deposit: "充值",
  depositOn: "充值到",
  generateNewAddress: "生成新地址",
  showQR: "显示二维码",
  hideQR: "隐藏二维码",
  oneTimeAddress: "一次性地址",
  amount: "金额",
  expiresIn: "剩余时间：",

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

  // flows
  flowError: "错误：",
  back: "返回",
  tryAgain: "重试",

  // hooks/useSessionNav
  tronUnavailable: "Tron 暂不可用，请稍后再试。",

  // formatUserError
  networkErrorOffline: "网络错误，是否已断开连接？",
  somethingWentWrong: "出了点问题",

  // embed page
  missingSessionParam: "缺少会话参数",
  failedToLoadSession: "无法加载会话",

  // account flow
  accountEmail: "登录 Daimo",
  accountEmailDesc: "输入您的邮箱以开始",
  accountEmailPlaceholder: "email@example.com",
  accountOtp: "输入验证码",
  accountOtpSent: "我们已发送验证码到",
  accountCreatingWallet: "正在设置您的账户",
  accountEnrollment: "验证您的身份",
  accountEnrollmentRetry: "重新提交文件",
  accountEnrollmentPending: "正在审核您的文件",
  accountEnrollmentPendingDesc: "通常需要几分钟",
  accountProviderPending: "正在注册您的账户",
  accountProviderPendingDesc: "正在完成服务商设置",
  accountEnrollmentRejected: "验证被拒绝",
  accountSuspended: "账户已暂停",
  accountEnrollmentError: "验证失败",
  accountRegionUnavailableTitle: "地区不可用",
  accountRegionUnavailableHeading: "您不符合该地区的条件",
  accountRegionUnavailableDescription: "此账户无法在该地区使用。",
  accountRegionUnavailableCta: "返回",
  accountPayment: "输入金额",
  accountResendCode: "重新发送验证码",
  accountVerify: "验证",
  accountPhone: "验证您的手机号",
  accountPhoneDesc: "我们将发送6位验证码以验证您的手机号。",
  accountSubmit: "提交",
  accountSelectBank: "选择银行",
  accountSearchInstitutions: "搜索机构...",
  accountOtherInstitutions: "其他机构",
  accountBankTransfer: "银行转账",
  accountBankDetails: "转账详情",
  accountBankDetailsCopied: "已复制",
  accountBankDetailsMemoWarning: "请在转账中包含此备注",
  accountBankTransferSubmittedTitle: "转账进行中",
  accountBankTransferSubmittedDesc:
    "银行转账通常需要1-3个工作日。您可以关闭此窗口，并在账户页面跟踪进度。",
  accountTosTitle: "服务条款",
  accountTosDesc: "继续前，请同意服务条款和隐私政策。",
  accountTosTerms: "服务条款",
  accountTosPrivacy: "隐私政策",
  accountTosCta: "继续",
  accountKycIntroTitle: "验证您的身份",
  accountKycIntroDesc:
    "法规要求银行转账需进行身份验证。您的数据已加密，绝不会被分享。",
  accountKycIntroCta: "继续",
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
  walletUnavailable: "钱包不可用",
  walletDisconnected: "钱包已断开",
  switchToChain: (chain: string) => `请切换到 ${chain}`,
  transactionFailed: "交易失败",
  paymentCancelled: "付款已取消",
  retryPayment: "重试付款",
  closeAndReturn: "关闭此页面并返回应用",
};
