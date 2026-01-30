// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/MockUSDC.sol";

contract DeployMockUSDC is Script {
    function run() external {
        vm.startBroadcast();
        
        MockUSDC usdc = new MockUSDC();
        
        console.log("Mock USDC deployed at:", address(usdc));
        console.log("Your balance:", usdc.balanceOf(msg.sender));
        
        vm.stopBroadcast();
    }
}