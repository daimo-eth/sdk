// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.13;

import "forge-std/Script.sol";

import "../../src/DAHopBridger.sol";
import {
    getDAHopBridgeRoutes
} from "./constants/DAHopBridgeRouteConstants.sol";
import "../Constants.s.sol";
import {DEPLOY_SALT_DA_HOP_BRIDGER} from "../DeploySalts.sol";

contract DeployDAHopBridger is Script {
    function run() public {
        (
            uint256[] memory finalChainIds,
            address[] memory finalStableAddrs,
            DAHopBridger.HopBridgeRoute[] memory hopBridgeRoutes
        ) = getDAHopBridgeRoutes(block.chainid, msg.sender);

        if (finalChainIds.length == 0) return;

        require(
            finalChainIds.length == finalStableAddrs.length &&
                finalChainIds.length == hopBridgeRoutes.length,
            "DAHB: length mismatch"
        );

        for (uint256 i = 0; i < finalChainIds.length; ++i) {
            console.log("Final chain:", finalChainIds[i]);
            console.log("Final stable:", finalStableAddrs[i]);
            console.log("Final stable decimals:");
            console.log(hopBridgeRoutes[i].finalStableDecimals);
            console.log("Hop chain:", hopBridgeRoutes[i].hopChainId);
            console.log("Hop stable:", hopBridgeRoutes[i].hopStableAddr);
            console.log("Hop stable decimals:");
            console.log(hopBridgeRoutes[i].hopStableDecimals);
            console.log(
                "Hop bridger:",
                address(hopBridgeRoutes[i].hopBridger)
            );
            console.log("--------------------------------");
        }

        vm.startBroadcast();
        address bridger = CREATE3.deploy(
            DEPLOY_SALT_DA_HOP_BRIDGER,
            abi.encodePacked(
                type(DAHopBridger).creationCode,
                abi.encode(finalChainIds, finalStableAddrs, hopBridgeRoutes)
            )
        );
        vm.stopBroadcast();

        console.log("DAHopBridger deployed at address:", bridger);
    }

    // Exclude from forge coverage
    function test() public {}
}
