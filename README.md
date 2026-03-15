# Custodex: Conditional Payments Infrastructure

[![Solidity](https://img.shields.io/badge/Solidity-%5E0.8.20-363636.svg?logo=solidity)](https://soliditylang.org/)
[![Foundry](https://img.shields.io/badge/Built%20with-Foundry-FF8A00.svg)](https://book.getfoundry.sh/)
[![Network](https://img.shields.io/badge/Network-Arc_Testnet-4F46E5.svg)](https://arc.network)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Non-custodial escrow infrastructure for programmable payments on the Arc Network.**

Custodex is a composable smart contract system that enables developers to build conditional payment applications with guaranteed execution and trustless escrow. It is designed as a foundational layer for builders, functioning similarly to Stripe for traditional web apps, but operating entirely on-chain.

---

## 📖 Protocol Overview

Custodex allows developers to easily integrate complex, conditional holding logic into their dApps without having to write escrow contracts from scratch. 

**Core Capabilities:**
* **Programmable Escrow:** Lock ERC20 tokens (e.g., USDC) with specific, time-bound conditions.
* **Three-Way Resolution:** Native support for standard acceptance, sender-initiated rejection, and automated expiries.
* **Arbitration Native:** Built-in dispute resolution routing for mediated transactions.
* **Non-Custodial Architecture:** Funds are locked in immutable smart contracts, removing counterparty risk.

**Target Use Cases:**
* **DeFi Primitives:** OTC trading, options contracts, and conditional treasury management.
* **Marketplaces:** Trustless peer-to-peer freelance platforms or service bookings.
* **Business Tools:** Automated payment splitting, rental deposits, and milestone-based grants.

---

## 🏗️ Architecture & Payment Flow

The protocol utilizes a state-driven payment lifecycle to ensure funds are never permanently locked and both parties have cryptographically guaranteed rights.

```text
┌─────────┐                    ┌──────────┐                    ┌──────────┐
│ Sender  │                    │ Contract │                    │ Receiver │
└────┬────┘                    └────┬─────┘                    └────┬─────┘
     │                              │                               │
     │ 1. createPayment()           │                               │
     ├─────────────────────────────>│                               │
     │                              │                               │
     │ 2. Lock funds                │                               │
     │ <────────────────────────────┤                               │
     │                              │                               │
     │                              │ 3. Notify receiver            │
     │                              ├──────────────────────────────>│
     │                              │                               │
     │                              │ 4. acceptPayment() OR         │
     │                              │ <─────────────────────────────┤
     │                              │    rejectPayment() OR         │
     │                              │    (timeout)                  │
     │                              │                               │
     │ 5. Refund (if rejected/exp)  │ 5. Release (if accepted)      │
     │ <────────────────────────────┤──────────────────────────────>│

     💻 Developer Integration
1. Smart Contract Interface
To interact with the Custodex protocol at the contract level, utilize the following interface:
interface IConditionalPayments {
    function createPayment(
        address receiver,
        address token,
        uint256 amount,
        bytes32 termsHash,
        uint256 customDeadline
    ) external returns (uint256 paymentId);
    
    function acceptPayment(uint256 paymentId) external;
    function rejectPayment(uint256 paymentId) external;
    function claimExpiredPayment(uint256 paymentId) external;
    function extendDeadline(uint256 paymentId, uint256 additionalTime) external;
    
    function getPayment(uint256 paymentId) external view returns (Payment memory);
    function getSenderPayments(address sender) external view returns (uint256[] memory);
    function getReceiverPayments(address receiver) external view returns (uint256[] memory);
}

2. Client-Side Quick Start (Ethers.js)
Integrating Custodex into a frontend application requires standard contract interaction:
import { ethers } from 'ethers';

// Initialize contract instance
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

// Execute a conditional payment
const tx = await contract.createPayment(
    receiverAddress,
    usdcAddress,
    ethers.parseUnits("1000", 6), // 1000 USDC
    ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(terms))),
    0 // Uses default protocol deadline (24h)
);
await tx.wait();
See BUILDER_INTEGRATION.md for complete implementation examples.


🛡️ Security & Testing
Custodex is built with a security-first approach, utilizing OpenZeppelin standards.

Reentrancy Protection: Implemented on all state-changing and token-transfer functions.

SafeERC20: Utilizing safe transfer libraries to handle non-standard ERC20 behaviors.

Strict Access Control: Resolution functions are cryptographically restricted to assigned participants (Sender, Receiver, or assigned Arbiter).

Running the Test Suite:
The project uses Foundry for comprehensive unit and fuzz testing.
# Run all tests
forge test -vvv

# Generate gas report
forge test --gas-report

🌐 Deployment Details
Arc Testnet Configuration

Network RPC: https://testnet.arc.network

Explorer: https://testnet.arcscan.app

USDC Faucet: https://faucet.circle.com

Deployed Contract: [INSERT_DEPLOYED_ADDRESS_HERE]

Protocol Parameters

Default Expiry: 24 hours

Max Extension: 30 days

Supported Assets: ERC20 Compatible (Optimized for USDC)


🤝 Contributing
Custodex is public infrastructure. We welcome pull requests for protocol enhancements.

Current Roadmap:

[ ] Multi-signature approval matrices

[ ] Partial acceptance / Milestoned payments

[ ] Protocol-level dispute resolution mechanics

Please ensure all tests pass (forge test) before submitting a PR. See SETUP_GUIDE.md for local environment configuration.

Built for the Arc Network developer ecosystem.