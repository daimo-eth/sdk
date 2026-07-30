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

  // PaymentActionPage
  continueTo: "",
  toCompleteYourDeposit: "에서 입금을 완료하세요",
  open: "열기",
  refreshInvoice: "새로고침",
  estimatedOutput: "예상 수령액",
  serviceFee: "서비스 수수료",
  networkFee: "네트워크 수수료",
  partnerFee: "파트너 수수료",

  // SelectAmountPage
  selectAmount: "금액 선택",
  loading: "로딩 중",
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
  minutes: (min: number) => `${min}분`,

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
  changeCountry: "국가 변경",

  // flows
  flowError: "오류:",
  back: "뒤로",
  tryAgain: "다시 시도",

  // hooks/useSessionNav
  tronUnavailable: "Tron을 사용할 수 없습니다. 나중에 다시 시도하세요.",

  // formatUserError
  networkErrorOffline: "네트워크 오류. 오프라인인가요?",
  somethingWentWrong: "문제가 발생했습니다",
  applePayRegionUnsupported:
    "현재 지역에서는 Apple Pay 입금을 사용할 수 없습니다.",
  applePayUsPhoneRequired: "Apple Pay 입금에는 미국 전화번호가 필요합니다.",
  applePayUnavailable: "Apple Pay를 사용할 수 없음",

  // embed page
  missingSessionParam: "세션 매개변수가 없습니다",
  failedToLoadSession: "세션을 불러오지 못했습니다",

  // account flow
  accountEmail: "이메일",
  accountEmailDesc: "계속하려면 이메일을 입력하세요.",
  accountEmailMethodDesc: (method: string) =>
    `${method}을 계속하려면 이메일을 입력하세요.`,
  accountEmailPlaceholder: "email@example.com",
  accountOtp: "인증 코드 입력",
  accountOtpSent: "Daimo를 통해 인증 코드를 전송했습니다:",
  accountOtpSentViaDaimo: (destination: string) =>
    `Daimo를 통해 ${destination}(으)로 인증 코드를 보냈습니다.`,
  accountCreatingWallet: "계정 준비 중",
  accountWalletConsent: "인증하면 다음에 동의합니다:",
  accountEnrollment: "계정 설정",
  accountEnrollmentRetry: "서류 재제출",
  accountEnrollmentPending: "정보 검토 중",
  accountEnrollmentPendingDesc:
    "정보를 제출해 주셔서 감사합니다. 추가 정보가 필요하면 연락드리겠습니다.",
  accountProviderPending: "계정 마무리 중",
  accountProviderPendingDesc: "잠시 시간이 걸릴 수 있습니다",
  accountLegalNameTitle: "법적 이름",
  accountLegalNameDesc:
    "은행 계좌 또는 신분증에 표시된 이름을 그대로 입력하세요.",
  accountLegalNameFirst: "이름",
  accountLegalNameLast: "성",
  accountEnrollmentRejected: "인증을 완료할 수 없습니다",
  accountSuspended: "계정이 정지되었습니다",
  accountEnrollmentError: "계정 설정 실패",
  accountRegionUnavailableTitle: "지역 이용 불가",
  accountRegionUnavailableHeading: "이 지역에서는 이용할 수 없습니다",
  accountRegionUnavailableDescription:
    "이 계정은 해당 지역에서 사용할 수 없습니다.",
  accountRegionUnavailableCta: "돌아가기",
  accountPayment: "금액 입력",
  accountResendCode: "코드 재전송",
  accountVerify: "인증",
  accountPhone: "전화번호 인증",
  accountPhoneDesc:
    "6자리 인증 코드를 문자로 보내드립니다. 미국 휴대전화 번호를 사용해 주세요. VoIP 번호는 지원되지 않습니다.",
  accountSubmit: "제출",
  accountFieldRequired: "필수",
  accountPhoneInvalid: "유효한 전화번호를 입력해 주세요",
  accountBooleanYes: "예",
  accountBooleanNo: "아니요",
  accountSelectBank: "은행 선택",
  accountSearchInstitutions: "금융기관 검색...",
  accountOtherInstitutions: "기타 금융기관",
  accountBankTransfer: "은행 이체",
  accountInteracConfirmTitle: "Interac 요청 확인",
  accountInteracConfirmDesc:
    "은행에는 이 입금의 캐나다 Interac 결제 파트너인 PayTrie AB Inc의 요청으로 표시됩니다.",
  accountInteracConfirmAmount: "금액",
  accountInteracConfirmSender: "보낸 사람",
  accountInteracConfirmBank: "은행",
  accountInteracConfirmProcessingTime: "처리 시간",
  accountInteracConfirmOpenInterac: "Interac 열기",
  accountInteracWaitingInstructions: (amount: string, processingTime: string) =>
    `은행에서 PayTrie AB Inc의 ${amount} 요청을 승인하세요. PayTrie는 이 입금의 캐나다 Interac 결제 파트너입니다. 승인 후 이체가 도착하는 데 ${processingTime}이 걸릴 수 있습니다. 정상적인 과정입니다. 이 페이지를 열어 두면 자동으로 계속 진행합니다.`,
  accountBankDetails: "이체 정보",
  accountDirections: "안내",
  accountDirectionsStep: (current: number, total: number) =>
    `${total}단계 중 ${current}단계`,
  accountDirectionsPrevious: "이전 단계",
  accountDirectionsNext: "다음 단계",
  accountDirectionsGoToStep: (step: number) => `${step}단계로 이동`,
  accountDirectionsShowInstructions: "입금 안내 보기",
  accountBankDetailsCopied: "복사됨",
  accountBankDetailsMemoWarning: "이체 시 이 메모를 포함해 주세요",
  accountBankDetailsAutoDetect: (amount: string) =>
    `은행 이체로 정확히 ${amount}를 보내고 이 페이지로 돌아오세요.`,
  accountTosTitle: "이용약관",
  accountTosDesc: "계속하려면 이용약관 및 개인정보 처리방침에 동의해 주세요.",
  accountTosTerms: "이용약관",
  accountTosPrivacy: "개인정보 처리방침",
  accountTosCta: "계속",
  accountKycIntroTitle: "본인 인증",
  accountKycIntroDesc:
    "이 입금 방법을 사용하려면 몇 가지 정보를 확인해야 합니다. 정보는 암호화되어 비공개로 처리됩니다.",
  accountKycIntroCta: "계속",
  accountHostedKycDesktopDesc:
    "별도 창에서 본인 인증을 완료한 후 이 페이지로 돌아오세요.",
  accountHostedKycMobileDesc:
    "이 모달 밖에서 본인 인증을 완료한 후 이 페이지로 돌아오세요.",
  accountHostedKycTitle: "본인 인증",
  accountHostedKycCta: "본인 인증 열기",
  accountHostedLivenessTitle: "라이브니스 확인",
  accountHostedLivenessDesc:
    "셀카를 찍어 본인 인증을 완료한 후 이 페이지로 돌아오세요.",
  accountHostedLivenessCta: "라이브니스 확인 시작",
  accountHostedActionDesktopSuffix: "별도 창에서 열고 이 페이지로 돌아오세요.",
  accountHostedActionMobileSuffix:
    "이 모달 밖에서 열고 이 페이지로 돌아오세요.",
  accountKycTrustEncrypted: "암호화",
  accountKycTrustPrivate: "비공개",
  accountKycTrustQuick: "2분",
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
  errorConnectionLost:
    "연결이 끊어졌습니다. 네트워크를 확인하고 다시 시도해 주세요.",

  // session page
  connect: "연결",
  connectWallet: "지갑 연결",
  noWalletsFound: "지갑을 찾을 수 없습니다",
  walletUnavailable: "지갑을 사용할 수 없습니다",
  walletDisconnected: "지갑 연결이 해제되었습니다",
  switchToChain: (chain: string) => `${chain}(으)로 전환해 주세요`,
  transactionFailed: "트랜잭션 실패",
  insufficientGas: "가스비가 부족합니다. 아래에서 지원팀에 문의하세요.",
  paymentCancelled: "결제가 취소되었습니다",
  confirmInWallet: "지갑에서 확인",
  retryPayment: "결제 재시도",
  closeAndReturn: "이 페이지를 닫고 앱으로 돌아가기",

  // FiatPopupPage / popup surface
  popupCloseThisPage: "이 페이지를 닫으셔도 됩니다.",
};
