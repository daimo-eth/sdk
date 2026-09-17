import type { ChangeEvent, ClipboardEvent } from "react";

import {
  isValidAmountInput,
  parseAmountEdit,
  parseDisplayAmount,
} from "./formatAmount.js";

/** Share decimal-key and strict paste handling across fiat and wallet inputs. */
export function getAmountInputHandlers(
  value: string,
  maxDecimals: number,
  onChange: (value: string) => void,
) {
  const accept = (next: string) => {
    if (isValidAmountInput(next, maxDecimals)) onChange(next);
  };
  return {
    onChange(event: ChangeEvent<HTMLInputElement>) {
      accept(parseAmountEdit(event.target.value, value));
    },
    onPaste(event: ClipboardEvent<HTMLInputElement>) {
      event.preventDefault();
      const pasted = parseDisplayAmount(event.clipboardData.getData("text"));
      if (pasted == null || pasted === "") return;
      const input = event.currentTarget;
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? start;
      // Parse only retained display text; the pasted amount is canonical already.
      const before = parseAmountEdit(input.value.slice(0, start), value);
      const after = parseAmountEdit(input.value.slice(end), value);
      accept(before + pasted + after);
    },
  };
}
