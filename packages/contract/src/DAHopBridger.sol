// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.12;

import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/IDaimoPayBridger.sol";
import "./TokenUtils.sol";

/// @author Daimo, Inc
/// @custom:security-contact security@daimo.com
/// @notice Bridges assets to a destination chain via a hop chain.
/// @dev    Instead of bridging directly to the final destination chain,
///         DAHopBridger first bridges to an intermediate hop chain before
///         bridging to the final destination chain from the hop chain.
contract DAHopBridger is IDaimoPayBridger {
    using SafeERC20 for IERC20;

    struct HopBridgeRoute {
        // The intermediate "hop" chain ID
        uint256 hopChainId;
        // The intermediate bridge token that will be delivered to the hop chain.
        // Must be 1:1 conversion with the finalToken.
        address hopStableAddr;
        // The decimals of the intermediate "hop" stablecoin
        uint256 hopStableDecimals;
        // The bridger used to get from the current chain to the hop chain.
        IDaimoPayBridger hopBridger;
        // The decimals of the final bridge token.
        uint256 finalStableDecimals;
    }

    /// Maps the final destination chain ID and its bridge output token address
    /// to the hop bridge route used to reach that chain from the current one.
    mapping(uint256 finalChainId => mapping(address finalStableAddr => HopBridgeRoute hopBridgeRoute))
        public hopBridgeRouteMapping;

    constructor(
        uint256[] memory _finalChainIds,
        address[] memory _finalStableAddrs,
        HopBridgeRoute[] memory _hopBridgeRoutes
    ) {
        uint256 n = _finalChainIds.length;
        require(
            n == _finalStableAddrs.length && n == _hopBridgeRoutes.length,
            "DAHB: length mismatch"
        );

        for (uint256 i = 0; i < n; ++i) {
            hopBridgeRouteMapping[_finalChainIds[i]][
                _finalStableAddrs[i]
            ] = _hopBridgeRoutes[i];
        }
    }

    /// Determine the input token and amount required for bridging to
    /// another chain.
    function getBridgeTokenIn(
        uint256 toChainId,
        TokenAmount[] calldata bridgeTokenOutOptions
    ) external view returns (address bridgeTokenIn, uint256 inAmount) {
        // The DepositAddressBridger should only ever send one option
        require(bridgeTokenOutOptions.length == 1, "DAHB: multiple options");

        TokenAmount memory finalStable = bridgeTokenOutOptions[0];
        HopBridgeRoute memory route = _getRoute(toChainId, finalStable);
        TokenAmount[] memory hopAssetOpts = _getHopAsset({
            route: route,
            finalStable: finalStable
        });

        (bridgeTokenIn, inAmount) = route.hopBridger.getBridgeTokenIn({
            toChainId: route.hopChainId,
            bridgeTokenOutOptions: hopAssetOpts
        });
    }

    /// Initiate a bridge to a destination chain via a hop chain.
    function sendToChain(
        uint256 toChainId,
        address toAddress,
        TokenAmount[] calldata bridgeTokenOutOptions,
        address refundAddress,
        bytes calldata extraData
    ) public {
        require(toChainId != block.chainid, "DAHB: same chain");
        // The DepositAddressBridger should only ever send one option
        require(bridgeTokenOutOptions.length == 1, "DAHB: multiple options");

        TokenAmount memory finalStable = bridgeTokenOutOptions[0];
        HopBridgeRoute memory route = _getRoute(toChainId, finalStable);
        TokenAmount[] memory hopAssetOpts = _getHopAsset({
            route: route,
            finalStable: finalStable
        });

        (address inToken, uint256 inAmount) = route
            .hopBridger
            .getBridgeTokenIn({
                toChainId: route.hopChainId,
                bridgeTokenOutOptions: hopAssetOpts
            });

        IERC20(inToken).safeTransferFrom({
            from: msg.sender,
            to: address(this),
            value: inAmount
        });
        IERC20(inToken).forceApprove({
            spender: address(route.hopBridger),
            value: inAmount
        });

        route.hopBridger.sendToChain({
            toChainId: route.hopChainId,
            toAddress: toAddress,
            bridgeTokenOutOptions: hopAssetOpts,
            refundAddress: refundAddress,
            extraData: extraData
        });
    }

    /// Look up the hop route for (finalChainId, finalStable.token) and assert
    /// it has been configured. A zeroed route would otherwise cause an opaque
    /// revert on the zero-address call to `hopBridger.getBridgeTokenIn`.
    function _getRoute(
        uint256 finalChainId,
        TokenAmount memory finalStable
    ) internal view returns (HopBridgeRoute memory route) {
        route = hopBridgeRouteMapping[finalChainId][
            address(finalStable.token)
        ];
        require(
            address(route.hopBridger) != address(0),
            "DAHB: route not found"
        );
    }

    /// Build the hop-asset option expected by the hop bridger.
    /// Returns exactly one TokenAmount with the hop coin and amount converted
    /// 1:1 by decimals from the required final-chain stablecoin. Rounds up when
    /// reducing precision to avoid underfunding.
    function _getHopAsset(
        HopBridgeRoute memory route,
        TokenAmount memory finalStable
    ) internal pure returns (TokenAmount[] memory) {
        uint256 convertedAmount = TokenUtils.convertTokenAmountDecimals({
            amount: finalStable.amount,
            fromDecimals: route.finalStableDecimals,
            toDecimals: route.hopStableDecimals,
            roundUp: true
        });

        TokenAmount[] memory opts = new TokenAmount[](1);
        opts[0] = TokenAmount({
            token: IERC20(route.hopStableAddr),
            amount: convertedAmount
        });
        return opts;
    }
}
