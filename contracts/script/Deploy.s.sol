// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../src/ChatOracle.sol";

contract DeployScript is Script {
    // Arbitrum Sepolia addresses
    address constant ARB_SEPOLIA_QUEX_CORE = 0x97076a3c0A414E779f7BEC2Bd196D4FdaADFDB96;
    address constant ARB_SEPOLIA_ORACLE_POOL = 0xE83bB2038F098E7aD40DC03298F4337609E6b0d5;
    address constant ARB_SEPOLIA_TD_ADDRESS = 0x128B61f611EB624d35c9Af77aAF785432080C8Df;

    // 0G Mainnet addresses
    address constant ZG_MAINNET_QUEX_CORE = 0x48f15775Bc2d83BA18485FE19D4BC6a7ad90293c;
    address constant ZG_MAINNET_ORACLE_POOL = 0xe0655573eCfE62a2e79ca99a4FB8d87a3e0B4822;
    address constant ZG_MAINNET_TD_ADDRESS = 0xB86EeAe9e3F0D3a91cE353CB0EfEaFF17CF16E6f;

    function run() external {
        bytes memory encryptedApiKey = vm.envBytes("ENCRYPTED_API_KEY");
        uint256 chainId = block.chainid;

        address quexCore;
        address oraclePool;
        address tdAddress;

        if (chainId == 421614) {
            // Arbitrum Sepolia
            quexCore = ARB_SEPOLIA_QUEX_CORE;
            oraclePool = ARB_SEPOLIA_ORACLE_POOL;
            tdAddress = ARB_SEPOLIA_TD_ADDRESS;
            console.log("Deploying to Arbitrum Sepolia...");
        } else if (chainId == 16661) {
            // 0G Mainnet (Aristotle)
            quexCore = ZG_MAINNET_QUEX_CORE;
            oraclePool = ZG_MAINNET_ORACLE_POOL;
            tdAddress = ZG_MAINNET_TD_ADDRESS;
            console.log("Deploying to 0G Mainnet...");
        } else {
            revert("Unsupported chain");
        }

        vm.startBroadcast();

        ChatOracle oracle = new ChatOracle(quexCore);
        oracle.setUp(oraclePool, tdAddress, encryptedApiKey);

        vm.stopBroadcast();

        console.log("ChatOracle deployed at:", address(oracle));
        console.log("QuexCore:", quexCore);
        console.log("OraclePool:", oraclePool);
        console.log("TdAddress:", tdAddress);
    }
}
