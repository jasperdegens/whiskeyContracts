
const hre = require("hardhat");

let whiskeyPlatform;
let barrelHouse;

async function main() {

    WhiskeyPlatform = await hre.ethers.getContractFactory("WhiskeyPlatformV1");
    BarrelHouse = await hre.ethers.getContractFactory("BarrelHouse");
    
    barrelHouse = await BarrelHouse.deploy();
    await barrelHouse.deployed();
    whiskeyPlatform = await WhiskeyPlatform.deploy(barrelHouse.address);
    await whiskeyPlatform.deployed();
    await barrelHouse.authorizePlatform(whiskeyPlatform.address, true);

    await createTestListings();

}

async function createTestListings() {
    await barrelHouse.setApprovalForAll(whiskeyPlatform.address, true);
    const listingDetails = [
        3500, // start price
        5500, // end price
        500, // fees
        250, // total bottles
        2500, // buyback %

        Math.floor((new Date(2020, 1, 1).getTime() / 1000)), // startTimestamp
        Math.floor((new Date(2025, 1, 1).getTime() / 1000)) // endTimestamp
    ];

    for(let i = 0; i < 20; i++) {
        listingDetails[0] = 3500 + i * 500;
        listingDetails[1] = 5500 + i * 800;
        listingDetails[3] = 200 + i * 30;

        await whiskeyPlatform.createWhiskeyListing(...listingDetails)
    }

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
