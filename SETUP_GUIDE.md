# Conditional Payments Infrastructure - Complete Setup Guide

## 🎯 What You're Building

A **non-custodial escrow infrastructure** that lets anyone build conditional payment apps on top of it. This is the foundation - other developers will use your smart contract to create their own payment solutions.

---

## 📋 Prerequisites Checklist

Before we start, make sure you have:
- ✅ Windows PC
- ✅ PowerShell installed (comes with Windows)
- ✅ Internet connection

That's it! We'll install everything else together.

---

## 🛠️ Step 1: Install Development Tools

### 1.1 Install Scoop (Package Manager for Windows)

Open **PowerShell as Administrator** (right-click → Run as Administrator) and run:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh -outfile 'install.ps1'
.\install.ps1
```

### 1.2 Install Git and Foundry

```powershell
scoop install git
scoop install foundry
```

### 1.3 Verify Installation

```powershell
forge --version
cast --version
```

You should see version numbers for both. ✅

---

## 📁 Step 2: Create Your Project

### 2.1 Create Project Folder

```powershell
# Navigate to where you want your project (e.g., Desktop)
cd $HOME\Desktop

# Create project folder
mkdir conditional-payments
cd conditional-payments

# Initialize Foundry project
forge init --no-commit
```

### 2.2 Install Dependencies

```powershell
forge install OpenZeppelin/openzeppelin-contracts --no-commit
```

### 2.3 Update Configuration

Create/edit `foundry.toml` in your project root:

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.20"
optimizer = true
optimizer_runs = 200

remappings = [
    "@openzeppelin/=lib/openzeppelin-contracts/"
]

[rpc_endpoints]
arc_testnet = "https://testnet.arc.network"

[etherscan]
arc_testnet = { key = "not_needed", url = "https://testnet.arcscan.app/api" }
```

---

## 💾 Step 3: Add Contract Files

### 3.1 Main Contract

Copy the **ConditionalPayments.sol** file to `src/ConditionalPayments.sol`

### 3.2 Test File

Copy the **ConditionalPayments.t.sol** file to `test/ConditionalPayments.t.sol`

### 3.3 Deployment Script

Copy the **Deploy.s.sol** file to `script/Deploy.s.sol`

---

## 🧪 Step 4: Test Your Contract Locally

Run the tests to make sure everything works:

```powershell
forge test -vvv
```

You should see all tests passing with green checkmarks! ✅

**What these tests prove:**
- ✅ Payments can be created and funds locked
- ✅ Only receivers can accept/reject
- ✅ Auto-refunds work after deadline
- ✅ Deadlines can be extended
- ✅ No one can steal funds
- ✅ All edge cases are handled

---

## 💰 Step 5: Get Testnet USDC

### 5.1 Create a Wallet

If you don't have a wallet yet:

1. Install **MetaMask** browser extension: https://metamask.io
2. Create a new wallet and **SAVE YOUR SEED PHRASE SECURELY**
3. Copy your wallet address (starts with 0x...)

### 5.2 Add Arc Network to MetaMask

In MetaMask:
- Click network dropdown → "Add Network" → "Add network manually"
- Enter these details:
  - **Network Name:** Arc Testnet
  - **RPC URL:** `https://testnet.arc.network`
  - **Chain ID:** `12345` (check docs.arc.network for exact ID)
  - **Currency Symbol:** USDC
  - **Block Explorer:** https://testnet.arcscan.app

### 5.3 Get Testnet USDC

Visit the Circle faucet: https://faucet.circle.com

