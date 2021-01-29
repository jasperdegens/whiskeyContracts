//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "hardhat/console.sol";

import "./BarrelHouse.sol";
import "./AggregatorV3Interface.sol";

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155Holder.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract WhiskeyPlatformV1 is ERC1155Holder, Ownable {
    using SafeMath for uint256;
    using Address for address;

    // BarrelData stores data for a single whiskey release
    struct BarrelData {
        // ALL PRICES ARE IN USD DOWN TO 2 DECIMAL PLACES
        // Max price is 2^32 - 1 = $42949672.96
        uint32 startPriceUsd;
        uint32 endPriceUsd;
        uint32 feesPerBottleUsd;


        uint16 totalBottles;

        // Percent is to 2 decimal places (3350 == 33.5%)
        uint16 buybackPercent;


        uint256 startTimestamp;
        uint256 endTimestamp;
    }

    BarrelHouse public barrelHouse;

    // Mapping from tokenId to it's barrelData
    mapping(uint256 => BarrelData) barrels;

    // Map token id to the distillery / treasury account
    mapping(uint256 => address) tokenTreasuries;

    // List of distilleries that can list barrels
    mapping(address => bool) authorizedDistilleries;

    // Pricefeed aggregator from ChainLink
    AggregatorV3Interface internal priceFeed;

    uint8 constant INTERNAL_PRICE_DECIMALS = 2;


    constructor (address barrelHouseAddress) public {
        
        barrelHouse = BarrelHouse(barrelHouseAddress); 

        // authorize msgSender to be able to create barrel listing
        approveDistillery(_msgSender());

        // Chainlink ETH/USD Kovan Address = 0x9326BFA02ADD2366b30bacB125260Af641031331
        priceFeed = AggregatorV3Interface(0x9326BFA02ADD2366b30bacB125260Af641031331);


    }


    // Check available bottles to purchase
    function availableBottles(uint256 tokenId) public view returns (uint256) {
        require(tokenTreasuries[tokenId] != address(0), "Token must have a valid treasury!");
        return barrelHouse.balanceOf(tokenTreasuries[tokenId], tokenId);
    }

    // Return the total number of bottles issued for a barrel
    function totalBottles(uint256 tokenId) public view returns (uint256) {
        return barrels[tokenId].totalBottles;
    }

    function isApprovedToMint(address distilleryAddress) public view returns (bool) {
        return authorizedDistilleries[distilleryAddress];
    }

    // Returns price in USD to 2 decimal places, (i.e. 3550 = $35.50)
    function bottlePrice(uint256 tokenId, uint256 targetDate) public view returns (uint32, uint32) {
        BarrelData storage barrel = barrels[tokenId];
        
        // TODO: need to calculate price based on date provided
        
        return (barrel.startPriceUsd, barrel.feesPerBottleUsd);
    }



    /**** Distillery Functions *****/
    
    // Create a new barrel listing, will enable users to buy
    function createWhiskeyListing(
        uint32 startPriceUsd,
        uint32 endPriceUsd,
        uint32 feesPerBottleUsd,
        uint16 totalBottles,
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

        // Mint tokens to create new tokenId from barrelHouse
        uint256 tokenId = barrelHouse.mint(_msgSender(), totalBottles);

        // set struct properties
        BarrelData storage barrel = barrels[tokenId];
        barrel.startPriceUsd = startPriceUsd;
        barrel.endPriceUsd = endPriceUsd;
        barrel.feesPerBottleUsd = feesPerBottleUsd;
        barrel.totalBottles = totalBottles;
        barrel.buybackPercent = buybackPercent;
        barrel.startTimestamp = startTimestamp;
        barrel.endTimestamp = endTimestamp;


        // set location of treasury and authorize platform to conduct sales
        tokenTreasuries[tokenId] = _msgSender();

        return tokenId;
    }



    /**** User Functions *****/
    function purchaseBottles(uint256 tokenId, uint16 quantity) public payable {
        // Ensure enough bottles to purchase
        uint256 remainingBottles = availableBottles(tokenId);
        require(remainingBottles >= quantity, "Not enough bottles available");

        
        (uint32 tokenPriceUsd, uint32 feePriceUsd) = bottlePrice(tokenId, block.timestamp);
        uint256 paymentRequiredUSD = uint256(tokenPriceUsd + feePriceUsd).mul(quantity);

        // Ensure eth sent covers USD cost of bottles.

        // Local method
        int ethToUsdRate = 124477730884; // ROUND 36893488147419107460 data from KOVAN
        uint8 rateDecimals = 8;
       
        // Use ChainLink Oracle for price feed for production
        //(uint80 _, int256 ethToUsdRate, uint256 _, uint256 _, uint80 _) = priceFeed.latestRoundData();
        //uint8 decimals = priceFeed.decimals();

        require(ethToUsdRate > 0, "Cannot buy when rate is 0 or less.");


        console.log("Total Price USD: %s", paymentRequiredUSD);
        console.log("Total Price in ETH: %s", paymentRequiredUSD.mul( 10**(rateDecimals - INTERNAL_PRICE_DECIMALS)).div(uint256(ethToUsdRate)));

        uint256 weiRequired = paymentRequiredUSD.mul( uint256(1 ether).mul(10 ** (rateDecimals - INTERNAL_PRICE_DECIMALS)) ).div(uint256(ethToUsdRate));

        console.log("Payment supplied: %s", msg.value);
        console.log("Wei cost is %s", weiRequired);

        require(msg.value >= weiRequired, "Payment does not cover the price of bottles.");

        // Transfer tokens to buyer from treasury
        barrelHouse.safeTransferFrom(
            tokenTreasuries[tokenId],
            _msgSender(),
            tokenId,
            quantity,
            "0x"
        );

        // TODO: Transfer payment to treasury account
        


    }


    /**** Platform Functions *****/

    // Authorize distillery to create listings
    function approveDistillery(address distilleryAddress) public onlyOwner {
        authorizedDistilleries[distilleryAddress] = true;
    }
    

    /****** Internal Functions ****/

    // Ensure transfered amount covers cost of 


}

