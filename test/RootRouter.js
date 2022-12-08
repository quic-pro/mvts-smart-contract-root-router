const {
    ethers,
    ethers: {
        provider,
        utils: {
            parseEther,
            formatEther
        }
    }
} = require('hardhat');
const {expect} = require('chai');

const {DAY, YEAR, CodeMode} = require('./constants');


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


describe('RootRouter', async () => {
    let Contract, contractOwner, accounts;
    before(async () => {
        Contract = await ethers.getContractFactory('RootRouter');
        [contractOwner, ...accounts] = await ethers.getSigners();
    });


    let contract;
    beforeEach(async () => {
        contract = await Contract.deploy();
    });


    it('should be have as the owner the address from which the deployment was made', async () => {
        const owner = await contract.owner();
        expect(owner).to.equal(contractOwner.address);
    });

    it('should be correct initial setting', async () => {
        const buyPrice = await contract.buyPrice();
        const subscriptionPrice = await contract.subscriptionPrice();
        const modeChangePrice = await contract.modeChangePrice();
        const subscriptionDuration = await contract.subscriptionDuration();
        const holdingDuration = await contract.holdingDuration();
        const ttl = await contract.ttl();
        const baseUri = await contract.baseUri();
        const defaultSipDomain = await contract.defaultSipDomain();

        expect(buyPrice).to.equal(BUY_PRICE);
        expect(subscriptionPrice).to.equal(SUBSCRIPTION_PRICE);
        expect(modeChangePrice).to.equal(MODE_CHANGE_PRICE);
        expect(subscriptionDuration).to.equal(SUBSCRIPTION_DURATION);
        expect(holdingDuration).to.equal(HOLDING_DURATION);
        expect(ttl).to.equal(TTL);
        expect(baseUri).to.equal(BASE_URI);
        expect(defaultSipDomain).to.equal(DEFAULT_SIP_DOMAIN);
    });

    it('should be correct initial state of the data', async () => {
        const name = await contract.name();
        const symbol = await contract.symbol();
        const poolSize = await contract.POOL_SIZE();

        expect(name).to.equal(NAME);
        expect(symbol).to.equal(SYMBOL);
        expect(poolSize).to.equal(POOL_SIZE);
        for (let code = 0; code < POOL_SIZE; ++code) {
            const {
                isBlocked,
                hasSipDomain,
                hasRouter,
                subscriptionEndTime,
                mode,
                sipDomain,
                router
            } = await contract.getCodeData(code);
            expect(isBlocked).to.equal(code < 100);
            expect(hasSipDomain).to.be.false;
            expect(hasRouter).to.be.false;
            expect(subscriptionEndTime).to.equal(0);
            expect(mode).to.equal(CodeMode.Number);
            expect(sipDomain).to.be.empty;
            expect(router.chainId).to.be.empty;
            expect(router.adr).to.be.empty;
            expect(router.poolCodeLength).to.be.empty;
        }

        await expect(contract.getCodeData(POOL_SIZE)).to.be.revertedWith('Invalid code!');
    });

    it('should withdraw all funds to the owner', async () => {
        await contract.connect(accounts[0]).mint(100, {value: BUY_PRICE.toString()});
        await expect(contract.connect(accounts[0]).withdraw()).to.be.revertedWith('Ownable: caller is not the owner');

        const contractOwnerInitialBalance = await provider.getBalance(contractOwner.address);
        await contract.connect(contractOwner).withdraw();
        const contractOwnerCurrentBalance = await provider.getBalance(contractOwner.address);

        const contractBalance = await provider.getBalance(contract.address);
        const contractOwnerDeltaBalance = formatEther(contractOwnerCurrentBalance.sub(contractOwnerInitialBalance));

        expect(contractBalance).to.be.equal(0);
        expect(+contractOwnerDeltaBalance).to.be.closeTo(+formatEther(BUY_PRICE.toString()), 1e-4);
    });

    it('should be set a new buy price', async () => {
        const newBuyPrice = parseEther('5');

        await expect(contract.connect(accounts[0]).setBuyPrice(newBuyPrice)).to.be.revertedWith('Ownable: caller is not the owner');
        await contract.connect(contractOwner).setBuyPrice(newBuyPrice);

        expect(await contract.buyPrice()).to.be.equal(newBuyPrice);
    });

    it('should be set a new subscription price', async () => {
        const newSubscriptionPrice = parseEther('3');

        await expect(contract.connect(accounts[0]).setSubscriptionPrice(newSubscriptionPrice)).to.be.revertedWith('Ownable: caller is not the owner');
        await contract.connect(contractOwner).setSubscriptionPrice(newSubscriptionPrice);

        expect(await contract.subscriptionPrice()).to.be.equal(newSubscriptionPrice);
    });

    it('should be set a new mode change price', async () => {
        const newModeChangePrice = parseEther('3');

        await expect(contract.connect(accounts[0]).setModeChangePrice(newModeChangePrice)).to.be.revertedWith('Ownable: caller is not the owner');
        await contract.connect(contractOwner).setModeChangePrice(newModeChangePrice);

        expect(await contract.modeChangePrice()).to.be.equal(newModeChangePrice);
    });

    it('should be set a new subscription duration', async () => {
        const newSubscriptionDuration = parseEther('3');

        await expect(contract.connect(accounts[0]).setSubscriptionDuration(newSubscriptionDuration)).to.be.revertedWith('Ownable: caller is not the owner');
        await contract.connect(contractOwner).setSubscriptionDuration(newSubscriptionDuration);

        expect(await contract.subscriptionDuration()).to.be.equal(newSubscriptionDuration);
    });

    it('should be set a new holding duration', async () => {
        const newHoldingDuration = parseEther('3');

        await expect(contract.connect(accounts[0]).setHoldingDuration(newHoldingDuration)).to.be.revertedWith('Ownable: caller is not the owner');
        await contract.connect(contractOwner).setHoldingDuration(newHoldingDuration);

        expect(await contract.holdingDuration()).to.be.equal(newHoldingDuration);
    });

    it('should be set a new holding duration', async () => {
        const newTtl = 3 * DAY;

        await expect(contract.connect(accounts[0]).setTtl(newTtl)).to.be.revertedWith('Ownable: caller is not the owner');
        await contract.connect(contractOwner).setTtl(newTtl);

        expect(await contract.ttl()).to.be.equal(newTtl);
    });

    it('should be set a new default sip domain', async () => {
        const newDefaultSipDomain = 'sip.test';

        await expect(contract.connect(accounts[0]).setDefaultSipDomain(newDefaultSipDomain)).to.be.revertedWith('Ownable: caller is not the owner');
        await contract.connect(contractOwner).setDefaultSipDomain(newDefaultSipDomain);

        expect(await contract.defaultSipDomain()).to.be.equal(newDefaultSipDomain);
    });

    it('should be set a new base uri', async () => {
        const newBaseUri = 'https://test.test/';

        await expect(contract.connect(accounts[0]).setBaseUri(newBaseUri)).to.be.revertedWith('Ownable: caller is not the owner');
        await contract.connect(contractOwner).setBaseUri(newBaseUri);

        expect(await contract.baseUri()).to.be.equal(newBaseUri);
    });

    it('should be set a new code blocked status', async () => {
        const code = POOL_SIZE - 1;
        const {isBlocked} = await contract.getCodeData(code);

        await expect(contract.connect(accounts[0]).setCodeBlockedStatus(code, !isBlocked)).to.be.revertedWith('Ownable: caller is not the owner');
        await expect(contract.connect(contractOwner).setCodeBlockedStatus(POOL_SIZE, !isBlocked)).to.be.revertedWith('Invalid code!');
        await contract.connect(contractOwner).setCodeBlockedStatus(code, !isBlocked);

        expect((await contract.getCodeData(code)).isBlocked).to.be.equal(!isBlocked);
    });

    it('should be set a new subscription end time', async () => {
        const code = POOL_SIZE - 1;
        await contract.mint(code);
        const {subscriptionEndTime} = await contract.getCodeData(code);

        await expect(contract.connect(accounts[0]).setCodeSubscriptionEndTime(code, subscriptionEndTime + DAY)).to.be.revertedWith('Ownable: caller is not the owner');
        await expect(contract.connect(contractOwner).setCodeSubscriptionEndTime(POOL_SIZE, subscriptionEndTime + DAY)).to.be.revertedWith('Invalid code!');
        await contract.connect(contractOwner).setCodeSubscriptionEndTime(code, subscriptionEndTime + DAY);

        expect((await contract.getCodeData(code)).subscriptionEndTime).to.be.equal(subscriptionEndTime + DAY);
    });

    /*
    it('should return the correct lock status', async () => {
    });
     */
});
