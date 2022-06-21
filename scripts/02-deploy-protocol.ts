import hre, { ethers } from "hardhat";
import { readFileSync, writeFileSync } from "fs";
import { numToWei } from "../utils/utils";
import { verifyContract } from "./common/verify-contract";
import { Unitroller, Comptroller } from "../typechain";

const outputFilePath = `./deployments/${hre.network.name}.json`;

// Protocol Params
const params = {
  creditLimitUsd: 100_000,
  oracle: "0xfFD6377A08a7dC376f9Af407B485Fa8Af713d0BC",
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`>>>>>>>>>>>> Deployer: ${deployer.address} <<<<<<<<<<<<\n`);

  const deployments = JSON.parse(readFileSync(outputFilePath, "utf-8"));

  const Unitroller = await ethers.getContractFactory("Unitroller");
  const unitroller = (await Unitroller.deploy()) as Unitroller;
  await unitroller.deployed();
  console.log("Unitroller deployed to:", unitroller.address);

  const Comptroller = await ethers.getContractFactory("Comptroller");
  const comptroller = (await Comptroller.deploy()) as Comptroller;
  await comptroller.deployed();
  console.log("Comptroller deployed to:", comptroller.address);

  console.log("calling unitroller._setPendingImplementation()");
  let _tx = await unitroller._setPendingImplementation(comptroller.address);
  await _tx.wait(3);

  console.log("calling comptroller._become()");
  _tx = await comptroller._become(unitroller.address);
  await _tx.wait(3);

  const unitrollerProxy = (await ethers.getContractAt(
    "Comptroller",
    unitroller.address
  )) as Comptroller;

  console.log("calling unitrollerProxy._setCreditLimit()");
  _tx = await unitrollerProxy._setCreditLimit(
    numToWei(params.creditLimitUsd, 18)
  );
  await _tx.wait(3);

  console.log("calling unitrollerProxy._setPriceOracle()");
  _tx = await unitrollerProxy._setPriceOracle(params.oracle);
  await _tx.wait(3);

  // save data
  deployments.Unitroller = unitroller.address;
  deployments.Comptroller = comptroller.address;
  writeFileSync(outputFilePath, JSON.stringify(deployments, null, 2));

  await comptroller.deployTransaction.wait(15);
  await verifyContract(unitroller.address, []);
  await verifyContract(comptroller.address, []);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
