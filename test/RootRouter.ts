import {loadFixture, time} from '@nomicfoundation/hardhat-network-helpers';
import {expect} from 'chai';
import {ethers} from 'hardhat';

import {RootRouter} from '../typechain-types';
import {DAY, YEAR} from './constants';


const {BigNumber} = ethers;
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
    const SUBSCRIPTION_DURATION = BigNumber.from(10 * YEAR);
    const HOLDING_DURATION = BigNumber.from(30 * DAY);
    const TTL = BigNumber.from(10 * DAY);
    const BASE_URI = 'https://mvts-metadata.io/';
    const DEFAULT_SIP_DOMAIN = 'sip.quic.pro';

    // Data
    const NAME = 'MetaVerse Telecom Service';
    const SYMBOL = 'MVTS';
    const POOL_SIZE = 1000;

    // Reasons
    const REASON_INVALID_CODE = 'Invalid code!';
    const REASON_NOT_AVAILABLE_FOR_MINTING = 'Not available for minting!';
    const REASON_INSUFFICIENT_FUNDS = 'Insufficient funds!';
    const REASON_CODE_NOT_IN_USE = 'Code not in use!';
    const REASON_INSUFFICIENT_RIGHTS = 'Insufficient rights!';
    const REASON_CODE_BLOCKED = 'Code blocked!';
    const REASON_INVALID_CODE_MODE = 'Invalid code mode!';


    async function deploy() {
        const [contractOwner, ...accounts] = await ethers.getSigners();

        const RootRouter = await ethers.getContractFactory('RootRouter', contractOwner);
        const rootRouter = (await RootRouter.deploy()) as RootRouter;
        await rootRouter.deployed();

        return {
            provider: ethers.provider,
            rootRouter,
            contractOwner,
            accounts
        };
    }
    
    function expectCodeData(actualCodeData: RootRouter.CodeStructOutput, expectedCodeData?: Partial<RootRouter.CodeStructOutput>) {
        expect(actualCodeData.isBlocked).to.equal(expectedCodeData?.isBlocked ?? false);
        expect(actualCodeData.hasSipDomain).to.equal(expectedCodeData?.hasSipDomain ?? false);
        expect(actualCodeData.hasRouter).to.equal(expectedCodeData?.hasRouter ?? false);
        expect(actualCodeData.subscriptionEndTime).to.closeTo(expectedCodeData?.subscriptionEndTime ?? 0, 60);
        expect(actualCodeData.mode).to.equal(expectedCodeData?.mode ?? CodeMode.Number);
        expect(actualCodeData.sipDomain).to.equal(expectedCodeData?.sipDomain ?? '');
        expect(actualCodeData.router.chainId).to.equal( expectedCodeData?.router?.chainId ?? '');
        expect(actualCodeData.router.adr).to.equal( expectedCodeData?.router?.adr ?? '');
        expect(actualCodeData.router.poolCodeLength).to.equal( expectedCodeData?.router?.poolCodeLength ?? '');
    }

    function expectCodeStatus(actualCodeStatus: RootRouter.CodeStatusStruct, expectedCodeStatus?: Partial<RootRouter.CodeStatusStruct>) {
        expect(actualCodeStatus.isBlocked).to.equal(expectedCodeStatus?.isBlocked ?? false);
        expect(actualCodeStatus.hasOwner).to.equal(expectedCodeStatus?.hasOwner ?? false);
        expect(actualCodeStatus.isHeld).to.equal(expectedCodeStatus?.isHeld ?? false);
        expect(actualCodeStatus.isAvailableForMint).to.equal(expectedCodeStatus?.isAvailableForMint ?? false);
        expect(actualCodeStatus.subscriptionEndTime).to.closeTo(expectedCodeStatus?.subscriptionEndTime ?? 0, 60);
        expect(actualCodeStatus.holdEndTime).to.closeTo(expectedCodeStatus?.holdEndTime ?? 0, 60);
    }

    async function getEndTime(duration: number | InstanceType<typeof BigNumber>): Promise<InstanceType<typeof BigNumber>> {
        return BigNumber.from(await time.latest()).add(duration);
    }



    // ----- SETTINGS --------------------------------------------------------------------------------------------------

    it('The initial settings should be as expected', async () => {
        const {rootRouter, contractOwner} = await loadFixture(deploy);

        expect(await rootRouter.owner()).to.equal(contractOwner.address);
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

    it('The initial data should be as expected', async () => {
        const {rootRouter} = await loadFixture(deploy);

        expect(await rootRouter.name()).to.equal(NAME);
        expect(await rootRouter.symbol()).to.equal(SYMBOL);
        expect(await rootRouter.POOL_SIZE()).to.equal(POOL_SIZE);

        for (let code = 0; code < POOL_SIZE; ++code) {
            await expect(rootRouter.getCodeData(code)).to.revertedWith(REASON_CODE_NOT_IN_USE);
        }
    });


    // ----- CONSTRUCTOR -----------------------------------------------------------------------------------------------

    it('The constructor must block the first hundred numbers', async () => {
        const {rootRouter} = await loadFixture(deploy);

        for (let code = 0; code < POOL_SIZE; ++code) {
            expect((await rootRouter.isBlocked(code))).to.equal(code < 100);
        }
    });


    // ----- PUBLIC UTILS ----------------------------------------------------------------------------------------------

    it('Method hasOwner: if code is invalid', async () => {
        const {rootRouter} = await loadFixture(deploy);

        await expect(rootRouter.hasOwner(POOL_SIZE)).to.revertedWith(REASON_INVALID_CODE);
    });

    it('Method hasOwner: if the code has no owner', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        expect(await rootRouter.hasOwner(code)).to.false;
    });

    it('Method hasOwner: if the code has an owner', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        // If the code has an owner
        await rootRouter.mint(code);
        expect(await rootRouter.hasOwner(code)).to.true;
    });

    it('Method hasOwner: if the code is held', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.mint(code);
        await rootRouter.setCodeSubscriptionEndTime(code, await time.latest());
        expect(await rootRouter.hasOwner(code)).to.true;
    });

    it('Method hasOwner: if the code subscription and hold time is over', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.mint(code);
        await rootRouter.setCodeSubscriptionEndTime(code, 0);
        expect(await rootRouter.hasOwner(code)).to.false;
    });

    it('Method getCodeData: if code is invalid', async () => {
        const {rootRouter} = await loadFixture(deploy);

        await expect(rootRouter.getCodeData(POOL_SIZE)).to.revertedWith(REASON_INVALID_CODE);
    });

    it('Method getCodeData: if code not in use', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await expect(rootRouter.getCodeData(code)).to.revertedWith(REASON_CODE_NOT_IN_USE);
    });

    it('Method getCodeData: if the call is valid', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.mint(code);
        expectCodeData(await rootRouter.getCodeData(code), {
            subscriptionEndTime: await getEndTime(SUBSCRIPTION_DURATION)
        });
    });

    it('Method isBlocked: if code is invalid', async () => {
        const {rootRouter} = await loadFixture(deploy);

        await expect(rootRouter.isBlocked(POOL_SIZE)).to.revertedWith(REASON_INVALID_CODE);
    });

    it('Method isBlocked: if the code is not blocked', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        expect(await rootRouter.isBlocked(code)).to.false;
    });

    it('Method isBlocked: if the code is blocked', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.setCodeBlockedStatus(code, true);
        expect(await rootRouter.isBlocked(code)).to.true;
    });

    it('Method isHeld: if code is invalid', async () => {
        const {rootRouter} = await loadFixture(deploy);

        await expect(rootRouter.isHeld(POOL_SIZE)).to.revertedWith(REASON_INVALID_CODE);
    });

    it('Method isHeld: if the code is not held', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        expect(await rootRouter.isHeld(code)).to.false;
    });

    it('Method isHeld: if the code is held', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.mint(code);
        await rootRouter.setCodeSubscriptionEndTime(code, await time.latest());
        expect(await rootRouter.isHeld(code)).to.true;
    });

    it('Method isAvailableForMint: if code is invalid', async () => {
        const {rootRouter} = await loadFixture(deploy);

        await expect(rootRouter.isAvailableForMint(POOL_SIZE)).to.revertedWith(REASON_INVALID_CODE);
    });

    it('Method isAvailableForMint: if the code is available for minting', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        expect(await rootRouter.isAvailableForMint(code)).to.true;
    });

    it('Method isAvailableForMint: if the code is blocked', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.setCodeBlockedStatus(code, true);
        expect(await rootRouter.isAvailableForMint(code)).to.false;
    });

    it('Method isAvailableForMint: if the code has an owner', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.mint(code);
        expect(await rootRouter.isAvailableForMint(code)).to.false;
    });

    it('Method isAvailableForMint: if the code is blocked and has an owner', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.mint(code);
        await rootRouter.setCodeBlockedStatus(code, true);
        expect(await rootRouter.isAvailableForMint(code)).to.false;
    });

    it('Method isNumberMode: if code is invalid', async () => {
        const {rootRouter} = await loadFixture(deploy);

        await expect(rootRouter.isNumberMode(POOL_SIZE)).to.revertedWith(REASON_INVALID_CODE);
    });

    it('Method isNumberMode: if code not in use', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await expect(rootRouter.isNumberMode(code)).to.revertedWith(REASON_CODE_NOT_IN_USE);
    });

    it('Method isNumberMode: if the code is a number', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.mint(code);
        expect(await rootRouter.isNumberMode(code)).to.true;
    });

    it('Method isNumberMode: if the code is a pool', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.mint(code);
        await rootRouter.changeCodeMode(code);
        expect(await rootRouter.isNumberMode(code)).to.false;
    });

    it('Method isPoolMode: if code is invalid', async () => {
        const {rootRouter} = await loadFixture(deploy);

        await expect(rootRouter.isPoolMode(POOL_SIZE)).to.revertedWith(REASON_INVALID_CODE);
    });

    it('Method isPoolMode: if code not in use', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await expect(rootRouter.isPoolMode(code)).to.revertedWith(REASON_CODE_NOT_IN_USE);
    });

    it('Method isPoolMode: if the code is a number', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.mint(code);
        expect(await rootRouter.isPoolMode(code)).to.false;
    });

    it('Method isPoolMode: if the code is a pool', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.mint(code);
        await rootRouter.changeCodeMode(code);
        expect(await rootRouter.isPoolMode(code)).to.true;
    });

    it('Method getMode: if code is invalid', async () => {
        const {rootRouter} = await loadFixture(deploy);

        await expect(rootRouter.getMode(POOL_SIZE)).to.revertedWith(REASON_INVALID_CODE);
    });

    it('Method getMode: if code not in use', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await expect(rootRouter.getMode(code)).to.revertedWith(REASON_CODE_NOT_IN_USE);
    });

    it('Method getMode: if the code is a number', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.mint(code);
        expect(await rootRouter.getMode(code)).to.equal(CodeMode.Number);
    });

    it('Method getMode: if the code is a pool', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.mint(code);
        await rootRouter.changeCodeMode(code);
        expect(await rootRouter.getMode(code)).to.equal(CodeMode.Pool);
    });

    it('Method getCodeStatus: if code is invalid', async () => {
        const {rootRouter} = await loadFixture(deploy);

        await expect(rootRouter.getCodeStatus(POOL_SIZE)).to.revertedWith(REASON_INVALID_CODE);
    });

    it('Method getCodeStatus: if the code is blocked', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.setCodeBlockedStatus(code, true);
        expectCodeStatus(await rootRouter.getCodeStatus(code), {
            isBlocked: true,
            isAvailableForMint: false
        });
    });

    it('Method getCodeStatus: if the code has no owner', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        expectCodeStatus(await rootRouter.getCodeStatus(code), {
            isAvailableForMint: true
        });
    });

    it('Method getCodeStatus: if the code has an owner', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.mint(code);
        expectCodeStatus(await rootRouter.getCodeStatus(code), {
            hasOwner: true,
            isAvailableForMint: false,
            subscriptionEndTime: await getEndTime(SUBSCRIPTION_DURATION),
            holdEndTime: await getEndTime(SUBSCRIPTION_DURATION.add(HOLDING_DURATION))
        });
    });

    it('Method getCodeStatus: if the code is held', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.mint(code);
        await rootRouter.setCodeSubscriptionEndTime(code, await getEndTime(0));
        expectCodeStatus(await rootRouter.getCodeStatus(code), {
            hasOwner: true,
            isHeld: true,
            isAvailableForMint: false,
            subscriptionEndTime: await getEndTime(0),
            holdEndTime: await getEndTime(HOLDING_DURATION)
        });
    });

    it('Method getBlockedCodes', async () => {
        const {rootRouter} = await loadFixture(deploy);

        const blockedCodes = await rootRouter.getBlockedCodes();
        expect(blockedCodes).to.length(POOL_SIZE);
        for (let code = 0; code < POOL_SIZE; ++code) {
            expect(blockedCodes[code]).to.equal(code < 100);
        }
    });

    it('Method getHeldCodes', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const heldCode = 100;

        await rootRouter.mint(heldCode);
        await rootRouter.setCodeSubscriptionEndTime(heldCode, await getEndTime(0));

        const heldCodes = await rootRouter.getHeldCodes();
        expect(heldCodes).to.length(POOL_SIZE);
        for (let code = 0; code < POOL_SIZE; ++code) {
            expect(heldCodes[code]).to.equal(code === heldCode);
        }
    });

    it('Method getAvailableForMintCodes', async () => {
        const {rootRouter} = await loadFixture(deploy);

        const availableForMintCodes = await rootRouter.getAvailableForMintCodes();
        expect(availableForMintCodes).to.length(POOL_SIZE);
        for (let code = 0; code < POOL_SIZE; ++code) {
            expect(availableForMintCodes[code]).to.equal(code >= 100);
        }
    });

    it('Method getPoolCodes', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const poolCode = 100;

        await rootRouter.mint(poolCode);
        await rootRouter.changeCodeMode(poolCode);

        const poolCodes = await rootRouter.getPoolCodes();
        expect(poolCodes).to.length(POOL_SIZE);
        for (let code = 0; code < POOL_SIZE; ++code) {
            expect(poolCodes[code]).to.equal(code === poolCode);
        }
    });

    it('Method getOwnerCodes', async () => {
        const {rootRouter, contractOwner} = await loadFixture(deploy);
        const codeContractOwner = 100;

        await rootRouter.mint(codeContractOwner);

        const ownerCodes = await rootRouter.getOwnerCodes(contractOwner.address);
        expect(ownerCodes).to.length(POOL_SIZE);
        for (let code = 0; code < POOL_SIZE; ++code) {
            expect(ownerCodes[code]).to.equal(code === codeContractOwner);
        }
    });


    // ----- SMART CONTRACT MANAGEMENT ---------------------------------------------------------------------------------

    it('Method withdraw', async () => {
        const {provider, rootRouter, contractOwner, accounts} = await loadFixture(deploy);

        await rootRouter.connect(accounts[0]).mint(100, {value: MINT_PRICE});
        await expect(rootRouter.connect(accounts[0]).withdraw()).to.revertedWith('Ownable: caller is not the owner');

        const contractOwnerInitialBalance = await provider.getBalance(contractOwner.address);
        await rootRouter.connect(contractOwner).withdraw();
        const contractOwnerCurrentBalance = await provider.getBalance(contractOwner.address);

        const contractBalance = await provider.getBalance(rootRouter.address);
        const contractOwnerDeltaBalance = formatEther(contractOwnerCurrentBalance.sub(contractOwnerInitialBalance));

        expect(contractBalance).to.equal(0);
        expect(+contractOwnerDeltaBalance).to.closeTo(+formatEther(MINT_PRICE.toString()), 1e-4);
    });

    it('Method setMintPrice', async () => {
        const {rootRouter, contractOwner, accounts} = await loadFixture(deploy);

        const newMintPrice = parseEther('5');

        await expect(rootRouter.connect(accounts[0]).setMintPrice(newMintPrice)).to.revertedWith('Ownable: caller is not the owner');
        await rootRouter.connect(contractOwner).setMintPrice(newMintPrice);

        expect(await rootRouter.mintPrice()).to.equal(newMintPrice);
    });

    it('Method setSubscriptionPrice', async () => {
        const {rootRouter, contractOwner, accounts} = await loadFixture(deploy);

        const newSubscriptionPrice = parseEther('3');

        await expect(rootRouter.connect(accounts[0]).setSubscriptionPrice(newSubscriptionPrice)).to.revertedWith('Ownable: caller is not the owner');
        await rootRouter.connect(contractOwner).setSubscriptionPrice(newSubscriptionPrice);

        expect(await rootRouter.subscriptionPrice()).to.equal(newSubscriptionPrice);
    });

    it('Method setModeChangePrice', async () => {
        const {rootRouter, contractOwner, accounts} = await loadFixture(deploy);

        const newModeChangePrice = parseEther('3');

        await expect(rootRouter.connect(accounts[0]).setModeChangePrice(newModeChangePrice)).to.revertedWith('Ownable: caller is not the owner');
        await rootRouter.connect(contractOwner).setModeChangePrice(newModeChangePrice);

        expect(await rootRouter.modeChangePrice()).to.equal(newModeChangePrice);
    });

    it('Method setSubscriptionDuration', async () => {
        const {rootRouter, contractOwner, accounts} = await loadFixture(deploy);

        const newSubscriptionDuration = parseEther('3');

        await expect(rootRouter.connect(accounts[0]).setSubscriptionDuration(newSubscriptionDuration)).to.revertedWith('Ownable: caller is not the owner');
        await rootRouter.connect(contractOwner).setSubscriptionDuration(newSubscriptionDuration);

        expect(await rootRouter.subscriptionDuration()).to.equal(newSubscriptionDuration);
    });

    it('Method setHoldingDuration', async () => {
        const {rootRouter, contractOwner, accounts} = await loadFixture(deploy);

        const newHoldingDuration = parseEther('3');

        await expect(rootRouter.connect(accounts[0]).setHoldingDuration(newHoldingDuration)).to.revertedWith('Ownable: caller is not the owner');
        await rootRouter.connect(contractOwner).setHoldingDuration(newHoldingDuration);

        expect(await rootRouter.holdingDuration()).to.equal(newHoldingDuration);
    });

    it('Method setTtl', async () => {
        const {rootRouter, contractOwner, accounts} = await loadFixture(deploy);

        const newTtl = 3 * DAY;

        await expect(rootRouter.connect(accounts[0]).setTtl(newTtl)).to.revertedWith('Ownable: caller is not the owner');
        await rootRouter.connect(contractOwner).setTtl(newTtl);

        expect(await rootRouter.ttl()).to.equal(newTtl);
    });

    it('Method setDefaultSipDomain', async () => {
        const {rootRouter, contractOwner, accounts} = await loadFixture(deploy);

        const newDefaultSipDomain = 'sip.test';

        await expect(rootRouter.connect(accounts[0]).setDefaultSipDomain(newDefaultSipDomain)).to.revertedWith('Ownable: caller is not the owner');
        await rootRouter.connect(contractOwner).setDefaultSipDomain(newDefaultSipDomain);

        expect(await rootRouter.defaultSipDomain()).to.equal(newDefaultSipDomain);
    });

    it('Method setBaseUri', async () => {
        const {rootRouter, contractOwner, accounts} = await loadFixture(deploy);

        const newBaseUri = 'https://test.test/';

        await expect(rootRouter.connect(accounts[0]).setBaseUri(newBaseUri)).to.revertedWith('Ownable: caller is not the owner');
        await rootRouter.connect(contractOwner).setBaseUri(newBaseUri);

        expect(await rootRouter.baseUri()).to.equal(newBaseUri);
    });

    it('Method setCodeBlockedStatus', async () => {
        const {rootRouter, contractOwner, accounts} = await loadFixture(deploy);

        const code = 100;
        const isBlocked = await rootRouter.isBlocked(code);

        await expect(rootRouter.connect(accounts[0]).setCodeBlockedStatus(code, !isBlocked)).to.revertedWith('Ownable: caller is not the owner');
        await expect(rootRouter.connect(contractOwner).setCodeBlockedStatus(POOL_SIZE, !isBlocked)).to.revertedWith('Invalid code!');
        await rootRouter.connect(contractOwner).setCodeBlockedStatus(code, !isBlocked);

        expect((await rootRouter.isBlocked(code))).to.equal(!isBlocked);
    });

    it('Method setCodeSubscriptionEndTime', async () => {
        const {rootRouter, contractOwner, accounts} = await loadFixture(deploy);

        const code = 100;
        await rootRouter.mint(code);
        const {subscriptionEndTime} = await rootRouter.getCodeData(code);

        await expect(rootRouter.connect(accounts[0]).setCodeSubscriptionEndTime(code, subscriptionEndTime.add(DAY))).to.revertedWith('Ownable: caller is not the owner');
        await expect(rootRouter.connect(contractOwner).setCodeSubscriptionEndTime(POOL_SIZE, subscriptionEndTime.add(DAY))).to.revertedWith('Invalid code!');
        await rootRouter.connect(contractOwner).setCodeSubscriptionEndTime(code, subscriptionEndTime.add(DAY));

        expect((await rootRouter.getCodeData(code)).subscriptionEndTime).to.equal(subscriptionEndTime.add(DAY));
    });


    // ----- CODE MANAGEMENT -------------------------------------------------------------------------------------------

    it('Method mint: if code is invalid', async () => {
        const {rootRouter, contractOwner, accounts: [client]} = await loadFixture(deploy);
        const code = POOL_SIZE;

        await expect(rootRouter.connect(contractOwner).mint(code, {value: MINT_PRICE})).to.revertedWith(REASON_INVALID_CODE);
        await expect(rootRouter.connect(client).mint(code, {value: MINT_PRICE})).to.revertedWith(REASON_INVALID_CODE);
    });

    it('Method mint: if the code is not available for minting', async () => {
        const {rootRouter, contractOwner, accounts: [client]} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.setCodeBlockedStatus(code, true);
        await expect(rootRouter.connect(client).mint(code, {value: MINT_PRICE})).to.revertedWith(REASON_NOT_AVAILABLE_FOR_MINTING);
        await expect(rootRouter.connect(contractOwner).mint(code, {value: MINT_PRICE})).to.revertedWith(REASON_NOT_AVAILABLE_FOR_MINTING);
        await rootRouter.setCodeBlockedStatus(code, false);

        await rootRouter.mint(code);
        await expect(rootRouter.connect(client).mint(code, {value: MINT_PRICE})).to.revertedWith(REASON_NOT_AVAILABLE_FOR_MINTING);
        await expect(rootRouter.connect(contractOwner).mint(code, {value: MINT_PRICE})).to.revertedWith(REASON_NOT_AVAILABLE_FOR_MINTING);
    });

    it('Method mint: if insufficient funds', async () => {
        const {rootRouter, contractOwner, accounts: [client]} = await loadFixture(deploy);
        const code = 100;

        await expect(rootRouter.connect(client).mint(code, {value: BigNumber.from(0)})).to.revertedWith(REASON_INSUFFICIENT_FUNDS);
        expect(await rootRouter.connect(contractOwner).mint(code, {value: BigNumber.from(0)})).to.changeTokenBalance(rootRouter, contractOwner, 1);
    });

    it('Method mint: minting with cleaning of code data after the previous owner', async () => {
        const {rootRouter, accounts: [client1, client2]} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.connect(client1).mint(code, {value: MINT_PRICE});
        await rootRouter.connect(client1).changeCodeMode(code, {value: MODE_CHANGE_PRICE});
        await rootRouter.setCodeSubscriptionEndTime(code, 0);

        expect(await rootRouter.connect(client2).mint(code, {value: MINT_PRICE})).to.changeTokenBalances(rootRouter, [client1, client2], [-1, 1]);
        expectCodeData(await rootRouter.getCodeData(code), {subscriptionEndTime: await getEndTime(SUBSCRIPTION_DURATION)});
    });

    it('Method renewSubscription: if code is invalid', async () => {
        const {rootRouter, contractOwner, accounts: [client]} = await loadFixture(deploy);
        const code = POOL_SIZE;

        await expect(rootRouter.connect(contractOwner).renewSubscription(code, {value: SUBSCRIPTION_PRICE})).to.revertedWith(REASON_INVALID_CODE);
        await expect(rootRouter.connect(client).renewSubscription(code, {value: SUBSCRIPTION_PRICE})).to.revertedWith(REASON_INVALID_CODE);
    });

    it('Method renewSubscription: if insufficient rights', async () => {
        const {rootRouter, contractOwner, accounts: [client]} = await loadFixture(deploy);
        const code = 100;

        expect(await rootRouter.connect(contractOwner).renewSubscription(code, {value: SUBSCRIPTION_PRICE})).to.not.reverted;
        await expect(rootRouter.connect(client).renewSubscription(code, {value: SUBSCRIPTION_PRICE})).to.revertedWith(REASON_INSUFFICIENT_RIGHTS);
    });

    it('Method renewSubscription: if insufficient funds', async () => {
        const {rootRouter, contractOwner, accounts: [client]} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.connect(client).mint(code, {value: MINT_PRICE});
        expect(await rootRouter.connect(contractOwner).renewSubscription(code, {value: BigNumber.from(0)})).to.not.reverted;
        await expect(rootRouter.connect(client).renewSubscription(code, {value: BigNumber.from(0)})).to.revertedWith(REASON_INSUFFICIENT_FUNDS);
    });

    it('Method renewSubscription: successful', async () => {
        const {rootRouter, contractOwner} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.connect(contractOwner).mint(code, {value: MINT_PRICE});
        expect(await rootRouter.connect(contractOwner).renewSubscription(code, {value: SUBSCRIPTION_PRICE})).to.not.reverted;
        expectCodeData(await rootRouter.getCodeData(code), {
            subscriptionEndTime: await getEndTime(SUBSCRIPTION_DURATION.mul(2))
        });
    });

    it('Method transferOwnershipOfCode', async () => {
    });
    it('Method renounceOwnershipOfCode', async () => {
    });
    it('Method changeCodeMode', async () => {
    });
    it('Method setCodeSipDomain', async () => {
        const {rootRouter, contractOwner, accounts: [codeOwner, anotherClient]} = await loadFixture(deploy);

        const subscriptionEndTime = await time.latest() + DAY;

        // If the code is missing from the pool:
        await expect(rootRouter.setCodeSipDomain(POOL_SIZE, codeOwner.address)).to.revertedWith(REASON_INVALID_CODE);

        // If not the owner of the code:
        await expect(rootRouter.connect(anotherClient).setCodeSipDomain(100, anotherClient.address)).to.revertedWith(REASON_INSUFFICIENT_RIGHTS);
        await rootRouter.connect(codeOwner).mint(100, {value: MINT_PRICE});
        await expect(rootRouter.connect(anotherClient).setCodeSipDomain(100, anotherClient.address)).to.revertedWith(REASON_INSUFFICIENT_RIGHTS);

        // If the owner of the code or contract:
        expect(await rootRouter.connect(codeOwner).setCodeSipDomain(100, codeOwner.address));
        expect((await rootRouter.connect(codeOwner).getCodeData(100)).sipDomain).to.equal(codeOwner.address);
        expect(await rootRouter.connect(contractOwner).setCodeSipDomain(100, contractOwner.address));
        expect((await rootRouter.connect(contractOwner).getCodeData(100)).sipDomain).to.equal(contractOwner.address);

        // If the code is not a number:
        await rootRouter.changeCodeMode(100);
        await expect(rootRouter.connect(codeOwner).setCodeSipDomain(100, codeOwner.address)).to.revertedWith(REASON_INVALID_CODE_MODE);
        await expect(rootRouter.connect(contractOwner).setCodeSipDomain(100, contractOwner.address)).to.revertedWith(REASON_INVALID_CODE_MODE);

        // If the code is blocked:
        await rootRouter.setCodeBlockedStatus(100, true);
        await expect(rootRouter.connect(codeOwner).setCodeSipDomain(100, codeOwner.address)).to.revertedWith(REASON_CODE_BLOCKED);
        await expect(rootRouter.connect(contractOwner).setCodeSipDomain(100, contractOwner.address)).to.revertedWith(REASON_CODE_BLOCKED);
    });

    it('Method clearCodeSipDomain', async () => {
        const {rootRouter, contractOwner, accounts: [codeOwner, anotherClient]} = await loadFixture(deploy);

        // If the code is missing from the pool:
        await expect(rootRouter.clearCodeSipDomain(POOL_SIZE)).to.revertedWith(REASON_INVALID_CODE);

        // If not the owner of the code:
        await expect(rootRouter.connect(anotherClient).clearCodeSipDomain(100)).to.revertedWith(REASON_INSUFFICIENT_RIGHTS);
        await rootRouter.connect(codeOwner).mint(100, {value: MINT_PRICE});
        await expect(rootRouter.connect(anotherClient).clearCodeSipDomain(100)).to.revertedWith(REASON_INSUFFICIENT_RIGHTS);

        // If the owner of the code or contract:
        await rootRouter.connect(codeOwner).setCodeSipDomain(100, codeOwner.address)
        expect(await rootRouter.connect(codeOwner).clearCodeSipDomain(100));
        expect((await rootRouter.connect(codeOwner).getCodeData(100)).sipDomain).to.equal('');
        await rootRouter.connect(contractOwner).setCodeSipDomain(100, contractOwner.address)
        expect(await rootRouter.connect(contractOwner).clearCodeSipDomain(100));
        expect((await rootRouter.connect(contractOwner).getCodeData(100)).sipDomain).to.equal('');

        // If the code is not a number:
        await rootRouter.changeCodeMode(100);
        await expect(rootRouter.connect(codeOwner).clearCodeSipDomain(100)).to.revertedWith(REASON_INVALID_CODE_MODE);
        await expect(rootRouter.connect(contractOwner).clearCodeSipDomain(100)).to.revertedWith(REASON_INVALID_CODE_MODE);

        // If the code is blocked:
        await rootRouter.setCodeBlockedStatus(100, true);
        await expect(rootRouter.connect(codeOwner).clearCodeSipDomain(100)).to.revertedWith(REASON_CODE_BLOCKED);
        await expect(rootRouter.connect(contractOwner).clearCodeSipDomain(100)).to.revertedWith(REASON_CODE_BLOCKED);
    });

    it('Method setCodeRouter', async () => {
        const {rootRouter, contractOwner, accounts: [codeOwner, anotherClient]} = await loadFixture(deploy);

        const subscriptionEndTime = await time.latest() + DAY;
        const newChainId = 1;
        const newAddress = 'test';
        const newPoolCodeLength = 3;

        // If the code is missing from the pool:
        await expect(rootRouter.setCodeRouter(POOL_SIZE, newChainId, newAddress, newPoolCodeLength)).to.revertedWith(REASON_INVALID_CODE);

        // If not the owner of the code:
        await expect(rootRouter.connect(anotherClient).setCodeRouter(100, newChainId, newAddress, newPoolCodeLength)).to.revertedWith(REASON_INSUFFICIENT_RIGHTS);
        await rootRouter.connect(codeOwner).mint(100, {value: MINT_PRICE});
        await expect(rootRouter.connect(anotherClient).setCodeRouter(100, newChainId, newAddress, newPoolCodeLength)).to.revertedWith(REASON_INSUFFICIENT_RIGHTS);

        // If the code is not a pool:
        await expect(rootRouter.connect(codeOwner).setCodeRouter(100, newChainId, newAddress, newPoolCodeLength)).to.revertedWith(REASON_INVALID_CODE_MODE);
        await expect(rootRouter.connect(contractOwner).setCodeRouter(100, newChainId, newAddress, newPoolCodeLength)).to.revertedWith(REASON_INVALID_CODE_MODE);

        // If the owner of the code or contract:
        await rootRouter.changeCodeMode(100);
        expect(await rootRouter.connect(codeOwner).setCodeRouter(100, newChainId, newAddress, newPoolCodeLength));
        await rootRouter.setCodeSubscriptionEndTime(100, subscriptionEndTime);
        expect(await rootRouter.getCodeData(100)).to.have.deep.members([
            false, // isBlocked
            false, // hasSipDomain
            true, // hasRouter
            BigNumber.from(subscriptionEndTime), // subscriptionEndTime
            CodeMode.Pool, // mode
            '', // sipDomain
            [ // router
                newChainId.toString(), // chainId
                newAddress, // adr
                newPoolCodeLength.toString() // poolCodeLength
            ]
        ]);
        expect(await rootRouter.connect(contractOwner).setCodeRouter(100, newChainId, newAddress, newPoolCodeLength));
        await rootRouter.setCodeSubscriptionEndTime(100, subscriptionEndTime);
        expect(await rootRouter.getCodeData(100)).to.have.deep.members([
            false, // isBlocked
            false, // hasSipDomain
            true, // hasRouter
            BigNumber.from(subscriptionEndTime), // subscriptionEndTime
            CodeMode.Pool, // mode
            '', // sipDomain
            [ // router
                newChainId.toString(), // chainId
                newAddress, // adr
                newPoolCodeLength.toString() // poolCodeLength
            ]
        ]);

        // If the code is blocked:
        await rootRouter.connect(contractOwner).setCodeBlockedStatus(100, true);
        await expect(rootRouter.connect(codeOwner).setCodeRouter(100, newChainId, newAddress, newPoolCodeLength)).to.revertedWith(REASON_CODE_BLOCKED);
        await expect(rootRouter.connect(contractOwner).setCodeRouter(100, newChainId, newAddress, newPoolCodeLength)).to.revertedWith(REASON_CODE_BLOCKED);
    });

    it('Method clearCodeRouter', async () => {
    });


    // ----- ROUTING ---------------------------------------------------------------------------------------------------
});
