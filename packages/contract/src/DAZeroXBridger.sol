// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.12;

import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";
import "openzeppelin-contracts/contracts/utils/cryptography/MessageHashUtils.sol";

import "./TokenUtils.sol";
import "./interfaces/IDaimoPayBridger.sol";

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
/// `bridgeRouteMapping[toChainId][bridgeTokenOut] -> ZeroXRoute`. Caller
/// (DepositAddressBridger) always passes a single-element option array.
contract DAZeroXBridger is IDaimoPayBridger, ReentrancyGuard {
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
        address bridgeTokenOut;
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
        uint256 toChainId;
        address toAddress;
        // sig
        bytes signature;
    }

    /// @notice Trusted signer attesting 0x quote calldata.
    address public immutable trustedSigner;

    /// @notice Maximum age of a signed quote in seconds.
    uint256 public immutable maxQuoteAge;

    /// @notice Authorized to sweep balances. Set at deploy-time
    address public immutable owner;

    /// @notice Maps (destination chainId, bridge output token) to the
    /// configured route. The same chainId can have multiple bridgeTokenOut
    /// entries with distinct bridgeTokenIn assets.
    mapping(uint256 toChainId => mapping(address bridgeTokenOut => ZeroXRoute bridgeRoute))
        public bridgeRouteMapping;

    /// @notice Quote IDs already consumed.
    mapping(bytes32 quoteId => bool used) public usedQuoteIds;

    constructor(
        address _owner,
        address _trustedSigner,
        uint256 _maxQuoteAge,
        uint256[] memory _toChainIds,
        address[] memory _bridgeTokenOuts,
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
            n == _bridgeTokenOuts.length && n == _bridgeRoutes.length,
            "DAZX: length mismatch"
        );
        for (uint256 i = 0; i < n; ++i) {
            require(
                _bridgeTokenOuts[i] != address(0) &&
                    _bridgeRoutes[i].bridgeTokenIn != address(0),
                "DAZX: zero token in route"
            );
            require(
                _bridgeRoutes[i].bridgeTokenInDecimals > 0 &&
                    _bridgeRoutes[i].bridgeTokenOutDecimals > 0,
                "DAZX: zero decimals in route"
            );
            bridgeRouteMapping[_toChainIds[i]][
                _bridgeTokenOuts[i]
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
        ZeroXRoute memory route = bridgeRouteMapping[toChainId][
            address(option.token)
        ];
        require(route.bridgeTokenIn != address(0), "DAZX: route not found");

        bridgeTokenIn = route.bridgeTokenIn;
        inAmount = TokenUtils.convertTokenAmountDecimals({
            amount: option.amount,
            fromDecimals: route.bridgeTokenOutDecimals,
            toDecimals: route.bridgeTokenInDecimals,
            roundUp: true
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
        require(toChainId != block.chainid, "DAZX: same chain");
        // The DepositAddressBridger should only ever send one option
        require(bridgeTokenOutOptions.length == 1, "DAZX: multiple options");

        TokenAmount calldata option = bridgeTokenOutOptions[0];
        require(option.amount > 0, "DAZX: zero amount");

        SignedQuote memory q = abi.decode(extraData, (SignedQuote));

        require(
            q.bridgeTokenOut == address(option.token),
            "DAZX: bridge token mismatch"
        );
        require(q.outAmount == option.amount, "DAZX: out amount mismatch");

        ZeroXRoute memory route = bridgeRouteMapping[toChainId][
            q.bridgeTokenOut
        ];
        require(route.bridgeTokenIn != address(0), "DAZX: route not found");

        // Convert dest-decimal outAmount to source-decimal inAmount.
        // Round up so we never under-fund the 0x call; any residue (zero in
        // the happy path) is swept to refundAddress below.
        uint256 inAmount = TokenUtils.convertTokenAmountDecimals({
            amount: q.outAmount,
            fromDecimals: route.bridgeTokenOutDecimals,
            toDecimals: route.bridgeTokenInDecimals,
            roundUp: true
        });

        require(q.toChainId == toChainId, "DAZX: chain id mismatch");
        require(q.toAddress == toAddress, "DAZX: to address mismatch");

        require(
            block.timestamp <= q.timestamp + maxQuoteAge,
            "DAZX: quote stale"
        );

        require(!usedQuoteIds[q.quoteId], "DAZX: quote replayed");
        usedQuoteIds[q.quoteId] = true;

        _verifySignature(q, route.bridgeTokenIn);

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

        emit BridgeInitiated({
            fromAddress: msg.sender,
            fromToken: route.bridgeTokenIn,
            fromAmount: inAmount,
            toChainId: toChainId,
            toAddress: toAddress,
            toToken: q.bridgeTokenOut,
            toAmount: q.outAmount,
            refundAddress: refundAddress
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

    function _verifySignature(
        SignedQuote memory q,
        address bridgeTokenIn
    ) internal view {
        bytes32 messageHash = keccak256(
            abi.encode(
                block.chainid,
                address(this),
                q.toChainId,
                q.toAddress,
                bridgeTokenIn,
                q.bridgeTokenOut,
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
}
