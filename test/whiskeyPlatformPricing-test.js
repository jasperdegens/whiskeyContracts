const {
    expect
} = require("chai");
const {
    ethers
} = require("hardhat");

function dateToUnix(date) {
    return Math.floor(date.getTime() / 1000);
}


describe("Pricing contract tests", () => {

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



    it("Should calculate correct start, end, middle prices.", async () => {
        const startTimestamp = dateToUnix(new Date());
        const endTimestamp = dateToUnix(new Date(2025, 1, 1));

        testListing[5] = startTimestamp;
        testListing[6] = endTimestamp;

        await whiskeyPlatform.createWhiskeyListing(...testListing);

        expect((await whiskeyPlatform.bottlePrice(0, startTimestamp))[0]).to.equal(testListing[0]);
        expect((await whiskeyPlatform.bottlePrice(0, endTimestamp))[0]).to.equal(testListing[1]);

        for(let i = 0; i < 10; i++) {
            const date = new Date(2018 + i, i + 1, i + 5);
            const midTimestamp = dateToUnix(date);
            let expectedPrice = testListing[0] +
                (midTimestamp - startTimestamp) * (testListing[1] - testListing[0]) /  (endTimestamp - startTimestamp);
            expectedPrice = Math.max(testListing[0], Math.min(testListing[1], expectedPrice));
            console.log(`${date} -- ${(expectedPrice / 100).toFixed(2)}`);
    
            // test if accurate to at least 1c
            expect((await whiskeyPlatform.bottlePrice(0, midTimestamp))[0] - expectedPrice).to.be.lessThan(1);

        }


    })

});