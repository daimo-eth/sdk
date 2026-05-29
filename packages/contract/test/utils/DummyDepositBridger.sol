// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.12;

import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

import {
    IDepositAddressBridgeEvents,
    IDepositAddressBridger,
    BridgeRecipientMode
} from "../../src/interfaces/IDepositAddressBridger.sol";
import {
    DestinationType,
    BridgeTokenAmount
} from "../../src/DestinationUtils.sol";
import {TokenAmount} from "../../src/TokenUtils.sol";
import {IDaimoPayBridger} from "../../src/interfaces/IDaimoPayBridger.sol";
import {DestinationUtils} from "../../src/DestinationUtils.sol";

/// @title DummyDepositAddressBridger
/// @notice Minimal in-memory implementation of the IDepositAddressBridger used exclusively in Foundry tests.
///         It burns bridge input tokens and echoes the parameters via events.
contract DummyDepositAddressBridger is
    IDepositAddressBridger,
    IDepositAddressBridgeEvents
{
    using SafeERC20 for IERC20;

    address public bridgeTokenInOverride;
    DestinationType public lastDestinationType;
    uint256 public lastToChainId;
    bytes public lastToAddress;
    bytes public lastTokenOut;
    uint256 public lastAmount;
    address public lastBridgerAdapter;
    address public lastRefundAddress;
    bool public bridgeRecipientModeOverrideSet;
    BridgeRecipientMode public bridgeRecipientModeOverride;

    function setBridgeTokenInOverride(address token) external {
        bridgeTokenInOverride = token;
    }

    function setBridgeRecipientMode(BridgeRecipientMode mode) external {
        bridgeRecipientModeOverrideSet = true;
        bridgeRecipientModeOverride = mode;
    }

    function clearBridgeRecipientMode() external {
        bridgeRecipientModeOverrideSet = false;
    }

    // ---------------------------------------------------------------------
    // IDepositAddressBridger
    // ---------------------------------------------------------------------

    function getBridgeTokenIn(
        DestinationType destinationType,
        uint256,
        /*toChainId*/
        BridgeTokenAmount calldata tokenOut,
        address /*bridgerAdapter*/
    ) external view override returns (address bridgeTokenIn, uint256 inAmount) {
        bridgeTokenIn = _getBridgeTokenIn(destinationType, tokenOut);
        inAmount = tokenOut.amount;
    }

    function sendToChain(
        DestinationType destinationType,
        uint256 toChainId,
        bytes calldata toAddress,
        bytes calldata fulfillmentAddress,
        BridgeTokenAmount calldata tokenOut,
        address bridgerAdapter,
        address refundAddress,
        bytes calldata /* extraData */
    ) external override {
        address bridgeTokenIn = _getBridgeTokenIn(destinationType, tokenOut);
        BridgeRecipientMode recipientMode = _bridgeRecipientMode(
            destinationType
        );
        bytes calldata bridgeRecipient = recipientMode ==
            BridgeRecipientMode.DIRECT
            ? toAddress
            : fulfillmentAddress;

        // Burn the tokens, simulating a slow bridge.
        IERC20(bridgeTokenIn).safeTransferFrom(
            msg.sender,
            address(0xdead),
            tokenOut.amount
        );

        lastDestinationType = destinationType;
        lastToChainId = toChainId;
        lastToAddress = bridgeRecipient;
        lastTokenOut = tokenOut.token;
        lastAmount = tokenOut.amount;
        lastBridgerAdapter = bridgerAdapter;
        lastRefundAddress = refundAddress;

        if (destinationType == DestinationType.EVM) {
            emit IDaimoPayBridger.BridgeInitiated({
                fromAddress: msg.sender,
                fromToken: bridgeTokenIn,
                fromAmount: tokenOut.amount,
                toChainId: toChainId,
                toAddress: DestinationUtils.decodeEvmAddress(bridgeRecipient),
                toToken: DestinationUtils.decodeEvmAddress(tokenOut.token),
                toAmount: tokenOut.amount,
                refundAddress: refundAddress
            });
        }

        emit BridgeInitiatedBytes({
            fromAddress: msg.sender,
            fromToken: bridgeTokenIn,
            fromAmount: tokenOut.amount,
            destinationType: destinationType,
            toChainId: toChainId,
            toAddress: bridgeRecipient,
            toToken: tokenOut.token,
            toAmount: tokenOut.amount,
            refundAddress: refundAddress
        });
    }

    function getBridgeRecipientMode(
        DestinationType destinationType,
        uint256,
        /*toChainId*/
        BridgeTokenAmount calldata,
        /*tokenOut*/
        address /*bridgerAdapter*/
    ) external view override returns (BridgeRecipientMode) {
        return _bridgeRecipientMode(destinationType);
    }

    function _getBridgeTokenIn(
        DestinationType destinationType,
        BridgeTokenAmount calldata tokenOut
    ) private view returns (address) {
        if (destinationType == DestinationType.EVM) {
            return DestinationUtils.decodeEvmAddress(tokenOut.token);
        }
        require(bridgeTokenInOverride != address(0), "DDB: no bridge token");
        return bridgeTokenInOverride;
    }

    function _bridgeRecipientMode(
        DestinationType destinationType
    ) private view returns (BridgeRecipientMode) {
        if (bridgeRecipientModeOverrideSet) return bridgeRecipientModeOverride;
        if (destinationType == DestinationType.EVM) {
            return BridgeRecipientMode.FULFILLMENT;
        }
        return BridgeRecipientMode.DIRECT;
    }
}
