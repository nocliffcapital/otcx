// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";

/// Minimal Ownable, Pausable, ReentrancyGuard to avoid external deps
abstract contract Ownable {
    address public owner;
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    constructor() { owner = msg.sender; emit OwnershipTransferred(address(0), msg.sender); }
    modifier onlyOwner() { require(msg.sender == owner, "NOT_OWNER"); _; }
    function transferOwnership(address newOwner) external onlyOwner { require(newOwner != address(0), "ZERO"); emit OwnershipTransferred(owner, newOwner); owner = newOwner; }
}

abstract contract Pausable is Ownable {
    bool public paused;
    event Paused(address indexed account);
    event Unpaused(address indexed account);
    modifier whenNotPaused() { require(!paused, "PAUSED"); _; }
    function pause() external onlyOwner { paused = true; emit Paused(msg.sender); }
    function unpause() external onlyOwner { paused = false; emit Unpaused(msg.sender); }
}

abstract contract ReentrancyGuard { uint256 private locked = 1; modifier nonReentrant(){ require(locked==1, "REENTRANCY"); locked=2; _; locked=1; } }

contract EscrowOrderBook is Pausable, ReentrancyGuard {
    enum Status { OPEN, FILLED, CANCELED, EXPIRED }

    struct Order {
        uint256 id;
        address maker;
        address buyer;
        address seller;
        address stable;
        address projectToken;
        uint256 amount;
        uint256 unitPrice; // in stable decimals
        bool isSell; // maker sells project asset, buyer on other side
        uint256 buyerFunds; // locked stable from buyer
        uint256 sellerCollateral; // locked stable from seller
        uint64 expiry; // unix seconds
        Status status;
    }

    IERC20 public immutable stable;
    uint8 public immutable stableDecimals;

    uint256 public nextId = 1;
    mapping(uint256 => Order) public orders;

    // events
    event OrderCreated(uint256 indexed id, address indexed maker, bool isSell, address projectToken, uint256 amount, uint256 unitPrice, uint64 expiry);
    event OrderFilled(uint256 indexed id, address seller, address buyer, uint256 totalPaid);
    event OrderCanceled(uint256 indexed id);
    event DefaultedToBuyer(uint256 indexed id, uint256 collateral);
    event DefaultedToSeller(uint256 indexed id, uint256 funds);

    constructor(address stableToken) {
        require(stableToken != address(0), "STABLE_ZERO");
        stable = IERC20(stableToken);
        stableDecimals = IERC20(stableToken).decimals();
    }

    function _total(uint256 amount, uint256 unitPrice) internal pure returns (uint256) {
        return amount * unitPrice;
    }

    function _validate(uint256 amount, uint256 unitPrice, uint64 expiry) internal view {
        require(amount > 0, "AMOUNT");
        require(unitPrice > 0, "PRICE");
        require(expiry > block.timestamp + 10 minutes, "EXPIRY");
    }

    function createSellOrder(uint256 amount, uint256 unitPrice, address projectToken, uint64 expiry)
        external whenNotPaused returns (uint256 id)
    {
        _validate(amount, unitPrice, expiry);
        id = nextId++;
        Order storage o = orders[id];
        o.id = id;
        o.maker = msg.sender;
        o.isSell = true;
        o.projectToken = projectToken;
        o.amount = amount;
        o.unitPrice = unitPrice;
        o.seller = msg.sender;
        o.expiry = expiry;
        o.stable = address(stable);
        o.status = Status.OPEN;
        emit OrderCreated(id, msg.sender, true, projectToken, amount, unitPrice, expiry);
    }

    function createBuyOrder(uint256 amount, uint256 unitPrice, address projectToken, uint64 expiry)
        external whenNotPaused returns (uint256 id)
    {
        _validate(amount, unitPrice, expiry);
        id = nextId++;
        Order storage o = orders[id];
        o.id = id;
        o.maker = msg.sender;
        o.isSell = false;
        o.projectToken = projectToken;
        o.amount = amount;
        o.unitPrice = unitPrice;
        o.buyer = msg.sender;
        o.expiry = expiry;
        o.stable = address(stable);
        o.status = Status.OPEN;
        emit OrderCreated(id, msg.sender, false, projectToken, amount, unitPrice, expiry);
    }

    function depositSellerCollateral(uint256 id) external whenNotPaused nonReentrant {
        Order storage o = orders[id];
        require(o.status == Status.OPEN, "STATUS");
        require(o.sellerCollateral == 0, "ALREADY");
        if (o.isSell) {
            require(msg.sender == o.maker, "ONLY_SELLER");
        } else {
            if (o.seller == address(0)) o.seller = msg.sender; else require(msg.sender == o.seller, "SELLER_SET");
        }
        uint256 totalAmt = _total(o.amount, o.unitPrice);
        require(stable.transferFrom(msg.sender, address(this), totalAmt), "TRANSFER");
        o.sellerCollateral = totalAmt;
    }

    function depositBuyerFunds(uint256 id) external whenNotPaused nonReentrant {
        Order storage o = orders[id];
        require(o.status == Status.OPEN, "STATUS");
        require(o.buyerFunds == 0, "ALREADY");
        if (!o.isSell) {
            require(msg.sender == o.maker, "ONLY_BUYER");
        } else {
            if (o.buyer == address(0)) o.buyer = msg.sender; else require(msg.sender == o.buyer, "BUYER_SET");
        }
        uint256 totalAmt = _total(o.amount, o.unitPrice);
        require(stable.transferFrom(msg.sender, address(this), totalAmt), "TRANSFER");
        o.buyerFunds = totalAmt;
    }

    function markFilled(uint256 id, address beneficiarySeller) external whenNotPaused nonReentrant {
        Order storage o = orders[id];
        require(o.status == Status.OPEN, "STATUS");
        require(o.buyerFunds > 0 && o.sellerCollateral > 0, "LOCKS");
        uint256 totalAmt = _total(o.amount, o.unitPrice);
        o.status = Status.FILLED;
        address sellerPayee = beneficiarySeller == address(0) ? o.seller : beneficiarySeller;
        require(stable.transfer(sellerPayee, totalAmt), "PAY_SELLER");
        require(stable.transfer(o.seller, totalAmt), "RETURN_COLL");
        emit OrderFilled(id, o.seller, o.buyer, totalAmt);
    }

    function cancel(uint256 id) external whenNotPaused nonReentrant {
        Order storage o = orders[id];
        require(o.status == Status.OPEN, "STATUS");
        require(o.maker == msg.sender, "MAKER");
        if (o.isSell) {
            require(o.buyerFunds == 0, "COUNTER_LOCK");
            if (o.sellerCollateral > 0) {
                o.status = Status.CANCELED;
                uint256 amt = o.sellerCollateral; o.sellerCollateral = 0;
                require(stable.transfer(o.seller, amt), "REFUND");
            } else {
                o.status = Status.CANCELED;
            }
        } else {
            require(o.sellerCollateral == 0, "COUNTER_LOCK");
            if (o.buyerFunds > 0) {
                o.status = Status.CANCELED;
                uint256 amt2 = o.buyerFunds; o.buyerFunds = 0;
                require(stable.transfer(o.buyer, amt2), "REFUND2");
            } else {
                o.status = Status.CANCELED;
            }
        }
        emit OrderCanceled(id);
    }

    function defaultBuyer(uint256 id) external whenNotPaused nonReentrant {
        Order storage o = orders[id];
        require(o.status == Status.OPEN, "STATUS");
        require(block.timestamp > o.expiry, "NOT_EXPIRED");
        require(o.sellerCollateral > 0 && o.buyerFunds == 0, "COND");
        o.status = Status.EXPIRED;
        uint256 amt = o.sellerCollateral; o.sellerCollateral = 0;
        require(stable.transfer(o.buyer == address(0) ? o.maker : o.buyer, amt), "PAY_BUYER");
        emit DefaultedToBuyer(id, amt);
    }

    function defaultSeller(uint256 id) external whenNotPaused nonReentrant {
        Order storage o = orders[id];
        require(o.status == Status.OPEN, "STATUS");
        require(block.timestamp > o.expiry, "NOT_EXPIRED");
        require(o.buyerFunds > 0 && o.sellerCollateral == 0, "COND");
        o.status = Status.EXPIRED;
        uint256 amt = o.buyerFunds; o.buyerFunds = 0;
        require(stable.transfer(o.seller == address(0) ? o.maker : o.seller, amt), "PAY_SELLER");
        emit DefaultedToSeller(id, amt);
    }
}

