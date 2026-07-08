import { expectTypeOf, test } from "vitest";

import type { NavNodeExchange } from "./navTree.js";

test("NavNodeExchange exchangeId excludes CashApp", () => {
  expectTypeOf<NavNodeExchange["exchangeId"]>().toEqualTypeOf<
    | "Coinbase"
    | "Binance"
    | "BinanceUSDC"
    | "BinanceUSDT"
    | "Lemon"
    | "BitgetExchange"
    | "BybitExchange"
    | "MtPelerin"
  >();
});
