import type { Address } from "viem";
import type { DaimoPayToken, DaimoPayTokenAmount } from "../../common/token.js";

export type { DaimoPayToken, DaimoPayTokenAmount };

export type WalletPaymentOption = {
  balance: DaimoPayTokenAmount;
  required: DaimoPayTokenAmount;
  minimumRequired: DaimoPayTokenAmount;
  fees: DaimoPayTokenAmount;
  disabledReason?: string;
  passthroughAddress?: Address;
};
