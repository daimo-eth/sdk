// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

import {DARelayBridger} from "../src/DARelayBridger.sol";
import {
    DestinationType,
    BridgeTokenAmount
} from "../src/DestinationUtils.sol";
import {TestUSDC} from "./utils/DummyUSDC.sol";

/// @notice Mock Relay depository. Pulls `amount` of `token` from msg.sender.
contract MockRelayDepository {
    bool public shouldFail;
    uint256 public lastPulled;
    uint256 public lastNativeReceived;

    function setShouldFail(bool v) external {
        shouldFail = v;
    }

    function depositErc20(address token, uint256 amount) external payable {
        if (shouldFail) revert("relay mock: forced fail");
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        lastPulled = amount;
        lastNativeReceived = msg.value;
    }
}

contract DARelayBridgerTest is Test {
    uint256 private constant TRUSTED_SIGNER_KEY = 0xa11ce;
    uint256 private constant UNTRUSTED_SIGNER_KEY = 0xb0b;
    uint256 private constant MAX_QUOTE_AGE = 300;
    uint256 private constant TRON_CHAIN = 728126428;
    uint256 private constant OUT_AMOUNT = 100_000_000; // 100 USDT
    uint256 private constant IN_AMOUNT = 101_162_215; // 100 USDT + Relay fee
    uint256 private constant FEE = IN_AMOUNT - OUT_AMOUNT;

    // Tron USDT TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t, 0x41 + 20 bytes.
    bytes private constant TRON_USDT =
        hex"41a614f803b6fd780986a42c78ec9c7f77e6ded13c";
    bytes private constant TRON_RECIPIENT =
        hex"41c14fdd4e21c817fbef0d485ad4af6ae1fa312747";

    address private trustedSigner;
    address private refundAddress = address(0xBEEF);
    address private relayerEoa = address(0x1337);
    address private multiplexer = address(0x9999);

    DARelayBridger private bridger;
    TestUSDC private usdcIn;
    MockRelayDepository private depository;

    function setUp() public {
        vm.warp(1_700_000_000);
        trustedSigner = vm.addr(TRUSTED_SIGNER_KEY);
        usdcIn = new TestUSDC();
        depository = new MockRelayDepository();
        bridger = _deploy(_routes(address(usdcIn), 6, 6));

        usdcIn.transfer(multiplexer, 1_000_000_000);
        usdcIn.transfer(relayerEoa, 1_000_000_000);
        vm.prank(multiplexer);
        usdcIn.approve(address(bridger), type(uint256).max);
    }

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------

    function _routes(
        address tokenIn,
        uint256 inDec,
        uint256 outDec
    ) internal pure returns (DARelayBridger.RelayRoute[] memory routes) {
        routes = new DARelayBridger.RelayRoute[](1);
        routes[0] = DARelayBridger.RelayRoute({
            bridgeTokenIn: tokenIn,
            bridgeTokenInDecimals: inDec,
            bridgeTokenOutDecimals: outDec
        });
    }

    function _deploy(
        DARelayBridger.RelayRoute[] memory routes
    ) internal returns (DARelayBridger) {
        return
            _deployWith(
                trustedSigner,
                trustedSigner,
                MAX_QUOTE_AGE,
                DestinationType.TRON,
                TRON_USDT,
                routes
            );
    }

    function _deployWith(
        address owner,
        address signer,
        uint256 maxAge,
        DestinationType destinationType,
        bytes memory tokenOut,
        DARelayBridger.RelayRoute[] memory routes
    ) internal returns (DARelayBridger) {
        DestinationType[] memory types = new DestinationType[](1);
        types[0] = destinationType;
        uint256[] memory chains = new uint256[](1);
        chains[0] = TRON_CHAIN;
        bytes[] memory tokenOuts = new bytes[](1);
        tokenOuts[0] = tokenOut;
        return
            new DARelayBridger(
                owner,
                signer,
                maxAge,
                types,
                chains,
                tokenOuts,
                routes
            );
    }

    function _quote(
        uint256 outAmount,
        uint256 inAmount
    ) internal view returns (DARelayBridger.SignedQuote memory) {
        return
            DARelayBridger.SignedQuote({
                bridgeTokenOut: TRON_USDT,
                outAmount: outAmount,
                inAmount: inAmount,
                allowanceTarget: address(depository),
                callTarget: address(depository),
                callData: abi.encodeCall(
                    MockRelayDepository.depositErc20,
                    (address(usdcIn), inAmount)
                ),
                callValue: 0,
                timestamp: block.timestamp,
                quoteId: keccak256(abi.encode(outAmount, block.timestamp)),
                destinationType: DestinationType.TRON,
                toChainId: TRON_CHAIN,
                toAddress: TRON_RECIPIENT,
                signature: ""
            });
    }

    function _sign(
        DARelayBridger.SignedQuote memory q,
        uint256 key
    ) internal view returns (DARelayBridger.SignedQuote memory) {
        bytes32 hash = keccak256(
            abi.encode(
                block.chainid,
                address(bridger),
                q.destinationType,
                q.toChainId,
                keccak256(q.toAddress),
                address(usdcIn),
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
        bytes32 ethHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, ethHash);
        q.signature = abi.encodePacked(r, s, v);
        return q;
    }

    function _signed() internal view returns (DARelayBridger.SignedQuote memory) {
        return _sign(_quote(OUT_AMOUNT, IN_AMOUNT), TRUSTED_SIGNER_KEY);
    }

    function _prefund(uint256 amount) internal {
        vm.prank(relayerEoa);
        usdcIn.transfer(address(bridger), amount);
    }

    function _send(DARelayBridger.SignedQuote memory q) internal {
        _sendTo(q, TRON_RECIPIENT, OUT_AMOUNT);
    }

    function _sendTo(
        DARelayBridger.SignedQuote memory q,
        bytes memory toAddress,
        uint256 outAmount
    ) internal {
        vm.prank(multiplexer, relayerEoa);
        bridger.sendToChain(
            DestinationType.TRON,
            TRON_CHAIN,
            toAddress,
            BridgeTokenAmount({token: TRON_USDT, amount: outAmount}),
            refundAddress,
            abi.encode(q)
        );
    }

    // ---------------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------------

    function testConstructor_ZeroOwner_Reverts() public {
        DARelayBridger.RelayRoute[] memory routes = _routes(
            address(usdcIn),
            6,
            6
        );
        vm.expectRevert("DARB: invalid owner");
        _deployWith(
            address(0),
            trustedSigner,
            MAX_QUOTE_AGE,
            DestinationType.TRON,
            TRON_USDT,
            routes
        );
    }

    function testConstructor_ZeroSigner_Reverts() public {
        DARelayBridger.RelayRoute[] memory routes = _routes(
            address(usdcIn),
            6,
            6
        );
        vm.expectRevert("DARB: invalid signer");
        _deployWith(
            trustedSigner,
            address(0),
            MAX_QUOTE_AGE,
            DestinationType.TRON,
            TRON_USDT,
            routes
        );
    }

    function testConstructor_ZeroMaxAge_Reverts() public {
        DARelayBridger.RelayRoute[] memory routes = _routes(
            address(usdcIn),
            6,
            6
        );
        vm.expectRevert("DARB: invalid max quote age");
        _deployWith(
            trustedSigner,
            trustedSigner,
            0,
            DestinationType.TRON,
            TRON_USDT,
            routes
        );
    }

    function testConstructor_EvmRoute_Reverts() public {
        DARelayBridger.RelayRoute[] memory routes = _routes(
            address(usdcIn),
            6,
            6
        );
        vm.expectRevert("DARB: evm route");
        _deployWith(
            trustedSigner,
            trustedSigner,
            MAX_QUOTE_AGE,
            DestinationType.EVM,
            abi.encodePacked(address(0xB1)),
            routes
        );
    }

    function testConstructor_BadTronToken_Reverts() public {
        DARelayBridger.RelayRoute[] memory routes = _routes(
            address(usdcIn),
            6,
            6
        );
        vm.expectRevert("DARB: bad route token");
        _deployWith(
            trustedSigner,
            trustedSigner,
            MAX_QUOTE_AGE,
            DestinationType.TRON,
            hex"42a614f803b6fd780986a42c78ec9c7f77e6ded13c",
            routes
        );
    }

    function testConstructor_ZeroTokenIn_Reverts() public {
        vm.expectRevert("DARB: zero token in route");
        _deploy(_routes(address(0), 6, 6));
    }

    function testConstructor_ZeroDecimals_Reverts() public {
        vm.expectRevert("DARB: zero decimals in route");
        _deploy(_routes(address(usdcIn), 0, 6));
    }

    // ---------------------------------------------------------------------
    // getBridgeTokenIn
    // ---------------------------------------------------------------------

    function testGetBridgeTokenIn_OneToOne() public view {
        (address tokenIn, uint256 inAmount) = bridger.getBridgeTokenIn(
            DestinationType.TRON,
            TRON_CHAIN,
            BridgeTokenAmount({token: TRON_USDT, amount: OUT_AMOUNT})
        );
        assertEq(tokenIn, address(usdcIn));
        assertEq(inAmount, OUT_AMOUNT);
    }

    function testGetBridgeTokenIn_CrossDecimal_RoundUp() public {
        DARelayBridger b = _deploy(_routes(address(usdcIn), 18, 6));
        (, uint256 inAmount) = b.getBridgeTokenIn(
            DestinationType.TRON,
            TRON_CHAIN,
            BridgeTokenAmount({token: TRON_USDT, amount: 1})
        );
        assertEq(inAmount, 1e12);
    }

    function testGetBridgeTokenIn_NoRoute_Reverts() public {
        vm.expectRevert("DARB: route not found");
        bridger.getBridgeTokenIn(
            DestinationType.TRON,
            TRON_CHAIN + 1,
            BridgeTokenAmount({token: TRON_USDT, amount: OUT_AMOUNT})
        );
    }

    // ---------------------------------------------------------------------
    // sendToChain
    // ---------------------------------------------------------------------

    function testSendToChain_HappyPath_ExactOutput() public {
        _prefund(FEE);
        uint256 multiplexerBefore = usdcIn.balanceOf(multiplexer);

        _send(_signed());

        assertEq(depository.lastPulled(), IN_AMOUNT);
        assertEq(usdcIn.balanceOf(address(depository)), IN_AMOUNT);
        assertEq(multiplexerBefore - usdcIn.balanceOf(multiplexer), OUT_AMOUNT);
        assertEq(usdcIn.balanceOf(address(bridger)), 0);
        assertEq(usdcIn.allowance(address(bridger), address(depository)), 0);
    }

    function testSendToChain_ExcessPrefund_ReturnedToRelayer() public {
        _prefund(FEE + 5);
        uint256 relayerBefore = usdcIn.balanceOf(relayerEoa);

        _send(_signed());

        assertEq(usdcIn.balanceOf(address(bridger)), 0);
        assertEq(usdcIn.balanceOf(relayerEoa), relayerBefore + 5);
    }

    function testSendToChain_NativeFee_PaidAndExcessRefunded() public {
        _prefund(FEE);
        vm.deal(address(bridger), 1 ether);
        DARelayBridger.SignedQuote memory q = _quote(OUT_AMOUNT, IN_AMOUNT);
        q.callValue = 0.25 ether;
        q = _sign(q, TRUSTED_SIGNER_KEY);

        _send(q);

        assertEq(depository.lastNativeReceived(), 0.25 ether);
        assertEq(address(bridger).balance, 0);
        assertEq(relayerEoa.balance, 0.75 ether);
    }

    function testSendToChain_FeeNotPrefunded_Reverts() public {
        DARelayBridger.SignedQuote memory q = _signed();
        vm.expectRevert("DARB: fee not prefunded");
        _send(q);
    }

    function testSendToChain_InAmountBelowOut_Reverts() public {
        DARelayBridger.SignedQuote memory q = _sign(
            _quote(OUT_AMOUNT, OUT_AMOUNT - 1),
            TRUSTED_SIGNER_KEY
        );
        vm.expectRevert("DARB: in amount low");
        _send(q);
    }

    function testSendToChain_BadSignature_Reverts() public {
        _prefund(FEE);
        DARelayBridger.SignedQuote memory q = _sign(
            _quote(OUT_AMOUNT, IN_AMOUNT),
            UNTRUSTED_SIGNER_KEY
        );
        vm.expectRevert("DARB: bad signature");
        _send(q);
    }

    function testSendToChain_InAmountTamperedAfterSign_Reverts() public {
        _prefund(FEE * 2);
        DARelayBridger.SignedQuote memory q = _signed();
        q.inAmount = IN_AMOUNT + FEE;
        vm.expectRevert("DARB: bad signature");
        _send(q);
    }

    function testSendToChain_StaleQuote_Reverts() public {
        _prefund(FEE);
        DARelayBridger.SignedQuote memory q = _signed();
        vm.warp(block.timestamp + MAX_QUOTE_AGE + 1);
        vm.expectRevert("DARB: quote stale");
        _send(q);
    }

    function testSendToChain_QuoteReplay_Reverts() public {
        _prefund(FEE * 2);
        DARelayBridger.SignedQuote memory q = _signed();
        _send(q);
        vm.expectRevert("DARB: quote replayed");
        _send(q);
    }

    function testSendToChain_ToAddressMismatch_Reverts() public {
        _prefund(FEE);
        DARelayBridger.SignedQuote memory q = _signed();
        vm.expectRevert("DARB: to address mismatch");
        _sendTo(q, TRON_USDT, OUT_AMOUNT);
    }

    function testSendToChain_OutAmountMismatch_Reverts() public {
        _prefund(FEE);
        DARelayBridger.SignedQuote memory q = _signed();
        vm.expectRevert("DARB: out amount mismatch");
        _sendTo(q, TRON_RECIPIENT, OUT_AMOUNT - 1);
    }

    function testSendToChain_BadToAddress_Reverts() public {
        DARelayBridger.SignedQuote memory q = _signed();
        vm.expectRevert("DARB: bad to address");
        _sendTo(q, hex"41c14f", OUT_AMOUNT);
    }

    function testSendToChain_ChainIdMismatch_Reverts() public {
        _prefund(FEE);
        DARelayBridger.SignedQuote memory q = _quote(OUT_AMOUNT, IN_AMOUNT);
        q.toChainId = TRON_CHAIN + 1;
        q = _sign(q, TRUSTED_SIGNER_KEY);
        vm.expectRevert("DARB: chain id mismatch");
        _send(q);
    }

    function testSendToChain_RelayCallFails_Reverts() public {
        _prefund(FEE);
        depository.setShouldFail(true);
        DARelayBridger.SignedQuote memory q = _signed();
        vm.expectRevert("DARB: relay call failed");
        _send(q);
    }

    // ---------------------------------------------------------------------
    // sweep
    // ---------------------------------------------------------------------

    function testSweep_OnlyOwner_Reverts() public {
        vm.expectRevert("DARB: not owner");
        bridger.sweep(address(usdcIn), payable(refundAddress));
    }

    function testSweep_Erc20_FullBalance() public {
        _prefund(FEE);
        vm.prank(trustedSigner);
        bridger.sweep(address(usdcIn), payable(refundAddress));
        assertEq(usdcIn.balanceOf(refundAddress), FEE);
        assertEq(usdcIn.balanceOf(address(bridger)), 0);
    }
}
