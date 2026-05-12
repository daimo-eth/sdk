// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "forge-std/console2.sol";

import "../src/DaimoPayPricer.sol";
import "./Constants.s.sol";
import {DEPLOY_SALT_DAIMO_PAY_PRICER} from "./DeploySalts.sol";

contract DeployDaimoPayPricer is Script {
    function run() public {
        address trustedSigner = vm.envAddress("PRICER_TRUSTED_SIGNER_ADDRESS");
        uint256 maxPriceAge = vm.envUint("MAX_PRICER_PRICE_AGE");

        vm.startBroadcast();

        address daimoPayPricer = CREATE3.deploy(
            DEPLOY_SALT_DAIMO_PAY_PRICER,
            abi.encodePacked(
                type(DaimoPayPricer).creationCode,
                abi.encode(trustedSigner, maxPriceAge)
            )
        );
        console.log("DaimoPayPricer deployed at address:", daimoPayPricer);
        console.log("  trustedSigner:", trustedSigner);
        console.log("  maxPriceAge:", maxPriceAge);

        vm.stopBroadcast();
    }

    // Exclude from forge coverage
    function test() public {}
}
