# Builder Integration Guide

## 🎯 For Developers Building On This Infrastructure

This guide shows you how to integrate the ConditionalPayments infrastructure into your own app.

---

## 📦 Contract Address

**Arc Testnet:** `[YOUR_DEPLOYED_ADDRESS_HERE]`

**USDC Token:** Check Arc docs for testnet USDC address

---

## 🚀 Quick Start Integration

### Option 1: Using ethers.js (Web Apps)

```javascript
import { ethers } from 'ethers';
import ConditionalPaymentsABI from './ConditionalPayments.json';

// Connect to Arc Network
const provider = new ethers.JsonRpcProvider('https://testnet.arc.network');
const signer = new ethers.Wallet(privateKey, provider);

// Initialize contract
const paymentsContract = new ethers.Contract(
    'YOUR_CONTRACT_ADDRESS',
    ConditionalPaymentsABI,
    signer
);

// Initialize USDC
const usdcContract = new ethers.Contract(
    'USDC_ADDRESS',
    ['function approve(address,uint256)', 'function balanceOf(address)'],
    signer
);
```

### Option 2: Using web3.js

```javascript
const Web3 = require('web3');
const web3 = new Web3('https://testnet.arc.network');

const paymentsContract = new web3.eth.Contract(
    ConditionalPaymentsABI,
    'YOUR_CONTRACT_ADDRESS'
);
```

---

## 💡 Common Use Cases

### 1. Freelance Payment System

```javascript
async function createFreelancePayment(freelancerAddress, amount, jobDescription) {
    // 1. Hash the terms (you decide what to include!)
    const terms = {
        description: jobDescription,
        deadline: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
        deliverables: ["Website", "Source code", "Documentation"]
    };
    const termsHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(terms)));
    
    // 2. Approve USDC
    const amountInUSDC = ethers.parseUnits(amount.toString(), 6); // USDC has 6 decimals
    await usdcContract.approve(paymentsContract.target, amountInUSDC);
    
    // 3. Create payment
    const tx = await paymentsContract.createPayment(
        freelancerAddress,
        USDC_ADDRESS,
        amountInUSDC,
        termsHash,
        0 // Use default 24 hour deadline for acceptance
    );
    
    const receipt = await tx.wait();
    
    // 4. Get payment ID from events
    const event = receipt.logs.find(log => 
        log.topics[0] === paymentsContract.interface.getEvent('PaymentCreated').topicHash
    );
    const paymentId = event.args.paymentId;
    
    // 5. Store terms in your database
    await db.saveTerms(paymentId, terms);
    
    return paymentId;
}
```

### 2. Service Booking Platform

```javascript
async function bookService(providerAddress, servicePrice, bookingDetails) {
    const terms = {
        service: bookingDetails.serviceName,
        date: bookingDetails.date,
        time: bookingDetails.time,
        location: bookingDetails.location,
        cancelPolicy: "24 hour cancellation notice required"
    };
    
    const termsHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(terms)));
    const amount = ethers.parseUnits(servicePrice.toString(), 6);
    
    // Approve and create
    await usdcContract.approve(paymentsContract.target, amount);
    const tx = await paymentsContract.createPayment(
        providerAddress,
        USDC_ADDRESS,
        amount,
        termsHash,
        Math.floor(Date.now() / 1000) + (48 * 3600) // 48 hour deadline
    );
    
    return await tx.wait();
}
```

### 3. Rental Deposit System

```javascript
async function createRentalDeposit(tenantAddress, depositAmount, propertyDetails) {
    const terms = {
        property: propertyDetails.address,
        moveInDate: propertyDetails.moveIn,
        monthlyRent: propertyDetails.rent,
        depositAmount: depositAmount,
        conditions: "Refundable if property left in good condition"
    };
    
    const termsHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(terms)));
    const amount = ethers.parseUnits(depositAmount.toString(), 6);
    
    await usdcContract.approve(paymentsContract.target, amount);
    const tx = await paymentsContract.createPayment(
        tenantAddress,
        USDC_ADDRESS,
        amount,
        termsHash,
        0
    );
    
    return await tx.wait();
}
```

