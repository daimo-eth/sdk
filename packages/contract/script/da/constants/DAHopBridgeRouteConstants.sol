// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.12;

import "../../../src/DAHopBridger.sol";
import "../../../src/interfaces/IDaimoPayBridger.sol";
import {CREATE3} from "../../Constants.s.sol";
import {
    DEPLOY_SALT_CCTP_V2_BRIDGER,
    DEPLOY_SALT_LEGACY_MESH_BRIDGER,
    DEPLOY_SALT_STARGATE_USDC_BRIDGER,
    DEPLOY_SALT_STARGATE_USDT_BRIDGER,
    DEPLOY_SALT_USDT0_BRIDGER
} from "../../DeploySalts.sol";

// @title DAHopBridgeRouteConstants
// @notice Auto-generated DA constants for Hop bridge routes

// Return all DA Hop bridge routes for the given source chain.
function getDAHopBridgeRoutes(
    uint256 sourceChainId,
    address deployer
)
    view
    returns (
        uint256[] memory finalChainIds,
        address[] memory finalStableAddrs,
        DAHopBridger.HopBridgeRoute[] memory hopBridgeRoutes
    )
{
    // Source chain 10
    if (sourceChainId == 10) {
        finalChainIds = new uint256[](3);
        finalStableAddrs = new address[](3);
        hopBridgeRoutes = new DAHopBridger.HopBridgeRoute[](3);

        // 10 -> 56 USDC
        finalChainIds[0] = 56;
        finalStableAddrs[0] = 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d;
        hopBridgeRoutes[0] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_CCTP_V2_BRIDGER)
            ),
            finalStableDecimals: 18
        });

        // 10 -> 100 USDC
        finalChainIds[1] = 100;
        finalStableAddrs[1] = 0x2a22f9c3b484c3629090FeED35F17Ff8F88f76F0;
        hopBridgeRoutes[1] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_CCTP_V2_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 10 -> 42220 USDT
        finalChainIds[2] = 42220;
        finalStableAddrs[2] = 0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e;
        hopBridgeRoutes[2] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_CCTP_V2_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        return (finalChainIds, finalStableAddrs, hopBridgeRoutes);
    }

    // Source chain 56
    if (sourceChainId == 56) {
        finalChainIds = new uint256[](7);
        finalStableAddrs = new address[](7);
        hopBridgeRoutes = new DAHopBridger.HopBridgeRoute[](7);

        // 56 -> 10 USDC
        finalChainIds[0] = 10;
        finalStableAddrs[0] = 0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85;
        hopBridgeRoutes[0] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_STARGATE_USDC_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 56 -> 143 USDC
        finalChainIds[1] = 143;
        finalStableAddrs[1] = 0x754704Bc059F8C67012fEd69BC8A327a5aafb603;
        hopBridgeRoutes[1] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_STARGATE_USDC_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 56 -> 480 USDC
        finalChainIds[2] = 480;
        finalStableAddrs[2] = 0x79A02482A880bCE3F13e09Da970dC34db4CD24d1;
        hopBridgeRoutes[2] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_STARGATE_USDC_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 56 -> 999 USDC
        finalChainIds[3] = 999;
        finalStableAddrs[3] = 0xb88339CB7199b77E23DB6E890353E22632Ba630f;
        hopBridgeRoutes[3] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_STARGATE_USDC_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 56 -> 4326 USDT
        finalChainIds[4] = 4326;
        finalStableAddrs[4] = 0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb;
        hopBridgeRoutes[4] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_STARGATE_USDC_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 56 -> 42220 USDT
        finalChainIds[5] = 42220;
        finalStableAddrs[5] = 0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e;
        hopBridgeRoutes[5] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_STARGATE_USDC_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 56 -> 59144 USDC
        finalChainIds[6] = 59144;
        finalStableAddrs[6] = 0x176211869cA2b568f2A7D4EE941E073a821EE1ff;
        hopBridgeRoutes[6] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_STARGATE_USDC_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        return (finalChainIds, finalStableAddrs, hopBridgeRoutes);
    }

    // Source chain 100
    if (sourceChainId == 100) {
        finalChainIds = new uint256[](7);
        finalStableAddrs = new address[](7);
        hopBridgeRoutes = new DAHopBridger.HopBridgeRoute[](7);

        // 100 -> 10 USDC
        finalChainIds[0] = 10;
        finalStableAddrs[0] = 0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85;
        hopBridgeRoutes[0] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_STARGATE_USDC_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 100 -> 143 USDC
        finalChainIds[1] = 143;
        finalStableAddrs[1] = 0x754704Bc059F8C67012fEd69BC8A327a5aafb603;
        hopBridgeRoutes[1] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_STARGATE_USDC_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 100 -> 480 USDC
        finalChainIds[2] = 480;
        finalStableAddrs[2] = 0x79A02482A880bCE3F13e09Da970dC34db4CD24d1;
        hopBridgeRoutes[2] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_STARGATE_USDC_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 100 -> 999 USDC
        finalChainIds[3] = 999;
        finalStableAddrs[3] = 0xb88339CB7199b77E23DB6E890353E22632Ba630f;
        hopBridgeRoutes[3] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_STARGATE_USDC_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 100 -> 4326 USDT
        finalChainIds[4] = 4326;
        finalStableAddrs[4] = 0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb;
        hopBridgeRoutes[4] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_STARGATE_USDC_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 100 -> 42220 USDT
        finalChainIds[5] = 42220;
        finalStableAddrs[5] = 0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e;
        hopBridgeRoutes[5] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_STARGATE_USDC_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 100 -> 59144 USDC
        finalChainIds[6] = 59144;
        finalStableAddrs[6] = 0x176211869cA2b568f2A7D4EE941E073a821EE1ff;
        hopBridgeRoutes[6] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_STARGATE_USDC_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        return (finalChainIds, finalStableAddrs, hopBridgeRoutes);
    }

    // Source chain 137
    if (sourceChainId == 137) {
        finalChainIds = new uint256[](1);
        finalStableAddrs = new address[](1);
        hopBridgeRoutes = new DAHopBridger.HopBridgeRoute[](1);

        // 137 -> 42220 USDT
        finalChainIds[0] = 42220;
        finalStableAddrs[0] = 0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e;
        hopBridgeRoutes[0] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_CCTP_V2_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        return (finalChainIds, finalStableAddrs, hopBridgeRoutes);
    }

    // Source chain 143
    if (sourceChainId == 143) {
        finalChainIds = new uint256[](4);
        finalStableAddrs = new address[](4);
        hopBridgeRoutes = new DAHopBridger.HopBridgeRoute[](4);

        // 143 -> 56 USDC
        finalChainIds[0] = 56;
        finalStableAddrs[0] = 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d;
        hopBridgeRoutes[0] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_CCTP_V2_BRIDGER)
            ),
            finalStableDecimals: 18
        });

        // 143 -> 100 USDC
        finalChainIds[1] = 100;
        finalStableAddrs[1] = 0x2a22f9c3b484c3629090FeED35F17Ff8F88f76F0;
        hopBridgeRoutes[1] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_CCTP_V2_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 143 -> 4217 USDC
        finalChainIds[2] = 4217;
        finalStableAddrs[2] = 0x20C000000000000000000000b9537d11c60E8b50;
        hopBridgeRoutes[2] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_CCTP_V2_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 143 -> 42220 USDT
        finalChainIds[3] = 42220;
        finalStableAddrs[3] = 0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e;
        hopBridgeRoutes[3] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_CCTP_V2_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        return (finalChainIds, finalStableAddrs, hopBridgeRoutes);
    }

    // Source chain 480
    if (sourceChainId == 480) {
        finalChainIds = new uint256[](5);
        finalStableAddrs = new address[](5);
        hopBridgeRoutes = new DAHopBridger.HopBridgeRoute[](5);

        // 480 -> 56 USDC
        finalChainIds[0] = 56;
        finalStableAddrs[0] = 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d;
        hopBridgeRoutes[0] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_CCTP_V2_BRIDGER)
            ),
            finalStableDecimals: 18
        });

        // 480 -> 100 USDC
        finalChainIds[1] = 100;
        finalStableAddrs[1] = 0x2a22f9c3b484c3629090FeED35F17Ff8F88f76F0;
        hopBridgeRoutes[1] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_CCTP_V2_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 480 -> 4217 USDC
        finalChainIds[2] = 4217;
        finalStableAddrs[2] = 0x20C000000000000000000000b9537d11c60E8b50;
        hopBridgeRoutes[2] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_CCTP_V2_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 480 -> 4326 USDT
        finalChainIds[3] = 4326;
        finalStableAddrs[3] = 0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb;
        hopBridgeRoutes[3] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_CCTP_V2_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 480 -> 42220 USDT
        finalChainIds[4] = 42220;
        finalStableAddrs[4] = 0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e;
        hopBridgeRoutes[4] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_CCTP_V2_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        return (finalChainIds, finalStableAddrs, hopBridgeRoutes);
    }

    // Source chain 999
    if (sourceChainId == 999) {
        finalChainIds = new uint256[](4);
        finalStableAddrs = new address[](4);
        hopBridgeRoutes = new DAHopBridger.HopBridgeRoute[](4);

        // 999 -> 56 USDC
        finalChainIds[0] = 56;
        finalStableAddrs[0] = 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d;
        hopBridgeRoutes[0] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_CCTP_V2_BRIDGER)
            ),
            finalStableDecimals: 18
        });

        // 999 -> 100 USDC
        finalChainIds[1] = 100;
        finalStableAddrs[1] = 0x2a22f9c3b484c3629090FeED35F17Ff8F88f76F0;
        hopBridgeRoutes[1] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_CCTP_V2_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 999 -> 4217 USDC
        finalChainIds[2] = 4217;
        finalStableAddrs[2] = 0x20C000000000000000000000b9537d11c60E8b50;
        hopBridgeRoutes[2] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_CCTP_V2_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 999 -> 42220 USDT
        finalChainIds[3] = 42220;
        finalStableAddrs[3] = 0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e;
        hopBridgeRoutes[3] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_CCTP_V2_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        return (finalChainIds, finalStableAddrs, hopBridgeRoutes);
    }

    // Source chain 4217
    if (sourceChainId == 4217) {
        finalChainIds = new uint256[](6);
        finalStableAddrs = new address[](6);
        hopBridgeRoutes = new DAHopBridger.HopBridgeRoute[](6);

        // 4217 -> 143 USDC
        finalChainIds[0] = 143;
        finalStableAddrs[0] = 0x754704Bc059F8C67012fEd69BC8A327a5aafb603;
        hopBridgeRoutes[0] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_STARGATE_USDC_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 4217 -> 480 USDC
        finalChainIds[1] = 480;
        finalStableAddrs[1] = 0x79A02482A880bCE3F13e09Da970dC34db4CD24d1;
        hopBridgeRoutes[1] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_STARGATE_USDC_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 4217 -> 999 USDC
        finalChainIds[2] = 999;
        finalStableAddrs[2] = 0xb88339CB7199b77E23DB6E890353E22632Ba630f;
        hopBridgeRoutes[2] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_STARGATE_USDC_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 4217 -> 4326 USDT
        finalChainIds[3] = 4326;
        finalStableAddrs[3] = 0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb;
        hopBridgeRoutes[3] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_STARGATE_USDC_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 4217 -> 42220 USDT
        finalChainIds[4] = 42220;
        finalStableAddrs[4] = 0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e;
        hopBridgeRoutes[4] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_STARGATE_USDC_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 4217 -> 59144 USDC
        finalChainIds[5] = 59144;
        finalStableAddrs[5] = 0x176211869cA2b568f2A7D4EE941E073a821EE1ff;
        hopBridgeRoutes[5] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_STARGATE_USDC_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        return (finalChainIds, finalStableAddrs, hopBridgeRoutes);
    }

    // Source chain 4326
    if (sourceChainId == 4326) {
        finalChainIds = new uint256[](7);
        finalStableAddrs = new address[](7);
        hopBridgeRoutes = new DAHopBridger.HopBridgeRoute[](7);

        // 4326 -> 56 USDC
        finalChainIds[0] = 56;
        finalStableAddrs[0] = 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d;
        hopBridgeRoutes[0] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_USDT0_BRIDGER)
            ),
            finalStableDecimals: 18
        });

        // 4326 -> 100 USDC
        finalChainIds[1] = 100;
        finalStableAddrs[1] = 0x2a22f9c3b484c3629090FeED35F17Ff8F88f76F0;
        hopBridgeRoutes[1] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_USDT0_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 4326 -> 480 USDC
        finalChainIds[2] = 480;
        finalStableAddrs[2] = 0x79A02482A880bCE3F13e09Da970dC34db4CD24d1;
        hopBridgeRoutes[2] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_USDT0_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 4326 -> 4217 USDC
        finalChainIds[3] = 4217;
        finalStableAddrs[3] = 0x20C000000000000000000000b9537d11c60E8b50;
        hopBridgeRoutes[3] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_USDT0_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 4326 -> 8453 USDC
        finalChainIds[4] = 8453;
        finalStableAddrs[4] = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
        hopBridgeRoutes[4] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_USDT0_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 4326 -> 42220 USDT
        finalChainIds[5] = 42220;
        finalStableAddrs[5] = 0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e;
        hopBridgeRoutes[5] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_USDT0_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 4326 -> 59144 USDC
        finalChainIds[6] = 59144;
        finalStableAddrs[6] = 0x176211869cA2b568f2A7D4EE941E073a821EE1ff;
        hopBridgeRoutes[6] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_USDT0_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        return (finalChainIds, finalStableAddrs, hopBridgeRoutes);
    }

    // Source chain 8453
    if (sourceChainId == 8453) {
        finalChainIds = new uint256[](2);
        finalStableAddrs = new address[](2);
        hopBridgeRoutes = new DAHopBridger.HopBridgeRoute[](2);

        // 8453 -> 4326 USDT
        finalChainIds[0] = 4326;
        finalStableAddrs[0] = 0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb;
        hopBridgeRoutes[0] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_CCTP_V2_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 8453 -> 42220 USDT
        finalChainIds[1] = 42220;
        finalStableAddrs[1] = 0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e;
        hopBridgeRoutes[1] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_CCTP_V2_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        return (finalChainIds, finalStableAddrs, hopBridgeRoutes);
    }

    // Source chain 42220
    if (sourceChainId == 42220) {
        finalChainIds = new uint256[](11);
        finalStableAddrs = new address[](11);
        hopBridgeRoutes = new DAHopBridger.HopBridgeRoute[](11);

        // 42220 -> 10 USDC
        finalChainIds[0] = 10;
        finalStableAddrs[0] = 0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85;
        hopBridgeRoutes[0] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_LEGACY_MESH_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 42220 -> 56 USDC
        finalChainIds[1] = 56;
        finalStableAddrs[1] = 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d;
        hopBridgeRoutes[1] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_LEGACY_MESH_BRIDGER)
            ),
            finalStableDecimals: 18
        });

        // 42220 -> 100 USDC
        finalChainIds[2] = 100;
        finalStableAddrs[2] = 0x2a22f9c3b484c3629090FeED35F17Ff8F88f76F0;
        hopBridgeRoutes[2] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_LEGACY_MESH_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 42220 -> 137 USDC
        finalChainIds[3] = 137;
        finalStableAddrs[3] = 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359;
        hopBridgeRoutes[3] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_LEGACY_MESH_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 42220 -> 143 USDC
        finalChainIds[4] = 143;
        finalStableAddrs[4] = 0x754704Bc059F8C67012fEd69BC8A327a5aafb603;
        hopBridgeRoutes[4] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_LEGACY_MESH_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 42220 -> 480 USDC
        finalChainIds[5] = 480;
        finalStableAddrs[5] = 0x79A02482A880bCE3F13e09Da970dC34db4CD24d1;
        hopBridgeRoutes[5] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_LEGACY_MESH_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 42220 -> 999 USDC
        finalChainIds[6] = 999;
        finalStableAddrs[6] = 0xb88339CB7199b77E23DB6E890353E22632Ba630f;
        hopBridgeRoutes[6] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_LEGACY_MESH_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 42220 -> 4217 USDC
        finalChainIds[7] = 4217;
        finalStableAddrs[7] = 0x20C000000000000000000000b9537d11c60E8b50;
        hopBridgeRoutes[7] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_LEGACY_MESH_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 42220 -> 4326 USDT
        finalChainIds[8] = 4326;
        finalStableAddrs[8] = 0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb;
        hopBridgeRoutes[8] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_LEGACY_MESH_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 42220 -> 8453 USDC
        finalChainIds[9] = 8453;
        finalStableAddrs[9] = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
        hopBridgeRoutes[9] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_LEGACY_MESH_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 42220 -> 59144 USDC
        finalChainIds[10] = 59144;
        finalStableAddrs[10] = 0x176211869cA2b568f2A7D4EE941E073a821EE1ff;
        hopBridgeRoutes[10] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_LEGACY_MESH_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        return (finalChainIds, finalStableAddrs, hopBridgeRoutes);
    }

    // Source chain 59144
    if (sourceChainId == 59144) {
        finalChainIds = new uint256[](5);
        finalStableAddrs = new address[](5);
        hopBridgeRoutes = new DAHopBridger.HopBridgeRoute[](5);

        // 59144 -> 56 USDC
        finalChainIds[0] = 56;
        finalStableAddrs[0] = 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d;
        hopBridgeRoutes[0] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_CCTP_V2_BRIDGER)
            ),
            finalStableDecimals: 18
        });

        // 59144 -> 100 USDC
        finalChainIds[1] = 100;
        finalStableAddrs[1] = 0x2a22f9c3b484c3629090FeED35F17Ff8F88f76F0;
        hopBridgeRoutes[1] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_CCTP_V2_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 59144 -> 4217 USDC
        finalChainIds[2] = 4217;
        finalStableAddrs[2] = 0x20C000000000000000000000b9537d11c60E8b50;
        hopBridgeRoutes[2] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_CCTP_V2_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 59144 -> 4326 USDT
        finalChainIds[3] = 4326;
        finalStableAddrs[3] = 0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb;
        hopBridgeRoutes[3] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_CCTP_V2_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        // 59144 -> 42220 USDT
        finalChainIds[4] = 42220;
        finalStableAddrs[4] = 0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e;
        hopBridgeRoutes[4] = DAHopBridger.HopBridgeRoute({
            hopChainId: 42161,
            hopStableAddr: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            hopStableDecimals: 6,
            hopBridger: IDaimoPayBridger(
                CREATE3.getDeployed(deployer, DEPLOY_SALT_CCTP_V2_BRIDGER)
            ),
            finalStableDecimals: 6
        });

        return (finalChainIds, finalStableAddrs, hopBridgeRoutes);
    }

    return (
        new uint256[](0),
        new address[](0),
        new DAHopBridger.HopBridgeRoute[](0)
    );
}
