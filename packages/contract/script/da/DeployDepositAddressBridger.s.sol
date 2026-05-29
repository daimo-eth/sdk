// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.13;

import "forge-std/Script.sol";

import "../../src/DepositAddressBridger.sol";
import {
    DestinationType,
    DestinationUtils
} from "../../src/DestinationUtils.sol";
import {
    BridgeRecipientMode
} from "../../src/interfaces/IDepositAddressBridger.sol";
import "../../src/DaimoPayCCTPV2Bridger.sol";
import "../../src/DaimoPayLayerZeroBridger.sol";
import "../../src/DaimoPayHopBridger.sol";
import "../../src/DAZeroXBridger.sol";
import "../Constants.s.sol";
import {
    getDACCTPV2BridgeRoutes
} from "./constants/DACCTPV2BridgeRouteConstants.sol";
import {
    getDAHopChain,
    getDAHopBridgeRoutes
} from "./constants/DAHopBridgeRouteConstants.sol";
import {
    getDALegacyMeshBridgeRoutes
} from "./constants/DALegacyMeshBridgeRouteConstants.sol";
import {
    getDAStargateUSDCBridgeRoutes,
    getDAStargateUSDTBridgeRoutes
} from "./constants/DAStargateBridgeRouteConstants.sol";
import {
    getDAUSDT0BridgeRoutes
} from "./constants/DAUSDT0BridgeRouteConstants.sol";
import {
    getDAZeroXBridgeRoutes
} from "./constants/DAZeroXBridgeRouteConstants.sol";
import {
    DEPLOY_SALT_CCTP_V2_BRIDGER,
    DEPLOY_SALT_HOP_BRIDGER,
    DEPLOY_SALT_LEGACY_MESH_BRIDGER,
    DEPLOY_SALT_STARGATE_USDC_BRIDGER,
    DEPLOY_SALT_STARGATE_USDT_BRIDGER,
    DEPLOY_SALT_USDT0_BRIDGER,
    DEPLOY_SALT_ZEROX_BRIDGER,
    DEPLOY_SALT_DA_BRIDGER
} from "../DeploySalts.sol";