---

## 📡 Listening to Events

### Track All Payments in Real-Time

```javascript
// Listen for new payments
paymentsContract.on('PaymentCreated', (paymentId, sender, receiver, token, amount, termsHash, deadline, event) => {
    console.log('New payment created!', {
        id: paymentId.toString(),
        from: sender,
        to: receiver,
        amount: ethers.formatUnits(amount, 6),
        deadline: new Date(deadline * 1000)
    });
    
    // Update your UI, send notifications, etc.
    notifyReceiver(receiver, paymentId);
});

// Listen for acceptances
paymentsContract.on('PaymentAccepted', (paymentId, receiver, amount) => {
    console.log('Payment accepted!', paymentId.toString());
    updateOrderStatus(paymentId, 'accepted');
});

// Listen for rejections
paymentsContract.on('PaymentRejected', (paymentId, receiver, amount) => {
    console.log('Payment rejected!', paymentId.toString());
    updateOrderStatus(paymentId, 'rejected');
});
```

---

## 🔍 Querying Payment Data

### Get Payment Details

```javascript
async function getPaymentInfo(paymentId) {
    const payment = await paymentsContract.getPayment(paymentId);
    
    return {
        sender: payment.sender,
        receiver: payment.receiver,
        amount: ethers.formatUnits(payment.amount, 6),
        deadline: new Date(payment.deadline * 1000),
        isActive: payment.isActive,
        isAccepted: payment.isAccepted
    };
}
```

### Get All User's Payments

```javascript
async function getUserPayments(userAddress) {
    // Payments they sent
    const sent = await paymentsContract.getSenderPayments(userAddress);
    
    // Payments they received
    const received = await paymentsContract.getReceiverPayments(userAddress);
    
    return {
        sent: sent.map(id => id.toString()),
        received: received.map(id => id.toString())
    };
}
```

### Check Time Remaining

```javascript
async function getTimeRemaining(paymentId) {
    const seconds = await paymentsContract.timeRemaining(paymentId);
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    return { hours, minutes, seconds: seconds.toString() };
}
```

---

## 🎨 React Component Example

### Payment Dashboard Component

```jsx
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

function PaymentDashboard() {
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        loadPayments();
    }, []);
    
    async function loadPayments() {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        
        const contract = new ethers.Contract(
            CONTRACT_ADDRESS,
            ABI,
            signer
        );
        
        // Get all payment IDs
        const receivedIds = await contract.getReceiverPayments(address);
        
        // Fetch details for each
        const paymentData = await Promise.all(
            receivedIds.map(async (id) => {
                const payment = await contract.getPayment(id);
                const timeLeft = await contract.timeRemaining(id);
                
                return {
                    id: id.toString(),
                    sender: payment.sender,
                    amount: ethers.formatUnits(payment.amount, 6),
                    deadline: new Date(payment.deadline * 1000),
                    timeLeft: timeLeft.toString(),
                    isActive: payment.isActive
                };
            })
        );
        
        setPayments(paymentData);
        setLoading(false);
    }
    
    async function acceptPayment(paymentId) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
        
        const tx = await contract.acceptPayment(paymentId);
        await tx.wait();
        
        alert('Payment accepted!');
        loadPayments(); // Refresh
    }
    
    async function rejectPayment(paymentId) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
        
        const tx = await contract.rejectPayment(paymentId);
        await tx.wait();
        
        alert('Payment rejected!');
        loadPayments(); // Refresh
    }
    
    if (loading) return <div>Loading...</div>;
    
    return (
        <div>
            <h2>Pending Payments</h2>
            {payments.filter(p => p.isActive).map(payment => (
                <div key={payment.id} style={{border: '1px solid #ccc', padding: '1rem', margin: '1rem 0'}}>
                    <p><strong>From:</strong> {payment.sender}</p>
                    <p><strong>Amount:</strong> ${payment.amount} USDC</p>
                    <p><strong>Time Left:</strong> {Math.floor(payment.timeLeft / 3600)} hours</p>
                    <button onClick={() => acceptPayment(payment.id)}>Accept</button>
                    <button onClick={() => rejectPayment(payment.id)}>Reject</button>
                </div>
            ))}
        </div>
    );
}
```

