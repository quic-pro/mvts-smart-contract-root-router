import {loadFixture, time} from '@nomicfoundation/hardhat-network-helpers';
import {expect} from 'chai';
import {ethers} from 'hardhat';

import {RootRouter} from '../typechain-types';
import {DAY, YEAR} from './constants';


const {BigNumber} = ethers;
const {parseEther} = ethers.utils;
const {Zero, AddressZero} = ethers.constants;


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
    const REASON_CALLER_IS_NOT_THE_OWNER = 'Ownable: caller is not the owner';


    async function deploy() {
        const [owner, ...accounts] = await ethers.getSigners();

        const RootRouter = await ethers.getContractFactory('RootRouter', owner);
        const rootRouter = (await RootRouter.deploy()) as RootRouter;
        await rootRouter.deployed();

        return {
            rootRouter,
            owner,
            accounts
        };
    }

    function expectCodeData(actualCodeData: RootRouter.CodeStructOutput, expectedCodeData?: Partial<RootRouter.CodeStructOutput>) {
        expect(actualCodeData).to.length(7);
        expect(actualCodeData.isBlocked).to.equal(expectedCodeData?.isBlocked ?? false);
        expect(actualCodeData.hasSipDomain).to.equal(expectedCodeData?.hasSipDomain ?? false);
        expect(actualCodeData.hasRouter).to.equal(expectedCodeData?.hasRouter ?? false);
        expect(actualCodeData.subscriptionEndTime).to.closeTo(expectedCodeData?.subscriptionEndTime ?? 0, 10);
        expect(actualCodeData.mode).to.equal(expectedCodeData?.mode ?? CodeMode.Number);
        expect(actualCodeData.sipDomain).to.equal(expectedCodeData?.sipDomain ?? '');
        expect(actualCodeData.router).to.have.deep.members([
            expectedCodeData?.router?.chainId ?? '',
            expectedCodeData?.router?.adr ?? '',
            expectedCodeData?.router?.poolCodeLength ?? ''
        ]);
    }

    function expectCodeStatus(actualCodeStatus: RootRouter.CodeStatusStruct, expectedCodeStatus?: Partial<RootRouter.CodeStatusStruct>) {
        expect(actualCodeStatus).to.length(6);
        expect(actualCodeStatus.isBlocked).to.equal(expectedCodeStatus?.isBlocked ?? false);
        expect(actualCodeStatus.hasOwner).to.equal(expectedCodeStatus?.hasOwner ?? false);
        expect(actualCodeStatus.isHeld).to.equal(expectedCodeStatus?.isHeld ?? false);
        expect(actualCodeStatus.isAvailableForMint).to.equal(expectedCodeStatus?.isAvailableForMint ?? false);
        expect(actualCodeStatus.subscriptionEndTime).to.closeTo(expectedCodeStatus?.subscriptionEndTime ?? 0, 10);
        expect(actualCodeStatus.holdEndTime).to.closeTo(expectedCodeStatus?.holdEndTime ?? 0, 10);
    }

    async function getEndTime(duration: number | InstanceType<typeof BigNumber>): Promise<InstanceType<typeof BigNumber>> {
        return BigNumber.from(await time.latest()).add(duration);
    }


    // ----- SETTINGS --------------------------------------------------------------------------------------------------

    it('The initial settings should be as expected', async () => {
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


    // ----- ERC721 ----------------------------------------------------------------------------------------------------

    it('Method ERC721.tokenURI', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.mint(code);
        expect(await rootRouter.tokenURI(code)).to.equal(BASE_URI + code);
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
        const {rootRouter, owner} = await loadFixture(deploy);
        const codeContractOwner = 100;

        await rootRouter.mint(codeContractOwner);

        const ownerCodes = await rootRouter.getOwnerCodes(owner.address);
        expect(ownerCodes).to.length(POOL_SIZE);
        for (let code = 0; code < POOL_SIZE; ++code) {
            expect(ownerCodes[code]).to.equal(code === codeContractOwner);
        }
    });


    // ----- SMART CONTRACT MANAGEMENT ---------------------------------------------------------------------------------

    it('Method withdraw: if caller is not the owner', async () => {
        const {rootRouter, accounts: [client]} = await loadFixture(deploy);

        await expect(rootRouter.connect(client).withdraw()).to.revertedWith(REASON_CALLER_IS_NOT_THE_OWNER);
    });

    it('Method withdraw: if caller is owner', async () => {
        const {rootRouter, owner, accounts: [client]} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.connect(client).mint(code, {value: MINT_PRICE});

        await expect(rootRouter.withdraw()).to.changeEtherBalances([rootRouter, owner], [MINT_PRICE.mul(-1), MINT_PRICE]);
    });

    it('Method setMintPrice: if caller is not the owner', async () => {
        const {rootRouter, accounts: [client]} = await loadFixture(deploy);
        const newMintPrice = parseEther('5');

        await expect(rootRouter.connect(client).setMintPrice(newMintPrice)).to.revertedWith(REASON_CALLER_IS_NOT_THE_OWNER);
    });

    it('Method setMintPrice: if caller is owner', async () => {
        const {rootRouter, owner} = await loadFixture(deploy);
        const newMintPrice = parseEther('5');

        await expect(rootRouter.connect(owner).setMintPrice(newMintPrice)).not.to.be.reverted;
        expect(await rootRouter.mintPrice()).to.equal(newMintPrice);
    });

    it('Method setSubscriptionPrice: if caller is not the owner', async () => {
        const {rootRouter, accounts: [client]} = await loadFixture(deploy);
        const newSubscriptionPrice = parseEther('3');

        await expect(rootRouter.connect(client).setSubscriptionPrice(newSubscriptionPrice)).to.revertedWith(REASON_CALLER_IS_NOT_THE_OWNER);
    });

    it('Method setSubscriptionPrice: if the call is valid', async () => {
        const {rootRouter, owner} = await loadFixture(deploy);
        const newSubscriptionPrice = parseEther('3');

        await expect(rootRouter.connect(owner).setSubscriptionPrice(newSubscriptionPrice)).not.to.be.reverted;
        expect(await rootRouter.subscriptionPrice()).to.equal(newSubscriptionPrice);
    });

    it('Method setModeChangePrice: if caller is not the owner', async () => {
        const {rootRouter, accounts: [client]} = await loadFixture(deploy);
        const newModeChangePrice = parseEther('3');

        await expect(rootRouter.connect(client).setModeChangePrice(newModeChangePrice)).to.revertedWith(REASON_CALLER_IS_NOT_THE_OWNER);
    });

    it('Method setModeChangePrice: if caller is owner', async () => {
        const {rootRouter, owner} = await loadFixture(deploy);
        const newModeChangePrice = parseEther('3');

        await expect(rootRouter.connect(owner).setModeChangePrice(newModeChangePrice)).not.to.be.reverted;
        expect(await rootRouter.modeChangePrice()).to.equal(newModeChangePrice);
    });

    it('Method setSubscriptionDuration: if caller is not the owner', async () => {
        const {rootRouter, accounts: [client]} = await loadFixture(deploy);
        const newSubscriptionDuration = parseEther('3');

        await expect(rootRouter.connect(client).setSubscriptionDuration(newSubscriptionDuration)).to.revertedWith(REASON_CALLER_IS_NOT_THE_OWNER);
    });

    it('Method setSubscriptionDuration: if caller is owner', async () => {
        const {rootRouter, owner} = await loadFixture(deploy);
        const newSubscriptionDuration = parseEther('3');

        await expect(rootRouter.connect(owner).setSubscriptionDuration(newSubscriptionDuration)).not.to.be.reverted;
        expect(await rootRouter.subscriptionDuration()).to.equal(newSubscriptionDuration);
    });

    it('Method setHoldingDuration: if caller is not the owner', async () => {
        const {rootRouter, accounts: [client]} = await loadFixture(deploy);
        const newHoldingDuration = parseEther('3');

        await expect(rootRouter.connect(client).setHoldingDuration(newHoldingDuration)).to.revertedWith(REASON_CALLER_IS_NOT_THE_OWNER);
    });

    it('Method setHoldingDuration: if caller is owner', async () => {
        const {rootRouter, owner} = await loadFixture(deploy);
        const newHoldingDuration = parseEther('3');

        await expect(rootRouter.connect(owner).setHoldingDuration(newHoldingDuration)).not.to.be.reverted;
        expect(await rootRouter.holdingDuration()).to.equal(newHoldingDuration);
    });

    it('Method setTtl: if caller is not the owner', async () => {
        const {rootRouter, accounts: [client]} = await loadFixture(deploy);
        const newTtl = 3 * DAY;

        await expect(rootRouter.connect(client).setTtl(newTtl)).to.revertedWith(REASON_CALLER_IS_NOT_THE_OWNER);
    });

    it('Method setTtl: if caller is owner', async () => {
        const {rootRouter, owner} = await loadFixture(deploy);
        const newTtl = 3 * DAY;

        await expect(rootRouter.connect(owner).setTtl(newTtl)).not.to.be.reverted;
        expect(await rootRouter.ttl()).to.equal(newTtl);
    });

    it('Method setDefaultSipDomain: if caller is not the owner', async () => {
        const {rootRouter, accounts: [client]} = await loadFixture(deploy);
        const newDefaultSipDomain = 'sip.test';

        await expect(rootRouter.connect(client).setDefaultSipDomain(newDefaultSipDomain)).to.revertedWith(REASON_CALLER_IS_NOT_THE_OWNER);
    });

    it('Method setDefaultSipDomain: if caller is owner', async () => {
        const {rootRouter, owner} = await loadFixture(deploy);
        const newDefaultSipDomain = 'sip.test';

        await expect(rootRouter.connect(owner).setDefaultSipDomain(newDefaultSipDomain)).not.to.be.reverted;
        expect(await rootRouter.defaultSipDomain()).to.equal(newDefaultSipDomain);
    });

    it('Method setBaseUri: if caller is not the owner', async () => {
        const {rootRouter, accounts: [client]} = await loadFixture(deploy);
        const newBaseUri = 'https://test.test/';

        await expect(rootRouter.connect(client).setBaseUri(newBaseUri)).to.revertedWith(REASON_CALLER_IS_NOT_THE_OWNER);
    });

    it('Method setBaseUri: if caller is owner', async () => {
        const {rootRouter, owner} = await loadFixture(deploy);
        const newBaseUri = 'https://test.test/';

        await expect(rootRouter.connect(owner).setBaseUri(newBaseUri)).not.to.be.reverted;
        expect(await rootRouter.baseUri()).to.equal(newBaseUri);
    });

    it('Method setCodeBlockedStatus: if code is invalid', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const newBlockedStatus = true;

        await expect(rootRouter.setCodeBlockedStatus(POOL_SIZE, newBlockedStatus)).to.revertedWith(REASON_INVALID_CODE);
    });

    it('Method setCodeBlockedStatus: if caller is not the owner', async () => {
        const {rootRouter, accounts: [client]} = await loadFixture(deploy);
        const code = 100, newBlockedStatus = true;

        await expect(rootRouter.connect(client).setCodeBlockedStatus(code, newBlockedStatus)).to.revertedWith(REASON_CALLER_IS_NOT_THE_OWNER);
    });

    it('Method setCodeBlockedStatus: if caller is owner', async () => {
        const {rootRouter, owner} = await loadFixture(deploy);
        const code = 100, newBlockedStatus = true;

        await expect(rootRouter.connect(owner).setCodeBlockedStatus(code, newBlockedStatus)).not.to.be.reverted
        expect(await rootRouter.isBlocked(code)).to.equal(newBlockedStatus);

        await expect(rootRouter.connect(owner).setCodeBlockedStatus(code, !newBlockedStatus)).not.to.be.reverted
        expect(await rootRouter.isBlocked(code)).to.equal(!newBlockedStatus);
    });

    it('Method setCodeSubscriptionEndTime: if code is invalid', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const newSubscriptionEndTime = await getEndTime(0);

        await expect(rootRouter.setCodeSubscriptionEndTime(POOL_SIZE, newSubscriptionEndTime)).to.revertedWith(REASON_INVALID_CODE);
    });

    it('Method setCodeSubscriptionEndTime: if caller is not the owner', async () => {
        const {rootRouter, accounts: [client]} = await loadFixture(deploy);
        const code = 100, newSubscriptionEndTime = await getEndTime(0);

        await expect(rootRouter.connect(client).setCodeSubscriptionEndTime(code, newSubscriptionEndTime)).to.revertedWith(REASON_CALLER_IS_NOT_THE_OWNER);
    });

    it('Method setCodeSubscriptionEndTime: if caller is owner', async () => {
        const {rootRouter, owner} = await loadFixture(deploy);
        const code = 100, newSubscriptionEndTime = await getEndTime(0);

        await rootRouter.mint(code);

        await rootRouter.connect(owner).setCodeSubscriptionEndTime(code, newSubscriptionEndTime);
        expectCodeData(await rootRouter.getCodeData(code), {subscriptionEndTime: newSubscriptionEndTime});
    });


    // ----- CODE MANAGEMENT -------------------------------------------------------------------------------------------

    it('Method mint: if code is invalid', async () => {
        const {rootRouter} = await loadFixture(deploy);

        await expect(rootRouter.mint(POOL_SIZE, {value: MINT_PRICE})).to.revertedWith(REASON_INVALID_CODE);
    });

    it('Method mint: if the code is blocked', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.setCodeBlockedStatus(code, true);
        await expect(rootRouter.mint(code)).to.revertedWith(REASON_NOT_AVAILABLE_FOR_MINTING);
    });

    it('Method mint: if the code has an owner', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.mint(code);
        await expect(rootRouter.mint(code)).to.revertedWith(REASON_NOT_AVAILABLE_FOR_MINTING);
    });

    it('Method mint: if the code is blocked and has an owner', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.mint(code);
        await rootRouter.setCodeBlockedStatus(code, true);
        await expect(rootRouter.mint(code)).to.revertedWith(REASON_NOT_AVAILABLE_FOR_MINTING);
    });

    it('Method mint: if insufficient funds', async () => {
        const {rootRouter, owner, accounts: [client]} = await loadFixture(deploy);
        const code = 100;

        await expect(rootRouter.connect(client).mint(code, {value: Zero})).to.revertedWith(REASON_INSUFFICIENT_FUNDS);
        expect(await rootRouter.connect(owner).mint(code, {value: Zero})).to.changeTokenBalance(rootRouter, owner, 1);
    });

    it('Method mint: if the code was previously used', async () => {
        const {rootRouter, accounts: [pastCodeOwner, newCodeOwner]} = await loadFixture(deploy);
        const code = 100;

        await expect(rootRouter.connect(pastCodeOwner).mint(code, {value: MINT_PRICE}))
            .to.emit(rootRouter, 'Transfer').withArgs(AddressZero, pastCodeOwner, code)
            .and.changeTokenBalance(rootRouter, pastCodeOwner, 1);

        await rootRouter.connect(pastCodeOwner).setCodeSipDomain(code, 'sip.test');
        await rootRouter.setCodeSubscriptionEndTime(code, 0);

        await expect(rootRouter.connect(newCodeOwner).mint(code, {value: MINT_PRICE}))
            .to.emit(rootRouter, 'Transfer').withArgs(pastCodeOwner, newCodeOwner, code)
            .and.changeTokenBalances(rootRouter, [pastCodeOwner, newCodeOwner], [-1, 1]);
        expectCodeData(await rootRouter.getCodeData(code), {
            subscriptionEndTime: await getEndTime(SUBSCRIPTION_DURATION)
        });
    });

    it('Method renewSubscription: if code is invalid', async () => {
        const {rootRouter} = await loadFixture(deploy);

        await expect(rootRouter.renewSubscription(POOL_SIZE, {value: SUBSCRIPTION_PRICE})).to.revertedWith(REASON_INVALID_CODE);
    });

    it('Method renewSubscription: if insufficient rights', async () => {
        const {rootRouter, owner, accounts: [codeOwner, client]} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.connect(codeOwner).mint(code, {value: MINT_PRICE});

        await expect(rootRouter.connect(client).renewSubscription(code, {value: SUBSCRIPTION_PRICE})).to.revertedWith(REASON_INSUFFICIENT_RIGHTS);
        await expect(rootRouter.connect(owner).renewSubscription(code, {value: SUBSCRIPTION_PRICE})).not.to.be.reverted;
        expectCodeData(await rootRouter.getCodeData(code), {
            subscriptionEndTime: await getEndTime(SUBSCRIPTION_DURATION.mul(2))
        });
    });

    it('Method renewSubscription: if insufficient funds', async () => {
        const {rootRouter, owner, accounts: [codeOwner]} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.connect(codeOwner).mint(code, {value: MINT_PRICE});

        await expect(rootRouter.connect(codeOwner).renewSubscription(code, {value: Zero})).to.revertedWith(REASON_INSUFFICIENT_FUNDS);
        await expect(rootRouter.connect(owner).renewSubscription(code, {value: Zero})).not.to.be.reverted;
        expectCodeData(await rootRouter.getCodeData(code), {
            subscriptionEndTime: await getEndTime(SUBSCRIPTION_DURATION.mul(2))
        });
    });

    it('Method renewSubscription: if the call is valid', async () => {
        const {rootRouter, accounts: [codeOwner]} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.connect(codeOwner).mint(code, {value: MINT_PRICE});

        await expect(rootRouter.connect(codeOwner).renewSubscription(code, {value: SUBSCRIPTION_PRICE})).not.to.be.reverted;
        expectCodeData(await rootRouter.getCodeData(code), {
            subscriptionEndTime: await getEndTime(SUBSCRIPTION_DURATION.mul(2))
        });
    });

    it('Method transferOwnershipOfCode: if code is invalid', async () => {
        const {rootRouter} = await loadFixture(deploy);

        await expect(rootRouter.transferOwnershipOfCode(POOL_SIZE, AddressZero)).to.revertedWith(REASON_INVALID_CODE);
    });

    it('Method transferOwnershipOfCode: if insufficient rights', async () => {
        const {rootRouter, owner, accounts: [pastCodeOwner, newCodeOwner]} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.connect(pastCodeOwner).mint(code, {value: MINT_PRICE});

        await expect(rootRouter.connect(newCodeOwner).transferOwnershipOfCode(code, AddressZero)).to.revertedWith(REASON_INSUFFICIENT_RIGHTS);
        await expect(rootRouter.connect(owner).transferOwnershipOfCode(code, newCodeOwner.address))
            .to.emit(rootRouter, 'Transfer').withArgs(pastCodeOwner, newCodeOwner, code)
            .and.changeTokenBalances(rootRouter, [pastCodeOwner, newCodeOwner], [-1, 1]);
    });

    it('Method transferOwnershipOfCode: if the call is valid', async () => {
        const {rootRouter, accounts: [pastCodeOwner, newCodeOwner]} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.connect(pastCodeOwner).mint(code, {value: MINT_PRICE});

        await expect(rootRouter.connect(pastCodeOwner).transferOwnershipOfCode(code, newCodeOwner.address))
            .to.emit(rootRouter, 'Transfer').withArgs(pastCodeOwner, newCodeOwner, code)
            .and.changeTokenBalances(rootRouter, [pastCodeOwner, newCodeOwner], [-1, 1]);
    });

    it('Method renounceOwnershipOfCode: if code is invalid', async () => {
        const {rootRouter} = await loadFixture(deploy);

        await expect(rootRouter.renounceOwnershipOfCode(POOL_SIZE)).to.revertedWith(REASON_INVALID_CODE);
    });

    it('Method renounceOwnershipOfCode: if insufficient rights', async () => {
        const {rootRouter, owner, accounts: [codeOwner, client]} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.connect(codeOwner).mint(code, {value: MINT_PRICE});

        await expect(rootRouter.connect(client).renounceOwnershipOfCode(code)).to.revertedWith(REASON_INSUFFICIENT_RIGHTS);
        await expect(rootRouter.connect(owner).renounceOwnershipOfCode(code))
            .to.emit(rootRouter, 'Transfer').withArgs(codeOwner, AddressZero, code)
            .and.changeTokenBalance(rootRouter, codeOwner, -1);
    });

    it('Method renounceOwnershipOfCode: if the call is valid', async () => {
        const {rootRouter, accounts: [codeOwner]} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.connect(codeOwner).mint(code, {value: MINT_PRICE});

        await expect(rootRouter.connect(codeOwner).renounceOwnershipOfCode(code))
            .to.emit(rootRouter, 'Transfer').withArgs(codeOwner, AddressZero, code)
            .and.changeTokenBalance(rootRouter, codeOwner, -1);
    });

    it('Method changeCodeMode: if code is invalid', async () => {
        const {rootRouter} = await loadFixture(deploy);

        await expect(rootRouter.changeCodeMode(POOL_SIZE)).to.revertedWith(REASON_INVALID_CODE);
    });

    it('Method changeCodeMode: if insufficient rights', async () => {
        const {rootRouter, owner, accounts: [codeOwner, client]} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.connect(codeOwner).mint(code, {value: MINT_PRICE});

        await expect(rootRouter.connect(client).changeCodeMode(code, {value: MODE_CHANGE_PRICE})).to.revertedWith(REASON_INSUFFICIENT_RIGHTS);
        await expect(rootRouter.connect(owner).changeCodeMode(code, {value: MODE_CHANGE_PRICE})).not.to.be.reverted;
        expect(await rootRouter.getMode(code)).to.equal(CodeMode.Pool);
    });

    it('Method changeCodeMode: if insufficient funds', async () => {
        const {rootRouter, owner, accounts: [codeOwner]} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.connect(codeOwner).mint(code, {value: MINT_PRICE});

        await expect(rootRouter.connect(codeOwner).changeCodeMode(code, {value: Zero})).to.revertedWith(REASON_INSUFFICIENT_FUNDS);
        expect(await rootRouter.connect(owner).changeCodeMode(code, {value: Zero})).not.to.reverted;
    });

    it('Method changeCodeMode: if the call is valid', async () => {
        const {rootRouter, accounts: [codeOwner]} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.connect(codeOwner).mint(code, {value: MINT_PRICE});
        await rootRouter.setCodeSipDomain(code, 'sip.test');

        await expect(rootRouter.connect(codeOwner).changeCodeMode(code, {value: MODE_CHANGE_PRICE})).not.to.be.reverted;
        expectCodeData(await rootRouter.getCodeData(code), {
            subscriptionEndTime: await getEndTime(SUBSCRIPTION_DURATION),
            mode: CodeMode.Pool
        });

        await rootRouter.setCodeRouter(code, 1, AddressZero, 3);

        await expect(rootRouter.connect(codeOwner).changeCodeMode(code, {value: MODE_CHANGE_PRICE})).not.to.be.reverted;
        expectCodeData(await rootRouter.getCodeData(code), {
            subscriptionEndTime: await getEndTime(SUBSCRIPTION_DURATION)
        });
    });

    it('Method setCodeSipDomain: if code is invalid', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const newSipDomain = 'test';

        await expect(rootRouter.setCodeSipDomain(POOL_SIZE, newSipDomain)).to.revertedWith(REASON_INVALID_CODE);
    });

    it('Method setCodeSipDomain: if insufficient rights', async () => {
        const {rootRouter, owner, accounts: [codeOwner, client]} = await loadFixture(deploy);
        const code = 100, newSipDomain = 'test';

        await rootRouter.connect(codeOwner).mint(code, {value: MINT_PRICE});

        await expect(rootRouter.connect(client).setCodeSipDomain(code, newSipDomain)).to.revertedWith(REASON_INSUFFICIENT_RIGHTS);
        await expect(rootRouter.connect(owner).setCodeSipDomain(code, newSipDomain)).not.to.be.reverted;
        expectCodeData(await rootRouter.getCodeData(code), {
            subscriptionEndTime: await getEndTime(SUBSCRIPTION_DURATION),
            hasSipDomain: true,
            sipDomain: newSipDomain
        });
    });

    it('Method setCodeSipDomain: if the code is blocked', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100, newSipDomain = 'test';

        await rootRouter.mint(code);
        await rootRouter.setCodeBlockedStatus(code, true);

        await expect(rootRouter.setCodeSipDomain(code, newSipDomain)).to.revertedWith(REASON_CODE_BLOCKED);
    });

    it('Method setCodeSipDomain: if the code mode is invalid', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100, newSipDomain = 'test';

        await rootRouter.mint(code);
        await rootRouter.changeCodeMode(code);

        await expect(rootRouter.setCodeSipDomain(code, newSipDomain)).to.revertedWith(REASON_INVALID_CODE_MODE);
    });

    it('Method setCodeSipDomain: if the call is valid', async () => {
        const {rootRouter, accounts: [codeOwner]} = await loadFixture(deploy);
        const code = 100, newSipDomain = 'test';

        await rootRouter.connect(codeOwner).mint(code, {value: MINT_PRICE});

        await expect(rootRouter.connect(codeOwner).setCodeSipDomain(code, newSipDomain)).not.to.be.reverted;
        expectCodeData(await rootRouter.getCodeData(code), {
            subscriptionEndTime: await getEndTime(SUBSCRIPTION_DURATION),
            hasSipDomain: true,
            sipDomain: newSipDomain
        });
    });

    it('Method clearCodeSipDomain: if code is invalid', async () => {
        const {rootRouter} = await loadFixture(deploy);

        await expect(rootRouter.clearCodeSipDomain(POOL_SIZE)).to.revertedWith(REASON_INVALID_CODE);
    });

    it('Method clearCodeSipDomain: if insufficient rights', async () => {
        const {rootRouter, owner, accounts: [codeOwner, client]} = await loadFixture(deploy);
        const code = 100, newSipDomain = 'test';

        await rootRouter.connect(codeOwner).mint(code, {value: MINT_PRICE});
        await rootRouter.setCodeSipDomain(code, newSipDomain);

        await expect(rootRouter.connect(client).clearCodeSipDomain(code)).to.revertedWith(REASON_INSUFFICIENT_RIGHTS);
        await expect(rootRouter.connect(owner).clearCodeSipDomain(code)).not.to.be.reverted;
        expectCodeData(await rootRouter.getCodeData(code), {
            subscriptionEndTime: await getEndTime(SUBSCRIPTION_DURATION),
        });
    });

    it('Method clearCodeSipDomain: if the code is blocked', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.mint(code);
        await rootRouter.setCodeBlockedStatus(code, true);

        await expect(rootRouter.clearCodeSipDomain(code)).to.revertedWith(REASON_CODE_BLOCKED);
    });

    it('Method clearCodeSipDomain: if the code mode is invalid', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.mint(code);
        await rootRouter.changeCodeMode(code);

        await expect(rootRouter.clearCodeSipDomain(code)).to.revertedWith(REASON_INVALID_CODE_MODE);
    });

    it('Method clearCodeSipDomain: if the call is valid', async () => {
        const {rootRouter, accounts: [codeOwner]} = await loadFixture(deploy);
        const code = 100, newSipDomain = 'test';

        await rootRouter.connect(codeOwner).mint(code, {value: MINT_PRICE});
        await rootRouter.connect(codeOwner).setCodeSipDomain(code, newSipDomain);

        await expect(rootRouter.connect(codeOwner).clearCodeSipDomain(code)).not.to.be.reverted;
        expectCodeData(await rootRouter.getCodeData(code), {
            subscriptionEndTime: await getEndTime(SUBSCRIPTION_DURATION),
        });
    });

    it('Method setCodeRouter: if code is invalid', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const newChainId = 1, newAdr = AddressZero, newPoolCodeLength = 3;

        await expect(rootRouter.setCodeRouter(POOL_SIZE, newChainId, newAdr, newPoolCodeLength)).to.revertedWith(REASON_INVALID_CODE);
    });

    it('Method setCodeRouter: if insufficient rights', async () => {
        const {rootRouter, owner, accounts: [codeOwner, client]} = await loadFixture(deploy);
        const code = 100, newChainId = 1, newAdr = AddressZero, newPoolCodeLength = 3;

        await rootRouter.connect(codeOwner).mint(code, {value: MINT_PRICE});
        await rootRouter.changeCodeMode(code);

        await expect(rootRouter.connect(client).setCodeRouter(code, newChainId, newAdr, newPoolCodeLength)).to.revertedWith(REASON_INSUFFICIENT_RIGHTS);
        await expect(rootRouter.connect(owner).setCodeRouter(code, newChainId, newAdr, newPoolCodeLength)).not.to.be.reverted;
        expectCodeData(await rootRouter.getCodeData(code), {
            subscriptionEndTime: await getEndTime(SUBSCRIPTION_DURATION),
            mode: CodeMode.Pool,
            hasRouter: true,
            // @ts-ignore
            router: {
                chainId: newChainId.toString(),
                adr: newAdr,
                poolCodeLength: newPoolCodeLength.toString()
            }
        });
    });

    it('Method setCodeRouter: if the code is blocked', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100, newChainId = 1, newAdr = AddressZero, newPoolCodeLength = 3;

        await rootRouter.mint(code);
        await rootRouter.changeCodeMode(code);
        await rootRouter.setCodeBlockedStatus(code, true);

        await expect(rootRouter.setCodeRouter(code, newChainId, newAdr, newPoolCodeLength)).to.revertedWith(REASON_CODE_BLOCKED);
    });

    it('Method setCodeRouter: if the code mode is invalid', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100, newChainId = 1, newAdr = AddressZero, newPoolCodeLength = 3;

        await rootRouter.mint(code);

        await expect(rootRouter.setCodeRouter(code, newChainId, newAdr, newPoolCodeLength)).to.revertedWith(REASON_INVALID_CODE_MODE);
    });

    it('Method setCodeRouter: if the call is valid', async () => {
        const {rootRouter, accounts: [codeOwner]} = await loadFixture(deploy);
        const code = 100, newChainId = 1, newAdr = AddressZero, newPoolCodeLength = 3;

        await rootRouter.connect(codeOwner).mint(code, {value: MINT_PRICE});
        await rootRouter.changeCodeMode(code);

        await expect(rootRouter.connect(codeOwner).setCodeRouter(code, newChainId, newAdr, newPoolCodeLength)).not.to.be.reverted;
        expectCodeData(await rootRouter.getCodeData(code), {
            subscriptionEndTime: await getEndTime(SUBSCRIPTION_DURATION),
            mode: CodeMode.Pool,
            hasRouter: true,
            // @ts-ignore
            router: {
                chainId: newChainId.toString(),
                adr: newAdr,
                poolCodeLength: newPoolCodeLength.toString()
            }
        });
    });

    it('Method clearCodeRouter: if code is invalid', async () => {
        const {rootRouter} = await loadFixture(deploy);

        await expect(rootRouter.clearCodeRouter(POOL_SIZE)).to.revertedWith(REASON_INVALID_CODE);
    });

    it('Method clearCodeRouter: if insufficient rights', async () => {
        const {rootRouter, owner, accounts: [codeOwner, client]} = await loadFixture(deploy);
        const code = 100, newChainId = 1, newAdr = AddressZero, newPoolCodeLength = 3;

        await rootRouter.connect(codeOwner).mint(code, {value: MINT_PRICE});
        await rootRouter.changeCodeMode(code);
        await rootRouter.setCodeRouter(code, newChainId, newAdr, newPoolCodeLength);

        await expect(rootRouter.connect(client).clearCodeRouter(code)).to.revertedWith(REASON_INSUFFICIENT_RIGHTS);
        await expect(rootRouter.connect(owner).clearCodeRouter(code)).not.to.be.reverted;
        expectCodeData(await rootRouter.getCodeData(code), {
            subscriptionEndTime: await getEndTime(SUBSCRIPTION_DURATION),
            mode: CodeMode.Pool
        });
    });

    it('Method clearCodeRouter: if the code is blocked', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.mint(code);
        await rootRouter.setCodeBlockedStatus(code, true);

        await expect(rootRouter.clearCodeRouter(code)).to.revertedWith(REASON_CODE_BLOCKED);
    });

    it('Method clearCodeRouter: if the code mode is invalid', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.mint(code);

        await expect(rootRouter.clearCodeRouter(code)).to.revertedWith(REASON_INVALID_CODE_MODE);
    });

    it('Method clearCodeRouter: if the call is valid', async () => {
        const {rootRouter, accounts: [codeOwner]} = await loadFixture(deploy);
        const code = 100, newChainId = 1, newAdr = AddressZero, newPoolCodeLength = 3;

        await rootRouter.connect(codeOwner).mint(code, {value: MINT_PRICE});
        await rootRouter.changeCodeMode(code);
        await rootRouter.setCodeRouter(code, newChainId, newAdr, newPoolCodeLength);

        await expect(rootRouter.connect(codeOwner).clearCodeRouter(code)).not.to.be.reverted;
        expectCodeData(await rootRouter.getCodeData(code), {
            subscriptionEndTime: await getEndTime(SUBSCRIPTION_DURATION),
            mode: CodeMode.Pool
        });
    });


    // ----- ROUTING ---------------------------------------------------------------------------------------------------

    it('Method getNextNode: if code is invalid', async () => {
        const {rootRouter} = await loadFixture(deploy);

        expect(await rootRouter.getNextNode(POOL_SIZE)).to.deep.equal(['400', '', '', '', TTL.toString()]);
    });

    it('Method getNextNode: if the code is blocked', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.mint(code);
        await rootRouter.setCodeBlockedStatus(code, true);

        expect(await rootRouter.getNextNode(code)).to.deep.equal(['400', '', '', '', TTL.toString()]);
    });

    it('Method getNextNode: if the code not in use', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        expect(await rootRouter.getNextNode(code)).to.deep.equal(['400', '', '', '', TTL.toString()]);
    });

    it('Method getNextNode: if the code is held', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.mint(code);
        await rootRouter.setCodeSubscriptionEndTime(code, await getEndTime(0));

        expect(await rootRouter.getNextNode(code)).to.deep.equal(['400', '', '', '', TTL.toString()]);
    });

    it('Method getNextNode: if the code is a number with default sip domain', async () => {
        const {rootRouter, owner} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.mint(code);

        expect(await rootRouter.getNextNode(code)).to.deep.equal(['200', '0', owner.address, DEFAULT_SIP_DOMAIN, TTL.toString()]);
    });

    it('Method getNextNode: if the code is a number with custom sip domain', async () => {
        const {rootRouter, owner} = await loadFixture(deploy);
        const code = 100, newSipDomain = 'sip.test';

        await rootRouter.mint(code);
        await rootRouter.setCodeSipDomain(code, newSipDomain)

        expect(await rootRouter.getNextNode(code)).to.deep.equal(['200', '0', owner.address, newSipDomain, TTL.toString()]);
    });

    it('Method getNextNode: if the code is a pool without router', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.mint(code);
        await rootRouter.changeCodeMode(code);

        expect(await rootRouter.getNextNode(code)).to.deep.equal(['400', '0', '', '', TTL.toString()]);
    });

    it('Method getNextNode: if the code is a pool with router', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100, newChainId = 1, newAdr = rootRouter.address, newPoolCodeLength = 3;;

        await rootRouter.mint(code);
        await rootRouter.changeCodeMode(code);
        await rootRouter.setCodeRouter(code, newChainId, newAdr, newPoolCodeLength);

        expect(await rootRouter.getNextNode(code)).to.deep.equal(['200', newPoolCodeLength.toString(), newChainId.toString(), newAdr, TTL.toString()]);
    });
});
