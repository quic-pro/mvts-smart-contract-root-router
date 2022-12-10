import {loadFixture, time} from '@nomicfoundation/hardhat-network-helpers';
import {expect} from 'chai';
import {ethers} from 'hardhat';

import {RootRouter} from '../typechain-types';
import {DAY, YEAR} from './constants';


const {BigNumber, provider} = ethers;
const {parseEther, formatEther} = ethers.utils;


const enum CodeMode {
    Number,
    Pool
}


describe('RootRouter', () => {
    // Settings
    const MINT_PRICE = parseEther('10');
    const SUBSCRIPTION_PRICE = parseEther('7');
    const MODE_CHANGE_PRICE = parseEther('5');
    const SUBSCRIPTION_DURATION = 10 * YEAR;
    const HOLDING_DURATION = 30 * DAY;
    const TTL = 10 * DAY;
    const BASE_URI = 'https://mvts-metadata.io/';
    const DEFAULT_SIP_DOMAIN = 'sip.quic.pro';

    // Data
    const NAME = 'MetaVerse Telecom Service';
    const SYMBOL = 'MVTS';
    const POOL_SIZE = 1000;


    async function deploy() {
        const [owner, ...accounts] = await ethers.getSigners();

        const RootRouter = await ethers.getContractFactory('RootRouter', owner);
        const rootRouter = (await RootRouter.deploy()) as RootRouter;
        await rootRouter.deployed();

        return {rootRouter, owner, accounts};
    }

    async function expectRevertedWithInvalidCode(call: Promise<any>) {
        await expect(call).to.revertedWith('Invalid code!');
    }

    async function expectRevertedWithCodeNotInUse(call: Promise<any>) {
        await expect(call).to.revertedWith('Code not in use!');
    }


    // ----- SETTINGS --------------------------------------------------------------------------------------------------

    it('settings', async () => {
        const {rootRouter, owner} = await loadFixture(deploy);

        expect(await rootRouter.owner()).to.equal(owner.address);
        expect(await rootRouter.mintPrice()).to.equal(MINT_PRICE);
        expect(await rootRouter.subscriptionPrice()).to.equal(SUBSCRIPTION_PRICE);
        expect(await rootRouter.modeChangePrice()).to.equal(MODE_CHANGE_PRICE);
        expect(await rootRouter.subscriptionDuration()).to.equal(SUBSCRIPTION_DURATION);
        expect(await rootRouter.holdingDuration()).to.equal(HOLDING_DURATION);
        expect(await rootRouter.ttl()).to.equal(TTL);
        expect(await rootRouter.baseUri()).to.equal(BASE_URI);
        expect(await rootRouter.defaultSipDomain()).to.equal(DEFAULT_SIP_DOMAIN);
    });


    // ----- DATA ------------------------------------------------------------------------------------------------------

    it('data', async () => {
        const {rootRouter} = await loadFixture(deploy);

        expect(await rootRouter.name()).to.equal(NAME);
        expect(await rootRouter.symbol()).to.equal(SYMBOL);
        expect(await rootRouter.POOL_SIZE()).to.equal(POOL_SIZE);

        await expectRevertedWithInvalidCode(rootRouter.getCodeData(POOL_SIZE));
    });


    // ----- CONSTRUCTOR -----------------------------------------------------------------------------------------------

    it('constructor', async () => {
        const {rootRouter} = await loadFixture(deploy);

        for (let code = 0; code < POOL_SIZE / POOL_SIZE; ++code) {
            expect((await rootRouter.isBlocked(code))).to.equal(code < 100);
        }
    });


    // ----- PUBLIC UTILS ----------------------------------------------------------------------------------------------

    it('getCodeData', async () => {
        const {rootRouter} = await loadFixture(deploy);

        await expectRevertedWithInvalidCode(rootRouter.getCodeData(POOL_SIZE));
        await expectRevertedWithCodeNotInUse(rootRouter.isNumberMode(100));

        const timestamp = await time.latest();

        await rootRouter.mint(100);
        await rootRouter.setCodeSubscriptionEndTime(100, timestamp);
        expect(await rootRouter.getCodeData(100)).to.have.deep.members([
            false, // isBlocked
            false, // hasSipDomain
            false, // hasRouter
            BigNumber.from(timestamp), // subscriptionEndTime
            CodeMode.Number, // mode
            '', // sipDomain
            [ // router
                '', // chainId
                '', // adr
                '' // poolCodeLength
            ]
        ]);
    });

    it('hasOwner', async () => {
        const {rootRouter, owner} = await loadFixture(deploy);

        await expectRevertedWithInvalidCode(rootRouter.hasOwner(POOL_SIZE));

        expect(await rootRouter.hasOwner(100)).to.false;
        await rootRouter.mint(100);
        expect(await rootRouter.hasOwner(100)).to.true;
    });

    it('isBlocked', async () => {
        const {rootRouter} = await loadFixture(deploy);

        await expectRevertedWithInvalidCode(rootRouter.isBlocked(POOL_SIZE));

        expect(await rootRouter.isBlocked(100)).to.false;
        await rootRouter.setCodeBlockedStatus(100, true);
        expect(await rootRouter.isBlocked(100)).to.true;
    });

    it('isHeld', async () => {
        const {rootRouter} = await loadFixture(deploy);

        await expectRevertedWithInvalidCode(rootRouter.isHeld(POOL_SIZE));

        expect(await rootRouter.isHeld(0)).to.false;
        await rootRouter.mint(100);
        await rootRouter.setCodeSubscriptionEndTime(100, await time.latest());
        expect(await rootRouter.isHeld(100)).to.true;
    });

    it('isAvailableForMint', async () => {
        const {rootRouter} = await loadFixture(deploy);

        await expectRevertedWithInvalidCode(rootRouter.isAvailableForMint(POOL_SIZE));

        expect(await rootRouter.isAvailableForMint(0)).to.false;
        expect(await rootRouter.isAvailableForMint(100)).to.true;
        await rootRouter.mint(100);
        expect(await rootRouter.isAvailableForMint(100)).to.false;
        await rootRouter.setCodeSubscriptionEndTime(100, await time.latest());
        expect(await rootRouter.isAvailableForMint(100)).to.false;
    });

    it('isNumberMode', async () => {
        const {rootRouter} = await loadFixture(deploy);

        await expectRevertedWithInvalidCode(rootRouter.isNumberMode(POOL_SIZE));
        await expectRevertedWithCodeNotInUse(rootRouter.isNumberMode(100));

        await rootRouter.mint(100);
        expect(await rootRouter.isNumberMode(100)).to.true;
        await rootRouter.changeCodeMode(100);
        expect(await rootRouter.isNumberMode(100)).to.false;
    });

    it('isPoolMode', async () => {
        const {rootRouter} = await loadFixture(deploy);

        await expectRevertedWithInvalidCode(rootRouter.isPoolMode(POOL_SIZE));
        await expectRevertedWithCodeNotInUse(rootRouter.isPoolMode(100));

        await rootRouter.mint(100);
        expect(await rootRouter.isPoolMode(100)).to.false;
        await rootRouter.changeCodeMode(100);
        expect(await rootRouter.isPoolMode(100)).to.true;
    });

    it('getMode', async () => {
        const {rootRouter} = await loadFixture(deploy);

        await expectRevertedWithInvalidCode(rootRouter.getMode(POOL_SIZE));
        await expectRevertedWithCodeNotInUse(rootRouter.getMode(100));

        await rootRouter.mint(100);
        expect(await rootRouter.getMode(100)).to.equal(CodeMode.Number);
        await rootRouter.changeCodeMode(100);
        expect(await rootRouter.getMode(100)).to.equal(CodeMode.Pool);
    });

    it('getCodeStatus', async () => {
        const {rootRouter} = await loadFixture(deploy);

        await expectRevertedWithInvalidCode(rootRouter.getCodeStatus(POOL_SIZE));

        const timestamp = await time.latest() + 60;

        expect(await rootRouter.getCodeStatus(100)).to.have.deep.members([
            false, // isBlocked
            false, // hasOwner
            false, // isHeld
            true, // isAvailableForMint
            BigNumber.from(0), // subscriptionEndTime
            BigNumber.from(0) // holdEndTime
        ]);
        await rootRouter.mint(100);
        await rootRouter.setCodeSubscriptionEndTime(100, timestamp);
        expect(await rootRouter.getCodeStatus(100)).to.have.deep.members([
            false, // isBlocked
            true, // hasOwner
            false, // isHeld
            false, // isAvailableForMint
            BigNumber.from(timestamp), // subscriptionEndTime
            BigNumber.from(timestamp + HOLDING_DURATION) // holdEndTime
        ]);

    });

    it('getBlockedCodes', async () => {
        const {rootRouter} = await loadFixture(deploy);

        const blockedCodes = await rootRouter.getBlockedCodes();
        expect(blockedCodes).to.length(POOL_SIZE);
        for (let code = 0; code < POOL_SIZE; ++code) {
            expect(blockedCodes[code]).to.equal(code < 100);
        }
    });

    it('getHeldCodes', async () => {
        const {rootRouter} = await loadFixture(deploy);

        await rootRouter.mint(100);
        await rootRouter.setCodeSubscriptionEndTime(100, await time.latest());

        const heldCodes = await rootRouter.getHeldCodes();
        expect(heldCodes).to.length(POOL_SIZE);
        for (let code = 0; code < POOL_SIZE; ++code) {
            expect(heldCodes[code]).to.equal(code === 100);
        }
    });

    it('getAvailableForMintCodes', async () => {
        const {rootRouter} = await loadFixture(deploy);

        await rootRouter.mint(100);
        await rootRouter.setCodeSubscriptionEndTime(100, await time.latest());

        const availableForMintCodes = await rootRouter.getAvailableForMintCodes();
        expect(availableForMintCodes).to.length(POOL_SIZE);
        for (let code = 0; code < POOL_SIZE; ++code) {
            expect(availableForMintCodes[code]).to.equal(code > 100);
        }
    });

    it('getPoolCodes', async () => {
        const {rootRouter} = await loadFixture(deploy);

        await rootRouter.mint(100);
        await rootRouter.changeCodeMode(100);

        const poolCodes = await rootRouter.getPoolCodes();
        expect(poolCodes).to.length(POOL_SIZE);
        for (let code = 0; code < POOL_SIZE; ++code) {
            expect(poolCodes[code]).to.equal(code === 100);
        }
    });

    it('getOwnerCodes', async () => {
        const {rootRouter, owner, accounts} = await loadFixture(deploy);

        await rootRouter.connect(accounts[0]).mint(100, {value: parseEther('10')});

        const ownerCodes = await rootRouter.connect(accounts[0]).getOwnerCodes(accounts[0].address);
        expect(ownerCodes).to.length(POOL_SIZE);
        for (let code = 0; code < POOL_SIZE; ++code) {
            expect(ownerCodes[code]).to.equal(code === 100);
        }
    });


    // ----- SMART CONTRACT MANAGEMENT ---------------------------------------------------------------------------------

    it('withdraw', async () => {
        const {rootRouter, owner, accounts} = await loadFixture(deploy);

        await rootRouter.connect(accounts[0]).mint(100, {value: MINT_PRICE.toString()});
        await expect(rootRouter.connect(accounts[0]).withdraw()).to.revertedWith('Ownable: caller is not the owner');

        const contractOwnerInitialBalance = await provider.getBalance(owner.address);
        await rootRouter.connect(owner).withdraw();
        const contractOwnerCurrentBalance = await provider.getBalance(owner.address);

        const contractBalance = await provider.getBalance(rootRouter.address);
        const contractOwnerDeltaBalance = formatEther(contractOwnerCurrentBalance.sub(contractOwnerInitialBalance));

        expect(contractBalance).to.equal(0);
        expect(+contractOwnerDeltaBalance).to.closeTo(+formatEther(MINT_PRICE.toString()), 1e-4);
    });

    it('setMintPrice', async () => {
        const {rootRouter, owner, accounts} = await loadFixture(deploy);

        const newMintPrice = parseEther('5');

        await expect(rootRouter.connect(accounts[0]).setMintPrice(newMintPrice)).to.revertedWith('Ownable: caller is not the owner');
        await rootRouter.connect(owner).setMintPrice(newMintPrice);

        expect(await rootRouter.mintPrice()).to.equal(newMintPrice);
    });

    it('setSubscriptionPrice', async () => {
        const {rootRouter, owner, accounts} = await loadFixture(deploy);

        const newSubscriptionPrice = parseEther('3');

        await expect(rootRouter.connect(accounts[0]).setSubscriptionPrice(newSubscriptionPrice)).to.revertedWith('Ownable: caller is not the owner');
        await rootRouter.connect(owner).setSubscriptionPrice(newSubscriptionPrice);

        expect(await rootRouter.subscriptionPrice()).to.equal(newSubscriptionPrice);
    });

    it('setModeChangePrice', async () => {
        const {rootRouter, owner, accounts} = await loadFixture(deploy);

        const newModeChangePrice = parseEther('3');

        await expect(rootRouter.connect(accounts[0]).setModeChangePrice(newModeChangePrice)).to.revertedWith('Ownable: caller is not the owner');
        await rootRouter.connect(owner).setModeChangePrice(newModeChangePrice);

        expect(await rootRouter.modeChangePrice()).to.equal(newModeChangePrice);
    });

    it('setSubscriptionDuration', async () => {
        const {rootRouter, owner, accounts} = await loadFixture(deploy);

        const newSubscriptionDuration = parseEther('3');

        await expect(rootRouter.connect(accounts[0]).setSubscriptionDuration(newSubscriptionDuration)).to.revertedWith('Ownable: caller is not the owner');
        await rootRouter.connect(owner).setSubscriptionDuration(newSubscriptionDuration);

        expect(await rootRouter.subscriptionDuration()).to.equal(newSubscriptionDuration);
    });

    it('setHoldingDuration', async () => {
        const {rootRouter, owner, accounts} = await loadFixture(deploy);

        const newHoldingDuration = parseEther('3');

        await expect(rootRouter.connect(accounts[0]).setHoldingDuration(newHoldingDuration)).to.revertedWith('Ownable: caller is not the owner');
        await rootRouter.connect(owner).setHoldingDuration(newHoldingDuration);

        expect(await rootRouter.holdingDuration()).to.equal(newHoldingDuration);
    });

    it('setTtl', async () => {
        const {rootRouter, owner, accounts} = await loadFixture(deploy);

        const newTtl = 3 * DAY;

        await expect(rootRouter.connect(accounts[0]).setTtl(newTtl)).to.revertedWith('Ownable: caller is not the owner');
        await rootRouter.connect(owner).setTtl(newTtl);

        expect(await rootRouter.ttl()).to.equal(newTtl);
    });

    it('setDefaultSipDomain', async () => {
        const {rootRouter, owner, accounts} = await loadFixture(deploy);

        const newDefaultSipDomain = 'sip.test';

        await expect(rootRouter.connect(accounts[0]).setDefaultSipDomain(newDefaultSipDomain)).to.revertedWith('Ownable: caller is not the owner');
        await rootRouter.connect(owner).setDefaultSipDomain(newDefaultSipDomain);

        expect(await rootRouter.defaultSipDomain()).to.equal(newDefaultSipDomain);
    });

    it('setBaseUri', async () => {
        const {rootRouter, owner, accounts} = await loadFixture(deploy);

        const newBaseUri = 'https://test.test/';

        await expect(rootRouter.connect(accounts[0]).setBaseUri(newBaseUri)).to.revertedWith('Ownable: caller is not the owner');
        await rootRouter.connect(owner).setBaseUri(newBaseUri);

        expect(await rootRouter.baseUri()).to.equal(newBaseUri);
    });

    it('setCodeBlockedStatus', async () => {
        const {rootRouter, owner, accounts} = await loadFixture(deploy);

        const code = 100;
        const isBlocked = await rootRouter.isBlocked(code);

        await expect(rootRouter.connect(accounts[0]).setCodeBlockedStatus(code, !isBlocked)).to.revertedWith('Ownable: caller is not the owner');
        await expect(rootRouter.connect(owner).setCodeBlockedStatus(POOL_SIZE, !isBlocked)).to.revertedWith('Invalid code!');
        await rootRouter.connect(owner).setCodeBlockedStatus(code, !isBlocked);

        expect((await rootRouter.isBlocked(code))).to.equal(!isBlocked);
    });

    it('setCodeSubscriptionEndTime', async () => {
        const {rootRouter, owner, accounts} = await loadFixture(deploy);

        const code = 100;
        await rootRouter.mint(code);
        const {subscriptionEndTime} = await rootRouter.getCodeData(code);

        await expect(rootRouter.connect(accounts[0]).setCodeSubscriptionEndTime(code, subscriptionEndTime.add(DAY))).to.revertedWith('Ownable: caller is not the owner');
        await expect(rootRouter.connect(owner).setCodeSubscriptionEndTime(POOL_SIZE, subscriptionEndTime.add(DAY))).to.revertedWith('Invalid code!');
        await rootRouter.connect(owner).setCodeSubscriptionEndTime(code, subscriptionEndTime.add(DAY));

        expect((await rootRouter.getCodeData(code)).subscriptionEndTime).to.equal(subscriptionEndTime.add(DAY));
    });


    // ----- CODE MANAGEMENT -------------------------------------------------------------------------------------------


    // ----- ROUTING ---------------------------------------------------------------------------------------------------
});
