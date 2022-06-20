import { ethers, waffle } from "hardhat";
import { expect } from "chai";
import { numToWei } from "../utils/utils";
import { fixture } from "./fixture";
const { loadFixture } = waffle;

describe("NFT Market", () => {
  it("Valid deployment", async () => {
    const {
      oracle,
      unitroller,
      comptroller,
      unitrollerProxy,
      mockERC20,
      cToken,
      nftWhitelist,
      nftBlacklist,
      deployer,
    } = await loadFixture(fixture);

    expect(await oracle.isPriceOracle()).to.eq(true);
    expect(await unitroller.admin()).to.eq(deployer.address);
    expect(await unitroller.comptrollerImplementation()).to.eq(
      comptroller.address
    );
    expect(await comptroller.isComptroller()).to.eq(true);
    expect(await unitrollerProxy.admin()).to.eq(deployer.address);
    expect(await unitrollerProxy.closeFactorMantissa()).to.not.eq(0);
    expect(await unitrollerProxy.liquidationIncentiveMantissa()).to.not.eq(0);
    expect(await unitrollerProxy.creditLimit()).to.not.eq(0);
    expect(await unitrollerProxy.oracle()).to.eq(oracle.address);
    expect(await mockERC20.decimals()).to.eq(18);
    expect(await mockERC20.totalSupply()).to.eq(0);
    expect(await cToken.totalSupply()).to.eq(0);
    expect(await cToken.isCToken()).to.eq(true);
    expect(await cToken.name()).to.eq("Test CToken");
    expect(await nftWhitelist.name()).to.eq("Mock NFT");
    expect(await nftBlacklist.name()).to.eq("Mock NFT");
    expect(await oracle.getUnderlyingPrice(cToken.address)).to.eq(
      numToWei(2, 18)
    );
  });

  it("Whitelist NFT holder should be able to borrow", async () => {
    const { mockERC20, nftWhitelist, cToken, lender, borrower1 } =
      await loadFixture(fixture);

    // mint
    await mockERC20.mint(lender.address, numToWei(1_000_000, 18));
    await nftWhitelist.mint(borrower1.address);

    await mockERC20
      .connect(lender)
      .approve(cToken.address, ethers.constants.MaxUint256);
    await cToken.connect(lender).mint(numToWei(1_000_000, 18));
    expect(await cToken.balanceOf(lender.address)).to.not.eq(0);

    expect(await mockERC20.balanceOf(borrower1.address)).to.eq(0);
    await expect(cToken.connect(borrower1).borrow(numToWei(100_000, 18)))
      .to.emit(mockERC20, "Transfer")
      .withArgs(cToken.address, borrower1.address, numToWei(100_000, 18));
    expect(await mockERC20.balanceOf(borrower1.address)).to.eq(
      numToWei(100_000, 18)
    );
  });

  it("Should be able to borrow upto max credit limit in single txn", async () => {
    const { mockERC20, nftWhitelist, cToken, lender, borrower1 } =
      await loadFixture(fixture);

    await mockERC20.mint(lender.address, numToWei(1_000_000, 18));
    await nftWhitelist.mint(borrower1.address);

    await mockERC20
      .connect(lender)
      .approve(cToken.address, ethers.constants.MaxUint256);
    await cToken.connect(lender).mint(numToWei(1_000_000, 18));

    const borrowAmt = numToWei(500_000, 18);
    expect(await mockERC20.balanceOf(borrower1.address)).to.eq(0);
    await expect(cToken.connect(borrower1).borrow(borrowAmt))
      .to.emit(mockERC20, "Transfer")
      .withArgs(cToken.address, borrower1.address, borrowAmt);
    expect(await mockERC20.balanceOf(borrower1.address)).to.eq(borrowAmt);
  });

  it("Should be able to borrow upto max credit limit in two txn", async () => {
    const { mockERC20, nftWhitelist, cToken, lender, borrower1 } =
      await loadFixture(fixture);

    await mockERC20.mint(lender.address, numToWei(1_000_000, 18));
    await nftWhitelist.mint(borrower1.address);

    await mockERC20
      .connect(lender)
      .approve(cToken.address, ethers.constants.MaxUint256);
    await cToken.connect(lender).mint(numToWei(1_000_000, 18));

    const borrowAmt1 = numToWei(400_000, 18);
    expect(await mockERC20.balanceOf(borrower1.address)).to.eq(0);
    await expect(cToken.connect(borrower1).borrow(borrowAmt1))
      .to.emit(mockERC20, "Transfer")
      .withArgs(cToken.address, borrower1.address, borrowAmt1);
    expect(await mockERC20.balanceOf(borrower1.address)).to.eq(borrowAmt1);

    const borrowAmt2 = numToWei(99_999, 18);
    expect(await mockERC20.balanceOf(borrower1.address)).to.eq(borrowAmt1);
    await expect(cToken.connect(borrower1).borrow(borrowAmt2))
      .to.emit(mockERC20, "Transfer")
      .withArgs(cToken.address, borrower1.address, borrowAmt2);
    expect(await mockERC20.balanceOf(borrower1.address)).to.eq(
      numToWei(499_999, 18)
    );
  });

  it("Should not be able to borrow more than max credit limit in one txn", async () => {
    const { mockERC20, nftWhitelist, cToken, lender, borrower1 } =
      await loadFixture(fixture);

    await mockERC20.mint(lender.address, numToWei(1_000_000, 18));
    await nftWhitelist.mint(borrower1.address);
    await mockERC20
      .connect(lender)
      .approve(cToken.address, ethers.constants.MaxUint256);
    await cToken.connect(lender).mint(numToWei(1_000_000, 18));

    const borrowAmt = numToWei(500_001, 18);
    expect(await mockERC20.balanceOf(borrower1.address)).to.eq(0);
    await expect(
      cToken.connect(borrower1).borrow(borrowAmt)
    ).to.be.revertedWith("credit limit exceeded");
  });

  it("Should not be able to borrow more than max credit limit in two txn", async () => {
    const { mockERC20, nftWhitelist, cToken, lender, borrower1 } =
      await loadFixture(fixture);

    await mockERC20.mint(lender.address, numToWei(1_000_000, 18));
    await nftWhitelist.mint(borrower1.address);
    await mockERC20
      .connect(lender)
      .approve(cToken.address, ethers.constants.MaxUint256);
    await cToken.connect(lender).mint(numToWei(1_000_000, 18));

    const borrowAmt1 = numToWei(400_000, 18);
    expect(await mockERC20.balanceOf(borrower1.address)).to.eq(0);
    await expect(cToken.connect(borrower1).borrow(borrowAmt1))
      .to.emit(mockERC20, "Transfer")
      .withArgs(cToken.address, borrower1.address, borrowAmt1);
    expect(await mockERC20.balanceOf(borrower1.address)).to.eq(borrowAmt1);

    const borrowAmt2 = numToWei(100_000, 18);
    expect(await mockERC20.balanceOf(borrower1.address)).to.eq(borrowAmt1);
    await expect(
      cToken.connect(borrower1).borrow(borrowAmt2)
    ).to.be.revertedWith("credit limit exceeded");
  });

  it("Should not be able to borrow without holding whitelist NFT", async () => {
    const { mockERC20, cToken, lender, borrower1 } = await loadFixture(fixture);

    await mockERC20.mint(lender.address, numToWei(1_000_000, 18));
    await mockERC20
      .connect(lender)
      .approve(cToken.address, ethers.constants.MaxUint256);
    await cToken.connect(lender).mint(numToWei(1_000_000, 18));

    const borrowAmt = numToWei(100_000, 18);
    await expect(
      cToken.connect(borrower1).borrow(borrowAmt)
    ).to.be.revertedWith("zero nftWhitelist balance");
  });

  it("Should not be able to borrow without holding whitelist NFT", async () => {
    const { mockERC20, nftWhitelist, nftBlacklist, cToken, lender, borrower1 } =
      await loadFixture(fixture);

    await nftWhitelist.mint(borrower1.address);
    await nftBlacklist.mint(borrower1.address);
    await mockERC20.mint(lender.address, numToWei(1_000_000, 18));
    await mockERC20
      .connect(lender)
      .approve(cToken.address, ethers.constants.MaxUint256);
    await cToken.connect(lender).mint(numToWei(1_000_000, 18));

    const borrowAmt = numToWei(100_000, 18);
    await expect(
      cToken.connect(borrower1).borrow(borrowAmt)
    ).to.be.revertedWith("non zero nftBlacklist balance");
  });

  it("Should be able to repay in single txn", async () => {
    const { mockERC20, nftWhitelist, cToken, lender, borrower1 } =
      await loadFixture(fixture);

    await mockERC20.mint(lender.address, numToWei(1_000_000, 18));
    await nftWhitelist.mint(borrower1.address);
    await mockERC20
      .connect(lender)
      .approve(cToken.address, ethers.constants.MaxUint256);
    await cToken.connect(lender).mint(numToWei(1_000_000, 18));

    const borrowAmt = numToWei(100_000, 18);
    await cToken.connect(borrower1).borrow(borrowAmt);
    await mockERC20
      .connect(borrower1)
      .approve(cToken.address, ethers.constants.MaxUint256);
    await expect(cToken.connect(borrower1).repayBorrow(borrowAmt))
      .to.emit(mockERC20, "Transfer")
      .withArgs(borrower1.address, cToken.address, borrowAmt);
    expect(await mockERC20.balanceOf(borrower1.address)).to.eq(0);
  });

  it("Should be able to repay in two txns", async () => {
    const { mockERC20, nftWhitelist, cToken, lender, borrower1 } =
      await loadFixture(fixture);

    await mockERC20.mint(lender.address, numToWei(1_000_000, 18));
    await nftWhitelist.mint(borrower1.address);
    await mockERC20
      .connect(lender)
      .approve(cToken.address, ethers.constants.MaxUint256);
    await cToken.connect(lender).mint(numToWei(1_000_000, 18));

    const borrowAmt = numToWei(100_000, 18);
    await cToken.connect(borrower1).borrow(borrowAmt);
    await mockERC20
      .connect(borrower1)
      .approve(cToken.address, ethers.constants.MaxUint256);
    await expect(cToken.connect(borrower1).repayBorrow(numToWei(30_000, 18)))
      .to.emit(mockERC20, "Transfer")
      .withArgs(borrower1.address, cToken.address, numToWei(30_000, 18));
    await expect(cToken.connect(borrower1).repayBorrow(numToWei(70_000, 18)))
      .to.emit(mockERC20, "Transfer")
      .withArgs(borrower1.address, cToken.address, numToWei(70_000, 18));
    expect(await mockERC20.balanceOf(borrower1.address)).to.eq(0);
  });

  it("Scenario-1 -- Whitelist -> Full Borrow -> Blacklist -> Borrow", async () => {
    const { mockERC20, nftWhitelist, nftBlacklist, cToken, lender, borrower1 } =
      await loadFixture(fixture);

    await mockERC20.mint(lender.address, numToWei(1_000_000, 18));
    await nftWhitelist.mint(borrower1.address);
    await mockERC20
      .connect(lender)
      .approve(cToken.address, ethers.constants.MaxUint256);
    await cToken.connect(lender).mint(numToWei(1_000_000, 18));

    const borrowAmt = numToWei(500_000, 18);
    await cToken.connect(borrower1).borrow(borrowAmt);
    await nftBlacklist.mint(borrower1.address);
    await expect(cToken.connect(borrower1).borrow(1)).to.be.revertedWith(
      "non zero nftBlacklist balance"
    );
    expect(await mockERC20.balanceOf(borrower1.address)).to.eq(borrowAmt);
  });

  it("Scenario-2 -- Whitelist -> Partial Borrow -> Blacklist -> Borrow", async () => {
    const { mockERC20, nftWhitelist, nftBlacklist, cToken, lender, borrower1 } =
      await loadFixture(fixture);

    await mockERC20.mint(lender.address, numToWei(1_000_000, 18));
    await nftWhitelist.mint(borrower1.address);
    await mockERC20
      .connect(lender)
      .approve(cToken.address, ethers.constants.MaxUint256);
    await cToken.connect(lender).mint(numToWei(1_000_000, 18));

    const borrowAmt = numToWei(100_000, 18);
    await cToken.connect(borrower1).borrow(borrowAmt);
    await nftBlacklist.mint(borrower1.address);
    await expect(cToken.connect(borrower1).borrow(1)).to.be.revertedWith(
      "non zero nftBlacklist balance"
    );
    expect(await mockERC20.balanceOf(borrower1.address)).to.eq(borrowAmt);
  });

  it("Scenario-3 -- Whitelist -> Partial Borrow -> Blacklist -> Repay", async () => {
    const { mockERC20, nftWhitelist, nftBlacklist, cToken, lender, borrower1 } =
      await loadFixture(fixture);

    await mockERC20.mint(lender.address, numToWei(1_000_000, 18));
    await nftWhitelist.mint(borrower1.address);
    await mockERC20
      .connect(lender)
      .approve(cToken.address, ethers.constants.MaxUint256);
    await cToken.connect(lender).mint(numToWei(1_000_000, 18));

    const borrowAmt = numToWei(100_000, 18);
    await cToken.connect(borrower1).borrow(borrowAmt);
    await nftBlacklist.mint(borrower1.address);

    await mockERC20
      .connect(borrower1)
      .approve(cToken.address, ethers.constants.MaxUint256);
    await expect(cToken.connect(borrower1).repayBorrow(borrowAmt))
      .to.emit(mockERC20, "Transfer")
      .withArgs(borrower1.address, cToken.address, borrowAmt);
    expect(await mockERC20.balanceOf(borrower1.address)).to.eq(0);
  });
});
