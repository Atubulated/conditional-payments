// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/ConditionalPayments.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TestPayment is Script {
    function run() external {
        // 1. Setup - Replace these with your actual testnet addresses
        address deployedContract = 0x5D40701a93Ffd6770D360983DB4791EF5Cfa6863;
        address usdcAddress = 0x2Cff5f1Bc50F990499A90B543A0f51Ae974c0E6c;
        address receiver = address(0x123); // Put a test wallet address here
        address arbiter = address(0x456);  // Put a second test wallet here
        
        uint256 amount = 10 * 10**6; // 10 USDC (assuming 6 decimals)
        bytes32 terms = keccak256(abi.encodePacked("Work Order #001"));
        uint256 deadline = block.timestamp + 1 days;

        ConditionalPayments infra = ConditionalPayments(deployedContract);
        IERC20 usdc = IERC20(usdcAddress);

        vm.startBroadcast();

        // 2. The Infrastructure Flow
        console.log("Approving Infra to spend USDC...");
        usdc.approve(deployedContract, amount);

        console.log("Creating a Mediated Payment (Option B)...");
        uint256 pId = infra.createMediatedPayment(
            receiver, 
            arbiter, 
            usdcAddress, 
            amount, 
            terms, 
            deadline
        );

        console.log("Success! Payment ID created:", pId);

        vm.stopBroadcast();
    }
}