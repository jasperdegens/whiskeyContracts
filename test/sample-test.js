const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Greeter", function() {
  it("Should return the new greeting once it's changed", async function() {
    const Greeter = await ethers.getContractFactory("Greeter");
    const greeter = await Greeter.deploy("Hello, world!");
    
    await greeter.deployed();
    expect(await greeter.greet()).to.equal("Hello, world!");

    await greeter.setGreeting("Hola, mundo!");
    expect(await greeter.greet()).to.equal("Hola, mundo!");
  });
});



describe(("Whiskey Platform"), function() {

  let whiskeyPlatform;
  let accounts;

  before(async () => {
    accounts = await ethers.getSigners();
  });

  // initialize a new contract before each test
  beforeEach(async () => {
    const WhiskeyPlatform = await ethers.getContractFactory("WhiskeyPlatform");
    whiskeyPlatform = await WhiskeyPlatform.deploy();
    await whiskeyPlatform.deployed();
  });


  it("Should authorize the owners address to create a listing", async () => {
    expect(await whiskeyPlatform.isAuthorizedToMint(accounts[0].address)).to.equal(true);
  }); 

});
