// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {
    SafeERC20
} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

import {DaimoPayHopBridger} from "../src/DaimoPayHopBridger.sol";
import {IDaimoPayBridger} from "../src/interfaces/IDaimoPayBridger.sol";
import {
    IDepositAddressBridgeEvents
} from "../src/interfaces/IDepositAddressBridger.sol";
import {TokenAmount} from "../src/TokenUtils.sol";
import {
    BridgeTokenAmount,
    DestinationType,
    DestinationUtils
} from "../src/DestinationUtils.sol";
import {TestUSDC} from "./utils/DummyUSDC.sol";
import {TestToken2Decimals} from "./utils/Dummy2DecimalsToken.sol";

contract DummyLegacyHopBridger is IDaimoPayBridger {
    using SafeERC20 for IERC20;

    uint256 public lastToChainId;
    address public lastToAddress;

    function getBridgeTokenIn(
        uint256,
        TokenAmount[] calldata bridgeTokenOutOptions
    ) external pure returns (address bridgeTokenIn, uint256 inAmount) {
        require(bridgeTokenOutOptions.length == 1, "DLHB: one option");
        bridgeTokenIn = address(bridgeTokenOutOptions[0].token);
        inAmount = bridgeTokenOutOptions[0].amount;
    }

    function sendToChain(
        uint256 toChainId,
        address toAddress,
        TokenAmount[] calldata bridgeTokenOutOptions,
        address refundAddress,
        bytes calldata
    ) external {
        require(bridgeTokenOutOptions.length == 1, "DLHB: one option");
        IERC20 bridgeTokenIn = bridgeTokenOutOptions[0].token;
        uint256 inAmount = bridgeTokenOutOptions[0].amount;
        bridgeTokenIn.safeTransferFrom(msg.sender, address(0xdead), inAmount);

        lastToChainId = toChainId;
        lastToAddress = toAddress;

        emit BridgeInitiated({
            fromAddress: msg.sender,
            fromToken: address(bridgeTokenIn),
            fromAmount: inAmount,
            toChainId: toChainId,
            toAddress: toAddress,
            toToken: address(bridgeTokenIn),
            toAmount: inAmount,
            refundAddress: refundAddress
        });
    }
}

contract DaimoPayHopBridgerHarness is DaimoPayHopBridger {
    constructor(
        uint256 hopChainId,
        address hopCoinAddr,
        uint256 hopCoinDecimals,
        IDaimoPayBridger hopBridger,
        FinalChainCoin[] memory finalChainCoins
    )
        DaimoPayHopBridger(
            hopChainId,
            hopCoinAddr,
            hopCoinDecimals,
            hopBridger,
            finalChainCoins
        )
    {}

    function expose_getHopAsset(
        uint256 toChainId,
        TokenAmount[] calldata tokenOpts
    ) external view returns (TokenAmount[] memory) {
        return _getHopAssetFromEvmOptions(toChainId, tokenOpts);
    }
}

