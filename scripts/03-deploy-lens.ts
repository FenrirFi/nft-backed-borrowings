import hre, { ethers } from "hardhat";
import { readFileSync, writeFileSync } from "fs";
import { verifyContract } from "./common/verify-contract";

const outputFilePath = `./deployments/${hre.network.name}.json`;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`>>>>>>>>>>>> Deployer: ${deployer.address} <<<<<<<<<<<<\n`);

  const deployments = JSON.parse(readFileSync(outputFilePath, "utf-8"));
  const CompoundLens = await ethers.getContractFactory("CompoundLens");
  const compoundLens = await CompoundLens.deploy();
  await compoundLens.deployed();
  console.log("CompoundLens deployed to:", compoundLens.address);

  deployments.CompoundLens = compoundLens.address;
  writeFileSync(outputFilePath, JSON.stringify(deployments, null, 2));

  await compoundLens.deployTransaction.wait(15);
  await verifyContract(compoundLens.address, []);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
