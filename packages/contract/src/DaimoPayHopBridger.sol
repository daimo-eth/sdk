// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.12;

import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

import "./DestinationUtils.sol";
import "./interfaces/IDaimoPayBridger.sol";
import "./interfaces/IDepositAddressBridger.sol";

/// @author Daimo, Inc
/// @custom:security-contact security@daimo.com
/// @notice Bridges assets to a destination chain via a hop chain.
/// @dev    Hop bridger must ONLY be used with intent address destinations.
///         It ignores bridgeTokenOutOptions, and relies on the intent address
///         on the hop chain to perform the correct swap + final bridge.
contract DaimoPayHopBridger is IDaimoPayBridger, IDepositAddressBridgeAdapter {
    using SafeERC20 for IERC20;

    /// Hop chain ID, eg Arbitrum.
    uint256 public immutable hopChainId;
    /// Hop coin must be a stablecoin, with 1:1 conversion to finalChainCoins.
    address public immutable hopCoinAddr; // eg Arb axlUSDC
    /// Decimals of the hop coin.
    uint256 public immutable hopCoinDecimals;
    /// Bridger used to get from current chain to hop chain, eg AxelarBriger.
    IDaimoPayBridger public immutable hopBridger;
    /// For each final dest chain, we require a specific stablecoin to be on the
    /// bridgeTokenOutOptions list. We convert that amount to the correct hop-
    /// coin amount at 1:1, accounting for decimals.
    mapping(DestinationType destinationType => mapping(uint256 chainId => FinalChainCoin chainCoin))
        public finalChainCoins;

    /// Stablecoin required on the final chain.
    struct FinalChainCoin {
        DestinationType destinationType;
        uint256 finalChainId;
        bytes coin;
        uint256 coinDecimals;
    }

    constructor(
        uint256 _hopChainId,
        address _hopCoinAddr,
        uint256 _hopCoinDecimals,
        IDaimoPayBridger _hopBridger,
        FinalChainCoin[] memory _finalChainCoins
    ) {
        hopChainId = _hopChainId;
        hopCoinAddr = _hopCoinAddr;
        hopCoinDecimals = _hopCoinDecimals;
        hopBridger = _hopBridger;
        for (uint256 i = 0; i < _finalChainCoins.length; i++) {
            require(
                DestinationUtils.isValidDestinationBytesMemory(
                    _finalChainCoins[i].destinationType,
                    _finalChainCoins[i].coin
                ),
                "DPHB: bad final token"
            );
            require(
                finalChainCoins[_finalChainCoins[i].destinationType][
                    _finalChainCoins[i].finalChainId
                ].coin.length == 0,
                "DPHB: duplicate final coin"
            );
            finalChainCoins[_finalChainCoins[i].destinationType][
                _finalChainCoins[i].finalChainId
            ] = _finalChainCoins[i];
        }
    }

    /// Determine the input token and amount required for bridging to
    /// another chain.
    function getBridgeTokenIn(
        uint256 toChainId,
        TokenAmount[] calldata bridgeTokenOutOptions
    ) external view returns (address bridgeTokenIn, uint256 inAmount) {
        TokenAmount[] memory hopAssetOpts = _getHopAssetFromEvmOptions({
            toChainId: toChainId,
            tokenOpts: bridgeTokenOutOptions
        });

        (bridgeTokenIn, inAmount) = hopBridger.getBridgeTokenIn({
            toChainId: hopChainId,
            bridgeTokenOutOptions: hopAssetOpts
        });
    }

    /// Determine the input token and amount required for bytes-aware DA hop
    /// routes, including non-EVM final destinations.
    function getBridgeTokenIn(
        DestinationType destinationType,
        uint256 toChainId,
        BridgeTokenAmount calldata tokenOut
    ) external view returns (address bridgeTokenIn, uint256 inAmount) {
        TokenAmount[] memory hopAssetOpts = _getHopAsset({
            destinationType: destinationType,
            toChainId: toChainId,
            token: tokenOut.token,
            amount: tokenOut.amount
        });

        (bridgeTokenIn, inAmount) = hopBridger.getBridgeTokenIn({
            toChainId: hopChainId,
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
        require(toChainId != block.chainid, "DPHB: same chain");

        TokenAmount[] memory hopAssetOpts = _getHopAssetFromEvmOptions({
            toChainId: toChainId,
            tokenOpts: bridgeTokenOutOptions
        });

        _sendHop({
            toAddress: toAddress,
            hopAssetOpts: hopAssetOpts,
            refundAddress: refundAddress,
            extraData: extraData
        });
    }

    /// Initiate a bytes-aware DA bridge to a final destination via the hop
    /// chain. The recipient is still an EVM fulfillment address on the hop
    /// chain; that fulfillment starts the final leg.
    function sendToChain(
        DestinationType destinationType,
        uint256 toChainId,
        bytes calldata toAddress,
        BridgeTokenAmount calldata tokenOut,
        address refundAddress,
        bytes calldata extraData
    ) external {
        require(toChainId != block.chainid, "DPHB: same chain");
        require(
            DestinationUtils.isValidDestinationBytes(
                DestinationType.EVM,
                toAddress
            ),
            "DPHB: bad hop recipient"
        );

        TokenAmount[] memory hopAssetOpts = _getHopAsset({
            destinationType: destinationType,
            toChainId: toChainId,
            token: tokenOut.token,
            amount: tokenOut.amount
        });

        (address inToken, uint256 inAmount) = _sendHop({
            toAddress: DestinationUtils.decodeEvmAddress(toAddress),
            hopAssetOpts: hopAssetOpts,
            refundAddress: refundAddress,
            extraData: extraData
        });

        emit BridgeInitiatedBytes({
            fromAddress: msg.sender,
            fromToken: inToken,
            fromAmount: inAmount,
            destinationType: DestinationType.EVM,
            toChainId: hopChainId,
            toAddress: toAddress,
            toToken: DestinationUtils.evmAddressToBytes(
                address(hopAssetOpts[0].token)
            ),
            toAmount: hopAssetOpts[0].amount,
            refundAddress: refundAddress
        });
    }

    function _sendHop(
        address toAddress,
        TokenAmount[] memory hopAssetOpts,
        address refundAddress,
        bytes calldata extraData
    ) private returns (address inToken, uint256 inAmount) {
        (inToken, inAmount) = hopBridger.getBridgeTokenIn({
            toChainId: hopChainId,
            bridgeTokenOutOptions: hopAssetOpts
        });

        IERC20(inToken).safeTransferFrom({
            from: msg.sender,
            to: address(this),
            value: inAmount
        });
        IERC20(inToken).forceApprove({
            spender: address(hopBridger),
            value: inAmount
        });

        hopBridger.sendToChain({
            toChainId: hopChainId,
            toAddress: toAddress,
            bridgeTokenOutOptions: hopAssetOpts,
            refundAddress: refundAddress,
            extraData: extraData
        });
    }

    /// Convert stablecoin amount between decimals with 1:1 value.
    /// Rounds up when decreasing precision.
    function _convertStableAmount(
        uint256 amount,
        uint256 fromDecimals,
        uint256 toDecimals
    ) internal pure returns (uint256) {
        if (toDecimals >= fromDecimals) {
            uint256 diff = toDecimals - fromDecimals;
            return amount * (10 ** diff);
        } else {
            uint256 diff = fromDecimals - toDecimals;
            uint256 divisor = 10 ** diff;
            return (amount + divisor - 1) / divisor; // round up
        }
    }

    /// Build the hop-asset option expected by the hop bridger.
    /// Returns exactly one TokenAmount with the hop coin and amount converted
    /// 1:1 by decimals from the required final-chain stablecoin. Rounds up when
    /// reducing precision to avoid underfunding.
    function _getHopAsset(
        DestinationType destinationType,
        uint256 toChainId,
        bytes memory token,
        uint256 amount
    ) internal view returns (TokenAmount[] memory) {
        FinalChainCoin memory finalCoin = _getFinalCoin({
            destinationType: destinationType,
            toChainId: toChainId
        });
        require(
            keccak256(token) == keccak256(finalCoin.coin) && amount > 0,
            "DPHB: required token missing"
        );

        return _buildHopAsset(finalCoin, amount);
    }

    /// Build the hop-asset option from legacy EVM token options.
    function _getHopAssetFromEvmOptions(
        uint256 toChainId,
        TokenAmount[] calldata tokenOpts
    ) internal view returns (TokenAmount[] memory) {
        FinalChainCoin memory finalCoin = _getFinalCoin({
            destinationType: DestinationType.EVM,
            toChainId: toChainId
        });
        bytes32 finalCoinHash = keccak256(finalCoin.coin);

        uint256 finalAmount = 0;
        uint256 n = tokenOpts.length;
        for (uint256 i = 0; i < n; ++i) {
            if (
                keccak256(
                    DestinationUtils.evmAddressToBytes(
                        address(tokenOpts[i].token)
                    )
                ) == finalCoinHash
            ) {
                finalAmount = tokenOpts[i].amount;
                break;
            }
        }
        require(finalAmount > 0, "DPHB: required token missing");

        return _buildHopAsset(finalCoin, finalAmount);
    }

    function _getFinalCoin(
        DestinationType destinationType,
        uint256 toChainId
    ) private view returns (FinalChainCoin memory finalCoin) {
        finalCoin = finalChainCoins[destinationType][toChainId];
        require(finalCoin.coin.length > 0, "DPHB: unsupported dest chain");
    }

    function _buildHopAsset(
        FinalChainCoin memory finalCoin,
        uint256 finalAmount
    ) private view returns (TokenAmount[] memory) {
        uint256 convertedAmount = _convertStableAmount({
            amount: finalAmount,
            fromDecimals: finalCoin.coinDecimals,
            toDecimals: hopCoinDecimals
        });

        TokenAmount[] memory opts = new TokenAmount[](1);
        opts[0] = TokenAmount({
            token: IERC20(hopCoinAddr),
            amount: convertedAmount
        });
        return opts;
    }
}
