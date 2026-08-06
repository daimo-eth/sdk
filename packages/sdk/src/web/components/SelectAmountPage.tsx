import { TokenLogo } from "../../common/token.js";
import type { NavNodeDepositAddress } from "../api/navTree.js";
import type { DaimoPayToken } from "../api/walletTypes.js";

import { t } from "../hooks/locale.js";
import { AmountSummaryRows } from "./AmountSummary.js";
import { PrimaryButton } from "./buttons.js";
import {
  AmountInput,
  PageHeader,
  TokenIconWithChainBadge,
  resolveIconUrl,
  useAmountInput,
} from "./shared.js";

type SelectAmountPageProps = {
  node: NavNodeDepositAddress | { icon?: string; title: string };
  minimum: number;
  maximum: number;
  currencySymbol?: string;
  decimals?: number;
  flatFeeUsd?: number;
  /** Token suffix for display (e.g., "USDC", "USDT") */
  tokenSuffix?: string;
  /** Chain ID for token badge display */
  chainId?: number;
  /** Optional back handler. If undefined, back button is hidden. */
  onBack?: () => void;
  onContinue: (amount: number, amountUnits: string) => void;
  isLoading?: boolean;
  error?: string | null;
  baseUrl: string;
};

export function SelectAmountPage({
  node,
  minimum,
  maximum,
  currencySymbol,
  decimals,
  flatFeeUsd,
  tokenSuffix,
  chainId,
  onBack,
  onContinue,
  isLoading,
  error,
  baseUrl,
}: SelectAmountPageProps) {
  const { amount, amountUnits, isValid, handleChange } = useAmountInput(
    minimum,
    maximum,
  );

  // Create pseudo-token for display if tokenSuffix is USDC or USDT and chainId is provided
  const selectedToken =
    tokenSuffix === "USDC" || tokenSuffix === "USDT" ? tokenSuffix : null;

  const displayToken: DaimoPayToken | null =
    selectedToken && chainId != null
      ? ({
          chainId,
          token: "0x0" as `0x${string}`,
          symbol: selectedToken,
          decimals: 6,
          logoURI: selectedToken === "USDC" ? TokenLogo.USDC : TokenLogo.USDT,
          logoSourceURI: "",
          usd: 1,
          priceFromUsd: 1,
          maxAcceptUsd: 1000000,
          maxSendUsd: 1000000,
          displayDecimals: 2,
        } as DaimoPayToken)
      : null;

  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title={t.selectAmount} onBack={onBack} />
      {/* Content */}
      <div className="daimo-flex-1 daimo-flex daimo-flex-col daimo-items-center daimo-p-6">
        {/* Logo - Token with chain badge when available */}
        <div className="daimo-h-24 daimo-flex daimo-items-center daimo-justify-center daimo-mb-3">
          {displayToken ? (
            <TokenIconWithChainBadge
              token={displayToken}
              size="lg"
              badgeBorderClass="daimo-border-2 daimo-bg-[var(--daimo-surface)] daimo-border-[var(--daimo-surface)]"
              baseUrl={baseUrl}
            />
          ) : (
            node.icon && (
              <img
                src={resolveIconUrl(node.icon, baseUrl)}
                alt={node.title}
                className="daimo-w-20 daimo-h-20 daimo-rounded-[25%]"
              />
            )
          )}
        </div>

        {/* Amount input */}
        <div className="daimo-mb-6">
          <AmountInput
            minimum={minimum}
            maximum={maximum}
            currencySymbol={currencySymbol}
            decimals={decimals}
            onSubmit={onContinue}
            onChange={handleChange}
          />
        </div>

        {flatFeeUsd != null && (
          <div className="daimo-w-full daimo-max-w-[320px] daimo-flex daimo-flex-col daimo-gap-1 daimo-text-sm daimo-mb-6">
            <AmountSummaryRows
              currencySymbol={currencySymbol ?? "$"}
              feeAmount={flatFeeUsd}
              receiveAmount={getAmountAfterFee(amount, flatFeeUsd)}
            />
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="daimo-text-[var(--daimo-error)] daimo-text-sm daimo-text-center daimo-mb-3">
            {error}
          </div>
        )}

        <PrimaryButton
          onClick={() =>
            isValid && !isLoading && onContinue(amount, amountUnits)
          }
          disabled={!isValid || isLoading}
          className="daimo-max-w-none"
        >
          {isLoading ? t.loading : t.continue}
        </PrimaryButton>
      </div>
    </div>
  );
}

export function getAmountAfterFee(amount: number, fee: number): number {
  return Math.max(0, amount - fee);
}
