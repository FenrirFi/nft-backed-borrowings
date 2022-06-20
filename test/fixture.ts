import { ethers, waffle } from "hardhat";
import { numToWei, toBn } from "../utils/utils";
import {
  Unitroller,
  Comptroller,
  CErc20Delegator,
  MockERC20,
  MockERC721,
} from "../typechain";

import SimplePriceOracleJson from "../artifacts/contracts/SimplePriceOracle.sol/SimplePriceOracle.json";
import UnitrollerJson from "../artifacts/contracts/Unitroller.sol/Unitroller.json";
import ComptrollerJson from "../artifacts/contracts/Comptroller.sol/Comptroller.json";
import JumpRateModelV2Json from "../artifacts/contracts/JumpRateModelV2.sol/JumpRateModelV2.json";
import CErc20DelegateJson from "../artifacts/contracts/CErc20Delegate.sol/CErc20Delegate.json";
import CErc20DelegatorJson from "../artifacts/contracts/CErc20Delegator.sol/CErc20Delegator.json";
import MockERC20Json from "../artifacts/contracts/test/MockERC20.sol/MockERC20.json";
import MockERC721Json from "../artifacts/contracts/test/MockERC721.sol/MockERC721.json";
const { deployContract } = waffle;

export async function fixture() {
  const params = {
    closeFactor: "0.5",
    liquidationIncentive: "1.08",
    creditLimitUsd: 1_000_000,
    jumpRateModel: {
      baseRate: "0",
      kink: "80",
      multiplierPreKink: "20",
      multiplierPostKink: "100",
    },
  };

  const [deployer, lender, borrower1, borrower2] = await ethers.getSigners();

  const simplePriceOracle = await deployContract(
    deployer,
    SimplePriceOracleJson,
    []
  );
  const unitroller = (await deployContract(
    deployer,
    UnitrollerJson,
    []
  )) as Unitroller;
  const comptroller = (await deployContract(
    deployer,
    ComptrollerJson,
    []
  )) as Comptroller;

  await unitroller._setPendingImplementation(comptroller.address);
  await comptroller._become(unitroller.address);

  const unitrollerProxy = new ethers.Contract(
    unitroller.address,
    ComptrollerJson.abi,
    deployer
  ) as Comptroller;

  await unitrollerProxy._setCloseFactor(numToWei(params.closeFactor, 18));
  await unitrollerProxy._setLiquidationIncentive(
    numToWei(params.liquidationIncentive, 18)
  );
  await unitrollerProxy._setPriceOracle(simplePriceOracle.address);
  await unitrollerProxy._setCreditLimit(numToWei(params.creditLimitUsd, 18));

  // Deploy IR Model
  const jumpMultiplier = getJumpMultiplier(
    params.jumpRateModel.kink,
    params.jumpRateModel.multiplierPreKink,
    params.jumpRateModel.multiplierPostKink
  );
  const baseRateWei = numToWei(
    toBn(params.jumpRateModel.baseRate).div(100),
    18
  );
  const kinkWei = numToWei(toBn(params.jumpRateModel.kink).div(100), 18);
  const multiplierWei = numToWei(
    toBn(params.jumpRateModel.multiplierPreKink).div(100),
    18
  );
  const jumpMultiplierWei = numToWei(toBn(jumpMultiplier).div(100), 18);
  const jumpRateModelV2 = await deployContract(deployer, JumpRateModelV2Json, [
    baseRateWei,
    multiplierWei,
    jumpMultiplierWei,
    kinkWei,
    deployer.address,
  ]);

  // Deploy CToken
  const mockERC20 = (await deployContract(
    deployer,
    MockERC20Json,
    []
  )) as MockERC20;
  const cErc20Delegate = await deployContract(deployer, CErc20DelegateJson, []);

  const underlyingDecimals = await mockERC20.decimals();
  const totalDecimals = underlyingDecimals.add(8);
  const initialExcRateMantissaStr = numToWei("2", totalDecimals);

  const cErc20Delegator = (await deployContract(deployer, CErc20DelegatorJson, [
    mockERC20.address,
    unitrollerProxy.address,
    jumpRateModelV2.address,
    initialExcRateMantissaStr,
    "Test CToken",
    "TCT",
    8,
    deployer.address,
    cErc20Delegate.address,
    "0x",
  ])) as CErc20Delegator;

  await simplePriceOracle.setUnderlyingPrice(
    cErc20Delegator.address,
    numToWei(2, 18)
  );
  await unitrollerProxy._supportMarket(cErc20Delegator.address);

  const nftWhitelist = (await deployContract(
    deployer,
    MockERC721Json,
    []
  )) as MockERC721;
  const nftBlacklist = (await deployContract(
    deployer,
    MockERC721Json,
    []
  )) as MockERC721;

  await unitrollerProxy._setNftWhitelist(nftWhitelist.address);
  await unitrollerProxy._setNftBlacklist(nftBlacklist.address);

  return {
    unitrollerProxy,
    unitroller,
    comptroller,
    oracle: simplePriceOracle,
    mockERC20,
    cToken: cErc20Delegator,
    nftWhitelist,
    nftBlacklist,
    deployer,
    lender,
    borrower1,
    borrower2,
  };
}

const getJumpMultiplier = (
  kink: string,
  multiplierPreKink: string,
  multiplierPostKink: string
): string => {
  return toBn(multiplierPostKink)
    .minus(multiplierPreKink)
    .div(toBn(100).minus(kink))
    .times(100)
    .toFixed();
};
