
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

contract RefactorBondedTest is Test {
    ConditionalPayments public pay;
    MockUSDC public token;

    address sender = address(0x1);
    address receiver = address(0x2);

    function setUp() public {
        token = new MockUSDC();
        pay = new ConditionalPayments();
        
        token.mint(sender, 1000 ether);
        token.mint(receiver, 1000 ether); // Receiver needs funds for bond
        
        vm.prank(sender);
        token.approve(address(pay), 1000 ether);
    }

    function testBondedRefactor_ReceiverPaysBond() public {
        uint256 amount = 100 ether;
        uint256 bond = 20 ether;
        
        // 1. Sender creates Bonded Payment
        vm.prank(sender);
        uint256 id = pay.createBondedPayment(receiver, address(token), amount, bond, keccak256("terms"), block.timestamp + 1 days);

        // 2. Receiver tries to accept WITHOUT approving bond (Should Fail)
        vm.prank(receiver);
        vm.expectRevert(); // SafeERC20 low-level revert or ERC20 insufficient allowance
        pay.acceptBondedPayment(id);

        // 3. Receiver approves bond
        vm.prank(receiver);
        token.approve(address(pay), bond);

        uint256 receiverPreBalance = token.balanceOf(receiver);

        // 4. Receiver accepts (Should Pass)
        vm.prank(receiver);
        pay.acceptBondedPayment(id);

        uint256 receiverPostBalance = token.balanceOf(receiver);

        // VERIFICATION: Bond was taken
        assertEq(receiverPostBalance, receiverPreBalance - bond, "Receiver should have paid bond");
        
        (,,,,,,,,,, ConditionalPayments.Status status,) = pay.payments(id);
        assertEq(uint(status), uint(ConditionalPayments.Status.Accepted), "Status should be Accepted");
    }
}
