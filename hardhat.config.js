require("@nomiclabs/hardhat-waffle");
//require("hardhat-gas-reporter");
const keys = require("./.keys.js");

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async () => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.7.3",
  networks: {
    hardhat: {
      chainId: 1337,
      forking: {
        url: keys.privateKeys.mainnet['url'],
        blockNumber: 11362835
      }
    },
    kovan: {
      url: keys.privateKeys.kovan['url'],
      accounts: [`0x${keys.privateKeys.kovan['testAccount']}`]
    }
  }
};

