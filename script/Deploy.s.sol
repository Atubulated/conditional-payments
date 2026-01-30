// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33; // matches Foundry compiler

import "forge-std/Script.sol";
import "../src/ConditionalPayments.sol";

contract DeployConditionalPayments is Script {
    function run() external {
        // Start broadcast using the private key from environment
        vm.startBroadcast();

        // Deploy the contract
        ConditionalPayments payments = new ConditionalPayments();

        // Stop broadcast
        vm.stopBroadcast();

        // Log the deployed address (optional but useful)
        console.log("Deployed ConditionalPayments at:", address(payments));
    }
}