// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.12;

import "../DestinationUtils.sol";

enum BridgeRecipientMode {
    FULFILLMENT,
    DIRECT
}

/// @notice Shared Deposit Address bridge events emitted by the bridger
///         multiplexer and by bytes-aware bridge adapters.
interface IDepositAddressBridgeEvents {
    event BridgeInitiatedBytes(
        address indexed fromAddress,
        address fromToken,
        uint256 fromAmount,
        DestinationType indexed destinationType,
        uint256 indexed toChainId,
        bytes toAddress,
        bytes toToken,
        uint256 toAmount,
        address refundAddress
    );
}

/// @notice Simplified bridging interface for the Deposit Address system
///         that multiplexes between multiple bridge-specific adapters (e.g.
///         CCTP, Across, Axelar).
interface IDepositAddressBridger {
    /// @notice Fetches a quote: what do I have to send in so that $x shows up
    ///         on the destination?
    /// @param destinationType Destination chain type
    /// @param toChainId       Destination chain
    /// @param tokenOut        The stablecoin token and amount to receive on
    ///                        the destination chain
    /// @param bridgerAdapter  The bridger adapter to use
    /// @return bridgeTokenIn  The asset that must be provided on the source
    ///                        chain
    /// @return inAmount       The exact quantity of bridgeTokenIn that must be
    ///                        provided
    function getBridgeTokenIn(
        DestinationType destinationType,
        uint256 toChainId,
        BridgeTokenAmount calldata tokenOut,
        address bridgerAdapter
    ) external view returns (address bridgeTokenIn, uint256 inAmount);

    /// @notice Returns whether a route should bridge to the deterministic
    ///         fulfillment address or directly to the final recipient bytes.
    /// @param destinationType Destination chain type
    /// @param toChainId       Destination chain
    /// @param tokenOut        The stablecoin token and amount to receive on
    ///                        the destination chain
    /// @param bridgerAdapter  The bridger adapter to use
    function getBridgeRecipientMode(
        DestinationType destinationType,
        uint256 toChainId,
        BridgeTokenAmount calldata tokenOut,
        address bridgerAdapter
    ) external view returns (BridgeRecipientMode);

    /// @notice Execute the bridge. Reverts if the adapter can't deliver the
    ///         specified destination amount.
    /// @param destinationType Destination chain type
    /// @param toChainId       Destination chain id
    /// @param toAddress       Final recipient bytes on the destination chain
    /// @param fulfillmentAddress Deterministic EVM fulfillment address bytes
    /// @param tokenOut        The stablecoin token and amount to receive on
    ///                        the destination chain
    /// @param bridgerAdapter  The bridger adapter to use
    /// @param refundAddress   Address to send funds to if the bridge fails
    /// @param extraData       Adapter-specific calldata
    function sendToChain(
        DestinationType destinationType,
        uint256 toChainId,
        bytes calldata toAddress,
        bytes calldata fulfillmentAddress,
        BridgeTokenAmount calldata tokenOut,
        address bridgerAdapter,
        address refundAddress,
        bytes calldata extraData
    ) external;
}

/// @notice Bytes-aware adapter interface used by DepositAddressBridger for
///         non-EVM delivery routes.
interface IDepositAddressBridgeAdapter is IDepositAddressBridgeEvents {
    function getBridgeTokenIn(
        DestinationType destinationType,
        uint256 toChainId,
        BridgeTokenAmount calldata tokenOut
    ) external view returns (address bridgeTokenIn, uint256 inAmount);

    function sendToChain(
        DestinationType destinationType,
        uint256 toChainId,
        bytes calldata toAddress,
        BridgeTokenAmount calldata tokenOut,
        address refundAddress,
        bytes calldata extraData
    ) external;
}
