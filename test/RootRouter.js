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

    it('should allow withdrawal of funds only to the owner', async () => {
        await expect(contract.connect(accounts[0]).withdraw()).to.be.revertedWith('Ownable: caller is not the owner');
        await expect(contract.connect(contractOwner).withdraw()).not.to.be.revertedWithoutReason()
    });

    it('should withdraw all funds to the owner', async () => {
        await contract.connect(accounts[0]).mint(100, {value: BUY_PRICE.toString()});

        const contractOwnerInitialBalance = await provider.getBalance(contractOwner.address);
        await contract.connect(contractOwner).withdraw();
        const contractOwnerCurrentBalance = await provider.getBalance(contractOwner.address);

        const contractBalance = await provider.getBalance(contract.address);
        const contractOwnerDeltaBalance = formatEther(contractOwnerCurrentBalance.sub(contractOwnerInitialBalance));

        expect(contractBalance).to.be.equal(0);
        expect(+contractOwnerDeltaBalance).to.be.closeTo(+formatEther(BUY_PRICE.toString()), 1e-4);
    });

    /*
    it('should return the correct lock status', async () => {
    });
     */
});
