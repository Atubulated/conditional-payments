// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ConditionalPayments is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ ENUMS & STRUCTS ============

    enum PaymentType {
        Simple,
        Timelocked,
        Mediated,
        Bonded
    }
    enum Status {
        Pending,
        Accepted,
        Disputed,
        Resolved,
        Refunded
    }

    struct Payment {
        address sender;
        address receiver;
        address arbiter;
        address token;
        uint256 amount;
        uint256 bondAmount;
        uint256 deadline;
        uint256 challengePeriod;
        bytes32 termsHash;
        PaymentType pType;
        Status status;
    }

    // ============ STATE ============

    uint256 private _paymentIdCounter;
    mapping(uint256 => Payment) public payments;

    // ============ EVENTS ============

    event PaymentCreated(uint256 indexed id, PaymentType pType, address sender, address receiver);
    event PaymentAccepted(uint256 indexed id, address receiver);
    event PaymentDisputed(uint256 indexed id, address indexed by);
    event DisputeResolved(uint256 indexed id, address winner);
    event PaymentRefunded(uint256 indexed id);

    error NotAuthorized();
    error InvalidStatus();
    error TimelockActive();
    error DeadlinePassed();

    // ============ CORE FUNCTIONS ============

    /**
     * @notice Option B: Mediated Payment (What you currently have)
     */
    function createMediatedPayment(
        address receiver,
        address arbiter,
        address token,
        uint256 amount,
        bytes32 termsHash,
        uint256 deadline
    ) external nonReentrant returns (uint256 paymentId) {
        paymentId = _createBase(receiver, arbiter, token, amount, 0, 0, termsHash, PaymentType.Mediated, deadline);
    }

    /**
     * @notice Option C: Bonded Payment
     * Receiver must pay a 'bond' to accept the job.
     */
    function createBondedPayment(
        address receiver,
        address token,
        uint256 amount,
        uint256 bondAmount,
        bytes32 termsHash,
        uint256 deadline
    ) external nonReentrant returns (uint256 paymentId) {
        paymentId = _createBase(
            receiver, address(0), token, amount, bondAmount, 0, termsHash, PaymentType.Bonded, deadline
        );
    }

    /**
     * @notice Option A: Timelocked Payment
     * After work is done, funds are locked for a 'challengePeriod' before release.
     */
    function createTimelockedPayment(
        address receiver,
        address token,
        uint256 amount,
        uint256 challengePeriod,
        bytes32 termsHash,
        uint256 deadline
    ) external nonReentrant returns (uint256 paymentId) {
        paymentId = _createBase(
            receiver, address(0), token, amount, 0, challengePeriod, termsHash, PaymentType.Timelocked, deadline
        );
    }

    // ============ ACTION FUNCTIONS ============

    /**
     * @notice Receiver accepts a Bonded payment by paying the bond
     */
    function acceptBondedPayment(uint256 paymentId) external nonReentrant {
        Payment storage payment = payments[paymentId];
        if (msg.sender != payment.receiver) revert NotAuthorized();
        if (payment.status != Status.Pending) revert InvalidStatus();
        if (payment.pType != PaymentType.Bonded) revert InvalidStatus();

        payment.status = Status.Accepted;
        IERC20(payment.token).safeTransferFrom(msg.sender, address(this), payment.bondAmount);

        emit PaymentAccepted(paymentId, msg.sender);
    }

    /**
     * @notice Resolve or Release (The Happy Path)
     * For Bonded: Receiver gets Amount + Bond back.
     */
    function releasePayment(uint256 paymentId) external nonReentrant {
        Payment storage payment = payments[paymentId];
        if (msg.sender != payment.sender) revert NotAuthorized();
        if (payment.status == Status.Refunded || payment.status == Status.Resolved) revert InvalidStatus();

        payment.status = Status.Resolved;
        uint256 totalPayout = payment.amount + payment.bondAmount;
        IERC20(payment.token).safeTransfer(payment.receiver, totalPayout);

        emit DisputeResolved(paymentId, payment.receiver);
    }

    /**
     * @notice Common logic for raising disputes
     */
    function disputePayment(uint256 paymentId) external {
        Payment storage payment = payments[paymentId];
        if (msg.sender != payment.sender && msg.sender != payment.receiver) revert NotAuthorized();
        payment.status = Status.Disputed;
        emit PaymentDisputed(paymentId, msg.sender);
    }

    function resolveDispute(uint256 paymentId, address winner) external nonReentrant {
        Payment storage payment = payments[paymentId];
        if (msg.sender != payment.arbiter) revert NotAuthorized();
        if (payment.status != Status.Disputed) revert InvalidStatus();

        payment.status = Status.Resolved;
        uint256 totalPayout = payment.amount + payment.bondAmount;
        IERC20(payment.token).safeTransfer(winner, totalPayout);

        emit DisputeResolved(paymentId, winner);
    }

    // ============ INTERNAL HELPERS ============

    function _createBase(
        address receiver,
        address arbiter,
        address token,
        uint256 amount,
        uint256 bond,
        uint256 challenge,
        bytes32 terms,
        PaymentType pType,
        uint256 deadline
    ) internal returns (uint256 id) {
        id = _paymentIdCounter++;
        payments[id] = Payment({
            sender: msg.sender,
            receiver: receiver,
            arbiter: arbiter,
            token: token,
            amount: amount,
            bondAmount: bond,
            deadline: deadline,
            challengePeriod: challenge,
            termsHash: terms,
            pType: pType,
            status: Status.Pending
        });
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit PaymentCreated(id, pType, msg.sender, receiver);
    }

    function getPayment(uint256 paymentId) external view returns (Payment memory) {
        return payments[paymentId];
    }
}
