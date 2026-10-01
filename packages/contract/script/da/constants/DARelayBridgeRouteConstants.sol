// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.12;

import "../../../src/DARelayBridger.sol";
import "../../../src/DestinationUtils.sol";

// @title DARelayBridgeRouteConstants
// @notice Auto-generated DA constants for Relay bridge routes

// Return all DA Relay bridge routes for the given source chain.
function getDARelayBridgeRoutes(
    uint256 sourceChainId
)
    pure
    returns (
        DestinationType[] memory destinationTypes,
        uint256[] memory toChainIds,
        bytes[] memory bridgeTokenOuts,
        DARelayBridger.RelayRoute[] memory bridgeRoutes
    )
{
    // Source chain 1
    if (sourceChainId == 1) {
        destinationTypes = new DestinationType[](2);
        toChainIds = new uint256[](2);
        bridgeTokenOuts = new bytes[](2);
        bridgeRoutes = new DARelayBridger.RelayRoute[](2);

        // 1 -> 501 USDC
        destinationTypes[0] = DestinationType.SOLANA;
        toChainIds[0] = 501;
        bridgeTokenOuts[0] = hex"c6fa7af3bedbad3a3d65f36aabc97431b1bbe4c2d2f6e0e47ca60203452f5d61";
        bridgeRoutes[0] = DARelayBridger.RelayRoute({
            bridgeTokenIn: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48,
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 6
        });
        // 1 -> 728126428 USDT
        destinationTypes[1] = DestinationType.TRON;
        toChainIds[1] = 728126428;
        bridgeTokenOuts[1] = hex"41a614f803b6fd780986a42c78ec9c7f77e6ded13c";
        bridgeRoutes[1] = DARelayBridger.RelayRoute({
            bridgeTokenIn: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48,
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 6
        });

        return (destinationTypes, toChainIds, bridgeTokenOuts, bridgeRoutes);
    }

    // Source chain 10
    if (sourceChainId == 10) {
        destinationTypes = new DestinationType[](2);
        toChainIds = new uint256[](2);
        bridgeTokenOuts = new bytes[](2);
        bridgeRoutes = new DARelayBridger.RelayRoute[](2);

        // 10 -> 501 USDC
        destinationTypes[0] = DestinationType.SOLANA;
        toChainIds[0] = 501;
        bridgeTokenOuts[0] = hex"c6fa7af3bedbad3a3d65f36aabc97431b1bbe4c2d2f6e0e47ca60203452f5d61";
        bridgeRoutes[0] = DARelayBridger.RelayRoute({
            bridgeTokenIn: 0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85,
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 6
        });
        // 10 -> 728126428 USDT
        destinationTypes[1] = DestinationType.TRON;
        toChainIds[1] = 728126428;
        bridgeTokenOuts[1] = hex"41a614f803b6fd780986a42c78ec9c7f77e6ded13c";
        bridgeRoutes[1] = DARelayBridger.RelayRoute({
            bridgeTokenIn: 0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85,
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 6
        });

        return (destinationTypes, toChainIds, bridgeTokenOuts, bridgeRoutes);
    }

    // Source chain 56
    if (sourceChainId == 56) {
        destinationTypes = new DestinationType[](2);
        toChainIds = new uint256[](2);
        bridgeTokenOuts = new bytes[](2);
        bridgeRoutes = new DARelayBridger.RelayRoute[](2);

        // 56 -> 501 USDC
        destinationTypes[0] = DestinationType.SOLANA;
        toChainIds[0] = 501;
        bridgeTokenOuts[0] = hex"c6fa7af3bedbad3a3d65f36aabc97431b1bbe4c2d2f6e0e47ca60203452f5d61";
        bridgeRoutes[0] = DARelayBridger.RelayRoute({
            bridgeTokenIn: 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d,
            bridgeTokenInDecimals: 18,
            bridgeTokenOutDecimals: 6
        });
        // 56 -> 728126428 USDT
        destinationTypes[1] = DestinationType.TRON;
        toChainIds[1] = 728126428;
        bridgeTokenOuts[1] = hex"41a614f803b6fd780986a42c78ec9c7f77e6ded13c";
        bridgeRoutes[1] = DARelayBridger.RelayRoute({
            bridgeTokenIn: 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d,
            bridgeTokenInDecimals: 18,
            bridgeTokenOutDecimals: 6
        });

        return (destinationTypes, toChainIds, bridgeTokenOuts, bridgeRoutes);
    }

    // Source chain 137
    if (sourceChainId == 137) {
        destinationTypes = new DestinationType[](2);
        toChainIds = new uint256[](2);
        bridgeTokenOuts = new bytes[](2);
        bridgeRoutes = new DARelayBridger.RelayRoute[](2);

        // 137 -> 501 USDC
        destinationTypes[0] = DestinationType.SOLANA;
        toChainIds[0] = 501;
        bridgeTokenOuts[0] = hex"c6fa7af3bedbad3a3d65f36aabc97431b1bbe4c2d2f6e0e47ca60203452f5d61";
        bridgeRoutes[0] = DARelayBridger.RelayRoute({
            bridgeTokenIn: 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359,
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 6
        });
        // 137 -> 728126428 USDT
        destinationTypes[1] = DestinationType.TRON;
        toChainIds[1] = 728126428;
        bridgeTokenOuts[1] = hex"41a614f803b6fd780986a42c78ec9c7f77e6ded13c";
        bridgeRoutes[1] = DARelayBridger.RelayRoute({
            bridgeTokenIn: 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359,
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 6
        });

        return (destinationTypes, toChainIds, bridgeTokenOuts, bridgeRoutes);
    }

    // Source chain 143
    if (sourceChainId == 143) {
        destinationTypes = new DestinationType[](2);
        toChainIds = new uint256[](2);
        bridgeTokenOuts = new bytes[](2);
        bridgeRoutes = new DARelayBridger.RelayRoute[](2);

        // 143 -> 501 USDC
        destinationTypes[0] = DestinationType.SOLANA;
        toChainIds[0] = 501;
        bridgeTokenOuts[0] = hex"c6fa7af3bedbad3a3d65f36aabc97431b1bbe4c2d2f6e0e47ca60203452f5d61";
        bridgeRoutes[0] = DARelayBridger.RelayRoute({
            bridgeTokenIn: 0x754704Bc059F8C67012fEd69BC8A327a5aafb603,
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 6
        });
        // 143 -> 728126428 USDT
        destinationTypes[1] = DestinationType.TRON;
        toChainIds[1] = 728126428;
        bridgeTokenOuts[1] = hex"41a614f803b6fd780986a42c78ec9c7f77e6ded13c";
        bridgeRoutes[1] = DARelayBridger.RelayRoute({
            bridgeTokenIn: 0x754704Bc059F8C67012fEd69BC8A327a5aafb603,
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 6
        });

        return (destinationTypes, toChainIds, bridgeTokenOuts, bridgeRoutes);
    }

    // Source chain 480
    if (sourceChainId == 480) {
        destinationTypes = new DestinationType[](2);
        toChainIds = new uint256[](2);
        bridgeTokenOuts = new bytes[](2);
        bridgeRoutes = new DARelayBridger.RelayRoute[](2);

        // 480 -> 501 USDC
        destinationTypes[0] = DestinationType.SOLANA;
        toChainIds[0] = 501;
        bridgeTokenOuts[0] = hex"c6fa7af3bedbad3a3d65f36aabc97431b1bbe4c2d2f6e0e47ca60203452f5d61";
        bridgeRoutes[0] = DARelayBridger.RelayRoute({
            bridgeTokenIn: 0x79A02482A880bCE3F13e09Da970dC34db4CD24d1,
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 6
        });
        // 480 -> 728126428 USDT
        destinationTypes[1] = DestinationType.TRON;
        toChainIds[1] = 728126428;
        bridgeTokenOuts[1] = hex"41a614f803b6fd780986a42c78ec9c7f77e6ded13c";
        bridgeRoutes[1] = DARelayBridger.RelayRoute({
            bridgeTokenIn: 0x79A02482A880bCE3F13e09Da970dC34db4CD24d1,
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 6
        });

        return (destinationTypes, toChainIds, bridgeTokenOuts, bridgeRoutes);
    }

    // Source chain 999
    if (sourceChainId == 999) {
        destinationTypes = new DestinationType[](2);
        toChainIds = new uint256[](2);
        bridgeTokenOuts = new bytes[](2);
        bridgeRoutes = new DARelayBridger.RelayRoute[](2);

        // 999 -> 501 USDC
        destinationTypes[0] = DestinationType.SOLANA;
        toChainIds[0] = 501;
        bridgeTokenOuts[0] = hex"c6fa7af3bedbad3a3d65f36aabc97431b1bbe4c2d2f6e0e47ca60203452f5d61";
        bridgeRoutes[0] = DARelayBridger.RelayRoute({
            bridgeTokenIn: 0xb88339CB7199b77E23DB6E890353E22632Ba630f,
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 6
        });
        // 999 -> 728126428 USDT
        destinationTypes[1] = DestinationType.TRON;
        toChainIds[1] = 728126428;
        bridgeTokenOuts[1] = hex"41a614f803b6fd780986a42c78ec9c7f77e6ded13c";
        bridgeRoutes[1] = DARelayBridger.RelayRoute({
            bridgeTokenIn: 0xb88339CB7199b77E23DB6E890353E22632Ba630f,
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 6
        });

        return (destinationTypes, toChainIds, bridgeTokenOuts, bridgeRoutes);
    }

    // Source chain 4217
    if (sourceChainId == 4217) {
        destinationTypes = new DestinationType[](2);
        toChainIds = new uint256[](2);
        bridgeTokenOuts = new bytes[](2);
        bridgeRoutes = new DARelayBridger.RelayRoute[](2);

        // 4217 -> 501 USDC
        destinationTypes[0] = DestinationType.SOLANA;
        toChainIds[0] = 501;
        bridgeTokenOuts[0] = hex"c6fa7af3bedbad3a3d65f36aabc97431b1bbe4c2d2f6e0e47ca60203452f5d61";
        bridgeRoutes[0] = DARelayBridger.RelayRoute({
            bridgeTokenIn: 0x20C000000000000000000000b9537d11c60E8b50,
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 6
        });
        // 4217 -> 728126428 USDT
        destinationTypes[1] = DestinationType.TRON;
        toChainIds[1] = 728126428;
        bridgeTokenOuts[1] = hex"41a614f803b6fd780986a42c78ec9c7f77e6ded13c";
        bridgeRoutes[1] = DARelayBridger.RelayRoute({
            bridgeTokenIn: 0x20C000000000000000000000b9537d11c60E8b50,
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 6
        });

        return (destinationTypes, toChainIds, bridgeTokenOuts, bridgeRoutes);
    }

    // Source chain 8453
    if (sourceChainId == 8453) {
        destinationTypes = new DestinationType[](2);
        toChainIds = new uint256[](2);
        bridgeTokenOuts = new bytes[](2);
        bridgeRoutes = new DARelayBridger.RelayRoute[](2);

        // 8453 -> 501 USDC
        destinationTypes[0] = DestinationType.SOLANA;
        toChainIds[0] = 501;
        bridgeTokenOuts[0] = hex"c6fa7af3bedbad3a3d65f36aabc97431b1bbe4c2d2f6e0e47ca60203452f5d61";
        bridgeRoutes[0] = DARelayBridger.RelayRoute({
            bridgeTokenIn: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913,
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 6
        });
        // 8453 -> 728126428 USDT
        destinationTypes[1] = DestinationType.TRON;
        toChainIds[1] = 728126428;
        bridgeTokenOuts[1] = hex"41a614f803b6fd780986a42c78ec9c7f77e6ded13c";
        bridgeRoutes[1] = DARelayBridger.RelayRoute({
            bridgeTokenIn: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913,
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 6
        });

        return (destinationTypes, toChainIds, bridgeTokenOuts, bridgeRoutes);
    }

    // Source chain 42161
    if (sourceChainId == 42161) {
        destinationTypes = new DestinationType[](2);
        toChainIds = new uint256[](2);
        bridgeTokenOuts = new bytes[](2);
        bridgeRoutes = new DARelayBridger.RelayRoute[](2);

        // 42161 -> 501 USDC
        destinationTypes[0] = DestinationType.SOLANA;
        toChainIds[0] = 501;
        bridgeTokenOuts[0] = hex"c6fa7af3bedbad3a3d65f36aabc97431b1bbe4c2d2f6e0e47ca60203452f5d61";
        bridgeRoutes[0] = DARelayBridger.RelayRoute({
            bridgeTokenIn: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 6
        });
        // 42161 -> 728126428 USDT
        destinationTypes[1] = DestinationType.TRON;
        toChainIds[1] = 728126428;
        bridgeTokenOuts[1] = hex"41a614f803b6fd780986a42c78ec9c7f77e6ded13c";
        bridgeRoutes[1] = DARelayBridger.RelayRoute({
            bridgeTokenIn: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 6
        });

        return (destinationTypes, toChainIds, bridgeTokenOuts, bridgeRoutes);
    }

    // Source chain 59144
    if (sourceChainId == 59144) {
        destinationTypes = new DestinationType[](2);
        toChainIds = new uint256[](2);
        bridgeTokenOuts = new bytes[](2);
        bridgeRoutes = new DARelayBridger.RelayRoute[](2);

        // 59144 -> 501 USDC
        destinationTypes[0] = DestinationType.SOLANA;
        toChainIds[0] = 501;
        bridgeTokenOuts[0] = hex"c6fa7af3bedbad3a3d65f36aabc97431b1bbe4c2d2f6e0e47ca60203452f5d61";
        bridgeRoutes[0] = DARelayBridger.RelayRoute({
            bridgeTokenIn: 0x176211869cA2b568f2A7D4EE941E073a821EE1ff,
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 6
        });
        // 59144 -> 728126428 USDT
        destinationTypes[1] = DestinationType.TRON;
        toChainIds[1] = 728126428;
        bridgeTokenOuts[1] = hex"41a614f803b6fd780986a42c78ec9c7f77e6ded13c";
        bridgeRoutes[1] = DARelayBridger.RelayRoute({
            bridgeTokenIn: 0x176211869cA2b568f2A7D4EE941E073a821EE1ff,
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 6
        });

        return (destinationTypes, toChainIds, bridgeTokenOuts, bridgeRoutes);
    }

    // If source chain not found, return empty arrays
    return (
        new DestinationType[](0),
        new uint256[](0),
        new bytes[](0),
        new DARelayBridger.RelayRoute[](0)
    );
}