1. Connect your wallet
2. Select Arc Testnet
3. Request USDC (you'll get free testnet USDC for development)

---

## 🚀 Step 6: Deploy to Arc Testnet

### 6.1 Set Up Environment Variables

Create a `.env` file in your project root:

```env
PRIVATE_KEY=your_private_key_here
RPC_URL=https://testnet.arc.network
```

**To get your private key from MetaMask:**
1. Click three dots → Account Details
2. Export Private Key
3. Enter password
4. Copy the key (NEVER share this!)

⚠️ **IMPORTANT:** Add `.env` to your `.gitignore` file so you never accidentally share your private key!

### 6.2 Load Environment Variables

```powershell
# Load the .env file
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
    }
}
```

### 6.3 Deploy!

```powershell
forge script script/Deploy.s.sol --rpc-url arc_testnet --broadcast --verify
```

**What happens:**
1. Forge compiles your contract
2. Sends it to Arc testnet
3. Deploys it to the blockchain
4. Shows you the contract address

**Save the contract address!** This is what other builders will use.

---

## ✅ Step 7: Verify Deployment

### 7.1 Check on Block Explorer

Visit: https://testnet.arcscan.app/address/YOUR_CONTRACT_ADDRESS

You should see:
- Contract creation transaction
- Contract code
- Contract ABI (Application Binary Interface)

### 7.2 Interact with Your Contract

In the block explorer, you can:
- Read contract state (view functions)
- See all payments created
- Test transactions

---

## 🎓 Understanding Your Contract

### Key Components:

**1. Payment Structure**
```solidity
struct Payment {
    address sender;      // Who locked the funds
    address receiver;    // Who can claim them
    address token;       // What token (USDC, etc.)
    uint256 amount;      // How much
    bytes32 termsHash;   // Hash of conditions
    uint256 deadline;    // When it expires
    bool isActive;       // Still pending?
    bool isAccepted;     // Was it accepted?
}
```

**2. Main Functions**

- `createPayment()` - Lock funds with conditions
- `acceptPayment()` - Receiver claims funds
- `rejectPayment()` - Receiver refuses, sender gets refund
- `claimExpiredPayment()` - Anyone can trigger refund after deadline
- `extendDeadline()` - Sender can give more time

**3. Security Features**

- ✅ **ReentrancyGuard** - Prevents attack vectors
- ✅ **SafeERC20** - Safe token transfers
- ✅ **Access Control** - Only authorized people can act
- ✅ **Time Locks** - Automatic refunds
- ✅ **Events** - Everything is logged

---

## 🏗️ How Builders Use Your Contract

### Example: Freelance Payment App

A developer could build a web app that:

```javascript
// 1. Freelancer posts a gig
const termsHash = keccak256("Build a website for $1000, due Friday");

// 2. Client creates payment
await contract.createPayment(
    freelancerAddress,
    usdcAddress,
    1000 * 1e6, // 1000 USDC
    termsHash,
    0 // 24 hour deadline
);

// 3. Freelancer accepts or rejects
await contract.acceptPayment(paymentId); // if they agree
// OR
await contract.rejectPayment(paymentId); // if they don't
```

### Other Use Cases Builders Could Create:

1. **Rental Deposits** - "Accept if you confirm apartment is available"
2. **Purchase Agreements** - "Accept if you have item in stock"
3. **Service Bookings** - "Accept if you can do the job on this date"
4. **Conditional Gifts** - "Accept if you'll use this for education"
5. **Insurance Claims** - "Accept if you agree to terms of payout"

---

## 📊 Next Steps

### For You (The Infrastructure Builder):

1. ✅ Deploy contract
2. ✅ Test it thoroughly
3. ✅ Document the API
4. ✅ Create example integrations
5. ✅ Share with other builders

### For Other Builders:

They just need:
- Your contract address
- The ABI (generated automatically)
- Documentation (we can create this!)

---

## 🐛 Troubleshooting

**"Transaction failed"**
- Check you have enough testnet USDC
- Make sure you approved the token first
- Verify the receiver address is correct

**"Contract not deploying"**
- Check your private key is correct
- Verify you have testnet USDC for gas
- Make sure RPC URL is correct

**"Tests failing"**
- Run `forge clean` then `forge build`
- Make sure OpenZeppelin is installed
- Check Solidity version is 0.8.20

---

## 🎉 Congratulations!

You've built **production-ready payment infrastructure**! This is the same quality of code that powers real DeFi protocols.

### What You've Learned:

✅ Smart contract development
✅ Testing and security
✅ Deployment to blockchain
✅ Building composable infrastructure
✅ Token handling (ERC20)
✅ Access control patterns
✅ Time-based logic

### What's Next?

Want to build more? Some ideas:
1. **Frontend** - Build a web interface
2. **Multi-signature** - Require multiple approvals
3. **Recurring Payments** - Automatic scheduled payments
4. **Dispute Resolution** - Add arbitration system
5. **Documentation** - Create builder docs

Let me know which direction you want to go! 🚀