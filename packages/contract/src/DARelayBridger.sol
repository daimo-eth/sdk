// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.12;

import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";
import "openzeppelin-contracts/contracts/utils/cryptography/MessageHashUtils.sol";

import "./DestinationUtils.sol";
import "./TokenUtils.sol";
import "./interfaces/IDepositAddressBridger.sol";

/// @author Daimo, Inc
/// @custom:security-contact security@daimo.com
/// @notice Bridges stablecoins to non-EVM destinations via Relay exact-output
/// quotes. The relayer supplies the per-quote Relay deposit calldata in
/// `extraData`, signed by a trusted authority. The bridger verifies the
/// signature and executes the deposit, so the recipient gets exactly
/// `outAmount`.
/// @dev The caller supplies the 1:1 amount: `outAmount` converted to the input
/// token's decimals (rounded up). Relay needs `inAmount`, which is larger by
/// the Relay fee. The relayer pre-funds the difference to this contract in the
/// same transaction, before `sendToChain`. Leftover input token and native are
/// returned to the relayer EOA (`tx.origin`).
contract DARelayBridger is IDepositAddressBridgeAdapter, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    struct RelayRoute {
        address bridgeTokenIn;
        uint256 bridgeTokenInDecimals;
        uint256 bridgeTokenOutDecimals;
    }

    struct SignedQuote {
        // route + amounts. outAmount is in bridgeTokenOut decimals. inAmount
        // is the Relay exact-output input, in bridgeTokenIn decimals.
        bytes bridgeTokenOut;
        uint256 outAmount;
        uint256 inAmount;
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

    /// @notice Trusted signer attesting Relay quote calldata.
    address public immutable trustedSigner;

    /// @notice Maximum age of a signed quote in seconds.
    uint256 public immutable maxQuoteAge;

    /// @notice Authorized to sweep balances. Set at deploy-time
    address public immutable owner;

    /// @notice Maps (destination type, chainId, bridge output token) to the
    /// configured route.
    mapping(DestinationType destinationType => mapping(uint256 toChainId => mapping(bytes32 bridgeTokenOutHash => RelayRoute bridgeRoute)))
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
        RelayRoute[] memory _bridgeRoutes
    ) {
        require(_owner != address(0), "DARB: invalid owner");
        require(_trustedSigner != address(0), "DARB: invalid signer");
        require(_maxQuoteAge > 0, "DARB: invalid max quote age");
        owner = _owner;
        trustedSigner = _trustedSigner;
        maxQuoteAge = _maxQuoteAge;

        uint256 n = _toChainIds.length;
        require(
            n == _destinationTypes.length &&
                n == _bridgeTokenOuts.length &&
                n == _bridgeRoutes.length,
            "DARB: length mismatch"
        );
        for (uint256 i = 0; i < n; ++i) {
            require(
                _destinationTypes[i] != DestinationType.EVM,
                "DARB: evm route"
            );
            require(
                DestinationUtils.isValidDestinationBytesMemory(
                    _destinationTypes[i],
                    _bridgeTokenOuts[i]
                ),
                "DARB: bad route token"
            );
            require(
                _bridgeRoutes[i].bridgeTokenIn != address(0),
                "DARB: zero token in route"
            );
            require(
                _bridgeRoutes[i].bridgeTokenInDecimals > 0 &&
                    _bridgeRoutes[i].bridgeTokenOutDecimals > 0,
                "DARB: zero decimals in route"
            );
            bridgeRouteMapping[_destinationTypes[i]][_toChainIds[i]][
                keccak256(_bridgeTokenOuts[i])
            ] = _bridgeRoutes[i];
        }
    }

    /// @notice Accept native pre-funding from the relayer to cover callValue.
    receive() external payable {}

    // ----- BRIDGER FUNCTIONS -----

    /// @inheritdoc IDepositAddressBridgeAdapter
    function getBridgeTokenIn(
        DestinationType destinationType,
        uint256 toChainId,
        BridgeTokenAmount calldata tokenOut
    ) external view returns (address bridgeTokenIn, uint256 inAmount) {
        RelayRoute memory route = _getRoute(
            destinationType,
            toChainId,
            tokenOut.token
        );
        return (route.bridgeTokenIn, _getBaseInAmount(route, tokenOut.amount));
    }

    /// @inheritdoc IDepositAddressBridgeAdapter
    /// @dev The relayer must pre-fund this contract with
    /// `q.inAmount - baseInAmount` of bridgeTokenIn and `q.callValue` native
    /// before this call.
    function sendToChain(
        DestinationType destinationType,
        uint256 toChainId,
        bytes calldata toAddress,
        BridgeTokenAmount calldata tokenOut,
        address refundAddress,
        bytes calldata extraData
    ) external nonReentrant {
        require(toChainId != block.chainid, "DARB: same chain");
        require(tokenOut.amount > 0, "DARB: zero amount");
        require(
            DestinationUtils.isValidDestinationBytesMemory(
                destinationType,
                toAddress
            ),
            "DARB: bad to address"
        );

        SignedQuote memory q = abi.decode(extraData, (SignedQuote));
        require(
            q.destinationType == destinationType,
            "DARB: dest type mismatch"
        );
        require(q.toChainId == toChainId, "DARB: chain id mismatch");
        require(
            keccak256(q.toAddress) == keccak256(toAddress),
            "DARB: to address mismatch"
        );
        require(
            keccak256(q.bridgeTokenOut) == keccak256(tokenOut.token),
            "DARB: bridge token mismatch"
        );
        require(q.outAmount == tokenOut.amount, "DARB: out amount mismatch");
        require(
            block.timestamp <= q.timestamp + maxQuoteAge,
            "DARB: quote stale"
        );

        RelayRoute memory route = _getRoute(
            destinationType,
            toChainId,
            q.bridgeTokenOut
        );

        require(!usedQuoteIds[q.quoteId], "DARB: quote replayed");
        usedQuoteIds[q.quoteId] = true;

        _verifySignature(q, route.bridgeTokenIn);

        uint256 baseInAmount = _getBaseInAmount(route, q.outAmount);
        require(q.inAmount >= baseInAmount, "DARB: in amount low");

        IERC20 tokenIn = IERC20(route.bridgeTokenIn);
        tokenIn.safeTransferFrom({
            from: msg.sender,
            to: address(this),
            value: baseInAmount
        });
        require(
            tokenIn.balanceOf(address(this)) >= q.inAmount,
            "DARB: fee not prefunded"
        );
        require(
            address(this).balance >= q.callValue,
            "DARB: insufficient native"
        );

        tokenIn.forceApprove({spender: q.allowanceTarget, value: q.inAmount});
        (bool ok, ) = q.callTarget.call{value: q.callValue}(q.callData);
        require(ok, "DARB: relay call failed");
        tokenIn.forceApprove({spender: q.allowanceTarget, value: 0});

        // Return any leftover relayer pre-funding. Zero in the happy path:
        // the Relay deposit consumes exactly inAmount.
        TokenUtils.transferBalance({
            token: tokenIn,
            recipient: payable(tx.origin)
        });
        if (address(this).balance > 0) {
            (bool nativeOk, ) = tx.origin.call{value: address(this).balance}(
                ""
            );
            require(nativeOk, "DARB: native refund failed");
        }

        emit BridgeInitiatedBytes({
            fromAddress: msg.sender,
            fromToken: route.bridgeTokenIn,
            fromAmount: q.inAmount,
            destinationType: destinationType,
            toChainId: toChainId,
            toAddress: toAddress,
            toToken: q.bridgeTokenOut,
            toAmount: q.outAmount,
            refundAddress: refundAddress
        });
    }

    /// @notice Send the contract's full balance of `token` to `to`.
    /// Pass `token == address(0)` to sweep native.
    function sweep(address token, address payable to) external {
        require(msg.sender == owner, "DARB: not owner");
        require(to != address(0), "DARB: zero recipient");
        TokenUtils.transferBalance({token: IERC20(token), recipient: to});
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
                q.inAmount,
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
        require(recovered == trustedSigner, "DARB: bad signature");
    }

    function _getRoute(
        DestinationType destinationType,
        uint256 toChainId,
        bytes memory bridgeTokenOut
    ) private view returns (RelayRoute memory route) {
        route = bridgeRouteMapping[destinationType][toChainId][
            keccak256(bridgeTokenOut)
        ];
        require(route.bridgeTokenIn != address(0), "DARB: route not found");
    }

    function _getBaseInAmount(
        RelayRoute memory route,
        uint256 outAmount
    ) private pure returns (uint256) {
        return
            TokenUtils.convertTokenAmountDecimals({
                amount: outAmount,
                fromDecimals: route.bridgeTokenOutDecimals,
                toDecimals: route.bridgeTokenInDecimals,
                roundUp: true
            });
    }
}
