import { formatFixedAmount } from "../formatAmount.js";
import { t } from "../hooks/locale.js";

type AmountSummaryRowsProps = {
  currencySymbol: string;
  feeAmount: number | null;
  receiveAmount: number;
  feeFallback?: string;
};

export function AmountSummaryRows({
  currencySymbol,
  feeAmount,
  receiveAmount,
  feeFallback = "—",
}: AmountSummaryRowsProps) {
  return (
    <>
      <div className="daimo-flex daimo-items-center daimo-justify-between daimo-text-[var(--daimo-text-muted)]">
        <span>{t.fee}</span>
        <span className="daimo-tabular-nums">
          {feeAmount == null
            ? feeFallback
            : `${currencySymbol}${formatFixedAmount(feeAmount)}`}
        </span>
      </div>
      <div className="daimo-flex daimo-items-center daimo-justify-between daimo-text-[var(--daimo-text)]">
        <span>{t.youReceive}</span>
        <span className="daimo-font-semibold daimo-tabular-nums">
          {currencySymbol}
          {formatFixedAmount(receiveAmount)}
        </span>
      </div>
    </>
  );
}
