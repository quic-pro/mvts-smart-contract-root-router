import hardhat, {ethers} from 'hardhat';


const WAIT_BLOCK_CONFIRMATIONS = 5;


async function main() {
    await hardhat.storageLayout.export();

    const RootRouter = await ethers.getContractFactory('RootRouter');

    console.log('Deploy...');
    const rootRouter = await RootRouter.deploy();
    await rootRouter.deployed();
    await rootRouter.deployTransaction.wait(WAIT_BLOCK_CONFIRMATIONS);
    console.log('RootRouter deployed to:', rootRouter.address);

    console.log('Verification...');
    try {
        await hardhat.run('verify:verify', {
            address: rootRouter.address,
            constructorArguments: []
        });
    } catch (error) {
        if (!(error as any).message.includes('Reason: Already Verified')) {
            throw error;
        }
    }
}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
