// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

import {DAZeroXBridger} from "../src/DAZeroXBridger.sol";
import {IDaimoPayBridger} from "../src/interfaces/IDaimoPayBridger.sol";
import {TokenAmount} from "../src/TokenUtils.sol";
import {TestUSDC} from "./utils/DummyUSDC.sol";

/// @notice Mock 0x router. Pulls `pullAmount` of `inToken` from msg.sender,
/// optionally accepts native value.
contract MockZeroXRouter {
    /// @notice Set to a non-zero amount to override the pull (defensive sweep test).
    uint256 public pullOverride;
    bool public shouldFail;

    uint256 public lastNativeReceived;
    uint256 public lastPulled;
    address public lastInToken;

    function setPullOverride(uint256 v) external {
        pullOverride = v;
    }

    function setShouldFail(bool v) external {
        shouldFail = v;
    }

    /// @dev Called by the bridger via low-level call.
    function swap(address inToken, uint256 amount) external payable {
        if (shouldFail) revert("0x mock: forced fail");
        uint256 pull = pullOverride != 0 ? pullOverride : amount;
        if (pull > 0) {
            IERC20(inToken).transferFrom(msg.sender, address(this), pull);
            lastPulled = pull;
            lastInToken = inToken;
        }
        lastNativeReceived = msg.value;
    }
}

