// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "../../src/DaimoPayHopBridger.sol";
import "../Constants.s.sol";
import {DEPLOY_SALT_HOP_BRIDGER} from "../DeploySalts.sol";
import {
    getDAHopChain,
    getDAHopBridgeRoutes
} from "./constants/DAHopBridgeRouteConstants.sol";

contract DeployDaimoPayHopBridger is Script {
    function run() public {
        // Discover hop configuration and final coin specs via codegen tables
        (
            uint256 hopChainId,
            address hopCoinAddr,
            uint256 hopCoinDecimals,
            address firstHopBridger
        ) = getDAHopChain(block.chainid);
        // No hops from this chain = don't deploy HopChainBridger.
        if (hopChainId == 0) return;

        // The leg-1 bridger address comes from codegen, not from
        // CREATE3.getDeployed(msg.sender, salt). A CREATE3 address is
        // f(deployer, salt), and leg-1 bridgers were not all deployed by the
        // key signing this deployment, so deriving it here silently produced
        // an address with no code on chains where the two differ.
        require(
            firstHopBridger.code.length > 0,
            "DPHB: leg 1 bridger not deployed"
        );

        // Retrieve final chain coin specs
        (
            uint256[] memory finalChains,
            DaimoPayHopBridger.FinalChainCoin[] memory finalChainCoins
        ) = getDAHopBridgeRoutes(block.chainid);
        require(
            finalChains.length == finalChainCoins.length,
            "DPHB: length mismatch"
        );

        // Log hop configuration and final coin specs
        console.log("Hop chain ID:", hopChainId);
        console.log("Hop coin address:", hopCoinAddr);
        console.log("Hop coin decimals:", hopCoinDecimals);
        console.log("First hop bridger:", firstHopBridger);
        console.log("--------------------------------");
        for (uint256 i = 0; i < finalChains.length; ++i) {
            console.log("Final chain:", finalChains[i]);
            console.log(
                "Destination type:",
                uint256(finalChainCoins[i].destinationType)
            );
            console.logBytes(finalChainCoins[i].coin);
            console.log(
                "Final coin decimals:",
                finalChainCoins[i].coinDecimals
            );
            console.log("--------------------------------");
        }

        vm.startBroadcast();
        address deployedHopBridger = CREATE3.deploy(
            DEPLOY_SALT_HOP_BRIDGER,
            abi.encodePacked(
                type(DaimoPayHopBridger).creationCode,
                abi.encode(
                    hopChainId,
                    hopCoinAddr,
                    hopCoinDecimals,
                    firstHopBridger,
                    finalChainCoins
                )
            )
        );
        vm.stopBroadcast();

        console.log("hop bridger deployed:", deployedHopBridger);
    }

    // Exclude from forge coverage
    function test() public {}
}
