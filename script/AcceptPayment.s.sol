// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/ConditionalPayments.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract AcceptPayment is Script {
    function run() external {
        // 1. Setup - Make sure these match your deployment
        address deployedContract = 0x5D40701a93Ffd6770D360983DB4791EF5Cfa6863;
        address usdcAddress = 0x2Cff5f1Bc50F990499A90B543A0f51Ae974c0E6c;
        uint256 paymentId = 1; // Change to your actual ID

        ConditionalPayments infra = ConditionalPayments(deployedContract);
        IERC20 usdc = IERC20(usdcAddress);

        vm.startBroadcast();

        // In the new Infra, "Accepting" isn't a single button anymore.
        // Usually, the Receiver just waits for the Sender to release,
        // OR they raise a dispute if things go wrong.

        // Let's simulate a "Dispute" to test the new logic:
        console.log("Raising a dispute for payment ID:", paymentId);
        infra.disputePayment(paymentId);

        console.log("Status updated to: DISPUTED");

        vm.stopBroadcast();
    }
}
