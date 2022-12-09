import {ethers} from 'hardhat';


async function main() {
    const RootRouter = await ethers.getContractFactory('RootRouter');
    const rootRouter = await RootRouter.deploy();

    await rootRouter.deployed();

    console.log('RootRouter deployed to:', rootRouter.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
