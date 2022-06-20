import path from "path";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";
import { HardhatUserConfig } from "hardhat/config";

import * as dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, "/.env") });

const config: HardhatUserConfig = {
  networks: {
    bsc: {
      url: process.env.BSC_RPC || "https://bsc-dataseed.binance.org/",
      accounts: [process.env.PRIVATE_KEY],
    },
    kcc: {
      url: process.env.KCC_RPC || "https://rpc-mainnet.kcc.network",
      accounts: [process.env.PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  solidity: {
    compilers: [
      {
        version: "0.5.16",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.4",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
};

export default config;
