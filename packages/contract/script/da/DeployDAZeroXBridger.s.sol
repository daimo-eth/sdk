// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.13;

import "forge-std/Script.sol";

import "../../src/DAZeroXBridger.sol";
import {
    getDAZeroXBridgeRoutes
} from "./constants/DAZeroXBridgeRouteConstants.sol";
import "../Constants.s.sol";
import {DEPLOY_SALT_ZEROX_BRIDGER} from "../DeploySalts.sol";

contract DeployDAZeroXBridger is Script {
    function run() public {
        // owner == trustedSigner today; kept as separate constructor params so
        // they can diverge later without a contract change.
        address signer = vm.envAddress("ZEROX_TRUSTED_SIGNER_ADDRESS");
        uint256 maxQuoteAge = vm.envUint("MAX_ZEROX_QUOTE_AGE");

        (
            uint256[] memory toChainIds,
            address[] memory bridgeTokenOuts,
            DAZeroXBridger.ZeroXRoute[] memory bridgeRoutes
        ) = getDAZeroXBridgeRoutes(block.chainid);

        if (toChainIds.length == 0) {
            revert("No 0x bridge routes found");
        }

        for (uint256 i = 0; i < toChainIds.length; ++i) {
            console.log("toChainId:", toChainIds[i]);
            console.log("bridgeTokenOut:", bridgeTokenOuts[i]);
            console.log("bridgeTokenIn:", bridgeRoutes[i].bridgeTokenIn);
            console.log("--------------------------------");
        }

        vm.startBroadcast();

        address bridger = CREATE3.deploy(
            DEPLOY_SALT_ZEROX_BRIDGER,
            abi.encodePacked(
                type(DAZeroXBridger).creationCode,
                abi.encode(
                    signer, // _owner
                    signer, // _trustedSigner
                    maxQuoteAge,
                    toChainIds,
                    bridgeTokenOuts,
                    bridgeRoutes
                )
            )
        );
        console.log("DAZeroXBridger deployed at address:", bridger);
        console.log("  owner:", signer);
        console.log("  trustedSigner:", signer);
        console.log("  maxQuoteAge:", maxQuoteAge);

        vm.stopBroadcast();
    }

    // Exclude from forge coverage
    function test() public {}
}
