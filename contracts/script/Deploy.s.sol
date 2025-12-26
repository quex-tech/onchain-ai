// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../src/ChatOracle.sol";

contract DeployScript is Script {
    function run() external {
        bytes memory encryptedApiKey = vm.envBytes("ENCRYPTED_API_KEY");
        uint256 chainId = block.chainid;

        // Read shared config from frontend directory
        string memory root = vm.projectRoot();
        string memory path = string.concat(root, "/../frontend/chains.json");
        string memory json = vm.readFile(path);

        // Get chain key based on chainId
        string memory chainKey;
        if (chainId == 421614) {
            chainKey = "arbitrumSepolia";
            console.log("Deploying to Arbitrum Sepolia...");
        } else if (chainId == 42161) {
            chainKey = "arbitrum";
            console.log("Deploying to Arbitrum One...");
        } else if (chainId == 16661) {
            chainKey = "zgMainnet";
            console.log("Deploying to 0G Mainnet...");
        } else if (chainId == 16601) {
            chainKey = "zgTestnet";
            console.log("Deploying to 0G Testnet...");
        } else {
            revert("Unsupported chain");
        }

        // Parse addresses from JSON
        string memory prefix = string.concat(".chains.", chainKey);
        address quexCore = vm.parseJsonAddress(json, string.concat(prefix, ".quexCore"));
        address oraclePool = vm.parseJsonAddress(json, string.concat(prefix, ".oraclePool"));
        address tdAddress = vm.parseJsonAddress(json, string.concat(prefix, ".tdAddress"));

        vm.startBroadcast();

        ChatOracle oracle = new ChatOracle(quexCore);
        oracle.setUp(oraclePool, tdAddress, encryptedApiKey);

        vm.stopBroadcast();

        console.log("ChatOracle deployed at:", address(oracle));
        console.log("QuexCore:", quexCore);
        console.log("OraclePool:", oraclePool);
        console.log("TdAddress:", tdAddress);
        console.log("");
        console.log("Update chains.json with new chatOracle address!");
    }
}