contract DaimoPayHopBridgerTest is Test {
    DummyLegacyHopBridger private hop;
    DaimoPayHopBridgerHarness private hb;
    TestUSDC private usdc6; // acts as final coin
    TestToken2Decimals private usdc2; // acts as hop coin (2 decimals)

    uint256 constant HOP_CHAIN = 42161;
    uint256 constant DST_CHAIN = 10;
    uint256 constant SOLANA_CHAIN = 501;
    bytes32 constant SOLANA_USDC =
        0xc6fa7af3bedbad3a3d65f36aabc97431b1bbe4c2d2f6e0e47ca60203452f5d61;

    function setUp() public {
        hop = new DummyLegacyHopBridger();
        usdc6 = new TestUSDC();
        usdc2 = new TestToken2Decimals();

        DaimoPayHopBridger.FinalChainCoin[]
            memory coins = new DaimoPayHopBridger.FinalChainCoin[](1);
        coins[0] = DaimoPayHopBridger.FinalChainCoin({
            destinationType: DestinationType.EVM,
            finalChainId: DST_CHAIN,
            coin: DestinationUtils.evmAddressToBytes(address(usdc6)),
            coinDecimals: 6
        });

        hb = new DaimoPayHopBridgerHarness({
            hopChainId: HOP_CHAIN,
            hopCoinAddr: address(usdc2),
            hopCoinDecimals: 2,
            hopBridger: IDaimoPayBridger(address(hop)),
            finalChainCoins: coins
        });
    }

    function test_getHopAsset_singleElement_and_rounding() public view {
        // Request 100_000 units of 6-dec token -> expect 2-dec hop amount 100_000 / 10^(6-2) = 10
        TokenAmount[] memory opts = new TokenAmount[](1);
        opts[0] = TokenAmount({token: IERC20(address(usdc6)), amount: 100_000});

        TokenAmount[] memory hopOpts = hb.expose_getHopAsset(DST_CHAIN, opts);
        assertEq(hopOpts.length, 1);
        assertEq(address(hopOpts[0].token), address(usdc2));
        assertEq(hopOpts[0].amount, 10);
    }

    function test_getHopAsset_roundsUp() public view {
        // 1 unit of 6-dec -> to 2-dec should round up to 1 (since 0.0001 -> 0.01)
        TokenAmount[] memory opts = new TokenAmount[](1);
        opts[0] = TokenAmount({token: IERC20(address(usdc6)), amount: 1});

        TokenAmount[] memory hopOpts = hb.expose_getHopAsset(DST_CHAIN, opts);
        assertEq(hopOpts[0].amount, 1);
    }

    function test_getHopAsset_lowToHighDecimals() public {
        // Setup a new bridger where final coin has 2 decimals and hop coin has 6 decimals
        DaimoPayHopBridger.FinalChainCoin[]
            memory coins = new DaimoPayHopBridger.FinalChainCoin[](1);
        coins[0] = DaimoPayHopBridger.FinalChainCoin({
            destinationType: DestinationType.EVM,
            finalChainId: DST_CHAIN,
            coin: DestinationUtils.evmAddressToBytes(address(usdc2)),
            coinDecimals: 2
        });

        DaimoPayHopBridgerHarness hb2 = new DaimoPayHopBridgerHarness({
            hopChainId: HOP_CHAIN,
            hopCoinAddr: address(usdc6),
            hopCoinDecimals: 6,
            hopBridger: IDaimoPayBridger(address(hop)),
            finalChainCoins: coins
        });

        // 10 units of 2-dec token -> to 6-dec should multiply by 10^(6-2) = 10,000 => 100,000
        TokenAmount[] memory opts = new TokenAmount[](1);
        opts[0] = TokenAmount({token: IERC20(address(usdc2)), amount: 10});

        TokenAmount[] memory hopOpts = hb2.expose_getHopAsset(DST_CHAIN, opts);
        assertEq(hopOpts.length, 1);
        assertEq(address(hopOpts[0].token), address(usdc6));
        assertEq(hopOpts[0].amount, 100_000);
    }

    function test_getBridgeTokenIn_solanaFinalCoin() public {
        DaimoPayHopBridgerHarness solanaHb = _newSolanaHopBridger();
        BridgeTokenAmount memory tokenOut = BridgeTokenAmount({
            token: abi.encodePacked(SOLANA_USDC),
            amount: 100_000
        });

        (address bridgeTokenIn, uint256 inAmount) = solanaHb.getBridgeTokenIn({
            destinationType: DestinationType.SOLANA,
            toChainId: SOLANA_CHAIN,
            tokenOut: tokenOut
        });

        assertEq(bridgeTokenIn, address(usdc2));
        assertEq(inAmount, 10);
    }

    function test_finalChainCoins_KeyedByDestinationType() public {
        DaimoPayHopBridger.FinalChainCoin[]
            memory coins = new DaimoPayHopBridger.FinalChainCoin[](2);
        coins[0] = DaimoPayHopBridger.FinalChainCoin({
            destinationType: DestinationType.EVM,
            finalChainId: SOLANA_CHAIN,
            coin: DestinationUtils.evmAddressToBytes(address(usdc6)),
            coinDecimals: 6
        });
        coins[1] = DaimoPayHopBridger.FinalChainCoin({
            destinationType: DestinationType.SOLANA,
            finalChainId: SOLANA_CHAIN,
            coin: abi.encodePacked(SOLANA_USDC),
            coinDecimals: 6
        });

        DaimoPayHopBridgerHarness keyedHb = new DaimoPayHopBridgerHarness({
            hopChainId: HOP_CHAIN,
            hopCoinAddr: address(usdc2),
            hopCoinDecimals: 2,
            hopBridger: IDaimoPayBridger(address(hop)),
            finalChainCoins: coins
        });

        TokenAmount[] memory evmOpts = new TokenAmount[](1);
        evmOpts[0] = TokenAmount({
            token: IERC20(address(usdc6)),
            amount: 100_000
        });
        TokenAmount[] memory evmHopOpts = keyedHb.expose_getHopAsset({
            toChainId: SOLANA_CHAIN,
            tokenOpts: evmOpts
        });
        assertEq(address(evmHopOpts[0].token), address(usdc2));
        assertEq(evmHopOpts[0].amount, 10);

        BridgeTokenAmount memory solanaTokenOut = BridgeTokenAmount({
            token: abi.encodePacked(SOLANA_USDC),
            amount: 100_000
        });
        (address bridgeTokenIn, uint256 inAmount) = keyedHb.getBridgeTokenIn({
            destinationType: DestinationType.SOLANA,
            toChainId: SOLANA_CHAIN,
            tokenOut: solanaTokenOut
        });
        assertEq(bridgeTokenIn, address(usdc2));
        assertEq(inAmount, 10);
    }

    function testConstructor_DuplicateFinalCoinKey_Reverts() public {
        DaimoPayHopBridger.FinalChainCoin[]
            memory coins = new DaimoPayHopBridger.FinalChainCoin[](2);
        coins[0] = DaimoPayHopBridger.FinalChainCoin({
            destinationType: DestinationType.SOLANA,
            finalChainId: SOLANA_CHAIN,
            coin: abi.encodePacked(SOLANA_USDC),
            coinDecimals: 6
        });
        coins[1] = DaimoPayHopBridger.FinalChainCoin({
            destinationType: DestinationType.SOLANA,
            finalChainId: SOLANA_CHAIN,
            coin: abi.encodePacked(bytes32(uint256(SOLANA_USDC) + 1)),
            coinDecimals: 6
        });

        vm.expectRevert("DPHB: duplicate final coin");
        new DaimoPayHopBridgerHarness({
            hopChainId: HOP_CHAIN,
            hopCoinAddr: address(usdc2),
            hopCoinDecimals: 2,
            hopBridger: IDaimoPayBridger(address(hop)),
            finalChainCoins: coins
        });
    }

    function test_sendToChain_solanaFinalCoinEmitsHopLegBytesEvent() public {
        DaimoPayHopBridgerHarness solanaHb = _newSolanaHopBridger();
        BridgeTokenAmount memory tokenOut = BridgeTokenAmount({
            token: abi.encodePacked(SOLANA_USDC),
            amount: 100_000
        });
        address fulfillment = address(0xBEEF);

        usdc2.approve(address(solanaHb), 10);

        vm.expectEmit(true, true, true, true, address(solanaHb));
        emit IDepositAddressBridgeEvents.BridgeInitiatedBytes({
            fromAddress: address(this),
            fromToken: address(usdc2),
            fromAmount: 10,
            destinationType: DestinationType.EVM,
            toChainId: HOP_CHAIN,
            toAddress: DestinationUtils.evmAddressToBytes(fulfillment),
            toToken: DestinationUtils.evmAddressToBytes(address(usdc2)),
            toAmount: 10,
            refundAddress: address(this)
        });

        solanaHb.sendToChain({
            destinationType: DestinationType.SOLANA,
            toChainId: SOLANA_CHAIN,
            toAddress: DestinationUtils.evmAddressToBytes(fulfillment),
            tokenOut: tokenOut,
            refundAddress: address(this),
            extraData: bytes("")
        });
    }

    function test_sendToChain_solanaFinalCoinSendsToHopFulfillment() public {
        DaimoPayHopBridgerHarness solanaHb = _newSolanaHopBridger();
        BridgeTokenAmount memory tokenOut = BridgeTokenAmount({
            token: abi.encodePacked(SOLANA_USDC),
            amount: 100_000
        });
        address fulfillment = address(0xBEEF);

        usdc2.approve(address(solanaHb), 10);
        solanaHb.sendToChain({
            destinationType: DestinationType.SOLANA,
            toChainId: SOLANA_CHAIN,
            toAddress: DestinationUtils.evmAddressToBytes(fulfillment),
            tokenOut: tokenOut,
            refundAddress: address(this),
            extraData: bytes("")
        });

        assertEq(hop.lastToChainId(), HOP_CHAIN);
        assertEq(hop.lastToAddress(), fulfillment);
    }

    function _newSolanaHopBridger()
        private
        returns (DaimoPayHopBridgerHarness)
    {
        DaimoPayHopBridger.FinalChainCoin[]
            memory coins = new DaimoPayHopBridger.FinalChainCoin[](1);
        coins[0] = DaimoPayHopBridger.FinalChainCoin({
            destinationType: DestinationType.SOLANA,
            finalChainId: SOLANA_CHAIN,
            coin: abi.encodePacked(SOLANA_USDC),
            coinDecimals: 6
        });

        return
            new DaimoPayHopBridgerHarness({
                hopChainId: HOP_CHAIN,
                hopCoinAddr: address(usdc2),
                hopCoinDecimals: 2,
                hopBridger: IDaimoPayBridger(address(hop)),
                finalChainCoins: coins
            });
    }
}
