import { useCallback, useEffect, useRef, useState } from "react";

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
  onDone: () => void;
};

/**
 * Auto-creates an embedded wallet via Privy, then creates an account.
 * Advances automatically — back button should skip this screen.
 */
export function AccountCreatingWalletPage({
  sessionId,
  clientSecret,
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
      const addr = await account.ensureWallet(client);
      stage = "account_creation";
      await account.createAccount(client, { sessionId, clientSecret }, addr);
      onDone();
    } catch (err) {
      setError(getAccountSetupFailure(stage, err));
    } finally {
      runningRef.current = false;
    }
  }, [account, client, sessionId, clientSecret, onDone]);

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
