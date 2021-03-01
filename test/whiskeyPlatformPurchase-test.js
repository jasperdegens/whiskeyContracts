const {
    expect
} = require("chai");
const {
    ethers
} = require("hardhat");


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
        10000000 // endTimestamp
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
        whiskeyPlatform = await WhiskeyPlatform.deploy(barrelHouse.address, barrelHouse.address);
        await whiskeyPlatform.deployed();

        // give platform PLATFORM_ROLE 
        await barrelHouse.connect(accounts[0]).authorizePlatform(whiskeyPlatform.address, true);

        await barrelHouse.connect(accounts[0]).setApprovalForAll(whiskeyPlatform.address, true);
    });


    it("Should not purchase if payment is not enough", async () => {
        const listingDetails = testListing;

        await whiskeyPlatform.connect(accounts[0]).createWhiskeyListing(...listingDetails)

        await whiskeyPlatform.connect(accounts[1]).purchaseBottles(0, 100, {
            value: ethers.constants.WeiPerEther.mul(2).div(10).toString()
        });
    })

    it("Should purchase if payment is enough", async () => {
        const listingDetails = [
            3500, // start price
            3500, // end price
            500, // fees
            250, // total bottles
            2500, // buyback %

            0, // startTimestamp
            1000000 // endTimestamp
        ];

        await whiskeyPlatform.connect(accounts[0]).createWhiskeyListing(...listingDetails)
        let numBottles = 10;
        let ethRate = 124477730884;
        let usdPrice = (listingDetails[0] + listingDetails[2]) * numBottles;
        let ethPrice = usdPrice * (10**(8 - 2)) / ethRate;
        console.log("Eth price: " + ethPrice.toString());
        let internalDecimals = 2;
        let chainlinkDecimals = 8;

        const usdToWei = ethers.constants.WeiPerEther.mul(10**(chainlinkDecimals - internalDecimals)).div(ethRate);
        const weiPayment = usdToWei.mul(usdPrice);
        console.log("wei react: " + weiPayment.toString());

        await expect(whiskeyPlatform.connect(accounts[1]).purchaseBottles(0, numBottles, {
            value: weiPayment.toString()
        })).to.not.be.reverted;

        // ensure bottles have transferred to new owner
        expect(await barrelHouse.balanceOf(accounts[1].address, 0)).to.equal(10);
    });


});