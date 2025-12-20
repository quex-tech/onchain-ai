// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../src/ChatOracle.sol";

contract DeployScript is Script {
    // 0G Mainnet addresses
    address constant QUEX_CORE = 0x48f15775Bc2d83BA18485FE19D4BC6a7ad90293c;
    address constant ORACLE_POOL = 0xe0655573eCfE62a2e79ca99a4FB8d87a3e0B4822;
    address constant TD_ADDRESS = 0xB86EeAe9e3F0D3a91cE353CB0EfEaFF17CF16E6f;

    function run() external {
        bytes memory encryptedApiKey = vm.envBytes("ENCRYPTED_API_KEY");

        vm.startBroadcast();

        ChatOracle oracle = new ChatOracle(QUEX_CORE);
        oracle.setUp(ORACLE_POOL, TD_ADDRESS, encryptedApiKey);

        vm.stopBroadcast();

        console.log("ChatOracle deployed at:", address(oracle));
    }
}
