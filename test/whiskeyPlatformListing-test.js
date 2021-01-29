const { expect } = require("chai");
const { ethers } = require("hardhat");

const zeroAddress = '0x0000000000000000000000000000000000000000';

describe(("Whiskey Platform Listings"), function() {

  let WhiskeyPlatform;
  let whiskeyPlatform;
  let BarrelHouse;
  let barrelHouse;
  let accounts;

  before(async () => {
    accounts = await ethers.getSigners();
    WhiskeyPlatform = await ethers.getContractFactory("WhiskeyPlatformV1");
    BarrelHouse = await ethers.getContractFactory("BarrelHouse");
  });

  // initialize a new contract before each test
  beforeEach(async () => {
    barrelHouse = await BarrelHouse.deploy();
    await barrelHouse.deployed();
    whiskeyPlatform = await WhiskeyPlatform.deploy(barrelHouse.address);
    await whiskeyPlatform.deployed();

    // give platform PLATFORM_ROLE 
    await barrelHouse.connect(accounts[0]).authorizePlatform(whiskeyPlatform.address, true);
  });


  it("Should authorize the owners address for future listing", async () => {
    expect(await whiskeyPlatform.isApprovedToMint(accounts[0].address)).to.equal(true);
  }); 
  


  it("Should be able to authorize account", async () => {
    expect(await whiskeyPlatform.isApprovedToMint(accounts[1].address)).to.equal(false);
    await whiskeyPlatform.connect(accounts[0]).approveDistillery(accounts[1].address);
    expect(await whiskeyPlatform.isApprovedToMint(accounts[1].address)).to.equal(true);

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

    await whiskeyPlatform.connect(accounts[0]).approveDistillery(accounts[1].address);
    await barrelHouse.connect(accounts[1]).setApprovalForAll(whiskeyPlatform.address, true);
    const trx = await whiskeyPlatform
    .connect(accounts[1])
    .createWhiskeyListing(...listingDetails);

    await expect(trx)
      .to.emit(barrelHouse, 'TransferSingle')
      .withArgs(
        whiskeyPlatform.address,
        zeroAddress,
        accounts[1].address,
        0,
        250);
  });

  it("Should correctly query barrel data", async () => {
    const listingDetails = [
      3500, // start price
      5500, // end price
      500, // fees
      250, // total bottles
      2500, // buyback %

      0, // startTimestamp
      0 // endTimestamp
    ];

    await barrelHouse.setApprovalForAll(whiskeyPlatform.address, true);
    expect((await whiskeyPlatform.createWhiskeyListing(...listingDetails)).value).to.equal(0);

    expect(await whiskeyPlatform.totalBottles(0)).to.equal(250);
    expect(await whiskeyPlatform.availableBottles(0)).to.equal(250);

  });

  it("Should correctly calculate price for whiskey", async () => {
    const listingDetails = [
      3500, // start price
      5500, // end price
      500, // fees
      250, // total bottles
      2500, // buyback %

      0, // startTimestamp
      0 // endTimestamp
    ];

    await barrelHouse.setApprovalForAll(whiskeyPlatform.address, true);

    for (var i = 0; i < 5; i++) {
      const startPrice = 3500 + 500 * i;
      listingDetails[0] = startPrice;
      let trx = await whiskeyPlatform.createWhiskeyListing(...listingDetails);
      let logs = await trx.wait();
      await expect(trx).to.emit(barrelHouse, "TransferSingle")
        .withArgs(whiskeyPlatform.address, zeroAddress, accounts[0].address, i, 250);
      expect(await whiskeyPlatform.bottlePrice(i, 0)).to.eql([startPrice, 500]);

    }
  });

});
