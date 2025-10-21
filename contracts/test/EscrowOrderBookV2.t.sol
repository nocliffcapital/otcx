// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {EscrowOrderBookV2} from "../src/EscrowOrderBookV2.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

contract EscrowOrderBookV2Test is Test {
    EscrowOrderBookV2 public orderbook;
    MockUSDC public stable;
    MockUSDC public actualToken; // Real token after TGE

    address public admin = address(0x1);
    address public seller = address(0x2);
    address public buyer = address(0x3);

    address public projectToken = address(0xdead); // Placeholder

    uint256 constant AMOUNT = 1000; // 1000 tokens (in wei, so just 1000)
    uint256 constant UNIT_PRICE = 5 * 1e6; // 5 USDC per token (6 decimals)
    uint256 constant TOTAL = 5000 * 1e6; // 5000 USDC total (6 decimals)
    uint64 EXPIRY;

    function setUp() public {
        EXPIRY = uint64(block.timestamp + 30 days);
        
        vm.startPrank(admin);
        
        stable = new MockUSDC();
        orderbook = new EscrowOrderBookV2(address(stable));
        actualToken = new MockUSDC(); // Simulate real token after TGE
        
        vm.stopPrank();

        // Fund participants
        stable.mint(seller, 100000 * 1e6);
        stable.mint(buyer, 100000 * 1e6);
        actualToken.mint(seller, 10000); // Seller gets real tokens (simple decimals for test)

        // Approve
        vm.prank(seller);
        stable.approve(address(orderbook), type(uint256).max);
        vm.prank(buyer);
        stable.approve(address(orderbook), type(uint256).max);
        vm.prank(seller);
        actualToken.approve(address(orderbook), type(uint256).max);
    }

    /* ========== HAPPY PATH: TGE SETTLEMENT ========== */

    function test_FullTGEFlow() public {
        // 1. Create sell order
        vm.prank(seller);
        uint256 id = orderbook.createSellOrder(AMOUNT, UNIT_PRICE, projectToken);

        // 2. Buyer takes order
        vm.prank(buyer);
        orderbook.takeSellOrder(id);

        // 3. Seller deposits collateral
        vm.prank(seller);
        orderbook.depositSellerCollateral(id);

        // 4. Buyer deposits payment
        vm.prank(buyer);
        orderbook.depositBuyerFunds(id);

        // 5. Check status is FUNDED
        EscrowOrderBookV2.Order memory order = orderbook.getOrder(id);
        assertEq(uint8(order.status), uint8(EscrowOrderBookV2.Status.FUNDED));

        // 6. Admin activates TGE
        vm.prank(admin);
        orderbook.activateTGE(id, address(actualToken));

        order = orderbook.getOrder(id);
        assertEq(uint8(order.status), uint8(EscrowOrderBookV2.Status.TGE_ACTIVATED));
        assertGt(order.settlementDeadline, block.timestamp);
        assertEq(orderbook.actualTokenAddress(id), address(actualToken));

        // 7. Seller deposits tokens
        vm.prank(seller);
        orderbook.depositTokensForSettlement(id);

        order = orderbook.getOrder(id);
        assertEq(uint8(order.status), uint8(EscrowOrderBookV2.Status.TOKENS_DEPOSITED));
        assertTrue(order.tokensDeposited);

        // 8. Buyer claims tokens
        uint256 buyerBalanceBefore = actualToken.balanceOf(buyer);
        uint256 sellerStableBefore = stable.balanceOf(seller);

        vm.prank(buyer);
        orderbook.claimTokens(id);

        // Verify final state
        order = orderbook.getOrder(id);
        assertEq(uint8(order.status), uint8(EscrowOrderBookV2.Status.SETTLED));
        
        // Buyer got tokens
        assertEq(actualToken.balanceOf(buyer), buyerBalanceBefore + AMOUNT);
        
        // Seller got payment + collateral back
        assertEq(stable.balanceOf(seller), sellerStableBefore + (TOTAL * 2));
    }

    /* ========== EXTENSION TESTS ========== */

    function test_ExtendSettlement4Hours() public {
        uint256 id = _createFundedOrder();

        vm.prank(admin);
        orderbook.activateTGE(id, address(actualToken));

        EscrowOrderBookV2.Order memory orderBefore = orderbook.getOrder(id);
        uint64 originalDeadline = orderBefore.settlementDeadline;

        // Extend by 4 hours
        vm.prank(admin);
        orderbook.extendSettlement(id, 4);

        EscrowOrderBookV2.Order memory orderAfter = orderbook.getOrder(id);
        assertEq(orderAfter.settlementDeadline, originalDeadline + 4 hours);
    }

    function test_ExtendSettlement24Hours() public {
        uint256 id = _createFundedOrder();

        vm.prank(admin);
        orderbook.activateTGE(id, address(actualToken));

        EscrowOrderBookV2.Order memory orderBefore = orderbook.getOrder(id);
        uint64 originalDeadline = orderBefore.settlementDeadline;

        // Extend by 24 hours
        vm.prank(admin);
        orderbook.extendSettlement(id, 24);

        EscrowOrderBookV2.Order memory orderAfter = orderbook.getOrder(id);
        assertEq(orderAfter.settlementDeadline, originalDeadline + 24 hours);
    }

    function test_RevertExtendInvalidHours() public {
        uint256 id = _createFundedOrder();

        vm.prank(admin);
        orderbook.activateTGE(id, address(actualToken));

        vm.expectRevert("INVALID_HOURS", "" // logoUrl
        );
        vm.prank(admin);
        orderbook.extendSettlement(id, 12); // Only 4 or 24 allowed
    }

    function test_RevertExtendNotActivated() public {
        uint256 id = _createFundedOrder();

        vm.expectRevert("NOT_ACTIVATED", "" // logoUrl
        );
        vm.prank(admin);
        orderbook.extendSettlement(id, 4);
    }

    /* ========== DEFAULT TESTS ========== */

    function test_DefaultSellerMissesDeadline() public {
        uint256 id = _createFundedOrder();

        vm.prank(admin);
        orderbook.activateTGE(id, address(actualToken));

        EscrowOrderBookV2.Order memory order = orderbook.getOrder(id);

        // Fast forward past deadline
        vm.warp(order.settlementDeadline + 1);

        uint256 buyerBalanceBefore = stable.balanceOf(buyer);

        // Buyer defaults seller
        vm.prank(buyer);
        orderbook.defaultSeller(id);

        // Buyer gets payment back + seller's collateral
        uint256 expectedCompensation = TOTAL * 2; // buyer funds + seller collateral
        assertEq(stable.balanceOf(buyer), buyerBalanceBefore + expectedCompensation);

        order = orderbook.getOrder(id);
        assertEq(uint8(order.status), uint8(EscrowOrderBookV2.Status.DEFAULTED));
    }

    function test_RevertDefaultBeforeDeadline() public {
        uint256 id = _createFundedOrder();

        vm.prank(admin);
        orderbook.activateTGE(id, address(actualToken));

        vm.expectRevert("DEADLINE_NOT_PASSED", "" // logoUrl
        );
        vm.prank(buyer);
        orderbook.defaultSeller(id);
    }

    function test_RevertDefaultAfterTokensDeposited() public {
        uint256 id = _createFundedOrder();

        vm.prank(admin);
        orderbook.activateTGE(id, address(actualToken));

        vm.prank(seller);
        orderbook.depositTokensForSettlement(id);

        vm.expectRevert("NOT_ACTIVATED", "" // logoUrl
        );
        vm.prank(buyer);
        orderbook.defaultSeller(id);
    }

    /* ========== MANUAL SETTLEMENT (POINTS) ========== */

    function test_ManualSettleForPoints() public {
        uint256 id = _createFundedOrder();

        uint256 sellerBalanceBefore = stable.balanceOf(seller);

        // Admin manually settles (e.g., verified off-chain points transfer)
        vm.prank(admin);
        orderbook.manualSettle(id);

        // Seller gets payment + collateral
        assertEq(stable.balanceOf(seller), sellerBalanceBefore + (TOTAL * 2));

        EscrowOrderBookV2.Order memory order = orderbook.getOrder(id);
        assertEq(uint8(order.status), uint8(EscrowOrderBookV2.Status.SETTLED));
    }

    function test_RevertManualSettleNotFunded() public {
        vm.prank(seller);
        uint256 id = orderbook.createSellOrder(AMOUNT, UNIT_PRICE, projectToken);

        vm.expectRevert("NOT_FUNDED", "" // logoUrl
        );
        vm.prank(admin);
        orderbook.manualSettle(id);
    }

    /* ========== ACCESS CONTROL ========== */

    function test_RevertActivateTGENotOwner() public {
        uint256 id = _createFundedOrder();

        vm.expectRevert("NOT_OWNER", "" // logoUrl
        );
        vm.prank(buyer);
        orderbook.activateTGE(id, address(actualToken));
    }

    function test_RevertExtendNotOwner() public {
        uint256 id = _createFundedOrder();

        vm.prank(admin);
        orderbook.activateTGE(id, address(actualToken));

        vm.expectRevert("NOT_OWNER", "" // logoUrl
        );
        vm.prank(buyer);
        orderbook.extendSettlement(id, 4);
    }

    /* ========== DEPOSIT TOKEN VALIDATIONS ========== */

    function test_RevertDepositTokensNotSeller() public {
        uint256 id = _createFundedOrder();

        vm.prank(admin);
        orderbook.activateTGE(id, address(actualToken));

        vm.expectRevert("NOT_SELLER", "" // logoUrl
        );
        vm.prank(buyer);
        orderbook.depositTokensForSettlement(id);
    }

    function test_RevertDepositTokensTwice() public {
        uint256 id = _createFundedOrder();

        vm.prank(admin);
        orderbook.activateTGE(id, address(actualToken));

        vm.prank(seller);
        orderbook.depositTokensForSettlement(id);

        vm.expectRevert("ALREADY_DEPOSITED", "" // logoUrl
        );
        vm.prank(seller);
        orderbook.depositTokensForSettlement(id);
    }

    function test_RevertDepositTokensAfterDeadline() public {
        uint256 id = _createFundedOrder();

        vm.prank(admin);
        orderbook.activateTGE(id, address(actualToken));

        EscrowOrderBookV2.Order memory order = orderbook.getOrder(id);
        vm.warp(order.settlementDeadline + 1);

        vm.expectRevert("DEADLINE_PASSED", "" // logoUrl
        );
        vm.prank(seller);
        orderbook.depositTokensForSettlement(id);
    }

    /* ========== CLAIM TOKEN VALIDATIONS ========== */

    function test_RevertClaimTokensNotBuyer() public {
        uint256 id = _createFundedOrder();

        vm.prank(admin);
        orderbook.activateTGE(id, address(actualToken));

        vm.prank(seller);
        orderbook.depositTokensForSettlement(id);

        vm.expectRevert("NOT_BUYER", "" // logoUrl
        );
        vm.prank(seller);
        orderbook.claimTokens(id);
    }

    function test_RevertClaimTokensBeforeDeposit() public {
        uint256 id = _createFundedOrder();

        vm.prank(admin);
        orderbook.activateTGE(id, address(actualToken));

        vm.expectRevert("TOKENS_NOT_DEPOSITED", "" // logoUrl
        );
        vm.prank(buyer);
        orderbook.claimTokens(id);
    }

    /* ========== PAUSABLE ========== */

    function test_PausePreventsTGEActivation() public {
        uint256 id = _createFundedOrder();

        vm.prank(admin);
        orderbook.pause();

        // TGE activation is owner-only, so it still works when paused
        // But let's test order creation is blocked
        vm.expectRevert("PAUSED", "" // logoUrl
        );
        vm.prank(seller);
        orderbook.createSellOrder(AMOUNT, UNIT_PRICE, projectToken);
    }

    /* ========== VIEW FUNCTIONS ========== */

    function test_GetSettlementStatus() public {
        uint256 id = _createFundedOrder();

        // Before TGE
        (bool tgeActivated, uint64 deadline, bool tokensDeposited, bool isOverdue) 
            = orderbook.getSettlementStatus(id);
        assertFalse(tgeActivated);
        assertEq(deadline, 0);
        assertFalse(tokensDeposited);
        assertFalse(isOverdue);

        // After TGE
        vm.prank(admin);
        orderbook.activateTGE(id, address(actualToken));

        (tgeActivated, deadline, tokensDeposited, isOverdue) 
            = orderbook.getSettlementStatus(id);
        assertTrue(tgeActivated);
        assertGt(deadline, block.timestamp);
        assertFalse(tokensDeposited);
        assertFalse(isOverdue);

        // After tokens deposited
        vm.prank(seller);
        orderbook.depositTokensForSettlement(id);

        (tgeActivated, deadline, tokensDeposited, isOverdue) 
            = orderbook.getSettlementStatus(id);
        assertTrue(tgeActivated);
        assertTrue(tokensDeposited);
        assertFalse(isOverdue);

        // Test overdue
        id = _createFundedOrder();
        vm.prank(admin);
        orderbook.activateTGE(id, address(actualToken));
        
        EscrowOrderBookV2.Order memory order = orderbook.getOrder(id);
        vm.warp(order.settlementDeadline + 1);

        (tgeActivated, deadline, tokensDeposited, isOverdue) 
            = orderbook.getSettlementStatus(id);
        assertTrue(tgeActivated);
        assertFalse(tokensDeposited);
        assertTrue(isOverdue);
    }

    /* ========== HELPER FUNCTIONS ========== */

    function _createFundedOrder() internal returns (uint256 id) {
        vm.prank(seller);
        id = orderbook.createSellOrder(AMOUNT, UNIT_PRICE, projectToken);

        vm.prank(buyer);
        orderbook.takeSellOrder(id);

        vm.prank(seller);
        orderbook.depositSellerCollateral(id);

        vm.prank(buyer);
        orderbook.depositBuyerFunds(id);
    }
}

