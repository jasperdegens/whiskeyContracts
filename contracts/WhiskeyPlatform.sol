//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "hardhat/console.sol";

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155Holder.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract WhiskeyPlatform is ERC1155, ERC1155Holder, Ownable {
    using SafeMath for uint256;
    using Address for address;
    using Counters for Counters.Counter;

    // BarrelData stores data for a single whiskey release
    struct BarrelData {
        // ALL PRICES ARE IN USD DOWN TO 2 DECIMAL PLACES
        // Max price is 2^32 - 1 = $42949672.96
        uint32 startPrice;
        uint32 endPrice;
        uint32 feesPerBottle;
        uint16 totalBottles;
        uint16 buybackPercent;


        uint256 startTimestamp;
        uint256 endTimestamp;
    }

    // Mapping from tokenId to it's barrelData
    mapping(uint256 => BarrelData) barrels;

    // Map token id to the distillery / treasury account
    mapping(uint256 => address) tokenTreasuries;

    // List of distilleries that can list barrels
    mapping(address => bool) authorizedDistilleries;

    // TokenId Tracker
    Counters.Counter private nextTokenId;

    constructor () public ERC1155("tmpURI") {
        
        // authorize msgSender to be able to create barrel listing
        authorizeDistillery(_msgSender());
    }


    // Check available bottles to purchase
    function availableBottles(uint256 tokenId) public view returns (uint256) {
        require(tokenTreasuries[tokenId] != address(0), "Token must have a valid treasury!");
        return balanceOf(tokenTreasuries[tokenId], tokenId);
    }

    // Return the total number of bottles issued for a barrel
    function totalBottles(uint256 tokenId) public view returns (uint256) {
        return barrels[tokenId].totalBottles;
    }

    function isAuthorizedToMint(address distilleryAddress) public view returns (bool) {
        return authorizedDistilleries[_msgSender()];
    }



    /**** Distillery Functions *****/
    
    // Create a new barrel listing, will enable users to buy
    function createWhiskeyListing(
        uint32 startPrice,
        uint32 endPrice,
        uint32 feesPerBottle,
        uint16 totalBottles,
        uint16 buybackPercent,


        uint256 startTimestamp,
        uint256 endTimestamp
    )
        public
        returns (uint256)
    {
        // Ensure authorized to create listing
        require(isAuthorizedToMint(_msgSender()), "You are not authorized to create listing!");

        // token ID is the current counter value
        uint256 tokenId = nextTokenId.current();
        nextTokenId.increment();

        // set struct properties
        BarrelData storage barrel = barrels[tokenId];
        barrel.startPrice = startPrice;
        barrel.endPrice = endPrice;
        barrel.feesPerBottle = feesPerBottle;
        barrel.totalBottles = totalBottles;
        barrel.buybackPercent = buybackPercent;
        barrel.startTimestamp = startTimestamp;
        barrel.endTimestamp = endTimestamp;

        return tokenId;
    }



    /**** User Functions *****/



    /**** Platform Functions *****/

    // Authorize distillery to create listings
    function authorizeDistillery(address distilleryAddress) public onlyOwner {
        authorizedDistilleries[distilleryAddress] = true;
    }

    





}

