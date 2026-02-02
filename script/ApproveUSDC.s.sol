// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function decimals() external view returns (uint8);
}

contract ApproveUSDC is Script {
    // Contract addresses on Arc Testnet
    address constant MOCK_USDC = 0xef3A17549c748e371D5166D68Ff9a5eD4B729c8f;
    address constant CONDITIONAL_PAYMENTS = 0x5D40701a93Ffd6770D360983DB4791EF5Cfa6863;

    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address wallet = vm.addr(privateKey);

        IERC20 usdc = IERC20(MOCK_USDC);

        console.log("=== Mock USDC Approval Script ===");
        console.log("Wallet:", wallet);
        console.log("Mock USDC:", MOCK_USDC);
        console.log("ConditionalPayments:", CONDITIONAL_PAYMENTS);
        console.log("");

        // Check balance
        uint256 balance = usdc.balanceOf(wallet);
        console.log("Your USDC Balance:", balance / 1e6, "USDC");

        // Check current allowance
        uint256 currentAllowance = usdc.allowance(wallet, CONDITIONAL_PAYMENTS);
        console.log("Current Allowance:", currentAllowance / 1e6, "USDC");

        if (currentAllowance < balance) {
            console.log("");
            console.log("Approving max USDC...");

            vm.startBroadcast(privateKey);
            usdc.approve(CONDITIONAL_PAYMENTS, type(uint256).max);
            vm.stopBroadcast();

            console.log("Approval successful!");
            console.log("New Allowance: UNLIMITED");
        } else {
            console.log("");
            console.log("Already approved! No action needed.");
        }
    }
}
