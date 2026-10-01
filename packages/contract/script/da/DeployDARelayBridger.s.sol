// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.13;

import "forge-std/Script.sol";

import "../../src/DARelayBridger.sol";
import {DestinationType} from "../../src/DestinationUtils.sol";
import {
    getDARelayBridgeRoutes
} from "./constants/DARelayBridgeRouteConstants.sol";
import "../Constants.s.sol";
import {DEPLOY_SALT_RELAY_BRIDGER} from "../DeploySalts.sol";

contract DeployDARelayBridger is Script {
    function run() public {
        // pay-api signs Relay quotes with the same key as 0x quotes, so this
        // is the 0x trusted signer address for the target environment.
        address signer = vm.envAddress("RELAY_TRUSTED_SIGNER_ADDRESS");
        uint256 maxQuoteAge = vm.envUint("MAX_RELAY_QUOTE_AGE");

        (
            DestinationType[] memory destinationTypes,
            uint256[] memory toChainIds,
            bytes[] memory bridgeTokenOuts,
            DARelayBridger.RelayRoute[] memory bridgeRoutes
        ) = getDARelayBridgeRoutes(block.chainid);

        if (toChainIds.length == 0) {
            revert("No Relay bridge routes found");
        }

        for (uint256 i = 0; i < toChainIds.length; ++i) {
            console.log("destinationType:", uint256(destinationTypes[i]));
            console.log("toChainId:", toChainIds[i]);
            console.logBytes(bridgeTokenOuts[i]);
            console.log("bridgeTokenIn:", bridgeRoutes[i].bridgeTokenIn);
            console.log("--------------------------------");
        }

        vm.startBroadcast();

        address bridger = CREATE3.deploy(
            DEPLOY_SALT_RELAY_BRIDGER,
            abi.encodePacked(
                type(DARelayBridger).creationCode,
                abi.encode(
                    signer, // _owner
                    signer, // _trustedSigner
                    maxQuoteAge,
                    destinationTypes,
                    toChainIds,
                    bridgeTokenOuts,
                    bridgeRoutes
                )
            )
        );
        console.log("DARelayBridger deployed at address:", bridger);
        console.log("  owner:", signer);
        console.log("  trustedSigner:", signer);
        console.log("  maxQuoteAge:", maxQuoteAge);

        vm.stopBroadcast();
    }

    // Exclude from forge coverage
    function test() public {}
}
