// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ConditionalPayments is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ ENUMS & STRUCTS ============
    enum PaymentType { Simple, Timelocked, Mediated, Bonded }
    enum Status { Pending, Accepted, Disputed, Resolved, Refunded }

    struct Payment {
        address sender;
        address receiver;
        address arbiter;
        address token;
        uint256 amount;
        uint256 bondAmount;
        uint256 deadline; 
        uint256 availableAt; 
        uint256 acceptedAt; 
        bytes32 termsHash;
        PaymentType pType;
        Status status;
        bool receiverAccepted;
        address resolvedTo; // NEW: Permanently stores the winner's address
    }

    // ============ STATE ============
    uint256 private _paymentIdCounter;
    mapping(uint256 => Payment) public payments;
    mapping(address => uint256[]) private paymentsByReceiver;
    mapping(address => uint256[]) private paymentsBySender;

    address public treasury; 
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    // ============ EVENTS ============
    event PaymentCreated(uint256 indexed id, PaymentType pType, address sender, address receiver);
    event PaymentAccepted(uint256 indexed id, address receiver);
    event PaymentDeclined(uint256 indexed id, address receiver);
    event PaymentResolved(uint256 indexed id); 
    event PaymentRefunded(uint256 indexed id);

    // ============ ERRORS ============
    error NotAuthorized();
    error InvalidStatus();
    error DeadlinePassed(); 
    error DeadlineNotPassed(); 
    error CoolingOffPeriodActive(); 
    error TokenTransferFailed(); 

    // ============ CONSTRUCTOR ============
    constructor() {
        treasury = msg.sender;
    }

    // ============ CREATE FUNCTIONS ============
    function createTimelockedPayment(address receiver, address token, uint256 amount, uint256 acceptanceDelay, bytes32 termsHash, uint256 deadline) external nonReentrant returns (uint256 paymentId) {
        uint256 availableAt = block.timestamp + acceptanceDelay;
        paymentId = _createBase(receiver, address(0), token, amount, 0, availableAt, termsHash, PaymentType.Timelocked, deadline);
    }

    function createMediatedPayment(address receiver, address arbiter, address token, uint256 amount, bytes32 termsHash, uint256 deadline) external nonReentrant returns (uint256 paymentId) {
        paymentId = _createBase(receiver, arbiter, token, amount, 0, block.timestamp, termsHash, PaymentType.Mediated, deadline);
    }

    function createBondedPayment(address receiver, address token, uint256 amount, uint256 bondAmount, bytes32 termsHash, uint256 deadline) external nonReentrant returns (uint256 paymentId) {
        paymentId = _createBase(receiver, address(0), token, amount, bondAmount, block.timestamp, termsHash, PaymentType.Bonded, deadline);
    }

    // ============ ACTION FUNCTIONS ============

    function claimTimelockedPayment(uint256 paymentId) external nonReentrant {
        Payment storage payment = payments[paymentId];
        if (msg.sender != payment.receiver) revert NotAuthorized();
        if (payment.status != Status.Pending) revert InvalidStatus();
        if (payment.pType != PaymentType.Timelocked) revert InvalidStatus();
        if (block.timestamp < payment.availableAt) revert CoolingOffPeriodActive();
        if (block.timestamp > payment.deadline) revert DeadlinePassed();

        payment.receiverAccepted = true;
        payment.status = Status.Resolved;
        payment.acceptedAt = block.timestamp; 
        payment.resolvedTo = payment.receiver; // RECORD WINNER
        
        _safeTransfer(payment.token, payment.receiver, payment.amount);

        emit PaymentAccepted(paymentId, msg.sender);
        emit PaymentResolved(paymentId);
    }

    function declineTimelockedPayment(uint256 paymentId) external nonReentrant {
        Payment storage payment = payments[paymentId];
        if (msg.sender != payment.receiver) revert NotAuthorized();
        if (payment.status != Status.Pending) revert InvalidStatus();
        if (payment.pType != PaymentType.Timelocked) revert InvalidStatus();

        payment.status = Status.Refunded;
        payment.resolvedTo = payment.sender; // RECORD WINNER
        _safeTransfer(payment.token, payment.sender, payment.amount);

        emit PaymentDeclined(paymentId, msg.sender);
        emit PaymentRefunded(paymentId);
    }

    function acceptMediatedPayment(uint256 paymentId) external nonReentrant {
        Payment storage payment = payments[paymentId];
        if (msg.sender != payment.receiver) revert NotAuthorized();
        if (payment.status != Status.Pending) revert InvalidStatus();
        if (payment.pType != PaymentType.Mediated) revert InvalidStatus();
        if (block.timestamp > payment.deadline) revert DeadlinePassed();

        payment.status = Status.Accepted;
        payment.acceptedAt = block.timestamp;
        emit PaymentAccepted(paymentId, msg.sender);
    }

    function acceptBondedPayment(uint256 paymentId) external nonReentrant {
        Payment storage payment = payments[paymentId];
        if (msg.sender != payment.receiver) revert NotAuthorized();
        if (payment.status != Status.Pending) revert InvalidStatus();
        if (payment.pType != PaymentType.Bonded) revert InvalidStatus();
        if (block.timestamp > payment.deadline) revert DeadlinePassed();

        payment.status = Status.Accepted;
        _safeTransferFrom(payment.token, msg.sender, address(this), payment.bondAmount);
        emit PaymentAccepted(paymentId, msg.sender);
    }

    function slashBondedPayment(uint256 paymentId) external nonReentrant {
        Payment storage payment = payments[paymentId];
        if (msg.sender != payment.sender) revert NotAuthorized();
        if (payment.status != Status.Accepted) revert InvalidStatus();
        if (payment.pType != PaymentType.Bonded) revert InvalidStatus();

        payment.status = Status.Resolved; 
        payment.resolvedTo = address(0); // RECORD AS BURNED/SLASHED

        uint256 totalPool = payment.amount + payment.bondAmount;
        uint256 treasuryShare = totalPool / 2;
        uint256 burnShare = totalPool - treasuryShare;

        _safeTransfer(payment.token, treasury, treasuryShare);
        _safeTransfer(payment.token, BURN_ADDRESS, burnShare);

        emit PaymentResolved(paymentId);
    }

    function releasePayment(uint256 paymentId) external nonReentrant {
        Payment storage payment = payments[paymentId];
        if (msg.sender != payment.sender) revert NotAuthorized();
        if (payment.status == Status.Refunded || payment.status == Status.Resolved) revert InvalidStatus();

        payment.status = Status.Resolved;
        payment.resolvedTo = payment.receiver; // RECORD WINNER
        uint256 totalPayout = payment.amount + payment.bondAmount;
        _safeTransfer(payment.token, payment.receiver, totalPayout);
        
        emit PaymentResolved(paymentId);
    }

    function disputePayment(uint256 paymentId) external {
        Payment storage payment = payments[paymentId];
        if (msg.sender != payment.sender && msg.sender != payment.receiver) revert NotAuthorized();
        if (payment.pType == PaymentType.Bonded) revert InvalidStatus(); 
        
        payment.status = Status.Disputed;
    }

    function resolveDispute(uint256 paymentId, address winner) external nonReentrant {
        Payment storage payment = payments[paymentId];
        if (msg.sender != payment.arbiter) revert NotAuthorized();
        if (payment.status != Status.Disputed) revert InvalidStatus();

        payment.status = Status.Resolved;
        payment.resolvedTo = winner; // RECORD WINNER
        uint256 totalPayout = payment.amount + payment.bondAmount;
        _safeTransfer(payment.token, winner, totalPayout);
    }

    function reclaimExpiredPayment(uint256 paymentId) external nonReentrant {
        Payment storage payment = payments[paymentId];
        if (msg.sender != payment.sender) revert NotAuthorized();
        if (payment.status != Status.Pending) revert InvalidStatus();
        if (block.timestamp <= payment.deadline) revert DeadlineNotPassed();

        payment.status = Status.Refunded;
        payment.resolvedTo = payment.sender; // RECORD WINNER
        _safeTransfer(payment.token, payment.sender, payment.amount);

        emit PaymentRefunded(paymentId);
    }

    // ============ INTERNAL HELPERS ============
    function _createBase(
        address receiver, address arbiter, address token, uint256 amount, uint256 bond,
        uint256 availableAt, bytes32 terms, PaymentType pType, uint256 deadline
    ) internal returns (uint256 id) {
        id = _paymentIdCounter++;
        payments[id] = Payment({
            sender: msg.sender, receiver: receiver, arbiter: arbiter, token: token,
            amount: amount, bondAmount: bond, deadline: deadline, availableAt: availableAt,
            acceptedAt: 0, termsHash: terms, pType: pType, status: Status.Pending, receiverAccepted: false,
            resolvedTo: address(0)
        });
        paymentsByReceiver[receiver].push(id);
        paymentsBySender[msg.sender].push(id); 
        _safeTransferFrom(token, msg.sender, address(this), amount);
        emit PaymentCreated(id, pType, msg.sender, receiver);
    }

    function _safeTransfer(address token, address to, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, amount));
        if (!success || (data.length > 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount));
        if (!success || (data.length > 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
    }

    function getPayment(uint256 paymentId) external view returns (Payment memory) { return payments[paymentId]; }
    function getPaymentsForReceiver(address receiver) external view returns (uint256[] memory) { return paymentsByReceiver[receiver]; }
    function getPaymentsForSender(address sender) external view returns (uint256[] memory) { return paymentsBySender[sender]; }
}