import {loadFixture} from '@nomicfoundation/hardhat-network-helpers';
import {expect} from 'chai';
import {ethers} from 'hardhat';

import {DAY, YEAR} from './constants';
import {RootRouter} from '../typechain-types';


const provider = ethers.provider;
const {parseEther, formatEther} = ethers.utils;


const enum CodeMode {
    Number,
    Pool
}


describe('RootRouter', () => {
    // Settings
    const BUY_PRICE = parseEther('10');
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
        const rootRouter = await RootRouter.deploy();
        await rootRouter.deployed();

        return {rootRouter, owner, accounts};
    }


    // ----- SETTINGS --------------------------------------------------------------------------------------------------

    it('settings', async () => {
        const {rootRouter, owner} = await loadFixture(deploy);

        expect(await rootRouter.owner()).to.equal(owner.address);
        expect(await rootRouter.buyPrice()).to.equal(BUY_PRICE);
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

        for (let code = 0; code < POOL_SIZE; ++code) {
            const {
                isBlocked,
                hasSipDomain,
                hasRouter,
                subscriptionEndTime,
                mode,
                sipDomain,
                router
            } = await rootRouter.getCodeData(code);

            expect(isBlocked).to.equal(code < 100);
            expect(hasSipDomain).to.false;
            expect(hasRouter).to.be.false;
            expect(subscriptionEndTime).to.equal(0);
            expect(mode).to.equal(CodeMode.Number);
            expect(sipDomain).to.be.empty;
            expect(router.chainId).to.be.empty;
            expect(router.adr).to.be.empty;
            expect(router.poolCodeLength).to.be.empty;
        }
    });


    // ----- CONSTRUCTOR -----------------------------------------------------------------------------------------------

    it('constructor', async () => {
        const {rootRouter} = await loadFixture(deploy);

        for (let code = 0; code < 100; ++code) {
            expect((await rootRouter.getCodeData(code)).isBlocked).to.true;
        }
    });


    // ----- PUBLIC UTILS ----------------------------------------------------------------------------------------------

    it('getCodeData', async () => {
        const {rootRouter} = await loadFixture(deploy);

        await expect(rootRouter.getCodeData(POOL_SIZE)).to.revertedWith('Invalid code!');
        expect(await rootRouter.getCodeData(POOL_SIZE - 1)).to.include.keys('isBlocked', 'hasSipDomain', 'hasRouter', 'subscriptionEndTime', 'mode', 'sipDomain', 'router');
    });

/*    it('isBlocked', async () => {
        const {rootRouter} = await loadFixture(deploy);

        await expect(rootRouter.isBlocked(POOL_SIZE)).to.revertedWith('Invalid code!');
        expect(await rootRouter.isBlocked(0)).to.be.true;
        expect(await rootRouter.isBlocked(100)).to.be.false;
    });*/


    // ----- SMART CONTRACT MANAGEMENT ---------------------------------------------------------------------------------

    it('withdraw', async () => {
        const {rootRouter, owner, accounts} = await loadFixture(deploy);

        await rootRouter.connect(accounts[0]).mint(100, {value: BUY_PRICE.toString()});
        await expect(rootRouter.connect(accounts[0]).withdraw()).to.be.revertedWith('Ownable: caller is not the owner');

        const contractOwnerInitialBalance = await provider.getBalance(owner.address);
        await rootRouter.connect(owner).withdraw();
        const contractOwnerCurrentBalance = await provider.getBalance(owner.address);

        const contractBalance = await provider.getBalance(rootRouter.address);
        const contractOwnerDeltaBalance = formatEther(contractOwnerCurrentBalance.sub(contractOwnerInitialBalance));

        expect(contractBalance).to.be.equal(0);
        expect(+contractOwnerDeltaBalance).to.be.closeTo(+formatEther(BUY_PRICE.toString()), 1e-4);
    });

    it('setBuyPrice', async () => {
        const {rootRouter, owner, accounts} = await loadFixture(deploy);

        const newBuyPrice = parseEther('5');

        await expect(rootRouter.connect(accounts[0]).setBuyPrice(newBuyPrice)).to.be.revertedWith('Ownable: caller is not the owner');
        await rootRouter.connect(owner).setBuyPrice(newBuyPrice);

        expect(await rootRouter.buyPrice()).to.be.equal(newBuyPrice);
    });

    it('setSubscriptionPrice', async () => {
        const {rootRouter, owner, accounts} = await loadFixture(deploy);

        const newSubscriptionPrice = parseEther('3');

        await expect(rootRouter.connect(accounts[0]).setSubscriptionPrice(newSubscriptionPrice)).to.be.revertedWith('Ownable: caller is not the owner');
        await rootRouter.connect(owner).setSubscriptionPrice(newSubscriptionPrice);

        expect(await rootRouter.subscriptionPrice()).to.be.equal(newSubscriptionPrice);
    });

    it('setModeChangePrice', async () => {
        const {rootRouter, owner, accounts} = await loadFixture(deploy);

        const newModeChangePrice = parseEther('3');

        await expect(rootRouter.connect(accounts[0]).setModeChangePrice(newModeChangePrice)).to.be.revertedWith('Ownable: caller is not the owner');
        await rootRouter.connect(owner).setModeChangePrice(newModeChangePrice);

        expect(await rootRouter.modeChangePrice()).to.be.equal(newModeChangePrice);
    });

    it('setSubscriptionDuration', async () => {
        const {rootRouter, owner, accounts} = await loadFixture(deploy);

        const newSubscriptionDuration = parseEther('3');

        await expect(rootRouter.connect(accounts[0]).setSubscriptionDuration(newSubscriptionDuration)).to.be.revertedWith('Ownable: caller is not the owner');
        await rootRouter.connect(owner).setSubscriptionDuration(newSubscriptionDuration);

        expect(await rootRouter.subscriptionDuration()).to.be.equal(newSubscriptionDuration);
    });

    it('setHoldingDuration', async () => {
        const {rootRouter, owner, accounts} = await loadFixture(deploy);

        const newHoldingDuration = parseEther('3');

        await expect(rootRouter.connect(accounts[0]).setHoldingDuration(newHoldingDuration)).to.be.revertedWith('Ownable: caller is not the owner');
        await rootRouter.connect(owner).setHoldingDuration(newHoldingDuration);

        expect(await rootRouter.holdingDuration()).to.be.equal(newHoldingDuration);
    });

    it('setTtl', async () => {
        const {rootRouter, owner, accounts} = await loadFixture(deploy);

        const newTtl = 3 * DAY;

        await expect(rootRouter.connect(accounts[0]).setTtl(newTtl)).to.be.revertedWith('Ownable: caller is not the owner');
        await rootRouter.connect(owner).setTtl(newTtl);

        expect(await rootRouter.ttl()).to.be.equal(newTtl);
    });

    it('setDefaultSipDomain', async () => {
        const {rootRouter, owner, accounts} = await loadFixture(deploy);

        const newDefaultSipDomain = 'sip.test';

        await expect(rootRouter.connect(accounts[0]).setDefaultSipDomain(newDefaultSipDomain)).to.be.revertedWith('Ownable: caller is not the owner');
        await rootRouter.connect(owner).setDefaultSipDomain(newDefaultSipDomain);

        expect(await rootRouter.defaultSipDomain()).to.be.equal(newDefaultSipDomain);
    });

    it('setBaseUri', async () => {
        const {rootRouter, owner, accounts} = await loadFixture(deploy);

        const newBaseUri = 'https://test.test/';

        await expect(rootRouter.connect(accounts[0]).setBaseUri(newBaseUri)).to.be.revertedWith('Ownable: caller is not the owner');
        await rootRouter.connect(owner).setBaseUri(newBaseUri);

        expect(await rootRouter.baseUri()).to.be.equal(newBaseUri);
    });

    it('setCodeBlockedStatus', async () => {
        const {rootRouter, owner, accounts} = await loadFixture(deploy);

        const code = POOL_SIZE - 1;
        const {isBlocked} = await rootRouter.getCodeData(code);

        await expect(rootRouter.connect(accounts[0]).setCodeBlockedStatus(code, !isBlocked)).to.be.revertedWith('Ownable: caller is not the owner');
        await expect(rootRouter.connect(owner).setCodeBlockedStatus(POOL_SIZE, !isBlocked)).to.be.revertedWith('Invalid code!');
        await rootRouter.connect(owner).setCodeBlockedStatus(code, !isBlocked);

        expect((await rootRouter.getCodeData(code)).isBlocked).to.be.equal(!isBlocked);
    });

    it('setCodeSubscriptionEndTime', async () => {
        const {rootRouter, owner, accounts} = await loadFixture(deploy);

        const code = POOL_SIZE - 1;
        await rootRouter.mint(code);
        const {subscriptionEndTime} = await rootRouter.getCodeData(code);

        await expect(rootRouter.connect(accounts[0]).setCodeSubscriptionEndTime(code, subscriptionEndTime.add(DAY))).to.be.revertedWith('Ownable: caller is not the owner');
        await expect(rootRouter.connect(owner).setCodeSubscriptionEndTime(POOL_SIZE, subscriptionEndTime.add(DAY))).to.be.revertedWith('Invalid code!');
        await rootRouter.connect(owner).setCodeSubscriptionEndTime(code, subscriptionEndTime.add(DAY));

        expect((await rootRouter.getCodeData(code)).subscriptionEndTime).to.be.equal(subscriptionEndTime.add(DAY));
    });


    // ----- CODE MANAGEMENT -------------------------------------------------------------------------------------------


    // ----- ROUTING ---------------------------------------------------------------------------------------------------
});
