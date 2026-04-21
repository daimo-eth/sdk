import type { en } from "./en.js";

/** Korean translations for DaimoModal UI. */
export const ko: typeof en = {
  // ConfirmationPage
  confirmYourPayment: "결제 확인",
  waitingForYourPayment: "결제 대기 중",
  paymentReceived: "결제 수신 완료",
  processingYourPayment: "결제 처리 중...",
  paymentCompleted: "결제 완료",
  paymentFailed: "결제 실패",
  refundingYourPayment: "환불 처리 중",
  paymentRefunded: "결제가 반환되었습니다",
  returnToApp: "앱으로 돌아가기",
  onChain: "",

  // ExpiredPage
  expired: "만료됨",
  paymentSessionExpired: "이 결제 세션이 만료되었습니다",

  // DeeplinkPage
  continueIn: "",
  toCompleteYourPayment: "에서 결제를 완료하세요",
  openIn: "",
  mobileWallets: "모바일 지갑",
  scanWithPhone: "휴대폰으로 스캔하여 지갑 열기",

  // ExchangePage
  continueTo: "",
  toCompleteYourDeposit: "에서 입금을 완료하세요",
  open: "열기",
  refreshInvoice: "새로고침",

  // SelectAmountPage
  selectAmount: "금액 선택",
  loading: "로딩 중...",
  continue: "계속",

  // SelectTokenPage
  selectToken: "토큰 선택",
  noTokensFound: "토큰을 찾을 수 없습니다",
  minimum: "최소",
  maximum: "최대",

  // WaitingDepositAddressPage
  deposit: "입금",
  depositOn: "입금 대상:",
  generateNewAddress: "새 주소 생성",
  showQR: "QR 코드 표시",
  hideQR: "QR 코드 숨기기",
  oneTimeAddress: "일회용 주소",
  amount: "금액",
  expiresIn: "남은 시간:",

  // WalletAmountPage
  enterAmount: "금액 입력",
  max: "최대",
  balance: "잔액:",

  // ErrorPage
  error: "오류",
  reload: "새로고침",
  unknownError: "알 수 없는 오류",

  // shared
  contactSupport: "고객 지원",
  tellUsHowWeCanHelp: "어떻게 도와드릴까요",
  showReceipt: "영수증 보기",
  poweredByDaimo: "Powered by Daimo",

  // containers
  close: "닫기",

  // flows
  flowError: "오류:",
  back: "뒤로",
  tryAgain: "다시 시도",

  // hooks/useSessionNav
  tronUnavailable: "Tron을 사용할 수 없습니다. 나중에 다시 시도하세요.",

  // formatUserError
  networkErrorOffline: "네트워크 오류. 오프라인인가요?",
  somethingWentWrong: "문제가 발생했습니다",

  // embed page
  missingSessionParam: "세션 매개변수가 없습니다",
  failedToLoadSession: "세션을 불러오지 못했습니다",

  // account flow
  accountEmail: "Daimo 로그인",
  accountEmailDesc: "이메일을 입력하여 시작하세요",
  accountEmailPlaceholder: "email@example.com",
  accountOtp: "인증 코드 입력",
  accountOtpSent: "인증 코드를 전송했습니다:",
  accountCreatingWallet: "계정 설정 중",
  accountEnrollment: "본인 인증",
  accountEnrollmentRetry: "서류 재제출",
  accountEnrollmentPending: "서류 검토 중",
  accountEnrollmentPendingDesc: "보통 몇 분 정도 소요됩니다",
  accountProviderPending: "계정 등록 중",
  accountProviderPendingDesc: "제공업체 설정을 완료하는 중입니다",
  accountEnrollmentRejected: "인증이 거부되었습니다",
  accountSuspended: "계정이 정지되었습니다",
  accountEnrollmentError: "인증 실패",
  accountRegionUnavailableTitle: "지역 이용 불가",
  accountRegionUnavailableHeading: "이 지역에서는 이용할 수 없습니다",
  accountRegionUnavailableDescription: "이 계정은 해당 지역에서 사용할 수 없습니다.",
  accountRegionUnavailableCta: "돌아가기",
  accountPayment: "금액 입력",
  accountResendCode: "코드 재전송",
  accountVerify: "인증",
  accountPhone: "전화번호 인증",
  accountPhoneDesc: "6자리 인증 코드를 문자로 보내드립니다.",
  accountSubmit: "제출",
  accountSelectBank: "은행 선택",
  accountSearchInstitutions: "금융기관 검색...",
  accountOtherInstitutions: "기타 금융기관",
  accountBankTransfer: "은행 이체",
  accountBankDetails: "이체 정보",
  accountBankDetailsCopied: "복사됨",
  accountBankDetailsMemoWarning: "이체 시 이 메모를 포함해 주세요",
  accountBankTransferSubmittedTitle: "이체 진행 중",
  accountBankTransferSubmittedDesc:
    "은행 이체는 1~3영업일이 소요될 수 있습니다. 이 창을 닫고 계정 페이지에서 진행 상황을 확인할 수 있습니다.",
  accountTosTitle: "이용약관",
  accountTosDesc: "계속하려면 이용약관 및 개인정보 처리방침에 동의해 주세요.",
  accountTosTerms: "이용약관",
  accountTosPrivacy: "개인정보 처리방침",
  accountTosCta: "계속",
  accountKycIntroTitle: "본인 인증",
  accountKycIntroDesc:
    "법규에 따라 은행 이체 시 본인 인증이 필요합니다. 데이터는 암호화되며 제3자와 공유되지 않습니다.",
  accountKycIntroCta: "계속",
  accountDepositReceived: "입금 수신 완료",
  accountDepositComplete: "입금 완료",
  accountViewAccount: "계정에서 확인",

  // account status
  depositDetected: "입금 감지됨",
  depositProcessing: "입금 처리 중",
  depositFinalizing: "입금 완료 처리 중",

  // error states
  errorGeneric: "문제가 발생했습니다. 다시 시도해 주세요.",
  errorDepositFailed: "입금을 처리할 수 없습니다. 다시 시도해 주세요.",
  errorAccountSetup: "계정을 설정할 수 없습니다. 다시 시도해 주세요.",
  errorConnectionLost: "연결이 끊어졌습니다. 네트워크를 확인하고 다시 시도해 주세요.",

  // session page
  connect: "연결",
  connectWallet: "지갑 연결",
  walletUnavailable: "지갑을 사용할 수 없습니다",
  walletDisconnected: "지갑 연결이 해제되었습니다",
  switchToChain: (chain: string) => `${chain}(으)로 전환해 주세요`,
  transactionFailed: "트랜잭션 실패",
  paymentCancelled: "결제가 취소되었습니다",
  retryPayment: "결제 재시도",
  closeAndReturn: "이 페이지를 닫고 앱으로 돌아가기",
};
