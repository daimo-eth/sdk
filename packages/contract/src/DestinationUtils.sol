// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.12;

enum DestinationType {
    EVM,
    SOLANA,
    TRON
}

struct BridgeTokenAmount {
    bytes token;
    uint256 amount;
}

library DestinationUtils {
    /// @notice Converts an EVM address to its canonical raw byte form.
    /// @dev This uses `abi.encodePacked`, so the result is exactly 20 bytes.
    ///      Use this when populating chain-agnostic destination fields for EVM
    ///      tokens or recipients.
    /// @param addr The EVM address to encode.
    /// @return The 20-byte raw address representation.
    function evmAddressToBytes(
        address addr
    ) internal pure returns (bytes memory) {
        return abi.encodePacked(addr);
    }

    /// @notice Checks whether calldata bytes are canonical for a destination type.
    /// @dev EVM values are 20 raw bytes, Solana values are 32 raw bytes, and
    ///      Tron values are 21 raw bytes prefixed with `0x41`. This validates
    ///      both token identifiers and recipient addresses because their
    ///      canonical byte shapes are currently identical per destination type.
    ///      Unknown enum values return false instead of reverting.
    /// @param destinationType The destination chain family that defines `data`.
    /// @param data The raw token or address bytes to validate.
    /// @return True if `data` matches the canonical byte format for `destinationType`.
    function isValidDestinationBytes(
        DestinationType destinationType,
        bytes calldata data
    ) internal pure returns (bool) {
        if (destinationType == DestinationType.EVM) {
            return data.length == 20;
        }
        if (destinationType == DestinationType.SOLANA) {
            return data.length == 32;
        }
        if (destinationType == DestinationType.TRON) {
            return data.length == 21 && data[0] == bytes1(0x41);
        }
        return false;
    }

    /// @notice Checks whether memory bytes are canonical for a destination type.
    /// @dev Memory variant of `isValidDestinationBytes` for structs,
    ///      constructor inputs, and intermediate values already loaded into
    ///      memory. Unknown enum values return false instead of reverting.
    /// @param destinationType The destination chain family that defines `data`.
    /// @param data The raw token or address bytes to validate.
    /// @return True if `data` matches the canonical byte format for `destinationType`.
    function isValidDestinationBytesMemory(
        DestinationType destinationType,
        bytes memory data
    ) internal pure returns (bool) {
        if (destinationType == DestinationType.EVM) {
            return data.length == 20;
        }
        if (destinationType == DestinationType.SOLANA) {
            return data.length == 32;
        }
        if (destinationType == DestinationType.TRON) {
            return data.length == 21 && data[0] == bytes1(0x41);
        }
        return false;
    }

    /// @notice Decodes a calldata raw EVM address.
    /// @dev Reverts unless `addr` is exactly 20 bytes. The input must be the
    ///      raw packed address form, not ABI-encoded `address` data.
    /// @param addr The 20-byte raw EVM address.
    /// @return ret The decoded EVM address.
    function decodeEvmAddress(
        bytes calldata addr
    ) internal pure returns (address ret) {
        require(addr.length == 20, "DU: bad evm address");
        assembly {
            ret := shr(96, calldataload(addr.offset))
        }
    }

    /// @notice Decodes a memory raw EVM address.
    /// @dev Reverts unless `addr` is exactly 20 bytes. The input must be the
    ///      raw packed address form, not ABI-encoded `address` data.
    /// @param addr The 20-byte raw EVM address.
    /// @return ret The decoded EVM address.
    function decodeEvmAddressMemory(
        bytes memory addr
    ) internal pure returns (address ret) {
        require(addr.length == 20, "DU: bad evm address");
        assembly {
            ret := shr(96, mload(add(addr, 32)))
        }
    }

}