contract DAZeroXBridgerTest is Test {
    // ---------------------------------------------------------------------
    // Test constants & actors
    // ---------------------------------------------------------------------
    uint256 private constant TRUSTED_SIGNER_KEY = 0xa11ce;
    uint256 private constant UNTRUSTED_SIGNER_KEY = 0xb0b;
    uint256 private constant MAX_QUOTE_AGE = 300;
    uint256 private constant DST_CHAIN = 10; // Optimism

    address private trustedSigner;
    address private bridgeTokenOutA; // e.g. USDC on Optimism
    address private bridgeTokenOutB; // e.g. USDT on Optimism
    address private toAddress;
    address private refundAddress;
    address private relayerEoa;
    address private multiplexer;

    // ---------------------------------------------------------------------
    // Deployed contracts
    // ---------------------------------------------------------------------
    DAZeroXBridger private bridger;
    TestUSDC private usdcIn; // bridgeTokenIn paired with bridgeTokenOutA
    TestUSDC private usdtIn; // bridgeTokenIn paired with bridgeTokenOutB
    MockZeroXRouter private router;

    // ---------------------------------------------------------------------
    // Setup
    // ---------------------------------------------------------------------
    function setUp() public {
        vm.warp(1_700_000_000);

        trustedSigner = vm.addr(TRUSTED_SIGNER_KEY);
        bridgeTokenOutA = address(0xB1B1B1B1b1B1b1b1b1B1B1B1B1b1b1B1b1b1B1B1);
        bridgeTokenOutB = address(0xb2b2b2b2b2B2b2B2B2b2b2B2B2b2B2B2b2b2b2b2);
        toAddress = address(0xDEED);
        refundAddress = address(0xBEEF);
        relayerEoa = address(0x1337);
        multiplexer = address(0x9999);

        usdcIn = new TestUSDC();
        usdtIn = new TestUSDC();
        router = new MockZeroXRouter();

        // Two routes on the same destination chain to exercise multi-output.
        uint256[] memory chains = new uint256[](2);
        chains[0] = DST_CHAIN;
        chains[1] = DST_CHAIN;

        address[] memory tokenOuts = new address[](2);
        tokenOuts[0] = bridgeTokenOutA;
        tokenOuts[1] = bridgeTokenOutB;

        DAZeroXBridger.ZeroXRoute[]
            memory routes = new DAZeroXBridger.ZeroXRoute[](2);
        routes[0] = DAZeroXBridger.ZeroXRoute({
            bridgeTokenIn: address(usdcIn),
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 6
        });
        routes[1] = DAZeroXBridger.ZeroXRoute({
            bridgeTokenIn: address(usdtIn),
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 6
        });

        bridger = new DAZeroXBridger({
            _owner: trustedSigner,
            _trustedSigner: trustedSigner,
            _maxQuoteAge: MAX_QUOTE_AGE,
            _toChainIds: chains,
            _bridgeTokenOuts: tokenOuts,
            _bridgeRoutes: routes
        });

        // Fund + approve the multiplexer for both input tokens.
        usdcIn.transfer(multiplexer, 1_000_000_000);
        usdtIn.transfer(multiplexer, 1_000_000_000);
        vm.prank(multiplexer);
        usdcIn.approve(address(bridger), type(uint256).max);
        vm.prank(multiplexer);
        usdtIn.approve(address(bridger), type(uint256).max);
    }

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------
    function _options(
        address tokenOut,
        uint256 amount
    ) internal pure returns (TokenAmount[] memory opts) {
        opts = new TokenAmount[](1);
        opts[0] = TokenAmount({token: IERC20(tokenOut), amount: amount});
    }

    function _baseQuote(
        address tokenOut,
        uint256 outAmount
    ) internal view returns (DAZeroXBridger.SignedQuote memory q) {
        q = DAZeroXBridger.SignedQuote({
            bridgeTokenOut: tokenOut,
            outAmount: outAmount,
            allowanceTarget: address(router),
            callTarget: address(router),
            callData: abi.encodeCall(
                MockZeroXRouter.swap,
                (_routeInToken(tokenOut), outAmount)
            ),
            callValue: 0,
            timestamp: block.timestamp,
            quoteId: keccak256(abi.encode(tokenOut, outAmount, block.timestamp)),
            toChainId: DST_CHAIN,
            toAddress: toAddress,
            signature: ""
        });
    }

    function _routeInToken(address tokenOut) internal view returns (address) {
        if (tokenOut == bridgeTokenOutA) return address(usdcIn);
        if (tokenOut == bridgeTokenOutB) return address(usdtIn);
        revert("unknown tokenOut");
    }

    function _sign(
        DAZeroXBridger.SignedQuote memory q,
        address bridgeTokenIn,
        uint256 signerKey,
        address bridgerAddr,
        uint256 chainId
    ) internal pure returns (bytes memory) {
        bytes32 hash = keccak256(
            abi.encode(
                chainId,
                bridgerAddr,
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
        bytes32 ethHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, ethHash);
        return abi.encodePacked(r, s, v);
    }

    function _signQuote(
        DAZeroXBridger.SignedQuote memory q
    ) internal view returns (DAZeroXBridger.SignedQuote memory) {
        q.signature = _sign(
            q,
            _routeInToken(q.bridgeTokenOut),
            TRUSTED_SIGNER_KEY,
            address(bridger),
            block.chainid
        );
        return q;
    }

    /// @notice Deploy a single-route bridger for cross-decimal scenarios.
    function _deployCrossDecimalBridger(
        address tokenIn,
        address tokenOut,
        uint256 inDec,
        uint256 outDec
    ) internal returns (DAZeroXBridger) {
        uint256[] memory chains = new uint256[](1);
        chains[0] = DST_CHAIN;
        address[] memory tokenOuts = new address[](1);
        tokenOuts[0] = tokenOut;
        DAZeroXBridger.ZeroXRoute[]
            memory routes = new DAZeroXBridger.ZeroXRoute[](1);
        routes[0] = DAZeroXBridger.ZeroXRoute({
            bridgeTokenIn: tokenIn,
            bridgeTokenInDecimals: inDec,
            bridgeTokenOutDecimals: outDec
        });
        return
            new DAZeroXBridger(
                trustedSigner,
                trustedSigner,
                MAX_QUOTE_AGE,
                chains,
                tokenOuts,
                routes
            );
    }

    /// @notice Build + sign a quote whose callData pulls `inAmount` while the
    /// signed `outAmount` is denominated in dest-token decimals. Used by
    /// cross-decimal sendToChain tests.
    function _signCrossDecimalQuote(
        DAZeroXBridger b,
        address tokenIn,
        address tokenOut,
        uint256 outAmount,
        uint256 inAmount
    ) internal view returns (DAZeroXBridger.SignedQuote memory q) {
        q = DAZeroXBridger.SignedQuote({
            bridgeTokenOut: tokenOut,
            outAmount: outAmount,
            allowanceTarget: address(router),
            callTarget: address(router),
            callData: abi.encodeCall(
                MockZeroXRouter.swap,
                (tokenIn, inAmount)
            ),
            callValue: 0,
            timestamp: block.timestamp,
            quoteId: keccak256(
                abi.encode(tokenOut, outAmount, inAmount, block.timestamp)
            ),
            toChainId: DST_CHAIN,
            toAddress: toAddress,
            signature: ""
        });
        q.signature = _sign(
            q,
            tokenIn,
            TRUSTED_SIGNER_KEY,
            address(b),
            block.chainid
        );
    }

    // ---------------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------------
    function testConstructor_ZeroOwner_Reverts() public {
        uint256[] memory chains = new uint256[](0);
        address[] memory tokenOuts = new address[](0);
        DAZeroXBridger.ZeroXRoute[]
            memory routes = new DAZeroXBridger.ZeroXRoute[](0);
        vm.expectRevert(bytes("DAZX: invalid owner"));
        new DAZeroXBridger(
            address(0),
            trustedSigner,
            MAX_QUOTE_AGE,
            chains,
            tokenOuts,
            routes
        );
    }

    function testConstructor_ZeroSigner_Reverts() public {
        uint256[] memory chains = new uint256[](0);
        address[] memory tokenOuts = new address[](0);
        DAZeroXBridger.ZeroXRoute[]
            memory routes = new DAZeroXBridger.ZeroXRoute[](0);
        vm.expectRevert(bytes("DAZX: invalid signer"));
        new DAZeroXBridger(
            trustedSigner,
            address(0),
            MAX_QUOTE_AGE,
            chains,
            tokenOuts,
            routes
        );
    }

    function testConstructor_ZeroMaxAge_Reverts() public {
        uint256[] memory chains = new uint256[](0);
        address[] memory tokenOuts = new address[](0);
        DAZeroXBridger.ZeroXRoute[]
            memory routes = new DAZeroXBridger.ZeroXRoute[](0);
        vm.expectRevert(bytes("DAZX: invalid max quote age"));
        new DAZeroXBridger(
            trustedSigner,
            trustedSigner,
            0,
            chains,
            tokenOuts,
            routes
        );
    }

    function testConstructor_LengthMismatch_Reverts() public {
        uint256[] memory chains = new uint256[](2);
        chains[0] = 1;
        chains[1] = 2;
        address[] memory tokenOuts = new address[](1);
        tokenOuts[0] = bridgeTokenOutA;
        DAZeroXBridger.ZeroXRoute[]
            memory routes = new DAZeroXBridger.ZeroXRoute[](2);
        routes[0] = DAZeroXBridger.ZeroXRoute({
            bridgeTokenIn: address(usdcIn),
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 6
        });
        routes[1] = DAZeroXBridger.ZeroXRoute({
            bridgeTokenIn: address(usdtIn),
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 6
        });
        vm.expectRevert(bytes("DAZX: length mismatch"));
        new DAZeroXBridger(
            trustedSigner,
            trustedSigner,
            MAX_QUOTE_AGE,
            chains,
            tokenOuts,
            routes
        );
    }

    function testConstructor_ZeroTokenInRoute_Reverts() public {
        uint256[] memory chains = new uint256[](1);
        chains[0] = DST_CHAIN;
        address[] memory tokenOuts = new address[](1);
        tokenOuts[0] = bridgeTokenOutA;
        DAZeroXBridger.ZeroXRoute[]
            memory routes = new DAZeroXBridger.ZeroXRoute[](1);
        routes[0] = DAZeroXBridger.ZeroXRoute({
            bridgeTokenIn: address(0),
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 6
        });
        vm.expectRevert(bytes("DAZX: zero token in route"));
        new DAZeroXBridger(
            trustedSigner,
            trustedSigner,
            MAX_QUOTE_AGE,
            chains,
            tokenOuts,
            routes
        );
    }

    function testConstructor_ZeroInDecimals_Reverts() public {
        uint256[] memory chains = new uint256[](1);
        chains[0] = DST_CHAIN;
        address[] memory tokenOuts = new address[](1);
        tokenOuts[0] = bridgeTokenOutA;
        DAZeroXBridger.ZeroXRoute[]
            memory routes = new DAZeroXBridger.ZeroXRoute[](1);
        routes[0] = DAZeroXBridger.ZeroXRoute({
            bridgeTokenIn: address(usdcIn),
            bridgeTokenInDecimals: 0,
            bridgeTokenOutDecimals: 6
        });
        vm.expectRevert(bytes("DAZX: zero decimals in route"));
        new DAZeroXBridger(
            trustedSigner,
            trustedSigner,
            MAX_QUOTE_AGE,
            chains,
            tokenOuts,
            routes
        );
    }

    function testConstructor_ZeroOutDecimals_Reverts() public {
        uint256[] memory chains = new uint256[](1);
        chains[0] = DST_CHAIN;
        address[] memory tokenOuts = new address[](1);
        tokenOuts[0] = bridgeTokenOutA;
        DAZeroXBridger.ZeroXRoute[]
            memory routes = new DAZeroXBridger.ZeroXRoute[](1);
        routes[0] = DAZeroXBridger.ZeroXRoute({
            bridgeTokenIn: address(usdcIn),
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 0
        });
        vm.expectRevert(bytes("DAZX: zero decimals in route"));
        new DAZeroXBridger(
            trustedSigner,
            trustedSigner,
            MAX_QUOTE_AGE,
            chains,
            tokenOuts,
            routes
        );
    }

    function testConstructor_ZeroTokenOut_Reverts() public {
        uint256[] memory chains = new uint256[](1);
        chains[0] = DST_CHAIN;
        address[] memory tokenOuts = new address[](1);
        tokenOuts[0] = address(0);
        DAZeroXBridger.ZeroXRoute[]
            memory routes = new DAZeroXBridger.ZeroXRoute[](1);
        routes[0] = DAZeroXBridger.ZeroXRoute({
            bridgeTokenIn: address(usdcIn),
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 6
        });
        vm.expectRevert(bytes("DAZX: zero token in route"));
        new DAZeroXBridger(
            trustedSigner,
            trustedSigner,
            MAX_QUOTE_AGE,
            chains,
            tokenOuts,
            routes
        );
    }

    // ---------------------------------------------------------------------
    // getBridgeTokenIn
    // ---------------------------------------------------------------------
    function testGetBridgeTokenIn_RouteA() public view {
        TokenAmount[] memory opts = _options(bridgeTokenOutA, 100);
        (address inToken, uint256 inAmount) = bridger.getBridgeTokenIn(
            DST_CHAIN,
            opts
        );
        assertEq(inToken, address(usdcIn));
        assertEq(inAmount, 100);
    }

    function testGetBridgeTokenIn_RouteB() public view {
        TokenAmount[] memory opts = _options(bridgeTokenOutB, 200);
        (address inToken, uint256 inAmount) = bridger.getBridgeTokenIn(
            DST_CHAIN,
            opts
        );
        assertEq(inToken, address(usdtIn));
        assertEq(inAmount, 200);
    }

    function testGetBridgeTokenIn_MultipleOptions_Reverts() public {
        TokenAmount[] memory opts = new TokenAmount[](2);
        opts[0] = TokenAmount({
            token: IERC20(bridgeTokenOutA),
            amount: 100
        });
        opts[1] = TokenAmount({
            token: IERC20(bridgeTokenOutB),
            amount: 100
        });
        vm.expectRevert(bytes("DAZX: multiple options"));
        bridger.getBridgeTokenIn(DST_CHAIN, opts);
    }

    function testGetBridgeTokenIn_NoRoute_Reverts() public {
        TokenAmount[] memory opts = _options(bridgeTokenOutA, 100);
        vm.expectRevert(bytes("DAZX: route not found"));
        bridger.getBridgeTokenIn(99999, opts);
    }

    function testGetBridgeTokenIn_BadToken_Reverts() public {
        TokenAmount[] memory opts = _options(address(0xCAFE), 100);
        vm.expectRevert(bytes("DAZX: route not found"));
        bridger.getBridgeTokenIn(DST_CHAIN, opts);
    }

    // ---------------------------------------------------------------------
    // getBridgeTokenIn - cross-decimal routes
    // ---------------------------------------------------------------------
    function testGetBridgeTokenIn_CrossDecimal_18To6() public {
        // Source: BSC USDT (18d) → Dest: Arbitrum USDT0 (6d).
        DAZeroXBridger b = _deployCrossDecimalBridger({
            tokenIn: address(usdcIn),
            tokenOut: bridgeTokenOutA,
            inDec: 18,
            outDec: 6
        });
        // 1 USDC at 6d on dest → 1 USDT at 18d on source.
        TokenAmount[] memory opts = _options(bridgeTokenOutA, 1_000_000);
        (address inToken, uint256 inAmount) = b.getBridgeTokenIn(
            DST_CHAIN,
            opts
        );
        assertEq(inToken, address(usdcIn));
        assertEq(inAmount, 1e18);
    }

    function testGetBridgeTokenIn_CrossDecimal_6To18() public {
        // Source: Arb USDT0 (6d) → Dest: BSC USDT (18d).
        DAZeroXBridger b = _deployCrossDecimalBridger({
            tokenIn: address(usdcIn),
            tokenOut: bridgeTokenOutA,
            inDec: 6,
            outDec: 18
        });
        // 2.5 USDT at 18d on dest → 2.5 USDT0 at 6d on source.
        TokenAmount[] memory opts = _options(
            bridgeTokenOutA,
            2_500_000_000_000_000_000
        );
        (address inToken, uint256 inAmount) = b.getBridgeTokenIn(
            DST_CHAIN,
            opts
        );
        assertEq(inToken, address(usdcIn));
        assertEq(inAmount, 2_500_000);
    }

    function testGetBridgeTokenIn_CrossDecimal_RoundUp() public {
        // 18→6: 1 wei of an 18d token rounds up to 1 wei of a 6d token,
        // never zero. Guarantees we never under-fund the 0x call.
        DAZeroXBridger b = _deployCrossDecimalBridger({
            tokenIn: address(usdcIn),
            tokenOut: bridgeTokenOutA,
            inDec: 6,
            outDec: 18
        });
        TokenAmount[] memory opts = _options(bridgeTokenOutA, 1);
        (, uint256 inAmount) = b.getBridgeTokenIn(DST_CHAIN, opts);
        assertEq(inAmount, 1);
    }

    /// @notice Regression test for the production bug where 0x was sent a
    /// dust sellAmount due to missing decimal conversion. DA address
    /// 0x6259...8955 held 0.25 BSC USDT (18d) bridging to 0.25 Arb USDT0 (6d);
    /// the bridger must compute inAmount = 250_000 * 10^12 = 2.5e17.
    function testGetBridgeTokenIn_BscUsdtToArbUsdt0_Regression() public {
        DAZeroXBridger b = _deployCrossDecimalBridger({
            tokenIn: address(usdcIn),
            tokenOut: bridgeTokenOutA,
            inDec: 18,
            outDec: 6
        });
        TokenAmount[] memory opts = _options(bridgeTokenOutA, 250_000);
        (, uint256 inAmount) = b.getBridgeTokenIn(DST_CHAIN, opts);
        assertEq(inAmount, 250_000_000_000_000_000);
    }

    // ---------------------------------------------------------------------
    // sendToChain - happy paths
    // ---------------------------------------------------------------------
    function testSendToChain_HappyPath_RouteA() public {
        uint256 amount = 1_000_000;
        TokenAmount[] memory opts = _options(bridgeTokenOutA, amount);
        DAZeroXBridger.SignedQuote memory q = _signQuote(
            _baseQuote(bridgeTokenOutA, amount)
        );

        vm.expectEmit(true, true, true, true);
        emit IDaimoPayBridger.BridgeInitiated({
            fromAddress: multiplexer,
            fromToken: address(usdcIn),
            fromAmount: amount,
            toChainId: DST_CHAIN,
            toAddress: toAddress,
            toToken: bridgeTokenOutA,
            toAmount: amount,
            refundAddress: refundAddress
        });

        vm.prank(multiplexer);
        bridger.sendToChain(
            DST_CHAIN,
            toAddress,
            opts,
            refundAddress,
            abi.encode(q)
        );

        assertEq(router.lastPulled(), amount);
        assertEq(router.lastInToken(), address(usdcIn));
        assertEq(router.lastNativeReceived(), 0);
        assertEq(usdcIn.allowance(address(bridger), address(router)), 0);
        assertEq(usdcIn.balanceOf(address(bridger)), 0);
    }

    /// @notice Multi-output: route B (USDT-equivalent) used in same bridger.
    function testSendToChain_HappyPath_RouteB() public {
        uint256 amount = 500_000;
        TokenAmount[] memory opts = _options(bridgeTokenOutB, amount);
        DAZeroXBridger.SignedQuote memory q = _signQuote(
            _baseQuote(bridgeTokenOutB, amount)
        );

        vm.expectEmit(true, true, true, true);
        emit IDaimoPayBridger.BridgeInitiated({
            fromAddress: multiplexer,
            fromToken: address(usdtIn),
            fromAmount: amount,
            toChainId: DST_CHAIN,
            toAddress: toAddress,
            toToken: bridgeTokenOutB,
            toAmount: amount,
            refundAddress: refundAddress
        });

        vm.prank(multiplexer);
        bridger.sendToChain(
            DST_CHAIN,
            toAddress,
            opts,
            refundAddress,
            abi.encode(q)
        );

        assertEq(router.lastPulled(), amount);
        assertEq(router.lastInToken(), address(usdtIn));
        // usdcIn should be untouched.
        assertEq(usdcIn.balanceOf(address(router)), 0);
    }

    /// @notice Both routes work in the same test, in sequence.
    function testSendToChain_MultiOutput_BothRoutesIndependently() public {
        uint256 amountA = 1_000_000;
        uint256 amountB = 500_000;

        TokenAmount[] memory optsA = _options(bridgeTokenOutA, amountA);
        DAZeroXBridger.SignedQuote memory qA = _signQuote(
            _baseQuote(bridgeTokenOutA, amountA)
        );
        vm.prank(multiplexer);
        bridger.sendToChain(
            DST_CHAIN,
            toAddress,
            optsA,
            refundAddress,
            abi.encode(qA)
        );

        TokenAmount[] memory optsB = _options(bridgeTokenOutB, amountB);
        DAZeroXBridger.SignedQuote memory qB = _signQuote(
            _baseQuote(bridgeTokenOutB, amountB)
        );
        vm.prank(multiplexer);
        bridger.sendToChain(
            DST_CHAIN,
            toAddress,
            optsB,
            refundAddress,
            abi.encode(qB)
        );

        assertEq(usdcIn.balanceOf(address(router)), amountA);
        assertEq(usdtIn.balanceOf(address(router)), amountB);
    }

    function testSendToChain_NativeFee_PaidAndExcessRefunded() public {
        uint256 amount = 1_000_000;
        TokenAmount[] memory opts = _options(bridgeTokenOutA, amount);
        DAZeroXBridger.SignedQuote memory q = _baseQuote(
            bridgeTokenOutA,
            amount
        );
        q.callValue = 0.05 ether;
        q = _signQuote(q);

        vm.deal(address(bridger), 0.1 ether);
        uint256 originBalBefore = relayerEoa.balance;

        vm.prank(multiplexer, relayerEoa);
        bridger.sendToChain(
            DST_CHAIN,
            toAddress,
            opts,
            refundAddress,
            abi.encode(q)
        );

        assertEq(router.lastNativeReceived(), 0.05 ether);
        assertEq(address(bridger).balance, 0);
        assertEq(relayerEoa.balance, originBalBefore + 0.05 ether);
    }

    function testSendToChain_DefensiveSweep_OnUnderConsume() public {
        uint256 amount = 1_000_000;
        router.setPullOverride(amount / 2);

        TokenAmount[] memory opts = _options(bridgeTokenOutA, amount);
        DAZeroXBridger.SignedQuote memory q = _signQuote(
            _baseQuote(bridgeTokenOutA, amount)
        );

        vm.prank(multiplexer);
        bridger.sendToChain(
            DST_CHAIN,
            toAddress,
            opts,
            refundAddress,
            abi.encode(q)
        );

        assertEq(usdcIn.balanceOf(refundAddress), amount / 2);
        assertEq(usdcIn.balanceOf(address(bridger)), 0);
    }

    // ---------------------------------------------------------------------
    // sendToChain - rejections
    // ---------------------------------------------------------------------
    function testSendToChain_SameChain_Reverts() public {
        uint256 amount = 100;
        TokenAmount[] memory opts = _options(bridgeTokenOutA, amount);
        DAZeroXBridger.SignedQuote memory q = _signQuote(
            _baseQuote(bridgeTokenOutA, amount)
        );

        vm.prank(multiplexer);
        vm.expectRevert(bytes("DAZX: same chain"));
        bridger.sendToChain(
            block.chainid,
            toAddress,
            opts,
            refundAddress,
            abi.encode(q)
        );
    }

    function testSendToChain_MultipleOptions_Reverts() public {
        TokenAmount[] memory opts = new TokenAmount[](2);
        opts[0] = TokenAmount({
            token: IERC20(bridgeTokenOutA),
            amount: 100
        });
        opts[1] = TokenAmount({
            token: IERC20(bridgeTokenOutB),
            amount: 100
        });
        DAZeroXBridger.SignedQuote memory q = _signQuote(
            _baseQuote(bridgeTokenOutA, 100)
        );

        vm.prank(multiplexer);
        vm.expectRevert(bytes("DAZX: multiple options"));
        bridger.sendToChain(
            DST_CHAIN,
            toAddress,
            opts,
            refundAddress,
            abi.encode(q)
        );
    }

    function testSendToChain_NoRoute_Reverts() public {
        // Pick an unconfigured chain.
        uint256 unconfiguredChain = 99999;
        uint256 amount = 100;
        TokenAmount[] memory opts = _options(bridgeTokenOutA, amount);
        DAZeroXBridger.SignedQuote memory q = _baseQuote(
            bridgeTokenOutA,
            amount
        );
        q.toChainId = unconfiguredChain;
        q = _signQuote(q);

        vm.prank(multiplexer);
        vm.expectRevert(bytes("DAZX: route not found"));
        bridger.sendToChain(
            unconfiguredChain,
            toAddress,
            opts,
            refundAddress,
            abi.encode(q)
        );
    }

    function testSendToChain_StaleQuote_Reverts() public {
        uint256 amount = 100;
        TokenAmount[] memory opts = _options(bridgeTokenOutA, amount);
        DAZeroXBridger.SignedQuote memory q = _baseQuote(
            bridgeTokenOutA,
            amount
        );
        q.timestamp = block.timestamp - MAX_QUOTE_AGE - 1;
        q = _signQuote(q);

        vm.prank(multiplexer);
        vm.expectRevert(bytes("DAZX: quote stale"));
        bridger.sendToChain(
            DST_CHAIN,
            toAddress,
            opts,
            refundAddress,
            abi.encode(q)
        );
    }

    function testSendToChain_BadSignature_Reverts() public {
        uint256 amount = 100;
        TokenAmount[] memory opts = _options(bridgeTokenOutA, amount);
        DAZeroXBridger.SignedQuote memory q = _baseQuote(
            bridgeTokenOutA,
            amount
        );
        q.signature = _sign(
            q,
            address(usdcIn),
            UNTRUSTED_SIGNER_KEY,
            address(bridger),
            block.chainid
        );

        vm.prank(multiplexer);
        vm.expectRevert(bytes("DAZX: bad signature"));
        bridger.sendToChain(
            DST_CHAIN,
            toAddress,
            opts,
            refundAddress,
            abi.encode(q)
        );
    }

    function testSendToChain_TamperedAfterSign_Reverts() public {
        uint256 amount = 100;
        TokenAmount[] memory opts = _options(bridgeTokenOutA, amount);
        DAZeroXBridger.SignedQuote memory q = _signQuote(
            _baseQuote(bridgeTokenOutA, amount)
        );
        q.callTarget = address(0xDEADBEEF);

        vm.prank(multiplexer);
        vm.expectRevert(bytes("DAZX: bad signature"));
        bridger.sendToChain(
            DST_CHAIN,
            toAddress,
            opts,
            refundAddress,
            abi.encode(q)
        );
    }

    function testSendToChain_QuoteReplay_Reverts() public {
        uint256 amount = 100;
        TokenAmount[] memory opts = _options(bridgeTokenOutA, amount);
        DAZeroXBridger.SignedQuote memory q = _signQuote(
            _baseQuote(bridgeTokenOutA, amount)
        );

        vm.prank(multiplexer);
        bridger.sendToChain(
            DST_CHAIN,
            toAddress,
            opts,
            refundAddress,
            abi.encode(q)
        );

        vm.prank(multiplexer);
        vm.expectRevert(bytes("DAZX: quote replayed"));
        bridger.sendToChain(
            DST_CHAIN,
            toAddress,
            opts,
            refundAddress,
            abi.encode(q)
        );
    }

    function testSendToChain_ToChainIdMismatch_Reverts() public {
        uint256 amount = 100;
        TokenAmount[] memory opts = _options(bridgeTokenOutA, amount);
        DAZeroXBridger.SignedQuote memory q = _baseQuote(
            bridgeTokenOutA,
            amount
        );
        q.toChainId = 999; // mismatch with DST_CHAIN
        q = _signQuote(q);

        vm.prank(multiplexer);
        vm.expectRevert(bytes("DAZX: chain id mismatch"));
        bridger.sendToChain(
            DST_CHAIN,
            toAddress,
            opts,
            refundAddress,
            abi.encode(q)
        );
    }

    function testSendToChain_ToAddressMismatch_Reverts() public {
        uint256 amount = 100;
        TokenAmount[] memory opts = _options(bridgeTokenOutA, amount);
        DAZeroXBridger.SignedQuote memory q = _baseQuote(
            bridgeTokenOutA,
            amount
        );
        q.toAddress = address(0xBAD);
        q = _signQuote(q);

        vm.prank(multiplexer);
        vm.expectRevert(bytes("DAZX: to address mismatch"));
        bridger.sendToChain(
            DST_CHAIN,
            toAddress,
            opts,
            refundAddress,
            abi.encode(q)
        );
    }

    function testSendToChain_OutAmountMismatch_Reverts() public {
        uint256 amount = 100;
        TokenAmount[] memory opts = _options(bridgeTokenOutA, amount);
        DAZeroXBridger.SignedQuote memory q = _baseQuote(
            bridgeTokenOutA,
            amount + 1
        );
        q = _signQuote(q);

        vm.prank(multiplexer);
        vm.expectRevert(bytes("DAZX: out amount mismatch"));
        bridger.sendToChain(
            DST_CHAIN,
            toAddress,
            opts,
            refundAddress,
            abi.encode(q)
        );
    }

    function testSendToChain_BridgeTokenOutMismatch_Reverts() public {
        uint256 amount = 100;
        TokenAmount[] memory opts = _options(bridgeTokenOutA, amount);
        // Sign a quote claiming bridgeTokenOutB while the option carries A.
        DAZeroXBridger.SignedQuote memory q = _baseQuote(
            bridgeTokenOutB,
            amount
        );
        q = _signQuote(q);

        vm.prank(multiplexer);
        vm.expectRevert(bytes("DAZX: bridge token mismatch"));
        bridger.sendToChain(
            DST_CHAIN,
            toAddress,
            opts,
            refundAddress,
            abi.encode(q)
        );
    }

    function testSendToChain_InsufficientNative_Reverts() public {
        uint256 amount = 100;
        TokenAmount[] memory opts = _options(bridgeTokenOutA, amount);
        DAZeroXBridger.SignedQuote memory q = _baseQuote(
            bridgeTokenOutA,
            amount
        );
        q.callValue = 1 ether;
        q = _signQuote(q);

        vm.prank(multiplexer);
        vm.expectRevert(bytes("DAZX: insufficient native"));
        bridger.sendToChain(
            DST_CHAIN,
            toAddress,
            opts,
            refundAddress,
            abi.encode(q)
        );
    }

    function testSendToChain_OxCallReverts_Bubbles() public {
        uint256 amount = 100;
        TokenAmount[] memory opts = _options(bridgeTokenOutA, amount);
        DAZeroXBridger.SignedQuote memory q = _signQuote(
            _baseQuote(bridgeTokenOutA, amount)
        );
        router.setShouldFail(true);

        vm.prank(multiplexer);
        vm.expectRevert(bytes("DAZX: 0x call failed"));
        bridger.sendToChain(
            DST_CHAIN,
            toAddress,
            opts,
            refundAddress,
            abi.encode(q)
        );
    }

    // ---------------------------------------------------------------------
    // sendToChain - cross-decimal routes
    // ---------------------------------------------------------------------

    /// @notice 18d source → 6d dest. Pulls source-decimal inAmount, not the
    /// 6-decimal outAmount. Emits BridgeInitiated with fromAmount = inAmount,
    /// toAmount = outAmount.
    function testSendToChain_CrossDecimal_18To6() public {
        DAZeroXBridger b = _deployCrossDecimalBridger({
            tokenIn: address(usdcIn),
            tokenOut: bridgeTokenOutA,
            inDec: 18,
            outDec: 6
        });
        deal(address(usdcIn), multiplexer, 2e18);
        vm.prank(multiplexer);
        usdcIn.approve(address(b), type(uint256).max);

        uint256 outAmount = 1_000_000; // 1 USDC at 6d
        uint256 inAmount = 1e18; // 1 USDT at 18d
        TokenAmount[] memory opts = _options(bridgeTokenOutA, outAmount);
        DAZeroXBridger.SignedQuote memory q = _signCrossDecimalQuote(
            b,
            address(usdcIn),
            bridgeTokenOutA,
            outAmount,
            inAmount
        );

        vm.expectEmit(true, true, true, true);
        emit IDaimoPayBridger.BridgeInitiated({
            fromAddress: multiplexer,
            fromToken: address(usdcIn),
            fromAmount: inAmount,
            toChainId: DST_CHAIN,
            toAddress: toAddress,
            toToken: bridgeTokenOutA,
            toAmount: outAmount,
            refundAddress: refundAddress
        });

        vm.prank(multiplexer);
        b.sendToChain(DST_CHAIN, toAddress, opts, refundAddress, abi.encode(q));

        assertEq(router.lastPulled(), inAmount);
        assertEq(usdcIn.balanceOf(address(b)), 0);
    }

    /// @notice 6d source → 18d dest. Round-down with round-up matters when
    /// outAmount is 1 wei of an 18d token: inAmount must be 1 (not 0).
    function testSendToChain_CrossDecimal_6To18() public {
        DAZeroXBridger b = _deployCrossDecimalBridger({
            tokenIn: address(usdcIn),
            tokenOut: bridgeTokenOutA,
            inDec: 6,
            outDec: 18
        });
        deal(address(usdcIn), multiplexer, 10_000_000);
        vm.prank(multiplexer);
        usdcIn.approve(address(b), type(uint256).max);

        uint256 outAmount = 2_500_000_000_000_000_000; // 2.5 at 18d
        uint256 inAmount = 2_500_000; // 2.5 at 6d
        TokenAmount[] memory opts = _options(bridgeTokenOutA, outAmount);
        DAZeroXBridger.SignedQuote memory q = _signCrossDecimalQuote(
            b,
            address(usdcIn),
            bridgeTokenOutA,
            outAmount,
            inAmount
        );

        vm.prank(multiplexer);
        b.sendToChain(DST_CHAIN, toAddress, opts, refundAddress, abi.encode(q));

        assertEq(router.lastPulled(), inAmount);
    }

    /// @notice Regression for the 0.25 USDT BSC → USDT0 Arbitrum case
    /// (daAddr 0x6259...8955). The pre-fix bug had us sending sellAmount=250000
    /// to 0x on an 18-decimal token (= dust). Post-fix: bridger pulls 2.5e17.
    function testSendToChain_BscUsdtToArbUsdt0_Regression() public {
        DAZeroXBridger b = _deployCrossDecimalBridger({
            tokenIn: address(usdcIn),
            tokenOut: bridgeTokenOutA,
            inDec: 18,
            outDec: 6
        });
        deal(address(usdcIn), multiplexer, 1e18);
        vm.prank(multiplexer);
        usdcIn.approve(address(b), type(uint256).max);

        uint256 outAmount = 250_000; // 0.25 USDT0 at 6d
        uint256 inAmount = 250_000_000_000_000_000; // 0.25 BSC USDT at 18d
        TokenAmount[] memory opts = _options(bridgeTokenOutA, outAmount);
        DAZeroXBridger.SignedQuote memory q = _signCrossDecimalQuote(
            b,
            address(usdcIn),
            bridgeTokenOutA,
            outAmount,
            inAmount
        );

        vm.prank(multiplexer);
        b.sendToChain(DST_CHAIN, toAddress, opts, refundAddress, abi.encode(q));

        assertEq(router.lastPulled(), inAmount);
    }

    // ---------------------------------------------------------------------
    // Domain separation
    // ---------------------------------------------------------------------
    function testSendToChain_CrossChainSignature_Reverts() public {
        uint256 amount = 100;
        TokenAmount[] memory opts = _options(bridgeTokenOutA, amount);
        DAZeroXBridger.SignedQuote memory q = _baseQuote(
            bridgeTokenOutA,
            amount
        );
        q.signature = _sign(
            q,
            address(usdcIn),
            TRUSTED_SIGNER_KEY,
            address(bridger),
            8453 // wrong chain id
        );

        vm.prank(multiplexer);
        vm.expectRevert(bytes("DAZX: bad signature"));
        bridger.sendToChain(
            DST_CHAIN,
            toAddress,
            opts,
            refundAddress,
            abi.encode(q)
        );
    }

    function testSendToChain_CrossDeploymentSignature_Reverts() public {
        // Deploy a second bridger with the same trustedSigner.
        uint256[] memory chains = new uint256[](1);
        chains[0] = DST_CHAIN;
        address[] memory tokenOuts = new address[](1);
        tokenOuts[0] = bridgeTokenOutA;
        DAZeroXBridger.ZeroXRoute[]
            memory routes = new DAZeroXBridger.ZeroXRoute[](1);
        routes[0] = DAZeroXBridger.ZeroXRoute({
            bridgeTokenIn: address(usdcIn),
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 6
        });
        DAZeroXBridger other = new DAZeroXBridger(
            trustedSigner,
            trustedSigner,
            MAX_QUOTE_AGE,
            chains,
            tokenOuts,
            routes
        );

        uint256 amount = 100;
        TokenAmount[] memory opts = _options(bridgeTokenOutA, amount);
        DAZeroXBridger.SignedQuote memory q = _baseQuote(
            bridgeTokenOutA,
            amount
        );
        // Sign for `other`, replay against `bridger`.
        q.signature = _sign(
            q,
            address(usdcIn),
            TRUSTED_SIGNER_KEY,
            address(other),
            block.chainid
        );

        vm.prank(multiplexer);
        vm.expectRevert(bytes("DAZX: bad signature"));
        bridger.sendToChain(
            DST_CHAIN,
            toAddress,
            opts,
            refundAddress,
            abi.encode(q)
        );
    }

    // ---------------------------------------------------------------------
    // sweep
    // ---------------------------------------------------------------------
    function testSweep_OnlyOwner_Reverts() public {
        vm.prank(address(0xBADBAD));
        vm.expectRevert(bytes("DAZX: not owner"));
        bridger.sweep(address(usdcIn), payable(address(0xC0FFEE)));
    }

    function testSweep_ZeroRecipient_Reverts() public {
        vm.prank(trustedSigner);
        vm.expectRevert(bytes("DAZX: zero recipient"));
        bridger.sweep(address(usdcIn), payable(address(0)));
    }

    function testSweep_Erc20_FullBalance() public {
        address recipient = address(0xC0FFEE);
        uint256 amount = 12_345;
        usdcIn.transfer(address(bridger), amount);
        assertEq(usdcIn.balanceOf(address(bridger)), amount);

        vm.prank(trustedSigner);
        bridger.sweep(address(usdcIn), payable(recipient));

        assertEq(usdcIn.balanceOf(address(bridger)), 0);
        assertEq(usdcIn.balanceOf(recipient), amount);
    }

    function testSweep_Native_FullBalance() public {
        address recipient = address(0xC0FFEE);
        vm.deal(address(bridger), 1 ether);
        assertEq(address(bridger).balance, 1 ether);
        uint256 before = recipient.balance;

        vm.prank(trustedSigner);
        bridger.sweep(address(0), payable(recipient));

        assertEq(address(bridger).balance, 0);
        assertEq(recipient.balance, before + 1 ether);
    }

    function testSweep_ZeroBalance_NoOp() public {
        address recipient = address(0xC0FFEE);
        assertEq(usdcIn.balanceOf(address(bridger)), 0);

        vm.prank(trustedSigner);
        bridger.sweep(address(usdcIn), payable(recipient));

        assertEq(usdcIn.balanceOf(recipient), 0);
    }
}
