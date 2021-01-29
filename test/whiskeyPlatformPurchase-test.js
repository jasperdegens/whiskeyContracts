const {
    expect
} = require("chai");
const {
    ethers
} = require("hardhat");

const zeroAddress = '0x0000000000000000000000000000000000000000';

describe(("Whiskey Platform Purchases"), function () {

    let WhiskeyPlatform;
    let whiskeyPlatform;
    let BarrelHouse;
    let barrelHouse;
    let accounts;

    const testListing =  [
        3500, // start price
        5500, // end price
        500, // fees
        250, // total bottles
        2500, // buyback %

        0, // startTimestamp
        0 // endTimestamp
    ];
  
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

        await barrelHouse.connect(accounts[0]).setApprovalForAll(whiskeyPlatform.address, true);
    });


    it("Should not purchase if payment is not enough", async () => {
        const listingDetails = testListing;

        await whiskeyPlatform.connect(accounts[0]).createWhiskeyListing(...listingDetails)

        await expect(whiskeyPlatform.connect(accounts[1]).purchaseBottles(0, 100, {
            value: ethers.constants.WeiPerEther.mul(2).div(10).toString()
        })).to.be.reverted;
    })

    it("Should purchase if payment is enough", async () => {
        const listingDetails = [
            3500, // start price
            5500, // end price
            500, // fees
            250, // total bottles
            2500, // buyback %

            0, // startTimestamp
            0 // endTimestamp
        ];

        await whiskeyPlatform.connect(accounts[0]).createWhiskeyListing(...listingDetails)

        await expect(whiskeyPlatform.connect(accounts[1]).purchaseBottles(0, 100, {
            value: ethers.constants.WeiPerEther.mul(33).div(10).toString()
        })).to.not.be.reverted;

        // ensure bottles have transferred to new owner
        expect(await barrelHouse.balanceOf(accounts[1].address, 0)).to.equal(100);
    });


});