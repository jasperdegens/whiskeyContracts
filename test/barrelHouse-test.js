const { expect } = require("chai");
const { ethers } = require("hardhat");


describe("Barrel House tests", function () {

    let accounts;
    let barrelHouse;

    before(async () => {
        accounts = await ethers.getSigners();
        const BarrelHouse = await ethers.getContractFactory("BarrelHouse");
        barrelHouse = await BarrelHouse.deploy();
        await barrelHouse.deployed();
    });


    it("Should allow only admin to add platform.", async () => {
        
        await expect(barrelHouse.authorizePlatform(accounts[4].address, true)).to.not.be.reverted;
        await expect(barrelHouse.connect(accounts[1]).authorizePlatform(accounts[4].address, true)).to.be.reverted;

    });

    it("Should allow platform to mint new tokens and transfer if platform role", async () => {
        // account 4 is already authorized as a platform
        barrelHouse.connect(accounts[4]);

        const mintTrx = await barrelHouse.connect(accounts[4]).mint(accounts[4].address, 110);

        const logs = await mintTrx.wait();

        expect(mintTrx).to.emit(barrelHouse, 'TransferSingle');

        expect(await barrelHouse.balanceOf(accounts[4].address, 0)).to.equal(110);

        await barrelHouse.connect(accounts[4]).safeTransferFrom(
            accounts[4].address,
            accounts[2].address,
            0,
            50,
            0x0    
        );

        expect(await barrelHouse.balanceOf(accounts[4].address, 0)).to.equal(60);
        expect(await barrelHouse.balanceOf(accounts[2].address, 0)).to.equal(50);
        
    });

    it("Should deauthorize platform.", async () => {
        expect(await barrelHouse.connect(accounts[4]).mint(accounts[4].address, 311))
            .to.emit(barrelHouse, 'TransferSingle')
            .withArgs(accounts[4].address, ethers.constants.AddressZero, accounts[4].address, 1, 311);

        await barrelHouse.connect(accounts[0]).authorizePlatform(accounts[4].address, false);

        await expect(barrelHouse.connect(accounts[4]).mint(accounts[4].address, 311)).to.be.reverted;

    });


})