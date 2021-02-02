// SPDX-License-Identifier: unlicensed
pragma solidity ^0.7.0;

import './IWETHGateway.sol';
import 'hardhat/console.sol';

contract TestWETHGateway is IWETHGateway { 

  function depositETH(address onBehalfOf, uint16 referralCode) override external payable {
      console.log('Received: %s', msg.value);
  }

  function withdrawETH(uint256 amount, address onBehalfOf) override external {
      console.log('Sending back: %s', address(this).balance);
      onBehalfOf.call{value: (address(this).balance)}("");
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


}