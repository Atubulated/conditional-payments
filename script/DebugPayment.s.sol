// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
}

interface IConditionalPayments {
    function createMediatedPayment(
        address receiver,
        address arbiter,
        address token,
        uint256 amount,
        bytes32 termsHash,
        uint256 deadline
    ) external returns (uint256 paymentId);
}

contract DebugPayment is Script {
    // Contract addresses on Arc Testnet
    address constant MOCK_USDC = 0xef3A17549c748e371D5166D68Ff9a5eD4B729c8f;
    address constant CONDITIONAL_PAYMENTS = 0x5D40701a93Ffd6770D360983DB4791EF5Cfa6863;

    // Your test addresses
    address constant RECEIVER = 0xAAd6B01820080Ce5E060dE2574f91e8EF535f11F;
    address constant ARBITER = 0x3d42f72984B3e3867C5aEFF8Ae9C2a1E21037199;

    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address wallet = vm.addr(privateKey);

        IERC20 usdc = IERC20(MOCK_USDC);
        IConditionalPayments escrow = IConditionalPayments(CONDITIONAL_PAYMENTS);

        console.log("=== Debug Mediated Payment ===");
        console.log("Sender (you):", wallet);
        console.log("Receiver:", RECEIVER);
        console.log("Arbiter:", ARBITER);
        console.log("");

        // Check balance
        uint256 balance = usdc.balanceOf(wallet);
        console.log("Your USDC Balance:", balance);
        console.log("Your USDC Balance (formatted):", balance / 1e6, "USDC");

        // Check allowance
        uint256 allowance = usdc.allowance(wallet, CONDITIONAL_PAYMENTS);
        console.log("Current Allowance:", allowance);

        // Amount: 1 USDC = 1000000 (6 decimals)
        uint256 amount = 1 * 1e6; // 1 USDC
        console.log("Amount to send:", amount);

        // Terms hash (zero)
        bytes32 termsHash = bytes32(0);

        // Deadline: 24 hours from now
        uint256 deadline = block.timestamp + 86400;
        console.log("Deadline:", deadline);

        console.log("");
        console.log("Attempting to create mediated payment...");

        vm.startBroadcast(privateKey);

        uint256 paymentId = escrow.createMediatedPayment(RECEIVER, ARBITER, MOCK_USDC, amount, termsHash, deadline);

        vm.stopBroadcast();

        console.log("SUCCESS! Payment ID:", paymentId);
    }
}
