// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.12;

import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

import "./DestinationUtils.sol";
import "./TokenUtils.sol"; // Provides TokenAmount struct
import "./interfaces/IDaimoPayBridger.sol";
import "./interfaces/IDepositAddressBridger.sol";

/// @author Daimo, Inc
/// @notice Simplified bridging interface for the Deposit Address system
///         that multiplexes between multiple bridge-specific adapters (e.g.
///         CCTP, Across, Axelar).
contract DepositAddressBridger is IDepositAddressBridger {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------------
    // Immutable routing data (set once in the constructor)
    // ---------------------------------------------------------------------

    /// Is a given bridging route (destination type, chainId, token, adapter)
    /// allowed?
    mapping(DestinationType destinationType => mapping(uint256 toChainId => mapping(bytes32 tokenOutHash => mapping(address bridgerAdapter => bool isAllowed))))
        public isRouteAllowed;

    /// Recipient mode for each allowed route.
    mapping(DestinationType destinationType => mapping(uint256 toChainId => mapping(bytes32 tokenOutHash => mapping(address bridgerAdapter => BridgeRecipientMode mode))))
        public routeRecipientModes;

    /// Set the allowed bridging routes.
    constructor(
        DestinationType[] memory destinationTypes,
        uint256[] memory toChainIds,
        bytes[] memory tokenOuts,
        address[] memory bridgerAdapters,
        BridgeRecipientMode[] memory recipientModes
    ) {
        uint256 n = toChainIds.length;
        require(
            n == destinationTypes.length &&
                n == tokenOuts.length &&
                n == bridgerAdapters.length &&
                n == recipientModes.length,
            "DAB: length mismatch"
        );
        for (uint256 i; i < n; ++i) {
            DestinationType destinationType = destinationTypes[i];
            require(
                DestinationUtils.isValidDestinationBytesMemory(
                    destinationType,
                    tokenOuts[i]
                ),
                "DAB: bad token out"
            );
            require(
                destinationType != DestinationType.EVM ||
                    recipientModes[i] == BridgeRecipientMode.FULFILLMENT,
                "DAB: evm direct route"
            );

            bytes32 tokenOutHash = keccak256(tokenOuts[i]);
            isRouteAllowed[destinationType][toChainIds[i]][tokenOutHash][
                bridgerAdapters[i]
            ] = true;
            routeRecipientModes[destinationType][toChainIds[i]][tokenOutHash][
                bridgerAdapters[i]
            ] = recipientModes[i];
        }
    }

    // ---------------------------------------------------------------------
    // Mutating state
    // ---------------------------------------------------------------------

    /// @inheritdoc IDepositAddressBridger
    function sendToChain(
        DestinationType destinationType,
        uint256 toChainId,
        bytes calldata toAddress,
        bytes calldata fulfillmentAddress,
        BridgeTokenAmount calldata tokenOut,
        address bridgerAdapter,
        address refundAddress,
        bytes calldata extraData
    ) external {
        BridgeRecipientMode recipientMode = getBridgeRecipientMode({
            destinationType: destinationType,
            toChainId: toChainId,
            tokenOut: tokenOut,
            bridgerAdapter: bridgerAdapter
        });

        (address bridgeTokenIn, uint256 inAmount) = getBridgeTokenIn({
            destinationType: destinationType,
            toChainId: toChainId,
            tokenOut: tokenOut,
            bridgerAdapter: bridgerAdapter
        });

        // Pull tokens from caller into this contract.
        IERC20(bridgeTokenIn).safeTransferFrom({
            from: msg.sender,
            to: address(this),
            value: inAmount
        });

        // Approve the bridger adapter to spend and forward the call.
        IERC20(bridgeTokenIn).forceApprove({
            spender: bridgerAdapter,
            value: inAmount
        });

        if (recipientMode == BridgeRecipientMode.DIRECT) {
            // Send directly to the toAddress
            _sendToAdapter({
                destinationType: destinationType,
                toChainId: toChainId,
                bridgeRecipient: toAddress,
                tokenOut: tokenOut,
                bridgerAdapter: bridgerAdapter,
                refundAddress: refundAddress,
                extraData: extraData
            });
        } else {
            // Send to the fulfillment address
            _sendToAdapter({
                destinationType: destinationType,
                toChainId: toChainId,
                bridgeRecipient: fulfillmentAddress,
                tokenOut: tokenOut,
                bridgerAdapter: bridgerAdapter,
                refundAddress: refundAddress,
                extraData: extraData
            });
        }
    }

    function _sendToAdapter(
        DestinationType destinationType,
        uint256 toChainId,
        bytes calldata bridgeRecipient,
        BridgeTokenAmount calldata tokenOut,
        address bridgerAdapter,
        address refundAddress,
        bytes calldata extraData
    ) private {
        if (destinationType == DestinationType.EVM) {
            IDaimoPayBridger(bridgerAdapter).sendToChain({
                toChainId: toChainId,
                toAddress: DestinationUtils.decodeEvmAddress(bridgeRecipient),
                bridgeTokenOutOptions: _getSingleBridgeTokenOutOption(tokenOut),
                refundAddress: refundAddress,
                extraData: extraData
            });
        } else {
            IDepositAddressBridgeAdapter(bridgerAdapter).sendToChain({
                destinationType: destinationType,
                toChainId: toChainId,
                toAddress: bridgeRecipient,
                tokenOut: tokenOut,
                refundAddress: refundAddress,
                extraData: extraData
            });
        }
    }

    // ---------------------------------------------------------------------
    // View helpers
    // ---------------------------------------------------------------------

    /// @inheritdoc IDepositAddressBridger
    function getBridgeTokenIn(
        DestinationType destinationType,
        uint256 toChainId,
        BridgeTokenAmount calldata tokenOut,
        address bridgerAdapter
    ) public view returns (address bridgeTokenIn, uint256 inAmount) {
        require(
            isRouteAllowed[destinationType][toChainId][
                keccak256(tokenOut.token)
            ][bridgerAdapter],
            "DAB: route not allowed"
        );

        if (destinationType == DestinationType.EVM) {
            (bridgeTokenIn, inAmount) = IDaimoPayBridger(bridgerAdapter)
                .getBridgeTokenIn({
                    toChainId: toChainId,
                    bridgeTokenOutOptions: _getSingleBridgeTokenOutOption(
                        tokenOut
                    )
                });
        } else {
            (bridgeTokenIn, inAmount) = IDepositAddressBridgeAdapter(
                bridgerAdapter
            ).getBridgeTokenIn({
                    destinationType: destinationType,
                    toChainId: toChainId,
                    tokenOut: tokenOut
                });
        }
    }

    /// @inheritdoc IDepositAddressBridger
    function getBridgeRecipientMode(
        DestinationType destinationType,
        uint256 toChainId,
        BridgeTokenAmount calldata tokenOut,
        address bridgerAdapter
    ) public view returns (BridgeRecipientMode) {
        bytes32 tokenOutHash = keccak256(tokenOut.token);
        require(
            isRouteAllowed[destinationType][toChainId][tokenOutHash][
                bridgerAdapter
            ],
            "DAB: route not allowed"
        );
        return
            routeRecipientModes[destinationType][toChainId][tokenOutHash][
                bridgerAdapter
            ];
    }

    /// @notice Converts a chain-agnostic token amount into the legacy EVM
    ///         bridger option shape.
    /// @dev Only use this for `DestinationType.EVM` routes. This helper decodes
    ///      `tokenOut.token` as a 20-byte EVM address and will revert for
    ///      Solana or Tron destination token bytes.
    function _getSingleBridgeTokenOutOption(
        BridgeTokenAmount calldata tokenOut
    ) private pure returns (TokenAmount[] memory opts) {
        opts = new TokenAmount[](1);
        opts[0] = TokenAmount({
            token: IERC20(DestinationUtils.decodeEvmAddress(tokenOut.token)),
            amount: tokenOut.amount
        });
    }
}
