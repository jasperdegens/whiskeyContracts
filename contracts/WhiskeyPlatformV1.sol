//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "hardhat/console.sol";

import "./BarrelHouse.sol";
import "./AggregatorV3Interface.sol";
import "./IWETHGateway.sol";

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155Holder.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract WhiskeyPlatformV1 is ERC1155Holder, Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using Address for address;

    // BarrelData stores data for a single whiskey release
    struct BarrelData {
        // ALL PRICES ARE IN USD DOWN TO 2 DECIMAL PLACES
        // Max price is 2^32 - 1 = $42949672.96
        uint32 startPriceUsd;
        uint32 endPriceUsd;
        uint32 feesPerBottleUsd;


        uint16 totalBottleSupply;

        // Percent is to 2 decimal places (3350 == 33.5%)
        uint16 buybackPercent;


        uint256 startTimestamp;
        uint256 endTimestamp;
    }

    BarrelHouse public barrelHouse;

    // Map from tokenId to it's barrelData
    mapping(uint256 => BarrelData) barrels;

    // Map token id to the distillery / treasury account
    mapping(uint256 => address) tokenTreasuries;

    // List of distilleries that can list barrels
    mapping(address => bool) authorizedDistilleries;

    // Tracks total fee deposits in wei and USD to calculate interest earned for each bottle
    uint256 public totalFeesDepositedInWei = 0;
    uint256 public totalFeesDepositedInUsd = 0;

    //Track amount spent by each customer
    mapping(address => uint256) amountSpentOnPlatformInUsd; 
    
    
    // Pricefeed aggregator from ChainLink
    AggregatorV3Interface internal priceFeed;

    // Aave WETHGateway for eth deposits
    IWETHGateway internal aaveWethGateway;


    uint8 constant INTERNAL_PRICE_DECIMALS = 2;

    constructor (address barrelHouseAddress, address wethGateway) public {
        
        barrelHouse = BarrelHouse(barrelHouseAddress); 
        approveDistillery(_msgSender());

        // AAVE WETHGateway KOVAN address
        aaveWethGateway = IWETHGateway(0xf8aC10E65F2073460aAD5f28E1EABE807DC287CF);
        
        // AAVE WETHGateway MAINNET address
        //aaveWethGateway = IWETHGateway(address(0xDcD33426BA191383f1c9B431A342498fdac73488));
        
        
        // authorize msgSender to be able to create barrel listing

        // Chainlink ETH/USD Kovan Address = 0x9326BFA02ADD2366b30bacB125260Af641031331
        priceFeed = AggregatorV3Interface(0x9326BFA02ADD2366b30bacB125260Af641031331);

        // Chainlink MAINNET ETH/USD price feed address
        //priceFeed = AggregatorV3Interface(address(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419));
    }


    // Check available bottles to purchase
    function availableBottles(uint256 tokenId) public view returns (uint256) {
        require(tokenTreasuries[tokenId] != address(0), "Token must have a valid treasury!");
        return barrelHouse.balanceOf(tokenTreasuries[tokenId], tokenId);
    }

    // Return the total number of bottles issued for a barrel
    function totalBottles(uint256 tokenId) public view returns (uint256) {
        return barrels[tokenId].totalBottleSupply;
    }

    function isApprovedToMint(address distilleryAddress) public view returns (bool) {
        return authorizedDistilleries[distilleryAddress];
    }

    // Returns price in USD to 2 decimal places, (i.e. 3550 = $35.50)
    function bottlePriceData(uint256 tokenId, uint256 targetDate) public view returns (uint32, uint32, uint32, uint32) {
        BarrelData storage barrel = barrels[tokenId];
        
        // calculate price based on linear appreciation
        // clamp date to avoid overflow
        uint256 startTimestamp = barrel.startTimestamp;
        uint256 endTimestamp = barrel.endTimestamp;
        uint256 clampedDate = Math.max(startTimestamp, Math.min(endTimestamp, targetDate));
        uint256 totalAgingDuration = endTimestamp - startTimestamp;
        uint256 elapsedDuration = clampedDate - startTimestamp;

        uint32 startPrice = barrel.startPriceUsd;
        uint32 endPrice = barrel.endPriceUsd;
        uint32 priceRange = endPrice - startPrice;
        uint32 additionalPrice = uint32(uint256(priceRange).mul(elapsedDuration).div(totalAgingDuration));

        uint32 currBottlePrice = barrel.startPriceUsd + additionalPrice;

        return (currBottlePrice, barrel.startPriceUsd, barrel.endPriceUsd, barrel.feesPerBottleUsd);
    }

    function currentBottlePrice(uint256 tokenId) public view returns(uint32, uint32, uint32, uint32) {
        return bottlePriceData(tokenId, block.timestamp);
    }

    function barrelMaturationData(uint256 tokenId) public view returns (uint256, uint256) {
        BarrelData storage barrel = barrels[tokenId];

        return (barrel.startTimestamp, barrel.endTimestamp);
    }

    function getInvetmentTotal(address buyer) public view returns (uint256) {
        return amountSpentOnPlatformInUsd[buyer];
    }

    /**** Distillery Functions *****/
    
    // Create a new barrel listing, will enable users to buy
    function createWhiskeyListing(
        uint32 startPriceUsd,
        uint32 endPriceUsd,
        uint32 feesPerBottleUsd,
        uint16 totalBottleSupply,
        uint16 buybackPercent,

        uint256 startTimestamp,
        uint256 endTimestamp
    )
        public
        returns (uint256)
    {
        // Ensure authorized to create listing
        require(isApprovedToMint(_msgSender()), "You are not authorized to create listing!");

        // Ensure that platform is approved operator for account
        require(barrelHouse.isApprovedForAll(
            _msgSender(),
            address(this)),
            "You must approve platform to sell bottles.");

        // ensure price does not devalue
        require(startPriceUsd <= endPriceUsd, "Price cannot devalue over time");

        // Mint tokens to create new tokenId from barrelHouse
        uint256 tokenId = barrelHouse.mint(_msgSender(), totalBottleSupply);

        uint16 clampedBuyback = buybackPercent > 10000 ? 10000 : buybackPercent;

        // set struct properties
        BarrelData storage barrel = barrels[tokenId];
        barrel.startPriceUsd = startPriceUsd;
        barrel.endPriceUsd = endPriceUsd;
        barrel.feesPerBottleUsd = feesPerBottleUsd;
        barrel.totalBottleSupply = totalBottleSupply;
        // ensure cannot buyback more than 100%
        barrel.buybackPercent = clampedBuyback;
        barrel.startTimestamp = startTimestamp;
        barrel.endTimestamp = endTimestamp;


        // set location of treasury and authorize platform to conduct sales
        tokenTreasuries[tokenId] = _msgSender();

        return tokenId;
    }



    /**** User Functions *****/
    function purchaseBottles(uint256 tokenId, uint16 quantity) public payable nonReentrant {
        require(_msgSender() != tokenTreasuries[tokenId], "Treasury cannot purchase bottles");
        
        // Ensure enough bottles to purchase
        uint256 remainingBottles = availableBottles(tokenId);
        require(remainingBottles >= quantity, "Not enough bottles available");

        
        (uint32 tokenPriceUsd, uint32 startPrice, uint32 endPrice, uint32 feePriceUsd) = bottlePriceData(tokenId, block.timestamp);
        uint256 paymentRequiredUSD = uint256(tokenPriceUsd + feePriceUsd).mul(quantity);

        // Ensure eth sent covers USD cost of bottles.
        uint256 usdToWei = usdToWeiExchangeRate();
        console.log('Eth to usd rate is: %s', uint256(usdToWei));

        console.log("Total Price USD: %s", paymentRequiredUSD);
        uint256 weiRequired = paymentRequiredUSD.mul(usdToWei);
        console.log("Wei cost is %s", weiRequired);

        console.log("Payment supplied: %s", msg.value);

        require(msg.value >= weiRequired, "Payment does not cover the price of bottles.");

        amountSpentOnPlatformInUsd[_msgSender()] += paymentRequiredUSD;

        // calculate fees total in wei
        uint256 feesInUsd = uint256(feePriceUsd).mul(quantity);
        uint256 feesInWei = feesInUsd.mul(usdToWei);
        //DepositFees(feesInWei, feesInUsd);


        // Transfer tokens to buyer from treasury
        barrelHouse.safeTransferFrom(
            tokenTreasuries[tokenId],
            _msgSender(),
            tokenId,
            quantity,
            "0x"
        );

        // Safe transfer payment to treasury account
        (bool success, ) = tokenTreasuries[tokenId].call{value: msg.value.sub(feesInWei)}("");
        require(success, "Transfer did not succceed.");
    }

    /**
     * @dev Redeem function allows user to trade in tokens for product. Product will either
     * be picked up or shipped.
     * Redeemed tokens will then be burnt, and the interest off of the fees will be transfered
     * to the redeeming user.
     * 
     * REQUIREMENTS: 
     *   - User must approve platform to transfer their whiskey tokens.
     */
    function redeem(uint256 tokenId, uint16 quantity) public {
        address treasury = tokenTreasuries[tokenId];
        require(_msgSender() != treasury, "Treasury cannot redeem bottles.");
        barrelHouse.burn(_msgSender(), tokenId, quantity);

        BarrelData storage barrel = barrels[tokenId];

        uint256 feesPaidUsd = quantity * barrel.feesPerBottleUsd;

        WithdrawFees(_msgSender(), tokenTreasuries[tokenId], feesPaidUsd);

    }



    /**** Platform Functions *****/

    // Authorize distillery to create listings
    function approveDistillery(address distilleryAddress) public onlyOwner {
        authorizedDistilleries[distilleryAddress] = true;
    }


    /****** Internal Functions ****/

    // Ensure transfered amount covers cost of 
    function usdToWeiExchangeRate() internal view returns (uint256) {
       
        // Use ChainLink Oracle for price feed for production
        (, int256 usdToEthRate, , , ) = priceFeed.latestRoundData();
        uint8 rateDecimals = priceFeed.decimals();

        // require(usdToEthRate > 0, "Cannot buy when rate is 0 or less.");
        console.log(uint(usdToEthRate));
        uint256 usdToWei = uint256(10 ** (rateDecimals - INTERNAL_PRICE_DECIMALS)).mul(1 ether).div(uint256(usdToEthRate));

        return usdToWei;
    }

    function DepositFees(uint256 feeAmountInWei, uint256 feeAmountInUsd) internal {
        // For now, deposit eth into Aave. However, if fee value is small, gas fees
        // will be very expensive, so maybe need to rethink...

        totalFeesDepositedInWei += feeAmountInWei;
        totalFeesDepositedInUsd += feeAmountInUsd;

        aaveWethGateway.depositETH{value: feeAmountInWei}(address(this), 0);
        
    }

    /**
     * @dev Calculate the share of fees that the distillery and redeemer are entitled to.
     * Redeemer is entitled to all interest off of fee pool, and distillery receives the 
     * remaining amount. All price fluctuations in ETH are split between distillery and redeemer.
     */
    function WithdrawFees(
        address redeemer,
        address distillery,
        uint256 feesPaidInUsd
    )
    internal nonReentrant {
        address aWETH = aaveWethGateway.getAWETHAddress();
        (bool success, bytes memory result) = (aWETH)
            .call(abi.encodeWithSignature("balanceOf(address)", address(this)));      
        require(success, "Error calling aWeth contract");


        uint256 feesWithInterest = toUint256(result, 0);
        console.log("Aave balance is: %s", feesWithInterest);
        
        // calculate wei representation of share of fee pool
        uint256 feeRatioInWei = feesPaidInUsd.mul(totalFeesDepositedInWei).div(totalFeesDepositedInUsd);
        // calculate interest earned ratio
        uint256 interestEarnedRatio = feesPaidInUsd.mul(feesWithInterest).div(totalFeesDepositedInUsd);


        uint256 eligableInterest = interestEarnedRatio - feeRatioInWei;

        console.log("Deposited fees: %s", feeRatioInWei);
        console.log("Interest earned: %s", interestEarnedRatio);
        console.log("Eligable interest: %s", eligableInterest);

        // Approve the WETHGateway
        aWETH.call(abi.encodeWithSignature("approve(address,uint256)", aaveWethGateway, interestEarnedRatio));
        aaveWethGateway.withdrawETH(interestEarnedRatio, address(this));        

        (bool distilleryFeePaidSuccess,) = distillery.call{value: feeRatioInWei}("");
        (bool redeemerInterestPaid,) = redeemer.call{value: eligableInterest}("");
        require(distilleryFeePaidSuccess && redeemerInterestPaid, "Error paying out fees.");

    }

    function toUint256(bytes memory _bytes, uint256 _start) internal pure returns (uint256) {
        require(_start + 32 >= _start, "toUint256_overflow");
        require(_bytes.length >= _start + 32, "toUint256_outOfBounds");
        uint256 tempUint;

        assembly {
            tempUint := mload(add(add(_bytes, 0x20), _start))
        }

        return tempUint;
    }

    // Fallback function
    receive() external payable {
    
    }

    

}

