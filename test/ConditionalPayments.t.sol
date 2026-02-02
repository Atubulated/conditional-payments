// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ConditionalPayments.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {
        _mint(msg.sender, 1000000 * 10 ** 6);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract ConditionalPaymentsTest is Test {
    ConditionalPayments public payments;
    MockUSDC public usdc;

    address public sender = address(0x1);
    address public receiver = address(0x2);
    address public arbiter = address(0x3);
    address public stranger = address(0x4);

    uint256 constant PAYMENT_AMOUNT = 1000 * 10 ** 6;

    function setUp() public {
        payments = new ConditionalPayments();
        usdc = new MockUSDC();

        usdc.transfer(sender, 10000 * 10 ** 6);
        usdc.transfer(receiver, 1000 * 10 ** 6); // Receiver starts with 1,000

        vm.label(sender, "Sender");
        vm.label(receiver, "Receiver");
        vm.label(arbiter, "Arbiter");
        vm.label(address(payments), "Infra");
    }

    // ============ INFRASTRUCTURE TESTS ============

    function test_CreateMediatedPayment() public {
        vm.startPrank(sender);
        usdc.approve(address(payments), PAYMENT_AMOUNT);

        uint256 pId = payments.createMediatedPayment(
            receiver, arbiter, address(usdc), PAYMENT_AMOUNT, keccak256("Terms"), block.timestamp + 1 days
        );

        ConditionalPayments.Payment memory p = payments.getPayment(pId);
        assertEq(uint256(p.pType), uint256(ConditionalPayments.PaymentType.Mediated));
        assertEq(uint256(p.status), uint256(ConditionalPayments.Status.Pending));
        vm.stopPrank();
    }

    function test_HappyPath_Release() public {
        vm.startPrank(sender);
        usdc.approve(address(payments), PAYMENT_AMOUNT);
        uint256 pId = payments.createMediatedPayment(
            receiver, arbiter, address(usdc), PAYMENT_AMOUNT, keccak256("Work"), block.timestamp + 1 days
        );

        // Track the balance BEFORE the release
        uint256 balanceBefore = usdc.balanceOf(receiver);

        payments.releasePayment(pId);
        vm.stopPrank();

        // Check that balance increased by exactly the PAYMENT_AMOUNT
        assertEq(usdc.balanceOf(receiver), balanceBefore + PAYMENT_AMOUNT);
    }

    function test_DisputeAndResolve() public {
        vm.startPrank(sender);
        usdc.approve(address(payments), PAYMENT_AMOUNT);
        uint256 pId = payments.createMediatedPayment(
            receiver, arbiter, address(usdc), PAYMENT_AMOUNT, keccak256("Work"), block.timestamp + 1 days
        );
        vm.stopPrank();

        vm.prank(receiver);
        payments.disputePayment(pId);

        // Track the balance BEFORE resolution
        uint256 balanceBefore = usdc.balanceOf(receiver);

        vm.prank(arbiter);
        payments.resolveDispute(pId, receiver);

        // Check that balance increased by exactly the PAYMENT_AMOUNT
        assertEq(usdc.balanceOf(receiver), balanceBefore + PAYMENT_AMOUNT);
    }

    function test_Revert_When_StrangerResolves() public {
        vm.startPrank(sender);
        usdc.approve(address(payments), PAYMENT_AMOUNT);
        uint256 pId = payments.createMediatedPayment(
            receiver, arbiter, address(usdc), PAYMENT_AMOUNT, keccak256("Work"), block.timestamp + 1 days
        );
        vm.stopPrank();

        vm.prank(sender);
        payments.disputePayment(pId);

        vm.prank(stranger);
        vm.expectRevert();
        payments.resolveDispute(pId, receiver);
    }
}
