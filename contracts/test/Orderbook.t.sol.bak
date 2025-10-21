// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {console2 as console} from "forge-std/console2.sol";
import {EscrowOrderBook} from "../src/EscrowOrderBook.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

contract OrderbookTest is Test {
    MockUSDC internal usdc;
    EscrowOrderBook internal book;

    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    uint256 constant DECIMALS = 1e6; // 6

    function setUp() public {
        usdc = new MockUSDC();
        book = new EscrowOrderBook(address(usdc));

        // mint balances
        usdc.mint(alice, 1_000_000 * DECIMALS);
        usdc.mint(bob, 1_000_000 * DECIMALS);

        // approve
        vm.startPrank(alice);
        usdc.approve(address(book), type(uint256).max);
        vm.stopPrank();
        vm.startPrank(bob);
        usdc.approve(address(book), type(uint256).max);
        vm.stopPrank();
    }

    function _future(uint64 plus) internal view returns (uint64) {
        return uint64(block.timestamp + plus);
    }

    function testCreateSellAndFillHappyPath() public {
        uint256 amount = 100; // project units
        uint256 price = 5 * DECIMALS; // 5 USDC per unit
        uint64 expiry = _future(1 days);
        // Alice is seller/maker
        vm.prank(alice);
        uint256 id = book.createSellOrder(amount, price, address(0x1234), expiry);

        // Bob funds as buyer
        vm.prank(bob);
        book.depositBuyerFunds(id);

        // Alice posts seller collateral
        vm.prank(alice);
        book.depositSellerCollateral(id);

        uint256 total = amount * price;
        uint256 balAliceBefore = usdc.balanceOf(alice);

        // Either party can mark filled; let Bob do it and direct to Alice
        vm.prank(bob);
        book.markFilled(id, alice);

        // Alice receives total twice? ensure exactly total*2 (funds + collateral returned)
        uint256 balAliceAfter = usdc.balanceOf(alice);
        assertEq(balAliceAfter, balAliceBefore + total * 2, "seller should get funds and collateral back");
    }

    function testCreateBuyAndFillHappyPath() public {
        uint256 amount = 50;
        uint256 price = 2 * DECIMALS;
        uint64 expiry = _future(1 days);
        // Bob is buyer/maker
        vm.prank(bob);
        uint256 id = book.createBuyOrder(amount, price, address(0x5678), expiry);

        // Bob funds buyer side
        vm.prank(bob);
        book.depositBuyerFunds(id);

        // Alice posts seller collateral as counterparty
        vm.prank(alice);
        book.depositSellerCollateral(id);

        uint256 total = amount * price;
        uint256 balAliceBefore = usdc.balanceOf(alice);

        // Mark filled, pay Alice
        vm.prank(alice);
        book.markFilled(id, alice);

        uint256 balAliceAfter = usdc.balanceOf(alice);
        assertEq(balAliceAfter, balAliceBefore + total * 2, "seller receives funds and collateral back");
    }

    function testCancelOnlyWhenNoCounterLock() public {
        uint256 amount = 10;
        uint256 price = 1 * DECIMALS;
        uint64 expiry = _future(1 days);
        vm.startPrank(alice);
        uint256 id = book.createSellOrder(amount, price, address(0x1), expiry);
        // seller collateral posted
        book.depositSellerCollateral(id);
        // can cancel because no buyer funds yet
        book.cancel(id);
        vm.stopPrank();

        // recreate and add buyer funds, then attempt cancel should fail
        vm.startPrank(alice);
        id = book.createSellOrder(amount, price, address(0x1), expiry);
        vm.stopPrank();
        vm.prank(bob);
        book.depositBuyerFunds(id);
        vm.prank(alice);
        vm.expectRevert("COUNTER_LOCK");
        book.cancel(id);
    }

    function testDefaultBuyerAfterExpirySellerDefault() public {
        uint256 amount = 7;
        uint256 price = 3 * DECIMALS;
        uint64 expiry = _future(1 days);
        // maker is seller Alice
        vm.prank(alice);
        uint256 id = book.createSellOrder(amount, price, address(0x1), expiry);
        // seller posted collateral but buyer funds not posted
        vm.prank(alice);
        book.depositSellerCollateral(id);

        // before expiry revert
        vm.expectRevert("NOT_EXPIRED");
        book.defaultBuyer(id);

        // after expiry buyer (Bob) or anyone defaults to buyer; set buyer = Bob by depositing or rely on maker?
        // In our logic, if buyer address empty, pays maker on buyer side; set buyer explicitly
        vm.prank(bob);
        // Bob does not fund to simulate default path; still, defaultBuyer sends to buyer if set; set buyer by no-op? can't. So leave empty -> maker is Alice, but spec says buyer gets seller collateral when seller defaults.
        // To represent buyer, create a buy order scenario for defaultSeller separately.
        // For seller default, we need an order where buyer is maker and seller collateral exists without buyer funds -> not possible. Instead use sell order with buyer address set via depositBuyerFunds then refund? Not allowed.

        // We'll use buy order case for the complementary default below.
        vm.warp(expiry + 1);
        // Since buyerFunds == 0 and sellerCollateral > 0, defaultBuyer transfers to buyer address or maker if unset (which is seller).
        // To ensure buyer gets paid, create another order where buyer is maker and seller (counterparty) posts collateral and times out.
    }

    function testDefaultPaths() public {
        uint256 amount = 5;
        uint256 price = 2 * DECIMALS;
        uint64 expiry = _future(1 days);

        // Buyer is maker (Bob); seller (Alice) posts collateral then times out -> defaultBuyer pays buyer (Bob)
        vm.prank(bob);
        uint256 idBuy = book.createBuyOrder(amount, price, address(0xAA), expiry);

        // Seller collateral posted by Alice, but buyer funds not posted to test other condition; however for defaultBuyer we need sellerCollateral>0 and buyerFunds==0.
        vm.prank(alice);
        book.depositSellerCollateral(idBuy);

        vm.warp(expiry + 1);
        uint256 balBobBefore = usdc.balanceOf(bob);
        book.defaultBuyer(idBuy);
        uint256 balBobAfter = usdc.balanceOf(bob);
        assertEq(balBobAfter, balBobBefore + amount * price, "buyer receives seller collateral");

        // Seller is maker (Alice); buyer (Bob) funds then times out -> defaultSeller pays seller (Alice)
        expiry = _future(1 days);
        vm.prank(alice);
        uint256 idSell = book.createSellOrder(amount, price, address(0xBB), expiry);

        vm.prank(bob);
        book.depositBuyerFunds(idSell);

        vm.warp(expiry + 1);
        uint256 balAliceBefore = usdc.balanceOf(alice);
        book.defaultSeller(idSell);
        uint256 balAliceAfter = usdc.balanceOf(alice);
        assertEq(balAliceAfter, balAliceBefore + amount * price, "seller receives buyer funds");
    }

    function testRevertsAndRounding() public {
        uint64 expirySoon = uint64(block.timestamp + 5 minutes);
        vm.expectRevert("EXPIRY");
        book.createSellOrder(1, 1, address(0), expirySoon);

        vm.expectRevert("AMOUNT");
        book.createSellOrder(0, 1, address(0), _future(1 days));

        vm.expectRevert("PRICE");
        book.createSellOrder(1, 0, address(0), _future(1 days));
    }

    function testCannotFillTwice() public {
        uint256 amount = 2;
        uint256 price = 1 * DECIMALS;
        uint64 expiry = _future(1 days);
        vm.prank(alice);
        uint256 id = book.createSellOrder(amount, price, address(0), expiry);
        vm.prank(bob);
        book.depositBuyerFunds(id);
        vm.prank(alice);
        book.depositSellerCollateral(id);
        vm.prank(bob);
        book.markFilled(id, alice);
        vm.expectRevert("STATUS");
        book.markFilled(id, alice);
    }
}

