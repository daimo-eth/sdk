import { useCallback, useEffect, useRef, useState } from "react";

import type { AccountRail } from "../../../common/account.js";
import { prepareAccountSigner } from "../../accountSigner.js";
import { t } from "../../hooks/locale.js";
import { useAccountFlow } from "../../hooks/useAccountFlow.js";
import { useDaimoClient } from "../../hooks/DaimoClientContext.js";
import { ErrorPage } from "../ErrorPage.js";
import { Skeleton, SkeletonText } from "../Skeleton.js";
import { CenteredContent, PageHeader } from "../shared.js";

import {
  getAccountSetupFailure,
  type AccountSetupFailure,
  type AccountSetupStage,
} from "./accountSetupFailure.js";

type AccountCreatingWalletPageProps = {
  sessionId: string;
  clientSecret: string;
  rail: AccountRail;
  onDone: () => void;
};

/**
 * Ensures the canonical wallet and Account, then enrolls the configured signer.
 * Advances automatically — back button should skip this screen.
 */
export function AccountCreatingWalletPage({
  sessionId,
  clientSecret,
  rail,
  onDone,
}: AccountCreatingWalletPageProps) {
  const account = useAccountFlow();
  const client = useDaimoClient();
  const [error, setError] = useState<AccountSetupFailure | null>(null);
  const autoStartedRef = useRef(false);
  const runningRef = useRef(false);

  const run = useCallback(async () => {
    if (!account || runningRef.current) return;
    runningRef.current = true;
    setError(null);
    let stage: AccountSetupStage = "wallet_preparation";
    try {
      const session = { sessionId, clientSecret };
      await prepareAccountSigner({
        authorizeSigner: true,
        operations: {
          embeddedWallets: account.embeddedWallets,
          signerConfigured: account.signerConfig !== null,
          getAccount: () => account.getAccount(client, session, { rail }),
          ensureWallet: () => account.ensureWalletDetails(client),
          createAccount: (walletAddress) => {
            stage = "account_creation";
            return account.createAccountResult(client, session, walletAddress);
          },
          authorizeWalletSigner: (wallet) =>
            account.authorizeWalletSigner(client, wallet),
          onEnrollmentUnavailable: (enrollment) => {
            console.warn(
              "[account-signer] automatic routing was not enabled:",
              enrollment.error ?? enrollment.status,
            );
          },
        },
      });
      onDone();
    } catch (err) {
      setError(getAccountSetupFailure(stage, err));
    } finally {
      runningRef.current = false;
    }
  }, [account, client, sessionId, clientSecret, rail, onDone]);

  useEffect(() => {
    if (!account || autoStartedRef.current) return;
    autoStartedRef.current = true;
    void run();
  }, [account, run]);

  if (error) {
    return (
      <ErrorPage
        message={t.errorAccountSetup}
        eventError={error.eventError}
        errorCode={error.errorCode}
        errorStage={error.stage}
        sessionId={sessionId}
        clientSecret={clientSecret}
        supportInfo={{
          stage: error.stage,
          details: error.eventError,
          ...(error.errorCode ? { providerErrorCode: error.errorCode } : {}),
        }}
        retryText={t.tryAgain}
        onRetry={run}
      />
    );
  }

  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title={t.accountCreatingWallet} />
      <CenteredContent>
        <div
          className="daimo-flex daimo-w-full daimo-max-w-[260px] daimo-flex-col daimo-items-center daimo-gap-4"
          aria-busy="true"
          aria-label={t.accountCreatingWallet}
        >
          <Skeleton className="daimo-h-14 daimo-w-14" rounded="full" />
          <SkeletonText lines={2} widths={["82%", "58%"]} />
        </div>
      </CenteredContent>
    </div>
  );
}
