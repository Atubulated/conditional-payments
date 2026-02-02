// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/ConditionalPayments.sol";
import "../src/MockUSDC.sol";

contract TestFullFlow is Script {
    function run() external {
        address deployedContract = 0x5D40701a93Ffd6770D360983DB4791EF5Cfa6863;
        MockUSDC usdc = MockUSDC(0x2Cff5f1Bc50F990499A90B543A0f51Ae974c0E6c);
        ConditionalPayments payments = ConditionalPayments(deployedContract);

        // We need an Arbiter for the new Mediated logic
        address dummyArbiter = address(0x999);

        vm.startBroadcast();

        console.log("=== Initial Balance ===");
        console.log("USDC balance:", usdc.balanceOf(msg.sender));

        // 1. Mint & Approve
        usdc.mint(msg.sender, 10 * 10 ** 6);
        usdc.approve(deployedContract, 1 * 10 ** 6);

        // 2. CHANGE: use 'createMediatedPayment' instead of 'createPayment'
        // We also added the 'dummyArbiter' argument
        uint256 paymentId = payments.createMediatedPayment(
            msg.sender,
            dummyArbiter, // NEW: The mediator
            address(usdc),
            1 * 10 ** 6,
            bytes32(0),
            block.timestamp + 1 days // Using a real timestamp instead of 0
        );

        console.log("\n=== Payment Created (Mediated) ===");
        console.log("Payment ID:", paymentId);

        // 3. CHANGE: use 'releasePayment' instead of 'acceptPayment'
        // In the new infra, the Sender releases the funds.
        payments.releasePayment(paymentId);

        console.log("\n=== Payment Released ===");
        console.log("Final balance:", usdc.balanceOf(msg.sender));

        vm.stopBroadcast();
    }
}
