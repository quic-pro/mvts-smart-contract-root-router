const RootRouter = artifacts.require('./RootRouter');


module.exports = function (deployer) {
    deployer.then(async () => {
        await deployer.deploy(RootRouter);
    });
};
