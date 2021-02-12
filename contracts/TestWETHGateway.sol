// SPDX-License-Identifier: unlicensed
pragma solidity ^0.7.0;

import './IWETHGateway.sol';
import 'hardhat/console.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract TestWETHGateway is IWETHGateway, ERC20 { 

  constructor() ERC20("Test Aave", "aWETH") payable { }

  function depositETH(address onBehalfOf, uint16 referralCode) override external payable {
      console.log('Received: %s', msg.value);
      // mint equivalent amount to msg sender
      // simulate 10% interest
      uint256 interestSimulation = (msg.value * 11) / 10;
      _mint(msg.sender, msg.value);
  }

  function withdrawETH(uint256 amount, address onBehalfOf) override external {
      require(balanceOf(onBehalfOf) >= amount, "Not enough deposited funds");
      _burn(msg.sender, amount);
      onBehalfOf.call{value: amount}("");
  }

  function repayETH(
    uint256 amount,
    uint256 rateMode,
    address onBehalfOf
  ) override external payable {

  }

  function borrowETH(
    uint256 amount,
    uint256 interesRateMode,
    uint16 referralCode
  ) override external {

  }

  function getAWETHAddress() override external returns (address) {
      return address(this);
  }



}