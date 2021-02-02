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
        // deploy and give ample eth to simulate interest
        wethGateway = await WethGateway.deploy({value: ethers.constants.WeiPerEther.mul(5)});
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

    async function createListing(fees) {
        testListing[2] = fees;
        await whiskeyPlatform.connect(accounts[0]).createWhiskeyListing(...testListing);
    }

    function usdToWei(usd) {
        return ethers.constants.WeiPerEther.mul(10**6).mul(usd).div(usdPerEth);
    }

    function weiToUsd(wei) {
        return ethers.BigNumber.from(wei).mul(usdPerEth).div(ethers.constants.WeiPerEther).div(10**6);
    }

    it("Should check balance of wethGateway", async() => {

        const startGatewayBalance = await provider.getBalance(wethGateway.address);
        await createListing(500);
        expect(await barrelHouse.balanceOf(accounts[0].address, 0)).to.equal(250);

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

        // check funds have transferred to account[0]
        const distilelryAfterBalance = await provider.getBalance(accounts[0].address);
        console.log(distilelryAfterBalance.toString());
        const weiIncrease = distilelryAfterBalance.sub(distilleryIniitalBalance);
        const usdValue = weiIncrease.mul(usdPerEth).div(ethers.constants.WeiPerEther).div(10**6).div(numBottles);
        // test if within $0.01
        expect(Math.abs(usdValue.toNumber() - testListing[0])).to.be.lessThan(2);

        expect(await provider.getBalance(whiskeyPlatform.address)).to.equal(0);

        expect(Math.abs((await whiskeyPlatform.totalFeesDepositedInWei()).sub(feePriceInWei).toNumber())).to.be.lessThan(10**4);

    });

    it("Should complete multiple purchases and fees should remain accurate", async() => {

        let totalFeesUsd = 0;
        for(let i = 0; i < 8; i++) {
            const fees = 250 * (i + 1);
            await createListing(fees);

            // buy from account (i + 1)
            const account = accounts[i+ 1];
            const numBottles = i + 1;
            const trxValue = usdToWei(numBottles * (fees + testListing[0]));
            await whiskeyPlatform.connect(account).purchaseBottles(i, numBottles, {value: trxValue});

            expect(await barrelHouse.balanceOf(account.address, i)).to.equal(numBottles);

            const platformFeeTotal = await whiskeyPlatform.totalFeesDepositedInWei();
            const platformFeeUsd = weiToUsd(platformFeeTotal).toNumber();
            totalFeesUsd += numBottles * fees;
            // test if within $0.01
            console.log(platformFeeUsd);
            console.log(totalFeesUsd);
            expect(Math.abs(totalFeesUsd - platformFeeUsd)).to.be.lessThan(2);
        }

        //const depositedWei = await wethGateway.balanceOf(whiskeyPlatform.address);
        //expect(depositedWei).to.equal(await whiskeyPlatform.totalFeesDepositedInWei());

        await barrelHouse.connect(accounts[2]).setApprovalForAll(whiskeyPlatform.address, true);
        await whiskeyPlatform.connect(accounts[2]).redeem(1, 2);
    });






});