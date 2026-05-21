import { useCallback, useEffect, useRef, useState } from "react";

import { t } from "../../hooks/locale.js";
import { useAccountFlow } from "../../hooks/useAccountFlow.js";
import { useDaimoClient } from "../../hooks/DaimoClientContext.js";
import { ErrorPage } from "../ErrorPage.js";
import { Skeleton, SkeletonText } from "../Skeleton.js";
import { CenteredContent, PageHeader } from "../shared.js";

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
  const [error, setError] = useState<string | null>(null);
  const runningRef = useRef(false);

  const run = useCallback(async () => {
    if (!account || runningRef.current) return;
    runningRef.current = true;
    setError(null);
    try {
      const addr = await account.ensureWallet();
      if (!addr) throw new Error("failed to create wallet");
      await account.createAccount(client, { sessionId, clientSecret }, addr);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to set up account");
    } finally {
      runningRef.current = false;
    }
  }, [account, client, sessionId, clientSecret, onDone]);

  useEffect(() => {
    run();
  }, [run]);

  if (error) {
    return (
      <ErrorPage
        message={t.errorAccountSetup}
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
