const {ethers} = require('hardhat');
const {expect} = require('chai');

describe('RootRouter', async () => {
    const RootRouter = await ethers.getContractFactory('RootRouter');

    let accounts, rootRouter;
    beforeEach(async () => {
        accounts = await ethers.getSigners();
        rootRouter = await RootRouter.deploy();
        await rootRouter.deployed();
    });

    it('should be successfully deployed', async () => {
        const owner = await rootRouter.owner();
        expect(owner).to.equal(accounts[0].address);
    })
});
