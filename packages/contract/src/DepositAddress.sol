// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.12;

import "openzeppelin-contracts-upgradeable/contracts/proxy/utils/Initializable.sol";
import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import "openzeppelin-contracts/contracts/utils/math/Math.sol";

import "./TokenUtils.sol";
import "./DestinationUtils.sol";
import "./interfaces/IDepositAddressBridger.sol";
import "./interfaces/IDaimoPayPricer.sol";

/// @notice Parameters that uniquely identify a Deposit Address.
struct DAParams {
    /// Destination chain type
    DestinationType destinationType;
    /// Destination chain
    uint256 toChainId;
    /// Final token received on destination chain
    bytes toToken;
    /// Destination address. If finalCallData is empty, tokens are transferred
    /// here. Otherwise, tokens are transferred here and a call is made with
    /// finalCallData (e.g., toAddress is an adapter contract).
    bytes toAddress;
    /// Recipient for refunds
    address refundAddress;
    /// Optional calldata to execute on toAddress after swapping to toToken.
    /// If empty, tokens are simply transferred to toAddress.
    bytes finalCallData;
    /// DepositAddressManager escrow contract
    address escrow;
    /// DepositAddressBridger contract
    IDepositAddressBridger bridger;
    /// DaimoPayPricer contract
    IDaimoPayPricer pricer;
    /// Maximum slippage allowed on starts. Expected slippage from token sent
    /// by the user to the bridge token.
    uint256 maxStartSlippageBps;
    /// Maximum slippage allowed on fast finishes. Expected slippage from bridge
    /// token to final token.
    uint256 maxFastFinishSlippageBps;
    /// Maximum slippage allowed on same chain finishes. Expected slippage from
    /// payment token to final token.
    uint256 maxSameChainFinishSlippageBps;
    /// Timestamp after which the deposit address expires and can be refunded
    uint256 expiresAt;
}

/// @notice Parameters that uniquely identify a single intent (cross-chain
///         transfer) for a Deposit Address.
struct DAFulfillmentParams {
    /// The Deposit Address contract for this intent
    address depositAddress;
    /// Unique salt/nonce provided by the relayer
    bytes32 relaySalt;
    /// Address and amount of token bridged to destination chain
    BridgeTokenAmount bridgeTokenOut;
    /// Chain ID where the bridge transfer originated
    uint256 sourceChainId;
}

/// @notice Calculate the deterministic hash committed to by the Deposit Address
function calcDAParamsHash(DAParams calldata params) pure returns (bytes32) {
    return keccak256(abi.encode(params));
}

/// @author Daimo, Inc
/// @notice Minimal contract that holds funds for a cross-chain deposit address,
///         enabling deterministic address across chains.
/// @dev Stateless design with only a fixed param hash allows cheap deployment
///      via proxy clones and reuse across multiple chains. Funds are held
///      securely until the Deposit Address Manager orchestrates their release
///      for swaps, bridging, or refunds. Each deposit address is uniquely tied
///      to a specific set of DAParams and can only be controlled by its
///      designated escrow.
contract DepositAddress is Initializable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    /// @dev Cheap single-slot storage – keccak256(DAParams).
    bytes32 public paramHash;

    // ---------------------------------------------------------------------
    // Constructor / Initializer
    // ---------------------------------------------------------------------

    constructor() {
        _disableInitializers();
    }

    /// Accept native chain asset (e.g. ETH) deposits
    receive() external payable {
        emit NativeTransfer(msg.sender, address(this), msg.value);
    }

    /// @param _paramHash keccak256(DAParams) committed by the factory.
    function initialize(bytes32 _paramHash) public initializer {
        paramHash = _paramHash;

        // Emit event for any native token that arrived before deployment
        if (address(this).balance > 0) {
            emit NativeTransfer(
                address(0),
                address(this),
                address(this).balance
            );
        }
    }

    // ---------------------------------------------------------------------
    // Escrow helpers – only callable by the escrow/manager
    // ---------------------------------------------------------------------

    /// @notice Transfers the balance of a token from the vault to a
    ///         designated recipient. Callable only by the authorized escrow.
    /// @param params      The DAParams that this vault was created for
    /// @param token       The token to transfer from the vault
    /// @param recipient   The address to receive the transferred tokens
    function sendBalance(
        DAParams calldata params,
        IERC20 token,
        address payable recipient
    ) public nonReentrant returns (uint256) {
        require(calcDAParamsHash(params) == paramHash, "DA: params mismatch");
        require(msg.sender == params.escrow, "DA: only escrow");

        return TokenUtils.transferBalance({token: token, recipient: recipient});
    }

    // ---------------------------------------------------------------------
    // Permit pull – move funds the owner authorized into this deposit address
    // ---------------------------------------------------------------------

    /// @notice Pull a token balance from `owner` into this deposit address
    ///         using an EIP-2612 permit, leaving it for the normal
    ///         escrow-controlled flow. Transfers the lesser of the owner's
    ///         balance and the permitted allowance, so a deposit that arrived
    ///         short of the signed amount still gets forwarded.
    /// @dev Permissionless by design: the permit names this contract as the
    ///      spender, so funds can only ever land here — the exact address the
    ///      owner authorized. The permit call is wrapped so an already-consumed
    ///      permit (a retry, or someone front-running the permit) falls through
    ///      to the existing allowance instead of reverting. Idempotent.
    /// @param token    EIP-2612 token to pull.
    /// @param owner    Account that signed the permit and holds the funds.
    /// @param value    Allowance ceiling signed in the permit.
    /// @param deadline Permit expiry.
    /// @param v        Permit signature component.
    /// @param r        Permit signature component.
    /// @param s        Permit signature component.
    /// @return pulled  Amount transferred into this deposit address.
    function pullFromPermit(
        IERC20Permit token,
        address owner,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public nonReentrant returns (uint256 pulled) {
        // Tolerate an already-applied permit (a retry, or a front-run of the
        // permit call): fall through to whatever allowance is already set.
        try token.permit(owner, address(this), value, deadline, v, r, s) {}
        catch {}

        IERC20 erc20 = IERC20(address(token));
        pulled = Math.min(
            erc20.balanceOf(owner),
            erc20.allowance(owner, address(this))
        );
        if (pulled == 0) return 0;

        erc20.safeTransferFrom(owner, address(this), pulled);
    }
}
