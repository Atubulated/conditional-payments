// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/ConditionalPayments.sol";

contract ViewPayment is Script {
    function run() external view {
        address deployedContract = 0x5D40701a93Ffd6770D360983DB4791EF5Cfa6863;
        uint256 paymentId = 1; 
        
        ConditionalPayments payments = ConditionalPayments(deployedContract);
        
        // Get the payment struct
        ConditionalPayments.Payment memory payment = payments.getPayment(paymentId);
        
        console.log("=== Payment Details ===");
        console.log("Payment ID:", paymentId);
        console.log("Sender:", payment.sender);
        console.log("Receiver:", payment.receiver);
        console.log("Token:", payment.token);
        console.log("Amount:", payment.amount);
        console.log("Deadline:", payment.deadline);

        // --- UPDATED LOGIC FOR INFRA VERSION ---
        
        // Convert the Enum (Status) to a readable number/string for console
        // Status: 0=Pending, 1=Accepted, 2=Disputed, 3=Resolved, 4=Refunded
        console.log("Status (0=Pending, 2=Disputed, 3=Resolved):", uint(payment.status));
        
        // Convert PaymentType Enum to readable number
        // Type: 0=Simple, 1=Timelocked, 2=Mediated, 3=Bonded
        console.log("Payment Type (2=Mediated):", uint(payment.pType));

        if (payment.termsHash != bytes32(0)) {
            console.log("Terms Hash:");
            console.logBytes32(payment.termsHash);
        }
        
        // Since we didn't add these view functions back yet, 
        // I've commented them out so the script compiles.
        // uint256 remaining = payments.timeRemaining(paymentId);
        // console.log("Time remaining (seconds):", remaining);
        
        // bool expired = payments.isExpired(paymentId);
        // console.log("Is Expired:", expired);
    }
}