---

## 🔒 Security Best Practices

### 1. Always Validate Input

```javascript
function validatePayment(receiver, amount) {
    if (!ethers.isAddress(receiver)) {
        throw new Error('Invalid receiver address');
    }
    if (amount <= 0) {
        throw new Error('Amount must be positive');
    }
}
```

### 2. Handle Errors Gracefully

```javascript
async function createPaymentSafely(receiver, amount, terms) {
    try {
        validatePayment(receiver, amount);
        
        const tx = await paymentsContract.createPayment(
            receiver,
            USDC_ADDRESS,
            ethers.parseUnits(amount.toString(), 6),
            ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(terms))),
            0
        );
        
        return await tx.wait();
    } catch (error) {
        if (error.code === 'INSUFFICIENT_FUNDS') {
            alert('Not enough USDC in wallet');
        } else if (error.message.includes('InvalidReceiver')) {
            alert('Cannot send to this address');
        } else {
            console.error('Transaction failed:', error);
            alert('Transaction failed. Please try again.');
        }
        throw error;
    }
}
```

### 3. Store Terms Off-Chain

```javascript
// Don't store large data on-chain!
// Instead, hash it and store the original off-chain

const terms = {
    // Your detailed terms
};

// Store in your database
const termsId = await db.saveTerms(terms);

// Hash for on-chain verification
const termsHash = ethers.keccak256(
    ethers.toUtf8Bytes(JSON.stringify(terms))
);

// Later, verify terms match
const storedTerms = await db.getTerms(termsId);
const storedHash = ethers.keccak256(
    ethers.toUtf8Bytes(JSON.stringify(storedTerms))
);

if (storedHash !== onChainHash) {
    throw new Error('Terms have been tampered with!');
}
```

---

## 🎓 Advanced Patterns

### Multi-Step Workflows

```javascript
// 1. Client creates payment
const paymentId = await createPayment(...);

// 2. Send notification to service provider
await sendEmail(provider, `New booking! Payment ${paymentId}`);

// 3. Provider accepts in their dashboard
// (through your UI)

// 4. Monitor for acceptance event
paymentsContract.once('PaymentAccepted', (id, receiver, amount) => {
    if (id.toString() === paymentId.toString()) {
        // Start the service workflow
        markServiceAsConfirmed(paymentId);
    }
});
```

### Automatic Deadline Extensions

```javascript
async function requestDeadlineExtension(paymentId, reason, additionalHours) {
    // Your business logic
    if (await isValidReason(reason)) {
        const additionalTime = additionalHours * 3600;
        
        const tx = await paymentsContract.extendDeadline(
            paymentId,
            additionalTime
        );
        
        await tx.wait();
        
        // Notify receiver
        notifyReceiver(paymentId, `Deadline extended by ${additionalHours} hours`);
    }
}
```

---

## 📚 Full ABI Reference

The contract ABI will be generated when you compile. You can find it at:
`out/ConditionalPayments.sol/ConditionalPayments.json`

Key functions:
- `createPayment(address,address,uint256,bytes32,uint256)`
- `acceptPayment(uint256)`
- `rejectPayment(uint256)`
- `claimExpiredPayment(uint256)`
- `extendDeadline(uint256,uint256)`
- `getPayment(uint256)`
- `getSenderPayments(address)`
- `getReceiverPayments(address)`
- `timeRemaining(uint256)`

---

## 🆘 Support

**Questions?** Open an issue or reach out to the infrastructure maintainer.

**Found a bug?** Report it with:
- Transaction hash
- Expected behavior
- Actual behavior
- Steps to reproduce

---

## 🎉 You're Ready!

You now have everything you need to build amazing payment applications on this infrastructure.

Happy building! 🚀