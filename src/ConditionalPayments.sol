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
        uint256 challengePeriod;
        bytes32 termsHash;
        PaymentType pType;
        Status status;
        bool receiverAccepted; // NEW: tracks if receiver accepted
    }

    // ============ STATE ============
    uint256 private _paymentIdCounter;
    mapping(uint256 => Payment) public payments;
    mapping(address => uint256[]) private paymentsByReceiver;

    // ============ EVENTS ============
    event PaymentCreated(uint256 indexed id, PaymentType pType, address sender, address receiver);
    event PaymentAccepted(uint256 indexed id, address receiver);
    event PaymentDeclined(uint256 indexed id, address receiver);
    event PaymentResolved(uint256 indexed id); // NEW
    event PaymentRefunded(uint256 indexed id);

    // ============ ERRORS ============
    error NotAuthorized();
    error InvalidStatus();
    error DeadlineNotPassed();
    error TokenTransferFailed(); // NEW

    // ============ CREATE FUNCTIONS ============
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

    function createMediatedPayment(
        address receiver,
        address arbiter,
        address token,
        uint256 amount,
        bytes32 termsHash,
        uint256 deadline
    ) external nonReentrant returns (uint256 paymentId) {
        paymentId = _createBase(
            receiver, arbiter, token, amount, 0, 0, termsHash, PaymentType.Mediated, deadline
        );
    }

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

    // ============ ACTION FUNCTIONS ============
    function acceptTimelockedPayment(uint256 paymentId) external {
        Payment storage payment = payments[paymentId];
        if (msg.sender != payment.receiver) revert NotAuthorized();
        if (payment.status != Status.Pending) revert InvalidStatus();
        if (payment.pType != PaymentType.Timelocked) revert InvalidStatus();

        payment.receiverAccepted = true;
        payment.status = Status.Accepted;
        emit PaymentAccepted(paymentId, msg.sender);
    }

    function declineTimelockedPayment(uint256 paymentId) external nonReentrant {
        Payment storage payment = payments[paymentId];
        if (msg.sender != payment.receiver) revert NotAuthorized();
        if (payment.status != Status.Pending) revert InvalidStatus();
        if (payment.pType != PaymentType.Timelocked) revert InvalidStatus();

        payment.status = Status.Refunded;
        _safeTransfer(payment.token, payment.sender, payment.amount);

        emit PaymentDeclined(paymentId, msg.sender);
        emit PaymentRefunded(paymentId);
    }

    function claimTimelockedPayment(uint256 paymentId) external nonReentrant {
        Payment storage payment = payments[paymentId];
        if (payment.pType != PaymentType.Timelocked) revert InvalidStatus();
        // Receiver can claim if Pending or Accepted
        if (payment.status != Status.Pending && payment.status != Status.Accepted) revert InvalidStatus();
        if (block.timestamp <= payment.deadline) revert DeadlineNotPassed();

        payment.status = Status.Resolved;
        _safeTransfer(payment.token, payment.receiver, payment.amount);
        
        emit PaymentResolved(paymentId);
    }

    function acceptBondedPayment(uint256 paymentId) external nonReentrant {
        Payment storage payment = payments[paymentId];
        if (msg.sender != payment.receiver) revert NotAuthorized();
        if (payment.status != Status.Pending) revert InvalidStatus();
        if (payment.pType != PaymentType.Bonded) revert InvalidStatus();

        payment.status = Status.Accepted;
        _safeTransferFrom(payment.token, msg.sender, address(this), payment.bondAmount);
        emit PaymentAccepted(paymentId, msg.sender);
    }

    function releasePayment(uint256 paymentId) external nonReentrant {
        Payment storage payment = payments[paymentId];
        if (msg.sender != payment.sender) revert NotAuthorized();
        if (payment.status == Status.Refunded || payment.status == Status.Resolved) revert InvalidStatus();

        payment.status = Status.Resolved;
        uint256 totalPayout = payment.amount + payment.bondAmount;
        _safeTransfer(payment.token, payment.receiver, totalPayout);
        
        emit PaymentResolved(paymentId);
    }

    function disputePayment(uint256 paymentId) external {
        Payment storage payment = payments[paymentId];
        if (msg.sender != payment.sender && msg.sender != payment.receiver) revert NotAuthorized();
        payment.status = Status.Disputed;
    }

    function resolveDispute(uint256 paymentId, address winner) external nonReentrant {
        Payment storage payment = payments[paymentId];
        if (msg.sender != payment.arbiter) revert NotAuthorized();
        if (payment.status != Status.Disputed) revert InvalidStatus();

        payment.status = Status.Resolved;
        uint256 totalPayout = payment.amount + payment.bondAmount;
        _safeTransfer(payment.token, winner, totalPayout);
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
            status: Status.Pending,
            receiverAccepted: false
        });

        paymentsByReceiver[receiver].push(id);
        _safeTransferFrom(token, msg.sender, address(this), amount);

        emit PaymentCreated(id, pType, msg.sender, receiver);
    }

    function _safeTransfer(address token, address to, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, amount));
        if (!success) {
            if (data.length > 0) {
                // bubble up revert reason
                assembly {
                    let returndata_size := mload(data)
                    revert(add(32, data), returndata_size)
                }
            } else {
                revert TokenTransferFailed();
            }
        }
        
        // Also check if return data (if present) is true
        if (data.length > 0 && !abi.decode(data, (bool))) {
            revert TokenTransferFailed();
        }
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount));
        if (!success) {
            if (data.length > 0) {
                // bubble up revert reason
                assembly {
                    let returndata_size := mload(data)
                    revert(add(32, data), returndata_size)
                }
            } else {
                revert TokenTransferFailed();
            }
        }
        
        // Also check if return data (if present) is true
        if (data.length > 0 && !abi.decode(data, (bool))) {
            revert TokenTransferFailed();
        }
    }

    function getPayment(uint256 paymentId) external view returns (Payment memory) {
        return payments[paymentId];
    }

    function getPaymentsForReceiver(address receiver) external view returns (uint256[] memory) {
        return paymentsByReceiver[receiver];
    }
}
