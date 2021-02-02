//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "hardhat/console.sol";

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";


/**
 * BarrelHouse is the ERC1155 tokenFactory for new whiskey barrel listings.
 * 
 * General use is as follows:
 *   - WhiskeyPlatform contract can mint new tokens when distillery releases new barrel.
 *   - When tokens are redeemed for physical whiskey, tokens are then burned.
 *
 */

contract BarrelHouse is ERC1155, AccessControl {
    using Address for address;
    using Counters for Counters.Counter;


    // Role to allow minting and authorized transfers from whiskey treasuries.
    bytes32 public constant PLATFORM_ROLE = keccak256("PLATFORM_ROLE");

    // Incremental tokenID tracker
    Counters.Counter private tokenIdTracker;


    constructor () public ERC1155("tmpURI") {

        // Give the deploy account admin role privileges
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }


    // Add or remove platform role
    function authorizePlatform(address platformAddress, bool isAuthorized) public {
        if( isAuthorized == true ) {
            grantRole(PLATFORM_ROLE, platformAddress);
        } else {
            revokeRole(PLATFORM_ROLE, platformAddress);
        }
    }


    /**
     * @dev Creates new barrel tokens, and authorizes platform to transfer from creator if
     * purchased.
    */
    function mint(address treasury, uint16 bottles) public returns (uint256) {
        require(hasRole(PLATFORM_ROLE, _msgSender()), "PLATFORM_ROLE needed to mint new barrels.");

        uint256 currTokenId = tokenIdTracker.current();
        tokenIdTracker.increment();

        // NOW CREATE TOKENS.
        _mint(treasury, currTokenId, bottles, "0x0");
        
        return currTokenId;
    }

    /**
     * @dev Burns tokens after redeemed, or can burn if distillery wants to burn them.
     */
    function burn(address account, uint256 id, uint256 value) public {
        require(
            account == _msgSender() || isApprovedForAll(account, _msgSender()),
            "ERC1155: caller is not owner nor approved"
        );

        _burn(account, id, value);
    }
    
    function setUri(string memory newUri) public {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "Must be admin to change uri.");
        _setURI(newUri);
    }



}

