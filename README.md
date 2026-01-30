# Conditional Payments Infrastructure

> **Non-custodial escrow infrastructure for programmable payments on Arc Network**

A composable smart contract system that enables developers to build conditional payment applications with guaranteed execution and trustless escrow.

---

## 🎯 What Is This?

This is **payment infrastructure**, not an end-user app. It's designed for **builders** to create their own payment solutions on top of it.

Think of it like:
- **Stripe** provides payment infrastructure for web apps
- **This** provides conditional payment infrastructure for blockchain apps

---

## ✨ Features

### Core Capabilities
- ✅ **Lock funds with conditions** - Escrow with custom terms
- ✅ **Three-way resolution** - Accept, Reject, or Auto-refund
- ✅ **Flexible deadlines** - Default 24 hours, extendable up to 30 days
- ✅ **Non-custodial** - Smart contract holds funds, not a third party
- ✅ **ERC20 compatible** - Works with any token (USDC, etc.)
- ✅ **Event-driven** - Easy integration with off-chain systems

### Security Features
- 🔒 **Reentrancy protection**
- 🔒 **Safe token transfers**
- 🔒 **Access control**
- 🔒 **Time-locked refunds**
- 🔒 **Comprehensive testing**

---

## 🏗️ What Can You Build?

This infrastructure enables:

### Financial Applications
- **Freelance payment platforms** - "Accept if you'll deliver by Friday"
- **Rental deposits** - "Accept if apartment is available"
- **Purchase agreements** - "Accept if item is in stock"
- **Service bookings** - "Accept if you can do the job"

### Business Tools
- **Conditional gifts** - "Accept if used for education"
- **Escrow services** - Trustless third-party holding
- **Payment splitting** - Multi-party agreements
- **Recurring conditionals** - Subscription-style payments

### DeFi Primitives
- **OTC trading** - Peer-to-peer swaps
- **Options contracts** - Time-based financial instruments
- **Insurance payouts** - Conditional claim releases
- **Treasury management** - Multi-sig with conditions

---

## 🚀 Quick Start

### For Infrastructure Deployers

```bash
# 1. Clone and setup
git clone <your-repo>
cd conditional-payments
forge install

# 2. Test locally
forge test -vvv

# 3. Deploy to Arc testnet
forge script script/Deploy.s.sol --rpc-url arc_testnet --broadcast
```

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed instructions.

### For App Builders

```javascript
import { ethers } from 'ethers';

// Connect to deployed contract
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

// Create a conditional payment
const tx = await contract.createPayment(
    receiverAddress,
    usdcAddress,
    ethers.parseUnits("1000", 6), // 1000 USDC
    ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(terms))),
    0 // Use default 24h deadline
);
```

See [BUILDER_INTEGRATION.md](BUILDER_INTEGRATION.md) for complete examples.

---

## 📁 Project Structure

```
conditional-payments/
├── src/
│   └── ConditionalPayments.sol    # Main contract
├── test/
│   └── ConditionalPayments.t.sol  # Comprehensive tests
├── script/
│   └── Deploy.s.sol               # Deployment script
├── docs/
│   ├── SETUP_GUIDE.md             # Setup instructions
│   └── BUILDER_INTEGRATION.md     # Integration examples
├── foundry.toml                   # Foundry configuration
└── README.md                      # This file
```

---

## 🔧 Technical Specification

### Contract Interface

```solidity
interface IConditionalPayments {
    // Create a payment
    function createPayment(
        address receiver,
        address token,
        uint256 amount,
        bytes32 termsHash,
        uint256 customDeadline
    ) external returns (uint256 paymentId);
    
    // Receiver actions
    function acceptPayment(uint256 paymentId) external;
    function rejectPayment(uint256 paymentId) external;
    
    // Expiry handling
    function claimExpiredPayment(uint256 paymentId) external;
    
    // Deadline management
    function extendDeadline(uint256 paymentId, uint256 additionalTime) external;
    
    // View functions
    function getPayment(uint256 paymentId) external view returns (Payment memory);
    function getSenderPayments(address sender) external view returns (uint256[] memory);
    function getReceiverPayments(address receiver) external view returns (uint256[] memory);
    function timeRemaining(uint256 paymentId) external view returns (uint256);
}
```

### Payment Flow

