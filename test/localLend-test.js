const { ethers } = require('hardhat');
const { expect } = require('chai');
const { waffle } = require("hardhat");
const provider = waffle.provider;

const usdPerEth = 124477730884;

function dateToUnix(date) {
    return Math.floor(date.getTime() / 1000);
}

describe("Fee and Aave lending tests", () => {

    let barrelHouse;
    let whiskeyPlatform;
    let wethGateway;
    let accounts;

    beforeEach(async () => {
        accounts = await ethers.getSigners();
        const BarrelHouse = await ethers.getContractFactory("BarrelHouse");
        const WhiskeyPlatform = await ethers.getContractFactory("WhiskeyPlatformV1");
        const WethGateway = await ethers.getContractFactory("TestWETHGateway");
        barrelHouse = await BarrelHouse.deploy();
        await barrelHouse.deployed();
        wethGateway = await WethGateway.deploy();
        await wethGateway.deployed();
        whiskeyPlatform = await WhiskeyPlatform.deploy(barrelHouse.address, wethGateway.address);

        // give platform PLATFORM_ROLE 
        await barrelHouse.connect(accounts[0]).authorizePlatform(whiskeyPlatform.address, true);

        await barrelHouse.connect(accounts[0]).setApprovalForAll(whiskeyPlatform.address, true);
    });

    const startTimestamp = dateToUnix(new Date());
    const endTimestamp = dateToUnix(new Date(2025, 1, 1));
    const testListing =  [
        3500, // start price
        3500, // end price
        500, // fees
        250, // total bottles
        2500, // buyback %

        startTimestamp, // startTimestamp
        endTimestamp // endTimestamp
    ];

    async function createListing() {
        await whiskeyPlatform.connect(accounts[0]).createWhiskeyListing(...testListing);
    }


    it("Should check balance of wethGateway", async() => {

        await createListing();
        expect(await barrelHouse.balanceOf(accounts[0].address, 0)).to.equal(250);
        expect(await provider.getBalance(wethGateway.address)).to.equal(0);

        const distilleryIniitalBalance = await provider.getBalance(accounts[0].address);
        
        // buy whiskey from account 1
        const numBottles = 5;
        const feePriceInWei = ethers.constants.WeiPerEther
            .mul(10**6).mul(numBottles * testListing[2]).div(usdPerEth);
        const bottlePriceInWei = ethers.constants.WeiPerEther
        .mul(10**6).mul(numBottles * testListing[0]).div(usdPerEth);
        const totalPriceWei = feePriceInWei.add(bottlePriceInWei);

        const trx = await whiskeyPlatform.connect(accounts[1]).purchaseBottles(0, numBottles, {
            value: totalPriceWei
        });
        await trx.wait();

        // ensure new owner of bottles
        expect(await barrelHouse.balanceOf(accounts[1].address, 0)).to.equal(numBottles);

        // check fees remain on gateway contract
        const gatewayBalance = await provider.getBalance(wethGateway.address);
        expect(Math.abs(gatewayBalance.sub(feePriceInWei).toNumber())).to.be.lessThan(10**4);
        
        // check funds have transferred to account[0]
        const distilelryAfterBalance = await provider.getBalance(accounts[0].address);
        console.log(distilelryAfterBalance.toString());
        const weiIncrease = distilelryAfterBalance.sub(distilleryIniitalBalance);
        const usdValue = weiIncrease.mul(usdPerEth).div(ethers.constants.WeiPerEther).div(10**6).div(numBottles);
        // test if within $0.01
        expect(Math.abs(usdValue.toNumber() - testListing[0])).to.be.lessThan(2);

    })






});