// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {IERC20Permit} from
    "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Permit.sol";

import {DAParams, DepositAddress} from "../src/DepositAddress.sol";
import {DepositAddressFactory} from "../src/DepositAddressFactory.sol";
import {DestinationType} from "../src/DestinationUtils.sol";
import {IDepositAddressBridger} from "../src/interfaces/IDepositAddressBridger.sol";
import {IDaimoPayPricer} from "../src/interfaces/IDaimoPayPricer.sol";
import {DummyPermitToken} from "./utils/DummyPermitToken.sol";
import {TestUSDC} from "./utils/DummyUSDC.sol";

// A signature that is well-formed but recovers to the wrong signer, so
// permit() reverts and the pull falls through to the existing allowance.
uint8 constant BAD_V = 27;
bytes32 constant BAD_R = bytes32(uint256(1));
bytes32 constant BAD_S = bytes32(uint256(2));

contract DepositAddressPullFromPermitTest is Test {
    bytes32 private constant PERMIT_TYPEHASH = keccak256(
        "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
    );

    DepositAddressFactory private factory;
    DepositAddress private vault;
    DummyPermitToken private token;

    uint256 private constant OWNER_PK = 0xA11CE;
    address private owner;

    function setUp() public {
        factory = new DepositAddressFactory();
        vault = factory.createDepositAddress(_params());
        token = new DummyPermitToken();
        owner = vm.addr(OWNER_PK);
    }

    function test_pullFromPermit_fullBalance() public {
        token.mint(owner, 100e18);

        uint256 pulled = _pull(100e18, block.timestamp + 1 hours);

        assertEq(pulled, 100e18);
        assertEq(token.balanceOf(address(vault)), 100e18);
        assertEq(token.balanceOf(owner), 0);
        assertEq(token.allowance(owner, address(vault)), 0);
    }

    // The core fix: a deposit short of the signed amount still forwards.
    function test_pullFromPermit_shortfallStillForwards() public {
        token.mint(owner, 100e18); // only 100 arrived...

        uint256 pulled = _pull(120e18, block.timestamp + 1 hours); // ...signed 120

        assertEq(pulled, 100e18);
        assertEq(token.balanceOf(address(vault)), 100e18);
        assertEq(token.balanceOf(owner), 0);
    }

    // Over-delivery beyond the signed ceiling is capped at the allowance.
    function test_pullFromPermit_capsAtAllowance() public {
        token.mint(owner, 130e18); // 130 arrived...

        uint256 pulled = _pull(100e18, block.timestamp + 1 hours); // ...signed 100

        assertEq(pulled, 100e18);
        assertEq(token.balanceOf(address(vault)), 100e18);
        assertEq(token.balanceOf(owner), 30e18);
    }

    // A front-run permit consumes the nonce; the pull falls through to the
    // resulting allowance instead of reverting.
    function test_pullFromPermit_toleratesFrontRunPermit() public {
        token.mint(owner, 100e18);
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _sign(100e18, deadline);

        token.permit(owner, address(vault), 100e18, deadline, v, r, s);
        uint256 pulled =
            vault.pullFromPermit(token, owner, 100e18, deadline, v, r, s);

        assertEq(pulled, 100e18);
        assertEq(token.balanceOf(address(vault)), 100e18);
    }

    // Re-running after a successful pull is a no-op (nonce used, allowance gone).
    function test_pullFromPermit_idempotent() public {
        token.mint(owner, 100e18);
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _sign(100e18, deadline);

        vault.pullFromPermit(token, owner, 100e18, deadline, v, r, s);
        uint256 pulled =
            vault.pullFromPermit(token, owner, 100e18, deadline, v, r, s);

        assertEq(pulled, 0);
        assertEq(token.balanceOf(address(vault)), 100e18);
    }

    // No funds and no allowance: a bad/empty permit is a safe no-op, not a revert.
    function test_pullFromPermit_noFundsNoAllowance() public {
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _sign(100e18, deadline);

        uint256 pulled =
            vault.pullFromPermit(token, owner, 100e18, deadline, v, r, s);

        assertEq(pulled, 0);
    }

    // An expired permit reverts inside permit() and is swallowed; with no
    // allowance set, the pull is a safe no-op rather than a revert.
    function test_pullFromPermit_expiredPermitNoOp() public {
        token.mint(owner, 100e18);
        uint256 deadline = block.timestamp;
        (uint8 v, bytes32 r, bytes32 s) = _sign(100e18, deadline);
        vm.warp(block.timestamp + 1); // now past the deadline

        uint256 pulled =
            vault.pullFromPermit(token, owner, 100e18, deadline, v, r, s);

        assertEq(pulled, 0);
        assertEq(token.balanceOf(owner), 100e18);
    }

    // A garbage signature reverts inside permit() and is swallowed; the pull
    // falls through to an allowance the owner set with a normal approve.
    function test_pullFromPermit_fallsThroughToExistingAllowance() public {
        token.mint(owner, 100e18);
        vm.prank(owner);
        token.approve(address(vault), 40e18);

        uint256 pulled = vault.pullFromPermit(
            token, owner, 100e18, block.timestamp + 1 hours, BAD_V, BAD_R, BAD_S
        );

        assertEq(pulled, 40e18);
        assertEq(token.balanceOf(address(vault)), 40e18);
        assertEq(token.balanceOf(owner), 60e18);
    }

    // A token that doesn't implement permit() (the call reverts and is
    // swallowed) still pulls against a pre-existing allowance.
    function test_pullFromPermit_nonPermitTokenViaAllowance() public {
        TestUSDC usdc = new TestUSDC();
        usdc.transfer(owner, 1000e6);
        vm.prank(owner);
        usdc.approve(address(vault), 1000e6);

        uint256 pulled = vault.pullFromPermit(
            IERC20Permit(address(usdc)),
            owner,
            1000e6,
            block.timestamp + 1 hours,
            BAD_V,
            BAD_R,
            BAD_S
        );

        assertEq(pulled, 1000e6);
        assertEq(usdc.balanceOf(address(vault)), 1000e6);
    }

    // --- helpers ---

    function _pull(uint256 value, uint256 deadline) private returns (uint256) {
        (uint8 v, bytes32 r, bytes32 s) = _sign(value, deadline);
        return vault.pullFromPermit(token, owner, value, deadline, v, r, s);
    }

    function _sign(uint256 value, uint256 deadline)
        private
        view
        returns (uint8 v, bytes32 r, bytes32 s)
    {
        bytes32 structHash = keccak256(
            abi.encode(
                PERMIT_TYPEHASH,
                owner,
                address(vault),
                value,
                token.nonces(owner),
                deadline
            )
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash)
        );
        (v, r, s) = vm.sign(OWNER_PK, digest);
    }

    function _params() private view returns (DAParams memory) {
        return DAParams({
            destinationType: DestinationType.EVM,
            toChainId: 8453,
            toToken: abi.encodePacked(address(0xdead)),
            toAddress: abi.encodePacked(address(0xbeef)),
            refundAddress: address(0xca11),
            finalCallData: "",
            escrow: address(this),
            bridger: IDepositAddressBridger(address(0)),
            pricer: IDaimoPayPricer(address(0)),
            maxStartSlippageBps: 0,
            maxFastFinishSlippageBps: 0,
            maxSameChainFinishSlippageBps: 0,
            expiresAt: block.timestamp + 1000
        });
    }
}
