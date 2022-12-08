const {ether} = require('@openzeppelin/test-helpers');
const {ethers} = require('hardhat');
const {expect} = require('chai');


describe('RootRouter',() => {
    let accounts, rootRouter;
    beforeEach(async () => {
        const RootRouter = await ethers.getContractFactory('RootRouter');
        accounts = await ethers.getSigners();
        rootRouter = await RootRouter.deploy();
        await rootRouter.deployed();
    });

    it('should be successfully deployed', async () => {
        const owner = await rootRouter.owner();
        expect(owner).to.equal(accounts[0].address);
    });

    it('should be correct initial value of the fields', async () => {
        const POOL_SIZE = await rootRouter.POOL_SIZE();
        const buyPrice = await rootRouter.buyPrice();
        const subscriptionPrice = await rootRouter.subscriptionPrice();
        const modeChangePrice = await rootRouter.modeChangePrice();
        const subscriptionDuration = await rootRouter.subscriptionDuration();
        const codeFreezeDuration = await rootRouter.codeFreezeDuration();
        const ttl = await rootRouter.ttl();
        const baseUri = await rootRouter.baseUri();
        const defaultSipDomain = await rootRouter.defaultSipDomain();

        expect(POOL_SIZE).to.equal(1000);
        expect(buyPrice).to.equal(ether('10'));
        expect(subscriptionPrice).to.equal(ether('7'));
        expect(modeChangePrice).to.equal(ether('5'));
        expect(subscriptionDuration).to.equal(315532800);
        expect(codeFreezeDuration).to.equal(7776000);
        expect(ttl).to.equal('864000');
        expect(baseUri).to.equal('https://mvts-metadata.io/');
        expect(defaultSipDomain).to.equal('sip.quic.pro');
    });
});
