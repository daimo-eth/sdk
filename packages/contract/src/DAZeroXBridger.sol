// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.12;

import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";
import "openzeppelin-contracts/contracts/utils/cryptography/MessageHashUtils.sol";

import "./DestinationUtils.sol";
import "./TokenUtils.sol";
import "./interfaces/IDaimoPayBridger.sol";
import "./interfaces/IDepositAddressBridger.sol";

/// @author Daimo, Inc
/// @custom:security-contact security@daimo.com
/// @notice Bridges assets via the 0x cross-chain aggregation API. The relayer
/// supplies the dynamic per-quote 0x calldata in `extraData`, signed by a
/// trusted authority. The bridger verifies the signature and executes the
/// quote.
/// @dev Source and destination tokens are stablecoins with a 1:1 value
/// relationship but may have different ERC-20 decimals (e.g., BSC USDT has 18
/// decimals). `inAmount` is derived on-chain from the signed `outAmount` and
/// the route's stored decimals via `TokenUtils.convertTokenAmountDecimals`
/// (rounded up). The 0x quote's
/// `minBuyAmount` may be smaller than `outAmount` due to slippage and
/// underlying-bridge fees; the recipient eats that difference.
/// Multiple destination tokens per chain are supported via the nested
/// `bridgeRouteMapping[destinationType][toChainId][bridgeTokenOutHash]`.
contract DAZeroXBridger is
    IDaimoPayBridger,
    IDepositAddressBridgeAdapter,
    ReentrancyGuard
{
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    struct ZeroXRoute {
        address bridgeTokenIn;
        uint256 bridgeTokenInDecimals;
        uint256 bridgeTokenOutDecimals;
    }

    struct SignedQuote {
        // route + amount. outAmount is denominated in bridgeTokenOut decimals;
        // the source-side inAmount is derived from outAmount + route decimals.
        bytes bridgeTokenOut;
        uint256 outAmount;
        // execution
        address allowanceTarget;
        address callTarget;
        bytes callData;
        uint256 callValue;
        // freshness / replay
        uint256 timestamp;
        bytes32 quoteId;
        // bound to caller args
        DestinationType destinationType;
        uint256 toChainId;
        bytes toAddress;
        // sig
        bytes signature;
    }

    /// @notice Trusted signer attesting 0x quote calldata.
    address public immutable trustedSigner;

    /// @notice Maximum age of a signed quote in seconds.
    uint256 public immutable maxQuoteAge;

    /// @notice Authorized to sweep balances. Set at deploy-time
    address public immutable owner;

    /// @notice Maps (destination type, chainId, bridge output token) to the
    /// configured route.
    mapping(DestinationType destinationType => mapping(uint256 toChainId => mapping(bytes32 bridgeTokenOutHash => ZeroXRoute bridgeRoute)))
        public bridgeRouteMapping;

    /// @notice Quote IDs already consumed.
    mapping(bytes32 quoteId => bool used) public usedQuoteIds;

    constructor(
        address _owner,
        address _trustedSigner,
        uint256 _maxQuoteAge,
        DestinationType[] memory _destinationTypes,
        uint256[] memory _toChainIds,
        bytes[] memory _bridgeTokenOuts,
        ZeroXRoute[] memory _bridgeRoutes
    ) {
        require(_owner != address(0), "DAZX: invalid owner");
        require(_trustedSigner != address(0), "DAZX: invalid signer");
        require(_maxQuoteAge > 0, "DAZX: invalid max quote age");
        owner = _owner;
        trustedSigner = _trustedSigner;
        maxQuoteAge = _maxQuoteAge;

        uint256 n = _toChainIds.length;
        require(
            n == _destinationTypes.length &&
                n == _bridgeTokenOuts.length &&
                n == _bridgeRoutes.length,
            "DAZX: length mismatch"
        );
        for (uint256 i = 0; i < n; ++i) {
            require(
                DestinationUtils.isValidDestinationBytesMemory(
                    _destinationTypes[i],
                    _bridgeTokenOuts[i]
                ),
                "DAZX: bad route token"
            );
            require(
                _destinationTypes[i] != DestinationType.EVM ||
                    DestinationUtils.decodeEvmAddressMemory(
                        _bridgeTokenOuts[i]
                    ) !=
                    address(0),
                "DAZX: zero token in route"
            );
            require(
                _bridgeRoutes[i].bridgeTokenIn != address(0),
                "DAZX: zero token in route"
            );
            require(
                _bridgeRoutes[i].bridgeTokenInDecimals > 0 &&
                    _bridgeRoutes[i].bridgeTokenOutDecimals > 0,
                "DAZX: zero decimals in route"
            );
            bridgeRouteMapping[_destinationTypes[i]][_toChainIds[i]][
                keccak256(_bridgeTokenOuts[i])
            ] = _bridgeRoutes[i];
        }
    }

    /// @notice Accept native pre-funding from the relayer to cover 0x callValue.
    receive() external payable {}

    // ----- BRIDGER FUNCTIONS -----

    /// @inheritdoc IDaimoPayBridger
    function getBridgeTokenIn(
        uint256 toChainId,
        TokenAmount[] calldata bridgeTokenOutOptions
    ) external view returns (address bridgeTokenIn, uint256 inAmount) {
        // The DepositAddressBridger should only ever send one option
        require(bridgeTokenOutOptions.length == 1, "DAZX: multiple options");

        TokenAmount calldata option = bridgeTokenOutOptions[0];
        return
            _getBridgeTokenIn({
                destinationType: DestinationType.EVM,
                toChainId: toChainId,
                bridgeTokenOut: DestinationUtils.evmAddressToBytes(
                    address(option.token)
                ),
                outAmount: option.amount
            });
    }

    /// @inheritdoc IDepositAddressBridgeAdapter
    function getBridgeTokenIn(
        DestinationType destinationType,
        uint256 toChainId,
        BridgeTokenAmount calldata tokenOut
    ) external view returns (address bridgeTokenIn, uint256 inAmount) {
        return
            _getBridgeTokenIn({
                destinationType: destinationType,
                toChainId: toChainId,
                bridgeTokenOut: tokenOut.token,
                outAmount: tokenOut.amount
            });
    }

    /// @inheritdoc IDaimoPayBridger
    /// @dev The relayer must pre-fund this contract with native tokens to
    /// cover the 0x quote's `callValue` before invoking sendToChain (the
    /// LayerZero bridger pattern).
    function sendToChain(
        uint256 toChainId,
        address toAddress,
        TokenAmount[] calldata bridgeTokenOutOptions,
        address refundAddress,
        bytes calldata extraData
    ) external nonReentrant {
        // The DepositAddressBridger should only ever send one option
        require(bridgeTokenOutOptions.length == 1, "DAZX: multiple options");

        TokenAmount calldata option = bridgeTokenOutOptions[0];
        BridgeTokenAmount memory tokenOut = BridgeTokenAmount({
            token: DestinationUtils.evmAddressToBytes(address(option.token)),
            amount: option.amount
        });

        _sendToChain({
            destinationType: DestinationType.EVM,
            toChainId: toChainId,
            toAddress: DestinationUtils.evmAddressToBytes(toAddress),
            tokenOut: tokenOut,
            refundAddress: refundAddress,
            extraData: extraData
        });
    }

    /// @inheritdoc IDepositAddressBridgeAdapter
    function sendToChain(
        DestinationType destinationType,
        uint256 toChainId,
        bytes calldata toAddress,
        BridgeTokenAmount calldata tokenOut,
        address refundAddress,
        bytes calldata extraData
    ) external nonReentrant {
        _sendToChain({
            destinationType: destinationType,
            toChainId: toChainId,
            toAddress: toAddress,
            tokenOut: tokenOut,
            refundAddress: refundAddress,
            extraData: extraData
        });
    }

    /// @notice Send the contract's full balance of `token` to `to`.
    /// Pass `token == address(0)` to sweep native. Bridges may refund
    /// unspent ERC20 / native to this contract.
    function sweep(address token, address payable to) external {
        require(msg.sender == owner, "DAZX: not owner");
        require(to != address(0), "DAZX: zero recipient");
        TokenUtils.transferBalance({token: IERC20(token), recipient: to});
    }

    function _sendToChain(
        DestinationType destinationType,
        uint256 toChainId,
        bytes memory toAddress,
        BridgeTokenAmount memory tokenOut,
        address refundAddress,
        bytes calldata extraData
    ) private {
        require(toChainId != block.chainid, "DAZX: same chain");
        require(tokenOut.amount > 0, "DAZX: zero amount");
        require(
            DestinationUtils.isValidDestinationBytesMemory(
                destinationType,
                toAddress
            ),
            "DAZX: bad to address"
        );
        require(
            DestinationUtils.isValidDestinationBytesMemory(
                destinationType,
                tokenOut.token
            ),
            "DAZX: bad bridge token"
        );

        SignedQuote memory q = abi.decode(extraData, (SignedQuote));

        require(
            q.destinationType == destinationType,
            "DAZX: dest type mismatch"
        );
        require(q.toChainId == toChainId, "DAZX: chain id mismatch");
        require(
            keccak256(q.toAddress) == keccak256(toAddress),
            "DAZX: to address mismatch"
        );
        require(
            keccak256(q.bridgeTokenOut) == keccak256(tokenOut.token),
            "DAZX: bridge token mismatch"
        );
        require(q.outAmount == tokenOut.amount, "DAZX: out amount mismatch");
        require(
            block.timestamp <= q.timestamp + maxQuoteAge,
            "DAZX: quote stale"
        );

        ZeroXRoute memory route = bridgeRouteMapping[destinationType][
            toChainId
        ][keccak256(q.bridgeTokenOut)];
        require(route.bridgeTokenIn != address(0), "DAZX: route not found");

        require(!usedQuoteIds[q.quoteId], "DAZX: quote replayed");
        usedQuoteIds[q.quoteId] = true;

        _verifySignature(q, route.bridgeTokenIn);

        // Convert dest-decimal outAmount to source-decimal inAmount.
        // Round up so we never under-fund the 0x call; any residue (zero in
        // the happy path) is swept to refundAddress below.
        uint256 inAmount = TokenUtils.convertTokenAmountDecimals({
            amount: q.outAmount,
            fromDecimals: route.bridgeTokenOutDecimals,
            toDecimals: route.bridgeTokenInDecimals,
            roundUp: true
        });

        // Move input token from caller to this contract and approve 0x.
        IERC20(route.bridgeTokenIn).safeTransferFrom({
            from: msg.sender,
            to: address(this),
            value: inAmount
        });
        IERC20(route.bridgeTokenIn).forceApprove({
            spender: q.allowanceTarget,
            value: inAmount
        });

        require(
            address(this).balance >= q.callValue,
            "DAZX: insufficient native"
        );

        (bool ok, ) = q.callTarget.call{value: q.callValue}(q.callData);
        require(ok, "DAZX: 0x call failed");

        // Revoke leftover allowance to the per-quote allowanceTarget.
        IERC20(route.bridgeTokenIn).forceApprove({
            spender: q.allowanceTarget,
            value: 0
        });

        // Defensive sweep of any leftover ERC20 input. Should be 0 in the
        // happy path since the 0x calldata consumes exactly inAmount.
        TokenUtils.transferBalance({
            token: IERC20(route.bridgeTokenIn),
            recipient: payable(refundAddress)
        });

        // Refund any unspent native to the relayer EOA
        if (address(this).balance > 0) {
            (bool nativeOk, ) = tx.origin.call{value: address(this).balance}(
                ""
            );
            require(nativeOk, "DAZX: native refund failed");
        }

        if (destinationType == DestinationType.EVM) {
            emit BridgeInitiated({
                fromAddress: msg.sender,
                fromToken: route.bridgeTokenIn,
                fromAmount: inAmount,
                toChainId: toChainId,
                toAddress: DestinationUtils.decodeEvmAddressMemory(toAddress),
                toToken: DestinationUtils.decodeEvmAddressMemory(
                    q.bridgeTokenOut
                ),
                toAmount: q.outAmount,
                refundAddress: refundAddress
            });
        }

        emit BridgeInitiatedBytes({
            fromAddress: msg.sender,
            fromToken: route.bridgeTokenIn,
            fromAmount: inAmount,
            destinationType: destinationType,
            toChainId: toChainId,
            toAddress: toAddress,
            toToken: q.bridgeTokenOut,
            toAmount: q.outAmount,
            refundAddress: refundAddress
        });
    }

    function _verifySignature(
        SignedQuote memory q,
        address bridgeTokenIn
    ) internal view {
        bytes32 messageHash = keccak256(
            abi.encode(
                block.chainid,
                address(this),
                q.destinationType,
                q.toChainId,
                keccak256(q.toAddress),
                bridgeTokenIn,
                keccak256(q.bridgeTokenOut),
                q.outAmount,
                q.allowanceTarget,
                q.callTarget,
                keccak256(q.callData),
                q.callValue,
                q.timestamp,
                q.quoteId
            )
        );
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        address recovered = ethSignedMessageHash.recover(q.signature);
        require(recovered == trustedSigner, "DAZX: bad signature");
    }

    function _getBridgeTokenIn(
        DestinationType destinationType,
        uint256 toChainId,
        bytes memory bridgeTokenOut,
        uint256 outAmount
    ) private view returns (address bridgeTokenIn, uint256 inAmount) {
        ZeroXRoute memory route = bridgeRouteMapping[destinationType][
            toChainId
        ][keccak256(bridgeTokenOut)];
        require(route.bridgeTokenIn != address(0), "DAZX: route not found");

        bridgeTokenIn = route.bridgeTokenIn;
        inAmount = TokenUtils.convertTokenAmountDecimals({
            amount: outAmount,
            fromDecimals: route.bridgeTokenOutDecimals,
            toDecimals: route.bridgeTokenInDecimals,
            roundUp: true
        });
    }
}
