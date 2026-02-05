
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ConditionalPayments.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {
        _mint(msg.sender, 1000 * 10 ** 6);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract ReproductionTest is Test {
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

    function testTimelockedFlow() public {
        uint256 amount = 100 ether;
        bytes32 terms = keccak256("deal");
        
        // 1. Sender creates Timelocked Payment
        vm.prank(sender);
        uint256 id = pay.createTimelockedPayment(receiver, address(token), amount, 1 days, terms, block.timestamp + 7 days);

        uint256 receiverPreBalance = token.balanceOf(receiver);

        // 2. Receiver Accepts
        vm.prank(receiver);
        pay.acceptTimelockedPayment(id);

        uint256 receiverPostAcceptBalance = token.balanceOf(receiver);

        // VERIFICATION 1: Receiver did NOT get funds yet
        assertEq(receiverPostAcceptBalance, receiverPreBalance, "Funds should NOT move on accept");

        (,,,,,,,,,, ConditionalPayments.Status status,) = pay.payments(id);
        assertEq(uint(status), uint(ConditionalPayments.Status.Accepted), "Status should be Accepted");

        // 3. Sender Releases
        vm.prank(sender);
        pay.releasePayment(id);

        uint256 receiverFinalBalance = token.balanceOf(receiver);

        // VERIFICATION 2: Receiver gets funds ONLY after release
        assertEq(receiverFinalBalance, receiverPreBalance + amount, "Funds matches amount after release");
    }
}
