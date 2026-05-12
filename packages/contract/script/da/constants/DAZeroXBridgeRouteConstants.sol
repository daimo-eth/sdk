// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.12;

import "../../../src/DAZeroXBridger.sol";

// @title DAZeroXBridgeRouteConstants
// @notice Auto-generated DA constants for 0x bridge routes

// Return all DA 0x bridge routes for the given source chain.
function getDAZeroXBridgeRoutes(
    uint256 sourceChainId
)
    pure
    returns (
        uint256[] memory toChainIds,
        address[] memory bridgeTokenOuts,
        DAZeroXBridger.ZeroXRoute[] memory bridgeRoutes
    )
{
    // Source chain 10
    if (sourceChainId == 10) {
        toChainIds = new uint256[](2);
        bridgeTokenOuts = new address[](2);
        bridgeRoutes = new DAZeroXBridger.ZeroXRoute[](2);

        // 10 -> 56 USDC
        toChainIds[0] = 56;
        bridgeTokenOuts[0] = 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d;
        bridgeRoutes[0] = DAZeroXBridger.ZeroXRoute({
            bridgeTokenIn: 0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85,
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 18
        });
        // 10 -> 56 USDT
        toChainIds[1] = 56;
        bridgeTokenOuts[1] = 0x55d398326f99059fF775485246999027B3197955;
        bridgeRoutes[1] = DAZeroXBridger.ZeroXRoute({
            bridgeTokenIn: 0x94b008aA00579c1307B0EF2c499aD98a8ce58e58,
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 18
        });

        return (toChainIds, bridgeTokenOuts, bridgeRoutes);
    }

    // Source chain 56
    if (sourceChainId == 56) {
        toChainIds = new uint256[](12);
        bridgeTokenOuts = new address[](12);
        bridgeRoutes = new DAZeroXBridger.ZeroXRoute[](12);

        // 56 -> 1 USDT
        toChainIds[0] = 1;
        bridgeTokenOuts[0] = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
        bridgeRoutes[0] = DAZeroXBridger.ZeroXRoute({
            bridgeTokenIn: 0x55d398326f99059fF775485246999027B3197955,
            bridgeTokenInDecimals: 18,
            bridgeTokenOutDecimals: 6
        });
        // 56 -> 10 USDC
        toChainIds[1] = 10;
        bridgeTokenOuts[1] = 0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85;
        bridgeRoutes[1] = DAZeroXBridger.ZeroXRoute({
            bridgeTokenIn: 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d,
            bridgeTokenInDecimals: 18,
            bridgeTokenOutDecimals: 6
        });
        // 56 -> 10 USDC
        toChainIds[2] = 10;
        bridgeTokenOuts[2] = 0x01bFF41798a0BcF287b996046Ca68b395DbC1071;
        bridgeRoutes[2] = DAZeroXBridger.ZeroXRoute({
            bridgeTokenIn: 0x55d398326f99059fF775485246999027B3197955,
            bridgeTokenInDecimals: 18,
            bridgeTokenOutDecimals: 6
        });
        // 56 -> 10 USDT
        toChainIds[3] = 10;
        bridgeTokenOuts[3] = 0x94b008aA00579c1307B0EF2c499aD98a8ce58e58;
        bridgeRoutes[3] = DAZeroXBridger.ZeroXRoute({
            bridgeTokenIn: 0x55d398326f99059fF775485246999027B3197955,
            bridgeTokenInDecimals: 18,
            bridgeTokenOutDecimals: 6
        });
        // 56 -> 143 USDC
        toChainIds[4] = 143;
        bridgeTokenOuts[4] = 0x754704Bc059F8C67012fEd69BC8A327a5aafb603;
        bridgeRoutes[4] = DAZeroXBridger.ZeroXRoute({
            bridgeTokenIn: 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d,
            bridgeTokenInDecimals: 18,
            bridgeTokenOutDecimals: 6
        });
        // 56 -> 143 USDT
        toChainIds[5] = 143;
        bridgeTokenOuts[5] = 0xe7cd86e13AC4309349F30B3435a9d337750fC82D;
        bridgeRoutes[5] = DAZeroXBridger.ZeroXRoute({
            bridgeTokenIn: 0x55d398326f99059fF775485246999027B3197955,
            bridgeTokenInDecimals: 18,
            bridgeTokenOutDecimals: 6
        });
        // 56 -> 480 USDC
        toChainIds[6] = 480;
        bridgeTokenOuts[6] = 0x79A02482A880bCE3F13e09Da970dC34db4CD24d1;
        bridgeRoutes[6] = DAZeroXBridger.ZeroXRoute({
            bridgeTokenIn: 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d,
            bridgeTokenInDecimals: 18,
            bridgeTokenOutDecimals: 6
        });
        // 56 -> 999 USDC
        toChainIds[7] = 999;
        bridgeTokenOuts[7] = 0xb88339CB7199b77E23DB6E890353E22632Ba630f;
        bridgeRoutes[7] = DAZeroXBridger.ZeroXRoute({
            bridgeTokenIn: 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d,
            bridgeTokenInDecimals: 18,
            bridgeTokenOutDecimals: 6
        });
        // 56 -> 999 USDT
        toChainIds[8] = 999;
        bridgeTokenOuts[8] = 0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb;
        bridgeRoutes[8] = DAZeroXBridger.ZeroXRoute({
            bridgeTokenIn: 0x55d398326f99059fF775485246999027B3197955,
            bridgeTokenInDecimals: 18,
            bridgeTokenOutDecimals: 6
        });
        // 56 -> 8453 USDT
        toChainIds[9] = 8453;
        bridgeTokenOuts[9] = 0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2;
        bridgeRoutes[9] = DAZeroXBridger.ZeroXRoute({
            bridgeTokenIn: 0x55d398326f99059fF775485246999027B3197955,
            bridgeTokenInDecimals: 18,
            bridgeTokenOutDecimals: 6
        });
        // 56 -> 42161 USDT
        toChainIds[10] = 42161;
        bridgeTokenOuts[10] = 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9;
        bridgeRoutes[10] = DAZeroXBridger.ZeroXRoute({
            bridgeTokenIn: 0x55d398326f99059fF775485246999027B3197955,
            bridgeTokenInDecimals: 18,
            bridgeTokenOutDecimals: 6
        });
        // 56 -> 59144 USDC
        toChainIds[11] = 59144;
        bridgeTokenOuts[11] = 0x176211869cA2b568f2A7D4EE941E073a821EE1ff;
        bridgeRoutes[11] = DAZeroXBridger.ZeroXRoute({
            bridgeTokenIn: 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d,
            bridgeTokenInDecimals: 18,
            bridgeTokenOutDecimals: 6
        });

        return (toChainIds, bridgeTokenOuts, bridgeRoutes);
    }

    // Source chain 137
    if (sourceChainId == 137) {
        toChainIds = new uint256[](1);
        bridgeTokenOuts = new address[](1);
        bridgeRoutes = new DAZeroXBridger.ZeroXRoute[](1);

        // 137 -> 10 USDT
        toChainIds[0] = 10;
        bridgeTokenOuts[0] = 0x94b008aA00579c1307B0EF2c499aD98a8ce58e58;
        bridgeRoutes[0] = DAZeroXBridger.ZeroXRoute({
            bridgeTokenIn: 0xc2132D05D31c914a87C6611C10748AEb04B58e8F,
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 6
        });

        return (toChainIds, bridgeTokenOuts, bridgeRoutes);
    }

    // Source chain 143
    if (sourceChainId == 143) {
        toChainIds = new uint256[](2);
        bridgeTokenOuts = new address[](2);
        bridgeRoutes = new DAZeroXBridger.ZeroXRoute[](2);

        // 143 -> 56 USDC
        toChainIds[0] = 56;
        bridgeTokenOuts[0] = 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d;
        bridgeRoutes[0] = DAZeroXBridger.ZeroXRoute({
            bridgeTokenIn: 0x754704Bc059F8C67012fEd69BC8A327a5aafb603,
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 18
        });
        // 143 -> 56 USDT
        toChainIds[1] = 56;
        bridgeTokenOuts[1] = 0x55d398326f99059fF775485246999027B3197955;
        bridgeRoutes[1] = DAZeroXBridger.ZeroXRoute({
            bridgeTokenIn: 0xe7cd86e13AC4309349F30B3435a9d337750fC82D,
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 18
        });

        return (toChainIds, bridgeTokenOuts, bridgeRoutes);
    }

    // Source chain 480
    if (sourceChainId == 480) {
        toChainIds = new uint256[](2);
        bridgeTokenOuts = new address[](2);
        bridgeRoutes = new DAZeroXBridger.ZeroXRoute[](2);

        // 480 -> 56 USDC
        toChainIds[0] = 56;
        bridgeTokenOuts[0] = 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d;
        bridgeRoutes[0] = DAZeroXBridger.ZeroXRoute({
            bridgeTokenIn: 0x79A02482A880bCE3F13e09Da970dC34db4CD24d1,
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 18
        });
        // 480 -> 4217 USDC
        toChainIds[1] = 4217;
        bridgeTokenOuts[1] = 0x20C000000000000000000000b9537d11c60E8b50;
        bridgeRoutes[1] = DAZeroXBridger.ZeroXRoute({
            bridgeTokenIn: 0x79A02482A880bCE3F13e09Da970dC34db4CD24d1,
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 6
        });

        return (toChainIds, bridgeTokenOuts, bridgeRoutes);
    }

    // Source chain 8453
    if (sourceChainId == 8453) {
        toChainIds = new uint256[](3);
        bridgeTokenOuts = new address[](3);
        bridgeRoutes = new DAZeroXBridger.ZeroXRoute[](3);

        // 8453 -> 10 USDC
        toChainIds[0] = 10;
        bridgeTokenOuts[0] = 0x01bFF41798a0BcF287b996046Ca68b395DbC1071;
        bridgeRoutes[0] = DAZeroXBridger.ZeroXRoute({
            bridgeTokenIn: 0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2,
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 6
        });
        // 8453 -> 10 USDT
        toChainIds[1] = 10;
        bridgeTokenOuts[1] = 0x94b008aA00579c1307B0EF2c499aD98a8ce58e58;
        bridgeRoutes[1] = DAZeroXBridger.ZeroXRoute({
            bridgeTokenIn: 0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2,
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 6
        });
        // 8453 -> 137 USDT
        toChainIds[2] = 137;
        bridgeTokenOuts[2] = 0xc2132D05D31c914a87C6611C10748AEb04B58e8F;
        bridgeRoutes[2] = DAZeroXBridger.ZeroXRoute({
            bridgeTokenIn: 0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2,
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 6
        });

        return (toChainIds, bridgeTokenOuts, bridgeRoutes);
    }

    // Source chain 42161
    if (sourceChainId == 42161) {
        toChainIds = new uint256[](1);
        bridgeTokenOuts = new address[](1);
        bridgeRoutes = new DAZeroXBridger.ZeroXRoute[](1);

        // 42161 -> 10 USDT
        toChainIds[0] = 10;
        bridgeTokenOuts[0] = 0x94b008aA00579c1307B0EF2c499aD98a8ce58e58;
        bridgeRoutes[0] = DAZeroXBridger.ZeroXRoute({
            bridgeTokenIn: 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9,
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 6
        });

        return (toChainIds, bridgeTokenOuts, bridgeRoutes);
    }

    // Source chain 59144
    if (sourceChainId == 59144) {
        toChainIds = new uint256[](2);
        bridgeTokenOuts = new address[](2);
        bridgeRoutes = new DAZeroXBridger.ZeroXRoute[](2);

        // 59144 -> 56 USDC
        toChainIds[0] = 56;
        bridgeTokenOuts[0] = 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d;
        bridgeRoutes[0] = DAZeroXBridger.ZeroXRoute({
            bridgeTokenIn: 0x176211869cA2b568f2A7D4EE941E073a821EE1ff,
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 18
        });
        // 59144 -> 4217 USDC
        toChainIds[1] = 4217;
        bridgeTokenOuts[1] = 0x20C000000000000000000000b9537d11c60E8b50;
        bridgeRoutes[1] = DAZeroXBridger.ZeroXRoute({
            bridgeTokenIn: 0x176211869cA2b568f2A7D4EE941E073a821EE1ff,
            bridgeTokenInDecimals: 6,
            bridgeTokenOutDecimals: 6
        });

        return (toChainIds, bridgeTokenOuts, bridgeRoutes);
    }

    // If source chain not found, return empty arrays
    return (
        new uint256[](0),
        new address[](0),
        new DAZeroXBridger.ZeroXRoute[](0)
    );
}
