import { describe, expect, it } from "vitest";

import {
  arbitrum,
  base,
  bsc,
  ethereum,
  hyperEvm,
  optimism,
  polygon,
  solana,
  tron,
} from "./chain.js";
import { getAddress } from "viem";
import {
  arbitrumUSDT0,
  baseUSDC,
  optimismUSDT,
  solanaUSDC,
  tronUSDT,
} from "./token.js";
import {
  daimoWithdrawalDestinationRoutes,
  getDaimoWithdrawalDestinationRoute,
  isDaimoWithdrawalDestination,
} from "./withdrawal.js";

describe("withdrawal destination routes", () => {
  it("matches the production send-enabled USDC and USDT matrix", () => {
    expect(
      daimoWithdrawalDestinationRoutes.map(
        (route) => `${route.asset}-${route.chainId}`,
      ),
    ).toEqual([
      `USDC-${arbitrum.chainId}`,
      `USDT-${arbitrum.chainId}`,
      `USDC-${base.chainId}`,
      `USDT-${base.chainId}`,
      `USDC-${bsc.chainId}`,
      `USDT-${bsc.chainId}`,
      `USDC-${ethereum.chainId}`,
      `USDT-${ethereum.chainId}`,
      `USDC-${hyperEvm.chainId}`,
      `USDC-${optimism.chainId}`,
      `USDT-${optimism.chainId}`,
      `USDC-${polygon.chainId}`,
      `USDT-${polygon.chainId}`,
      `USDC-${solana.chainId}`,
    ]);
    expect(
      getDaimoWithdrawalDestinationRoute("USDC", base.chainId),
    ).toMatchObject({ tokenAddress: baseUSDC.token });
    expect(
      getDaimoWithdrawalDestinationRoute("USDT", arbitrum.chainId),
    ).toMatchObject({ tokenAddress: arbitrumUSDT0.token, asset: "USDT" });
    expect(
      getDaimoWithdrawalDestinationRoute("USDC", solana.chainId),
    ).toMatchObject({ tokenAddress: solanaUSDC.token });
    expect(
      getDaimoWithdrawalDestinationRoute("USDT", hyperEvm.chainId),
    ).toBeUndefined();
    expect(
      getDaimoWithdrawalDestinationRoute("USDT", optimism.chainId),
    ).toMatchObject({ tokenAddress: optimismUSDT.token, asset: "USDT" });
    expect(
      daimoWithdrawalDestinationRoutes.some(
        (route) =>
          route.chainId === tron.chainId ||
          route.tokenAddress === tronUSDT.token,
      ),
    ).toBe(false);
  });

  it("validates configured EVM and Solana destinations", () => {
    expect(
      isDaimoWithdrawalDestination({
        type: "evm",
        address: getAddress("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"),
        chainId: base.chainId,
        tokenAddress: getAddress(baseUSDC.token),
      }),
    ).toBe(true);
    expect(
      isDaimoWithdrawalDestination({
        type: "solana",
        address: "Vote111111111111111111111111111111111111111",
        tokenAddress: solanaUSDC.token,
      }),
    ).toBe(true);
    expect(
      isDaimoWithdrawalDestination({
        type: "evm",
        address: getAddress("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"),
        chainId: base.chainId,
        tokenAddress: getAddress("0x0000000000000000000000000000000000000001"),
      }),
    ).toBe(false);
    expect(
      isDaimoWithdrawalDestination({
        type: "solana",
        address: "z".repeat(44),
        tokenAddress: solanaUSDC.token,
      }),
    ).toBe(false);
  });
});
