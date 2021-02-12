
// const hre = require("hardhat");
// const ethers = hre.ethers;

let whiskeyPlatform;
let barrelHouse;

async function main() {

    const [deployer] = await ethers.getSigners();
    WhiskeyPlatform = await ethers.getContractFactory("WhiskeyPlatformV1");
    BarrelHouse = await ethers.getContractFactory("BarrelHouse");
    
    console.log("Starting Deploy");
    barrelHouse = await BarrelHouse.deploy();
    console.log("barrel house initial deploy");
    await barrelHouse.deployed();
    console.log("barrel house addres: " + barrelHouse.address);
    whiskeyPlatform = await WhiskeyPlatform.deploy(barrelHouse.address, barrelHouse.address);
    console.log("Whiskey platform deployed");
    await whiskeyPlatform.deployed();
    console.log("whiskey platform address: " + whiskeyPlatform.address);
    await barrelHouse.authorizePlatform(whiskeyPlatform.address, true);

    await createTestListings();
    console.log(whiskeyPlatform.address);
    console.log(barrelHouse.address);

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

    for(let i = 0; i < 16; i++) {
        listingDetails[0] = 3500 + i * 500;
        listingDetails[1] = 5500 + i * 800;
        listingDetails[3] = 200 + i * 30;

        const trx = await whiskeyPlatform.createWhiskeyListing(...listingDetails);
        await trx.wait();
        console.log("Created token: " + i);
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
