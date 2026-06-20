// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Permit.sol";

// ERC20 with EIP-2612 permit, for exercising DepositAddress.pullFromPermit.
contract DummyPermitToken is ERC20, ERC20Permit {
    constructor() ERC20("Permit Token", "PRM") ERC20Permit("Permit Token") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