contract DeployDepositAddressBridger is Script {
    function run() public {
        (
            DestinationType[] memory destinationTypes,
            uint256[] memory chainIds,
            bytes[] memory stableOuts,
            address[] memory bridgers,
            BridgeRecipientMode[] memory recipientModes
        ) = _getBridgerRoutes();

        console.log("--------------------------------");
        for (uint256 i = 0; i < chainIds.length; ++i) {
            console.log("destinationType:", uint256(destinationTypes[i]));
            console.log("toChain:", chainIds[i]);
            console.logBytes(stableOuts[i]);
            console.log("  bridger:", bridgers[i]);
            console.log("  recipientMode:", uint256(recipientModes[i]));
        }
        console.log("--------------------------------");

        vm.startBroadcast();

        address universalBridger = CREATE3.deploy(
            DEPLOY_SALT_DA_BRIDGER,
            abi.encodePacked(
                type(DepositAddressBridger).creationCode,
                abi.encode(
                    destinationTypes,
                    chainIds,
                    stableOuts,
                    bridgers,
                    recipientModes
                )
            )
        );

        vm.stopBroadcast();

        console.log("DepositAddressBridger deployed at:", universalBridger);
    }

    function _getBridgerRoutes()
        private
        view
        returns (
            DestinationType[] memory destinationTypes,
            uint256[] memory chainIds,
            bytes[] memory stableOuts,
            address[] memory bridgers,
            BridgeRecipientMode[] memory recipientModes
        )
    {
        // Get addresses of deployed bridger implementations
        address cctpV2Bridger = CREATE3.getDeployed(
            msg.sender,
            DEPLOY_SALT_CCTP_V2_BRIDGER
        );
        address stargateUSDCBridger = CREATE3.getDeployed(
            msg.sender,
            DEPLOY_SALT_STARGATE_USDC_BRIDGER
        );
        address stargateUSDTBridger = CREATE3.getDeployed(
            msg.sender,
            DEPLOY_SALT_STARGATE_USDT_BRIDGER
        );
        address legacyMeshBridger = CREATE3.getDeployed(
            msg.sender,
            DEPLOY_SALT_LEGACY_MESH_BRIDGER
        );
        address hopBridger = CREATE3.getDeployed(
            msg.sender,
            DEPLOY_SALT_HOP_BRIDGER
        );
        address usdt0Bridger = CREATE3.getDeployed(
            msg.sender,
            DEPLOY_SALT_USDT0_BRIDGER
        );
        address zeroXBridger = CREATE3.getDeployed(
            msg.sender,
            DEPLOY_SALT_ZEROX_BRIDGER
        );

        console.log("cctpV2Bridger address:", cctpV2Bridger);
        console.log("stargateUSDCBridger address:", stargateUSDCBridger);
        console.log("stargateUSDTBridger address:", stargateUSDTBridger);
        console.log("legacyMeshBridger address:", legacyMeshBridger);
        console.log("hopBridger address:", hopBridger);
        console.log("usdt0Bridger address:", usdt0Bridger);
        console.log("zeroXBridger address:", zeroXBridger);

        // Get all supported destination chains from the DA constants
        // CCTP V2
        (
            uint256[] memory cctpV2ChainIds,
            DaimoPayCCTPV2Bridger.CCTPBridgeRoute[] memory cctpV2BridgeRoutes
        ) = getDACCTPV2BridgeRoutes(block.chainid);

        // Stargate USDC
        (
            uint256[] memory stargateUSDCChainIds,
            DaimoPayLayerZeroBridger.LZBridgeRoute[] memory stargateUSDCBridgeRoutes
        ) = getDAStargateUSDCBridgeRoutes(block.chainid);

        // Stargate USDT
        (
            uint256[] memory stargateUSDTChainIds,
            DaimoPayLayerZeroBridger.LZBridgeRoute[] memory stargateUSDTBridgeRoutes
        ) = getDAStargateUSDTBridgeRoutes(block.chainid);

        // Legacy Mesh
        (
            uint256[] memory legacyMeshChainIds,
            DaimoPayLayerZeroBridger.LZBridgeRoute[] memory legacyMeshBridgeRoutes
        ) = getDALegacyMeshBridgeRoutes(block.chainid);

        // Hop
        (
            uint256[] memory hopDestChainIds,
            DaimoPayHopBridger.FinalChainCoin[] memory finalChainCoins
        ) = getDAHopBridgeRoutes(block.chainid);

        // USDT0
        (
            uint256[] memory usdt0ChainIds,
            DaimoPayLayerZeroBridger.LZBridgeRoute[] memory usdt0BridgeRoutes
        ) = getDAUSDT0BridgeRoutes(block.chainid);

        // 0x
        (
            DestinationType[] memory zeroXDestinationTypes,
            uint256[] memory zeroXChainIds,
            bytes[] memory zeroXBridgeTokenOuts,

        ) = getDAZeroXBridgeRoutes(block.chainid);

        // Count total number of supported chains
        uint256 totalChains = cctpV2ChainIds.length +
            stargateUSDCChainIds.length +
            stargateUSDTChainIds.length +
            legacyMeshChainIds.length +
            hopDestChainIds.length +
            usdt0ChainIds.length +
            zeroXChainIds.length;

        // Initialize arrays for the combined result
        destinationTypes = new DestinationType[](totalChains);
        chainIds = new uint256[](totalChains);
        stableOuts = new bytes[](totalChains);
        bridgers = new address[](totalChains);
        recipientModes = new BridgeRecipientMode[](totalChains);

        uint256 index = 0;

        // Add CCTP V2 routes
        for (uint256 i = 0; i < cctpV2ChainIds.length; ++i) {
            destinationTypes[index] = DestinationType.EVM;
            chainIds[index] = cctpV2ChainIds[i];
            stableOuts[index] = DestinationUtils.evmAddressToBytes(
                cctpV2BridgeRoutes[i].bridgeTokenOut
            );
            bridgers[index] = cctpV2Bridger;
            recipientModes[index] = BridgeRecipientMode.FULFILLMENT;
            index++;
        }

        // Add Stargate USDC routes
        for (uint256 i = 0; i < stargateUSDCChainIds.length; ++i) {
            destinationTypes[index] = DestinationType.EVM;
            chainIds[index] = stargateUSDCChainIds[i];
            stableOuts[index] = DestinationUtils.evmAddressToBytes(
                stargateUSDCBridgeRoutes[i].bridgeTokenOut
            );
            bridgers[index] = stargateUSDCBridger;
            recipientModes[index] = BridgeRecipientMode.FULFILLMENT;
            index++;
        }

        // Add Stargate USDT routes
        for (uint256 i = 0; i < stargateUSDTChainIds.length; ++i) {
            destinationTypes[index] = DestinationType.EVM;
            chainIds[index] = stargateUSDTChainIds[i];
            stableOuts[index] = DestinationUtils.evmAddressToBytes(
                stargateUSDTBridgeRoutes[i].bridgeTokenOut
            );
            bridgers[index] = stargateUSDTBridger;
            recipientModes[index] = BridgeRecipientMode.FULFILLMENT;
            index++;
        }

        // Add Legacy Mesh routes
        for (uint256 i = 0; i < legacyMeshChainIds.length; i++) {
            destinationTypes[index] = DestinationType.EVM;
            chainIds[index] = legacyMeshChainIds[i];
            stableOuts[index] = DestinationUtils.evmAddressToBytes(
                legacyMeshBridgeRoutes[i].bridgeTokenOut
            );
            bridgers[index] = legacyMeshBridger;
            recipientModes[index] = BridgeRecipientMode.FULFILLMENT;
            index++;
        }

        // Add Hop routes
        for (uint256 i = 0; i < hopDestChainIds.length; ++i) {
            destinationTypes[index] = finalChainCoins[i].destinationType;
            chainIds[index] = hopDestChainIds[i];
            stableOuts[index] = finalChainCoins[i].coin;
            bridgers[index] = hopBridger;
            recipientModes[index] = BridgeRecipientMode.FULFILLMENT;
            index++;
        }

        // Add USDT0 routes
        for (uint256 i = 0; i < usdt0ChainIds.length; ++i) {
            destinationTypes[index] = DestinationType.EVM;
            chainIds[index] = usdt0ChainIds[i];
            stableOuts[index] = DestinationUtils.evmAddressToBytes(
                usdt0BridgeRoutes[i].bridgeTokenOut
            );
            bridgers[index] = usdt0Bridger;
            recipientModes[index] = BridgeRecipientMode.FULFILLMENT;
            index++;
        }

        // Add 0x routes
        for (uint256 i = 0; i < zeroXChainIds.length; ++i) {
            destinationTypes[index] = zeroXDestinationTypes[i];
            chainIds[index] = zeroXChainIds[i];
            stableOuts[index] = zeroXBridgeTokenOuts[i];
            bridgers[index] = zeroXBridger;
            recipientModes[index] = zeroXDestinationTypes[i] ==
                DestinationType.EVM
                ? BridgeRecipientMode.FULFILLMENT
                : BridgeRecipientMode.DIRECT;
            index++;
        }

        return (
            destinationTypes,
            chainIds,
            stableOuts,
            bridgers,
            recipientModes
        );
    }

    // Exclude from forge coverage
    function test() public {}
}
