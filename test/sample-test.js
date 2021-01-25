const { expect } = require("chai");
const { ethers } = require("hardhat");


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


  it("Should authorize the owners address for future listing", async () => {
    expect(await whiskeyPlatform.isAuthorizedToMint(accounts[0].address)).to.equal(true);
  }); 
  
  it("Should be able to authorize account", async () => {
    expect(await whiskeyPlatform.isAuthorizedToMint(accounts[1].address)).to.equal(false);
    await whiskeyPlatform.connect(accounts[0]).authorizeDistillery(accounts[1].address);
    expect(await whiskeyPlatform.isAuthorizedToMint(accounts[1].address)).to.equal(true);

  });

  it("Should allow authorized accounts to create listing", async () => {
    const listingDetails = [
      3500, // start price
      5500, // end price
      500, // fees
      250, // total bottles
      2500, // buyback %

      0, // startTimestamp
      0 // endTimestamp
    ];

    await expect(whiskeyPlatform.connect(accounts[1]).createWhiskeyListing(...listingDetails)).to.be.reverted;

    await whiskeyPlatform.connect(accounts[0]).authorizeDistillery(accounts[1].address);

    await expect(whiskeyPlatform
      .connect(accounts[1])
      .createWhiskeyListing(...listingDetails))
      .to.emit(whiskeyPlatform, 'BarrelListing')
      .withArgs(0, 250, accounts[1].address);


  })

});
