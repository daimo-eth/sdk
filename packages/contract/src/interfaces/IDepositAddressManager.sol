// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.13;

import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {DAParams} from "../DepositAddress.sol";
import {BridgeTokenAmount} from "../DestinationUtils.sol";
import {PriceData} from "./IDaimoPayPricer.sol";
import {Call} from "../DaimoPayExecutor.sol";
import {TokenAmount} from "../TokenUtils.sol";

/// @notice Caller-facing interface for DepositAddressManager. Contracts that
///         only call the manager (e.g. DaimoPayRelayer) depend on this instead
///         of the concrete contract. This keeps DepositAddressManager.sol out
///         of their import graph, so the manager's per-contract optimizer
///         pinning (it compiles at a low optimizer_runs to fit Tempo's block
///         gas cap) does not propagate into those callers' bytecode.
/// @dev Signatures (incl. parameter names, for named-argument calls) must stay
///      in sync with DepositAddressManager. Covered by the relayer test suite.
interface IDepositAddressManager {
    function start(
        DAParams calldata params,
        IERC20 paymentToken,
        BridgeTokenAmount calldata bridgeTokenOut,
        PriceData calldata paymentTokenPrice,
        PriceData calldata bridgeTokenInPrice,
        address bridgerAdapter,
        bytes32 relaySalt,
        Call[] calldata calls,
        bytes calldata bridgeExtraData
    ) external;

    function sameChainFinish(
        DAParams calldata params,
        IERC20 paymentToken,
        PriceData calldata paymentTokenPrice,
        PriceData calldata toTokenPrice,
        Call[] calldata calls
    ) external;

    function fastFinish(
        DAParams calldata params,
        Call[] calldata calls,
        IERC20 token,
        PriceData calldata bridgeTokenOutPrice,
        PriceData calldata toTokenPrice,
        BridgeTokenAmount calldata bridgeTokenOut,
        bytes32 relaySalt,
        uint256 sourceChainId
    ) external;

    function claim(
        DAParams calldata params,
        Call[] calldata calls,
        BridgeTokenAmount calldata bridgeTokenOut,
        PriceData calldata bridgeTokenOutPrice,
        PriceData calldata toTokenPrice,
        bytes32 relaySalt,
        uint256 sourceChainId
    ) external;

    function hopStart(
        DAParams calldata params,
        TokenAmount calldata leg1BridgeTokenOut,
        uint256 leg1SourceChainId,
        PriceData calldata leg1BridgeTokenOutPrice,
        BridgeTokenAmount calldata leg2BridgeTokenOut,
        PriceData calldata leg2BridgeTokenInPrice,
        address bridgerAdapter,
        bytes32 relaySalt,
        Call[] calldata calls,
        bytes calldata bridgeExtraData
    ) external;
}