```
┌─────────┐                    ┌──────────┐                    ┌──────────┐
│ Sender  │                    │ Contract │                    │ Receiver │
└────┬────┘                    └────┬─────┘                    └────┬─────┘
     │                              │                               │
     │ 1. createPayment()           │                               │
     ├─────────────────────────────>│                               │
     │                              │                               │
     │ 2. Lock funds                │                               │
     │ <─────────────────────────────┤                               │
     │                              │                               │
     │                              │ 3. Notify receiver            │
     │                              ├──────────────────────────────>│
     │                              │                               │
     │                              │ 4a. acceptPayment() OR        │
     │                              │ <─────────────────────────────┤
     │                              │     rejectPayment() OR        │
     │                              │     (timeout)                 │
     │                              │                               │
     │ 5. Refund (if rejected)      │ 5. Release (if accepted)      │
     │ <─────────────────────────────┤──────────────────────────────>│
     │      or timeout              │                               │
```

---

## 🧪 Testing

The contract includes comprehensive tests covering:

- ✅ Payment creation (valid/invalid scenarios)
- ✅ Acceptance by receiver
- ✅ Rejection by receiver
- ✅ Expiration and auto-refund
- ✅ Deadline extensions
- ✅ Access control (authorization checks)
- ✅ Edge cases and security

```bash
# Run all tests
forge test -vvv

# Run specific test
forge test --match-test test_AcceptPayment -vvv

# Gas report
forge test --gas-report
```

---

## 🌐 Deployment Info

### Arc Testnet
- **RPC URL:** https://testnet.arc.network
- **Explorer:** https://testnet.arcscan.app
- **Faucet:** https://faucet.circle.com
- **Contract Address:** `[DEPLOYED_ADDRESS]`

### Configuration
- **Default Deadline:** 24 hours
- **Min Extension:** 1 hour
- **Max Extension:** 30 days
- **Gas Token:** USDC

---

## 📊 Gas Costs (Approximate)

| Operation | Gas Cost |
|-----------|----------|
| Create Payment | ~100,000 |
| Accept Payment | ~50,000 |
| Reject Payment | ~50,000 |
| Claim Expired | ~50,000 |
| Extend Deadline | ~30,000 |

*Costs may vary based on network conditions*

---

## 🔐 Security

### Audits
- ⚠️ **Not yet audited** - Use at your own risk on testnet
- Built using OpenZeppelin audited contracts
- Comprehensive test coverage

### Best Practices
- Never store private keys in code
- Always validate user input
- Use environment variables for sensitive data
- Test thoroughly before mainnet deployment

---

## 🤝 Contributing

This is infrastructure - contributions welcome!

### Areas for Enhancement
- [ ] Multi-signature approval
- [ ] Partial acceptance (split payments)
- [ ] Recurring conditional payments
- [ ] Dispute resolution mechanism
- [ ] Integration with oracles
- [ ] Batch operations

### How to Contribute
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

---

## 📄 License

MIT License - see LICENSE file for details

---

## 🆘 Support

- **Documentation:** See `/docs` folder
- **Issues:** Open a GitHub issue
- **Questions:** Discussion board or Discord

---

## 🙏 Acknowledgments

Built for the Arc Network testnet builder community.

Powered by:
- [Foundry](https://github.com/foundry-rs/foundry) - Development framework
- [OpenZeppelin](https://openzeppelin.com/) - Security libraries
- [Arc Network](https://arc.network) - Layer 1 blockchain

---

## 📈 Roadmap

### Phase 1 (Current)
- ✅ Core escrow functionality
- ✅ Testing suite
- ✅ Documentation
- ✅ Testnet deployment

### Phase 2 (Next)
- [ ] Frontend demo application
- [ ] Advanced features (multi-sig, recurring)
- [ ] Security audit
- [ ] Mainnet deployment

### Phase 3 (Future)
- [ ] SDK for popular languages
- [ ] Template applications
- [ ] Integration plugins
- [ ] Analytics dashboard

---

## 💬 Community

Join the builder community:
- **Discord:** [Arc Network Discord](https://discord.com/invite/buildonarc)
- **Twitter:** [@arc](http://x.com/arc)
- **Docs:** [docs.arc.network](https://docs.arc.network)

---

**Built with ❤️ for the Arc ecosystem**

*Making programmable payments accessible to all builders*