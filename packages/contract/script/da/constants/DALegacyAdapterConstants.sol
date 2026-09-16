// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.12;

// @title DALegacyAdapterConstants
// @notice Auto-generated. Adapter addresses, emitted rather than derived from
// @notice the deploying key: a CREATE3 address is f(deployer, salt) and these
// @notice were not deployed by the key that signs new cuts.

function getDALegacyAdapters()
    pure
    returns (
        address stargateUSDCBridger,
        address stargateUSDTBridger,
        address legacyMeshBridger,
        address usdt0Bridger,
        address hopBridger,
        address cctpV2Bridger
    )
{
    stargateUSDCBridger = 0x85B0b03ED6fc421ca55AAa3a55723a70701908B8;
    stargateUSDTBridger = 0xC3944Ec7751f29f5181EC85EA6654fef50E16ca0;
    legacyMeshBridger = 0x8de29A04DEe5894D7bd536a7b4c924560F2DfF57;
    usdt0Bridger = 0x9c62eEe55EC0f74F11f8B371ED605Ed088AD1597;
    hopBridger = 0x8eE3165c50B8185dC0f1984C24A1a5b1D72543A8;
    cctpV2Bridger = 0xaec53EfDc5582DC78F52ed4CFa852BFa5BF0C1d3;
}
