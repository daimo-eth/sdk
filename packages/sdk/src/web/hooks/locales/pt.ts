import type { en } from "./en.js";

/** Brazilian Portuguese translations for DaimoModal UI. */
export const pt: typeof en = {
  // ConfirmationPage
  confirmYourPayment: "Confirme seu pagamento",
  waitingForYourPayment: "Aguardando seu pagamento",
  paymentReceived: "Pagamento recebido",
  processingYourPayment: "Processando seu pagamento...",
  paymentCompleted: "Pagamento concluído",
  paymentFailed: "Pagamento falhou",
  refundingYourPayment: "Reembolsando seu pagamento",
  paymentRefunded: "Pagamento devolvido",
  returnToApp: "Voltar ao app",
  onChain: "em",

  // ExpiredPage
  expired: "Expirado",
  paymentSessionExpired: "Esta sessão de pagamento expirou",

  // withdrawal flow
  withdrawalAction: "Sacar",
  withdrawalDestinationQuestion: "Para onde você quer sacar?",
  withdrawalIdentifierPlaceholder: "Endereço EVM, ENS ou endereço Solana",
  withdrawalResolving: "Resolvendo…",
  withdrawalAddDestination: "Adicionar novo destino",
  withdrawalSavedDestinations: "Salvos",
  withdrawalRemoveDestinationConfirm: "Remover este destino?",
  withdrawalCancel: "Cancelar",
  withdrawalRemove: "Remover",
  withdrawalUnsupported: "Não compatível",
  withdrawalRemoveDestinationLabel: (identifier: string) =>
    `Remover ${identifier}`,
  withdrawalChooseStablecoin: "Escolher stablecoin",
  withdrawalChooseNetwork: "Escolher rede",
  withdrawalReview: "Revisar saque",
  withdrawalRecipient: "Destinatário",
  withdrawalResolvedAddress: "Endereço resolvido",
  withdrawalStablecoin: "Stablecoin",
  withdrawalNetwork: "Rede",
  withdrawalSaveRoute: "Salvar esta rota para a próxima vez",
  withdrawalCreating: "Criando saque…",
  withdrawalNotSubmitted: "Saque não enviado",
  withdrawalConfirm: "Confirme seu saque",
  withdrawalConfirmInWallet: "Confirme o saque na sua carteira",
  withdrawalWaitingForTransfer: "Aguardando sua transferência",
  withdrawalInProgress: "Saque em andamento",
  withdrawalCompleted: "Saque concluído",
  withdrawalRefunded: "Saque reembolsado",
  withdrawalCancelled: "Saque cancelado",
  withdrawalRetry: "Tentar saque novamente",
  withdrawalExpired: "Saque expirado",
  withdrawalSessionExpired: "Esta sessão de saque expirou.",
  withdrawalCompleteTransferInWallet:
    "Conclua a transferência na sua carteira para continuar.",
  withdrawalFundsBeingDelivered:
    "Os fundos foram recebidos e estão sendo entregues.",
  withdrawalReachedDestination:
    "As stablecoins chegaram ao destino selecionado.",
  withdrawalDeliveryFailedRefunded:
    "A transferência não pôde ser entregue e foi reembolsada.",
  withdrawalNoTransferBeforeExpiry:
    "Nenhuma transferência foi detectada antes desta sessão expirar.",
  withdrawalAutoUpdate:
    "Seu saque será atualizado automaticamente quando os fundos chegarem.",
  withdrawalSolanaUnavailable: "Saques de USDC na Solana estão indisponíveis.",
  withdrawalSavedRouteUnsupported: "Esta rota salva não é mais compatível.",
  withdrawalInvalidIdentifier:
    "Insira um endereço EVM, endereço Solana ou nome ENS válido.",
  withdrawalInvalidEns: "Insira um nome ENS válido.",
  withdrawalSolanaNetworkRequired: "Destinatários Solana exigem a rede Solana.",
  withdrawalEvmNetworkRequired: "Destinatários EVM e ENS exigem uma rede EVM.",
  withdrawalInitializationFailed: "Falha ao iniciar o saque.",
  withdrawalHelp: "Ajuda com saque",
  withdrawalExpiredHelp: "Saque expirado",

  // DeeplinkPage
  continueIn: "Continuar em",
  toCompleteYourPayment: "para concluir seu pagamento",
  openIn: "Abrir em",
  mobileWallets: "Carteiras móveis",
  scanWithPhone: "Escaneie com seu telefone para abrir a carteira",

  // ExchangePage
  continueTo: "Continuar para",
  toCompleteYourDeposit: "para concluir seu depósito",
  open: "Abrir",
  refreshInvoice: "Atualizar",

  // SelectAmountPage
  selectAmount: "Selecionar valor",
  fee: "Taxa",
  youReceive: "Você recebe",
  loading: "Carregando",
  continue: "Continuar",

  // SelectTokenPage
  selectToken: "Selecionar token",
  noTokensFound: "Nenhum token encontrado",
  minimum: "Mínimo",
  maximum: "Máximo",

  // WaitingDepositAddressPage
  deposit: "Depositar",
  depositOn: "Depositar em",
  generateNewAddress: "Gerar novo endereço",
  showQR: "Mostrar QR",
  hideQR: "Ocultar QR",
  oneTimeAddress: "Endereço de uso único",
  amount: "Valor",
  expiresIn: "Expira em:",
  minutes: (min: number) => `${min} min`,

  // WalletAmountPage
  enterAmount: "Inserir valor",
  max: "Máx",
  balance: "Saldo:",

  // ErrorPage
  error: "Erro",
  reload: "Recarregar",
  unknownError: "erro desconhecido",

  // shared
  contactSupport: "Contatar suporte",
  tellUsHowWeCanHelp: "Conte-nos como podemos ajudar",
  showReceipt: "Mostrar recibo",
  poweredByDaimo: "Powered by Daimo",

  // containers
  close: "Fechar",
  changeCountry: "Mudar país",

  // flows
  flowError: "Erro:",
  back: "Voltar",
  tryAgain: "Tentar novamente",

  // hooks/useSessionNav
  tronUnavailable: "Tron indisponível. Tente novamente mais tarde.",

  // formatUserError
  networkErrorOffline: "Erro de rede. Está offline?",
  somethingWentWrong: "Algo deu errado",
  applePayRegionUnsupported:
    "Depósitos com Apple Pay não são aceitos na sua região.",
  applePayUsPhoneRequired:
    "Depósitos com Apple Pay exigem um número de telefone dos EUA.",
  applePayUnavailable: "Apple Pay indisponível",

  // embed page
  missingSessionParam: "parâmetro de sessão ausente",
  failedToLoadSession: "não foi possível carregar a sessão",

  // account flow
  accountEmail: "Email",
  accountEmailDesc: "Insira seu email para continuar.",
  accountEmailMethodDesc: (method: string) =>
    `Insira seu email para continuar com ${method}.`,
  accountEmailPlaceholder: "email@exemplo.com",
  accountOtp: "Insira o código de verificação",
  accountOtpSent: "Enviamos um código via Daimo para",
  accountOtpSentViaDaimo: (destination: string) =>
    `Enviamos um código de verificação via Daimo para ${destination}.`,
  accountCreatingWallet: "Preparando sua conta",
  accountWalletConsent: "Ao verificar, você concorda com os",
  accountEnrollment: "Configuração da conta",
  accountEnrollmentRetry: "Reenviar documentos",
  accountEnrollmentPending: "Analisando suas informações",
  accountEnrollmentPendingDesc:
    "Obrigado por enviar suas informações. Entraremos em contato se precisarmos de mais alguma coisa.",
  accountProviderPending: "Finalizando conta",
  accountProviderPendingDesc: "Isso pode levar um momento",
  accountLegalNameTitle: "Seu nome legal",
  accountLegalNameDesc:
    "Insira seu nome exatamente como aparece na sua conta bancária ou documento de identidade.",
  accountLegalNameFirst: "Nome",
  accountLegalNameLast: "Sobrenome",
  accountEnrollmentRejected: "Não foi possível concluir a verificação",
  accountSuspended: "Conta suspensa",
  accountEnrollmentError: "Falha na configuração da conta",
  accountRegionUnavailableTitle: "Região indisponível",
  accountRegionUnavailableHeading: "Você não está elegível para esta região",
  accountRegionUnavailableDescription: "Esta conta não pode usar esta região.",
  accountRegionUnavailableCta: "Voltar",
  accountPayment: "Inserir valor",
  accountResendCode: "Reenviar código",
  accountVerify: "Verificar",
  accountPhone: "Verifique seu telefone",
  accountPhoneDesc:
    "Enviaremos um código de 6 dígitos por SMS. Use um número de celular dos EUA; números VoIP não são aceitos.",
  accountSubmit: "Enviar",
  accountFieldRequired: "Obrigatório",
  accountPhoneInvalid: "insira um número de telefone válido",
  accountBooleanYes: "Sim",
  accountBooleanNo: "Não",
  accountSelectBank: "Selecionar banco",
  accountSearchInstitutions: "Buscar instituições...",
  accountOtherInstitutions: "Outras instituições",
  accountBankTransfer: "Transferência bancária",
  accountInteracConfirmTitle: "Revisar solicitação Interac",
  accountInteracConfirmDesc:
    "Seu banco mostrará uma solicitação da PayTrie AB Inc, parceira canadense de Interac para este depósito.",
  accountInteracConfirmAmount: "Valor",
  accountInteracConfirmSender: "Remetente",
  accountInteracConfirmBank: "Banco",
  accountInteracConfirmProcessingTime: "Tempo de processamento",
  accountInteracConfirmOpenInterac: "Abrir Interac",
  accountInteracWaitingInstructions: (amount: string, processingTime: string) =>
    `Aprove a solicitação de ${amount} da PayTrie AB Inc no seu banco. A PayTrie é a parceira canadense de Interac para este depósito. Depois da aprovação, a transferência pode levar ${processingTime} para chegar. Isso é esperado; mantenha esta página aberta e ela continuará automaticamente.`,
  accountBankDetails: "Dados da transferência",
  accountDirections: "Instruções",
  accountDirectionsStep: (current: number, total: number) =>
    `Etapa ${current} de ${total}`,
  accountDirectionsPrevious: "Etapa anterior",
  accountDirectionsNext: "Próxima etapa",
  accountDirectionsGoToStep: (step: number) => `Ir para a etapa ${step}`,
  accountDirectionsShowInstructions: "Mostrar instruções de depósito",
  accountBankDetailsCopied: "Copiado",
  accountBankDetailsMemoWarning: "Inclua este memo na sua transferência",
  accountBankDetailsAutoDetect: (amount: string) =>
    `Envie exatamente ${amount} por transferência bancária e volte para esta página.`,
  accountTosTitle: "Termos de Serviço",
  accountTosDesc:
    "Para continuar, aceite os termos de serviço e a política de privacidade.",
  accountTosTerms: "Termos e Condições",
  accountTosPrivacy: "Política de Privacidade",
  accountTosCta: "Continuar",
  accountKycIntroTitle: "Verifique sua identidade",
  accountKycIntroDesc:
    "Confirme alguns dados para usar este método de depósito. Suas informações permanecem criptografadas e privadas.",
  accountKycIntroCta: "Continuar",
  accountHostedKycDesktopDesc:
    "Conclua a verificação de identidade em uma janela separada e retorne a esta página.",
  accountHostedKycMobileDesc:
    "Conclua a verificação de identidade fora deste modal e retorne a esta página.",
  accountHostedKycTitle: "Verificação",
  accountHostedKycCta: "Abrir verificação",
  accountHostedLivenessTitle: "Prova de vida",
  accountHostedLivenessDesc:
    "Tire uma selfie rápida para concluir a verificação de identidade e retorne a esta página.",
  accountHostedLivenessCta: "Iniciar prova de vida",
  accountHostedActionDesktopSuffix:
    "Abra em uma janela separada e retorne a esta página.",
  accountHostedActionMobileSuffix:
    "Abra fora deste modal e retorne a esta página.",
  accountKycTrustEncrypted: "Criptografado",
  accountKycTrustPrivate: "Privado",
  accountKycTrustQuick: "2 min",
  accountDepositReceived: "Depósito recebido",
  accountDepositComplete: "Depósito concluído",
  accountViewAccount: "Ver na conta",

  // account status
  depositDetected: "Depósito detectado",
  depositProcessing: "Depósito em processamento",
  depositFinalizing: "Finalizando depósito",

  // error states
  errorGeneric: "Algo deu errado. Tente novamente.",
  errorDepositFailed:
    "Não foi possível processar seu depósito. Tente novamente.",
  errorAccountSetup: "Não foi possível configurar sua conta. Tente novamente.",
  errorConnectionLost: "Conexão perdida. Verifique sua rede e tente novamente.",

  // session page
  connect: "Conectar",
  connectWallet: "Conectar carteira",
  noWalletsFound: "Nenhuma carteira encontrada",
  walletUnavailable: "Carteira indisponível",
  walletDisconnected: "Carteira desconectada",
  switchToChain: (chain: string) => `Mude para ${chain}`,
  transactionFailed: "Transação falhou",
  insufficientGas: "Gás insuficiente. Contate o suporte abaixo.",
  paymentCancelled: "Pagamento cancelado",
  confirmInWallet: "Confirme na carteira",
  retryPayment: "Tentar pagamento novamente",
  closeAndReturn: "Feche esta página e volte ao app",

  // FiatPopupPage / popup surface
  popupCloseThisPage: "Você pode fechar esta página.",
};
