// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ConditionalPayments.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// This is a "Mock" token so we don't need real USDC for the test
contract MockToken is IERC20 {
    mapping(address => uint256) public override balanceOf;
    function transfer(address to, uint256 amount) external override returns (bool) { return true; }
    function transferFrom(address from, address to, uint256 amount) external override returns (bool) { return true; }
    function approve(address spender, uint256 amount) external override returns (bool) { return true; }
    function allowance(address owner, address spender) external override view returns (uint256) { return 1000 ether; }
    function totalSupply() external override view returns (uint256) { return 1000 ether; }
}

contract InfraTest is Test {
    ConditionalPayments public infra;
    MockToken public token;
    address public sender = address(1);
    address public receiver = address(2);
    address public arbiter = address(3);

    function setUp() public {
        infra = new ConditionalPayments();
        token = new MockToken();
    }

    function testMediatedFlow() public {
        vm.startPrank(sender);
        bytes32 terms = keccak256("Work");
        
        // 1. Create
        uint256 pId = infra.createMediatedPayment(receiver, arbiter, address(token), 100, terms, block.timestamp + 1 days);
        
        // 2. Dispute
        infra.disputePayment(pId);
        vm.stopPrank();

        // 3. Resolve (by Arbiter)
        vm.prank(arbiter);
        infra.resolveDispute(pId, receiver);
        
        // Check if status is Resolved
        (,,,,,,,,,, ConditionalPayments.Status status) = infra.payments(pId);
        assertEq(uint(status), uint(ConditionalPayments.Status.Resolved));
    }
}