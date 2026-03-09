
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ConditionalPayments.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {
        _mint(msg.sender, 1000000 * 10 ** 6);
    }
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract RefactorTimelockTest is Test {
    ConditionalPayments public pay;
    MockUSDC public token;

    address sender = address(0x1);
    address receiver = address(0x2);

    function setUp() public {
        token = new MockUSDC();
        pay = new ConditionalPayments();
        
        token.mint(sender, 1000 ether);
        vm.prank(sender);
        token.approve(address(pay), 1000 ether);
    }

    function testtimelockrefactor_ReceiverClaimsAfterDeadline() public {
        uint256 amount = 100 ether;
        uint256 deadline = block.timestamp + 1 days;
        
        // 1. Sender creates Timelocked Payment
        vm.prank(sender);
        uint256 id = pay.createTimelockedPayment(receiver, address(token), amount, 0, keccak256("terms"), deadline);

        // 2. Receiver tries to claim BEFORE deadline (Should Fail)
        vm.prank(receiver);
        vm.expectRevert(ConditionalPayments.DeadlineNotPassed.selector);
        pay.claimTimelockedPayment(id);

        // 3. Warp to AFTER deadline
        vm.warp(deadline + 1);

        uint256 receiverPreBalance = token.balanceOf(receiver);

        // 4. Receiver claims AFTER deadline (Should PasS)
        vm.prank(receiver);
        pay.claimTimelockedPayment(id);

        uint256 receiverFinalBalance = token.balanceOf(receiver);

        // VERIFICATION: Receiver got the money
        assertEq(receiverFinalBalance, receiverPreBalance + amount, "Receiver should be able to claim after deadline");
        
        (,,,,,,,,,, ConditionalPayments.Status status,) = pay.payments(id);
        assertEq(uint(status), uint(ConditionalPayments.Status.Resolved), "Status should be Resolved");
    }
}
