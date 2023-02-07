import {loadFixture, time} from '@nomicfoundation/hardhat-network-helpers';
import chai, {expect} from 'chai';
import {ethers} from 'hardhat';

import {RootRouter} from '../typechain-types';
import {DAY, YEAR} from './constants';


chai.use(require('chai-string'));


const {BigNumber} = ethers;
const {parseEther} = ethers.utils;
const {Zero, AddressZero} = ethers.constants;


const enum CodeMode {
    Number,
    Pool,
}

const enum CodeStatus {
    AvailableForMinting,
    Active,
    Held,
    Blocked,
}


describe('RootRouter', () => {
    // Settings
    const MINT_PRICE = parseEther('10');
    const SUBSCRIPTION_PRICE = parseEther('7');
    const MODE_CHANGE_PRICE = parseEther('5');
    const SUBSCRIPTION_DURATION = BigNumber.from(10 * YEAR);
    const HOLD_DURATION = BigNumber.from(30 * DAY);
    const TTL = BigNumber.from(10 * DAY);
    const BASE_URI = 'https://mvts-metadata.io/';
    const DEFAULT_SIP_DOMAIN = 'sip.quic.pro';
    const VERIFICATION_OPERATOR = AddressZero;

    // Data
    const NAME = 'MetaVerse Telecom Service';
    const SYMBOL = 'MVTS';
    const POOL_SIZE = 1000;

    // Reasons
    const REASON_INVALID_CODE = 'Invalid code';
    const REASON_CODE_IS_NOT_AVAILABLE_FOR_MINTING = 'Code is not available for minting';
    const REASON_INSUFFICIENT_FUNDS = 'Insufficient funds';
    const REASON_INSUFFICIENT_RIGHTS = 'Insufficient rights';
    const REASON_CODE_IS_NOT_ACTIVE = 'Code is not active';
    const REASON_INVALID_CODE_MODE = 'Invalid code mode';
    const REASON_CALLER_IS_NOT_THE_OWNER = 'Ownable: caller is not the owner';
    const REASON_INVALID_NEW_HOLD_END_TIME = 'Invalid newHoldEndTime';


    async function deploy() {
        const [owner, ...accounts] = await ethers.getSigners();

        const RootRouter = await ethers.getContractFactory('RootRouter', owner);
        const rootRouter = (await RootRouter.deploy()) as RootRouter;
        await rootRouter.deployed();

        return {
            rootRouter,
            owner,
            accounts,
        };
    }

    async function getEndTime(duration: number | InstanceType<typeof BigNumber>): Promise<InstanceType<typeof BigNumber>> {
        return BigNumber.from(await time.latest()).add(duration);
    }

    function expectCodeData(actualCodeData: RootRouter.CodeDataStructOutput, expectedCodeData: Partial<RootRouter.CodeDataStruct>) {
        expect(actualCodeData).to.length(7);
        if (expectedCodeData.status !== undefined) {
            expect(actualCodeData.status).to.equal(expectedCodeData.status);
        }
        if (expectedCodeData.isVerified !== undefined) {
            expect(actualCodeData.isVerified).to.equal(expectedCodeData.isVerified);
        }
        if (expectedCodeData.subscriptionEndTime !== undefined) {
            expect(actualCodeData.subscriptionEndTime).to.closeTo(expectedCodeData.subscriptionEndTime, 5);
        }
        if (expectedCodeData.holdEndTime !== undefined) {
            expect(actualCodeData.holdEndTime).to.closeTo(expectedCodeData.holdEndTime, 5);
        }
        if (expectedCodeData.mode !== undefined) {
            expect(actualCodeData.mode).to.equal(expectedCodeData.mode);
        }
        if (expectedCodeData.sipDomain !== undefined) {
            expect(actualCodeData.sipDomain).to.equalIgnoreCase(<string>expectedCodeData.sipDomain);
        }
        if (expectedCodeData.router !== undefined) {
            expect(actualCodeData.router).to.have.deep.members([
                BigNumber.from(expectedCodeData.router.chainId),
                BigNumber.from(expectedCodeData.router.poolCodeLength),
                expectedCodeData.router.adr
            ]);
        }
    }

    function expectNodeData(actualNodeData: RootRouter.NodeDataStruct, expectedNodeData: RootRouter.NodeDataStruct) {
        expect(actualNodeData).to.length(5);
        expect(actualNodeData.responseCode).to.equal(expectedNodeData.responseCode);
        expect(actualNodeData.ttl).to.equal(expectedNodeData.ttl);
        expect(actualNodeData.mode).to.equal(expectedNodeData.mode);
        expect(actualNodeData.sipUri).to.equalIgnoreCase(<string>expectedNodeData.sipUri);
        expect(actualNodeData.router).to.have.deep.members([
            BigNumber.from(expectedNodeData.router.chainId),
            BigNumber.from(expectedNodeData.router.poolCodeLength),
            expectedNodeData.router.adr
        ]);
    }


    // ----- SETTINGS --------------------------------------------------------------------------------------------------

    it('The initial settings should be as expected', async () => {
        const {rootRouter, owner} = await loadFixture(deploy);

        expect(await rootRouter.owner()).to.equal(owner.address);
        expect(await rootRouter.mintPrice()).to.equal(MINT_PRICE);
        expect(await rootRouter.subscriptionPrice()).to.equal(SUBSCRIPTION_PRICE);
        expect(await rootRouter.modeChangePrice()).to.equal(MODE_CHANGE_PRICE);
        expect(await rootRouter.subscriptionDuration()).to.equal(SUBSCRIPTION_DURATION);
        expect(await rootRouter.holdDuration()).to.equal(HOLD_DURATION);
        expect(await rootRouter.ttl()).to.equal(TTL);
        expect(await rootRouter.baseUri()).to.equal(BASE_URI);
        expect(await rootRouter.defaultSipDomain()).to.equal(DEFAULT_SIP_DOMAIN);
        expect(await rootRouter.verificationOperator()).to.equal(VERIFICATION_OPERATOR);
    });


    // ----- DATA ------------------------------------------------------------------------------------------------------

    it('The initial data should be as expected', async () => {
        const {rootRouter} = await loadFixture(deploy);

        expect(await rootRouter.name()).to.equal(NAME);
        expect(await rootRouter.symbol()).to.equal(SYMBOL);
        expect(await rootRouter.POOL_SIZE()).to.equal(POOL_SIZE);
    });


    // ----- CONSTRUCTOR -----------------------------------------------------------------------------------------------

    it('The constructor must block the first hundred numbers', async () => {
        const {rootRouter} = await loadFixture(deploy);

        for (let code = 0; code < POOL_SIZE; ++code) {
            expectCodeData(await rootRouter.getCodeData(code), {
                status: code < 100 ? CodeStatus.Blocked : CodeStatus.AvailableForMinting,
            });
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
        await rootRouter.setCodeSubscriptionEndTime(code, await time.latest());
        await rootRouter.setCodeHoldEndTime(code, await time.latest());

        expect(await rootRouter.hasOwner(code)).to.false;
    });

    it('Method getCodeData: if code is invalid', async () => {
        const {rootRouter} = await loadFixture(deploy);

        await expect(rootRouter.getCodeData(POOL_SIZE)).to.revertedWith(REASON_INVALID_CODE);
    });

    it('Method getCodeData: if the code has no owner', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        expectCodeData(await rootRouter.getCodeData(code), {
            status: CodeStatus.AvailableForMinting,
            isVerified: false,
            subscriptionEndTime: Zero,
            holdEndTime: Zero,
            mode: CodeMode.Number,
            sipDomain: '',
            router: {
                chainId: Zero,
                poolCodeLength: Zero,
                adr: '',
            },
        });
    });

    it('Method getCodeData: if the code has an owner', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.mint(code);

        expectCodeData(await rootRouter.getCodeData(code), {
            status: CodeStatus.Active,
            isVerified: false,
            subscriptionEndTime: await getEndTime(SUBSCRIPTION_DURATION),
            holdEndTime: await getEndTime(SUBSCRIPTION_DURATION.add(HOLD_DURATION)),
            mode: CodeMode.Number,
            sipDomain: DEFAULT_SIP_DOMAIN,
            router: {
                chainId: Zero,
                poolCodeLength: Zero,
                adr: '',
            },
        });
    });

    it('Method getCodeData: if the code is held', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.mint(code);
        await rootRouter.setCodeSubscriptionEndTime(code, await time.latest());

        expectCodeData(await rootRouter.getCodeData(code), {
            status: CodeStatus.Held,
        });
    });

    it('Method getCodeData: if the code is blocked', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.mint(code);
        await rootRouter.setCodeBlockedStatus(100, true);

        expectCodeData(await rootRouter.getCodeData(code), {
            status: CodeStatus.Blocked,
        });
    });

    it('Method getCodeData: if the code is a number', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.mint(code);

        expectCodeData(await rootRouter.getCodeData(code), {
            mode: CodeMode.Number,
        });
    });

    it('Method getCodeData: if the code is a pool', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.mint(code);
        await rootRouter.changeCodeMode(100);

        expectCodeData(await rootRouter.getCodeData(code), {
            mode: CodeMode.Pool,
        });
    });

    it('Method getCodeStatus: if code is invalid', async () => {
        const {rootRouter} = await loadFixture(deploy);

        await expect(rootRouter.getCodeStatus(POOL_SIZE)).to.revertedWith(REASON_INVALID_CODE);
    });

    it('Method getCodeStatus: if the code is available for minting', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        expect(await rootRouter.getCodeStatus(code)).to.equal(CodeStatus.AvailableForMinting);
    });

    it('Method getCodeStatus: if the code is active', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.mint(code);

        expect(await rootRouter.getCodeStatus(code)).to.equal(CodeStatus.Active);
    });

    it('Method getCodeStatus: if the code is held', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.mint(code);
        await rootRouter.setCodeSubscriptionEndTime(code, await getEndTime(0));

        expect(await rootRouter.getCodeStatus(code)).to.equal(CodeStatus.Held);
    });

    it('Method getCodeStatus: if the code is blocked', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.setCodeBlockedStatus(code, true);

        expect(await rootRouter.getCodeStatus(code)).to.equal(CodeStatus.Blocked);
    });

    it('Method getCodeStatus: if the subscription has ended', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.mint(code);
        await rootRouter.setCodeSubscriptionEndTime(code, await getEndTime(0));
        await rootRouter.setCodeHoldEndTime(code, await getEndTime(0));

        expect(await rootRouter.getCodeStatus(code)).to.equal(CodeStatus.AvailableForMinting);
    });

    it('Method getCodeStatuses', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const activeCode = 100;
        const heldCode = 200;
        const availableForMintingCode = 300;
        const blockedCode = 400;

        await rootRouter.mint(activeCode);
        await rootRouter.mint(heldCode);
        await rootRouter.setCodeSubscriptionEndTime(heldCode, await getEndTime(0));
        await rootRouter.setCodeBlockedStatus(blockedCode, true);

        const statuses = await rootRouter.getCodeStatuses();
        expect(statuses).to.length(POOL_SIZE);
        expect(statuses[activeCode]).to.equal(CodeStatus.Active);
        expect(statuses[heldCode]).to.equal(CodeStatus.Held);
        expect(statuses[availableForMintingCode]).to.equal(CodeStatus.AvailableForMinting);
        expect(statuses[blockedCode]).to.equal(CodeStatus.Blocked);
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

    it('Method withdraw: if caller is the contract owner', async () => {
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

    it('Method setMintPrice: if caller is the contract owner', async () => {
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

    it('Method setModeChangePrice: if caller is the contract owner', async () => {
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

    it('Method setSubscriptionDuration: if caller is the contract owner', async () => {
        const {rootRouter, owner} = await loadFixture(deploy);
        const newSubscriptionDuration = parseEther('3');

        await expect(rootRouter.connect(owner).setSubscriptionDuration(newSubscriptionDuration)).not.to.be.reverted;
        expect(await rootRouter.subscriptionDuration()).to.equal(newSubscriptionDuration);
    });

    it('Method setHoldDuration: if caller is not the owner', async () => {
        const {rootRouter, accounts: [client]} = await loadFixture(deploy);
        const newHoldingDuration = parseEther('3');

        await expect(rootRouter.connect(client).setHoldDuration(newHoldingDuration)).to.revertedWith(REASON_CALLER_IS_NOT_THE_OWNER);
    });

    it('Method setHoldDuration: if caller is the contract owner', async () => {
        const {rootRouter, owner} = await loadFixture(deploy);
        const newHoldingDuration = parseEther('3');

        await expect(rootRouter.connect(owner).setHoldDuration(newHoldingDuration)).not.to.be.reverted;
        expect(await rootRouter.holdDuration()).to.equal(newHoldingDuration);
    });

    it('Method setTtl: if caller is not the owner', async () => {
        const {rootRouter, accounts: [client]} = await loadFixture(deploy);
        const newTtl = 3 * DAY;

        await expect(rootRouter.connect(client).setTtl(newTtl)).to.revertedWith(REASON_CALLER_IS_NOT_THE_OWNER);
    });

    it('Method setTtl: if caller is the contract owner', async () => {
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

    it('Method setDefaultSipDomain: if caller is the contract owner', async () => {
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

    it('Method setBaseUri: if caller is the contract owner', async () => {
        const {rootRouter, owner} = await loadFixture(deploy);
        const newBaseUri = 'https://test.test/';

        await expect(rootRouter.connect(owner).setBaseUri(newBaseUri)).not.to.be.reverted;
        expect(await rootRouter.baseUri()).to.equal(newBaseUri);
    });

    it('Method setVerificationOperator: if caller is not the owner', async () => {
        const {rootRouter, accounts: [client]} = await loadFixture(deploy);
        const newVerificationOperator = client.address;

        await expect(rootRouter.connect(client).setVerificationOperator(newVerificationOperator)).to.revertedWith(REASON_CALLER_IS_NOT_THE_OWNER);
    });

    it('Method setVerificationOperator: if caller is the contract owner', async () => {
        const {rootRouter, owner, accounts: [client]} = await loadFixture(deploy);
        const newVerificationOperator = client.address;

        await expect(rootRouter.connect(owner).setVerificationOperator(newVerificationOperator)).not.to.be.reverted;
        expect(await rootRouter.verificationOperator()).to.equal(newVerificationOperator);
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

    it('Method setCodeBlockedStatus: if caller is the contract owner', async () => {
        const {rootRouter, owner} = await loadFixture(deploy);
        const code = 100, newBlockedStatus = true;

        await rootRouter.mint(code);

        await expect(rootRouter.connect(owner).setCodeBlockedStatus(code, newBlockedStatus)).not.to.be.reverted;
        expect(await rootRouter.getCodeStatus(code)).to.equal(CodeStatus.Blocked);

        await expect(rootRouter.connect(owner).setCodeBlockedStatus(code, !newBlockedStatus)).not.to.be.reverted;
        expect(await rootRouter.getCodeStatus(code)).to.equal(CodeStatus.Active);
    });

    it('Method setCodeVerifiedStatus: if code is invalid', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const newVerifiedStatus = true;

        await expect(rootRouter.setCodeVerifiedStatus(POOL_SIZE, newVerifiedStatus)).to.revertedWith(REASON_INVALID_CODE);
    });

    it('Method setCodeVerifiedStatus: if caller is not the owner', async () => {
        const {rootRouter, accounts: [client]} = await loadFixture(deploy);
        const code = 100, newVerifiedStatus = true;

        await expect(rootRouter.connect(client).setCodeVerifiedStatus(code, newVerifiedStatus)).to.revertedWith(REASON_INSUFFICIENT_RIGHTS);
    });

    it('Method setCodeVerifiedStatus: if caller is the contract owner', async () => {
        const {rootRouter, owner} = await loadFixture(deploy);
        const code = 100, newVerifiedStatus = true;

        await rootRouter.mint(code);

        await expect(rootRouter.connect(owner).setCodeVerifiedStatus(code, newVerifiedStatus)).not.to.be.reverted;
        expectCodeData(await rootRouter.getCodeData(code), {isVerified: newVerifiedStatus});

        await expect(rootRouter.connect(owner).setCodeVerifiedStatus(code, !newVerifiedStatus)).not.to.be.reverted;
        expectCodeData(await rootRouter.getCodeData(code), {isVerified: !newVerifiedStatus});
    });

    it('Method setCodeVerifiedStatus: if caller is verification operator', async () => {
        const {rootRouter, accounts: [verificationOperator]} = await loadFixture(deploy);
        const code = 100, newVerifiedStatus = true;

        await rootRouter.setVerificationOperator(verificationOperator.address);
        await rootRouter.mint(code);

        await expect(rootRouter.connect(verificationOperator).setCodeVerifiedStatus(code, newVerifiedStatus)).not.to.be.reverted;
        expectCodeData(await rootRouter.getCodeData(code), {isVerified: newVerifiedStatus});

        await expect(rootRouter.connect(verificationOperator).setCodeVerifiedStatus(code, !newVerifiedStatus)).not.to.be.reverted;
        expectCodeData(await rootRouter.getCodeData(code), {isVerified: !newVerifiedStatus});
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

    it('Method setCodeSubscriptionEndTime: if caller is the contract owner', async () => {
        const {rootRouter, owner} = await loadFixture(deploy);
        const code = 100, newSubscriptionEndTime = await getEndTime(SUBSCRIPTION_DURATION.add(YEAR));

        await rootRouter.mint(code);

        await rootRouter.connect(owner).setCodeSubscriptionEndTime(code, newSubscriptionEndTime);

        expectCodeData(await rootRouter.getCodeData(code), {
            subscriptionEndTime: newSubscriptionEndTime,
            holdEndTime: newSubscriptionEndTime.add(HOLD_DURATION),
        });
    });

    it('Method setCodeHoldEndTime: if code is invalid', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const newHoldEndTime = await getEndTime(0);

        await expect(rootRouter.setCodeHoldEndTime(POOL_SIZE, newHoldEndTime)).to.revertedWith(REASON_INVALID_CODE);
    });

    it('Method setCodeHoldEndTime: if caller is not the contract owner', async () => {
        const {rootRouter, accounts: [client]} = await loadFixture(deploy);
        const code = 100, newHoldEndTime = await getEndTime(0);

        await expect(rootRouter.connect(client).setCodeHoldEndTime(code, newHoldEndTime)).to.revertedWith(REASON_CALLER_IS_NOT_THE_OWNER);
    });

    it('Method setCodeHoldEndTime: if caller is the contract owner', async () => {
        const {rootRouter, owner} = await loadFixture(deploy);
        const code = 100, newHoldEndTime = await getEndTime(SUBSCRIPTION_DURATION.add(YEAR));

        await rootRouter.mint(code);
        await rootRouter.connect(owner).setCodeHoldEndTime(code, newHoldEndTime);

        expectCodeData(await rootRouter.getCodeData(code), {holdEndTime: newHoldEndTime});
    });


    it('Method setCodeHoldEndTime: if new hold end time is invalid', async () => {
        const {rootRouter, owner} = await loadFixture(deploy);
        const code = 100, newHoldEndTime = await getEndTime(SUBSCRIPTION_DURATION.sub(YEAR));

        await rootRouter.mint(code);
        await expect(rootRouter.connect(owner).setCodeHoldEndTime(code, newHoldEndTime)).to.revertedWith(REASON_INVALID_NEW_HOLD_END_TIME);
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
        await expect(rootRouter.mint(code)).to.revertedWith(REASON_CODE_IS_NOT_AVAILABLE_FOR_MINTING);
    });

    it('Method mint: if the code has an owner', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.mint(code);
        await expect(rootRouter.mint(code)).to.revertedWith(REASON_CODE_IS_NOT_AVAILABLE_FOR_MINTING);
    });

    it('Method mint: if the code is blocked and has an owner', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.mint(code);
        await rootRouter.setCodeBlockedStatus(code, true);
        await expect(rootRouter.mint(code)).to.revertedWith(REASON_CODE_IS_NOT_AVAILABLE_FOR_MINTING);
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

    it('Method transferFrom: if code is invalid', async () => {
        const {rootRouter} = await loadFixture(deploy);

        await expect(rootRouter.transferFrom(AddressZero, AddressZero, POOL_SIZE)).to.revertedWith(REASON_INVALID_CODE);
    });

    it('Method transferFrom: if insufficient rights', async () => {
        const {rootRouter, owner, accounts: [pastCodeOwner, newCodeOwner]} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.connect(pastCodeOwner).mint(code, {value: MINT_PRICE});

        await expect(rootRouter.connect(newCodeOwner).transferFrom(pastCodeOwner.address, newCodeOwner.address, code)).to.revertedWith(REASON_INSUFFICIENT_RIGHTS);
        await expect(rootRouter.connect(owner).transferFrom(pastCodeOwner.address, newCodeOwner.address, code))
            .to.emit(rootRouter, 'Transfer').withArgs(pastCodeOwner, newCodeOwner, code)
            .and.changeTokenBalances(rootRouter, [pastCodeOwner, newCodeOwner], [-1, 1]);
    });

    it('Method transferFrom: if the call is valid', async () => {
        const {rootRouter, accounts: [pastCodeOwner, newCodeOwner]} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.connect(pastCodeOwner).mint(code, {value: MINT_PRICE});

        await expect(rootRouter.connect(pastCodeOwner).transferFrom(pastCodeOwner.address, newCodeOwner.address, code))
            .to.emit(rootRouter, 'Transfer').withArgs(pastCodeOwner, newCodeOwner, code)
            .and.changeTokenBalances(rootRouter, [pastCodeOwner, newCodeOwner], [-1, 1]);
    });

    it('Method safeTransferFrom: if code is invalid', async () => {
        const {rootRouter} = await loadFixture(deploy);

        await expect(rootRouter['safeTransferFrom(address,address,uint256,bytes)'](AddressZero, AddressZero, POOL_SIZE, [])).to.revertedWith(REASON_INVALID_CODE);
    });

    it('Method safeTransferFrom: if insufficient rights', async () => {
        const {rootRouter, owner, accounts: [pastCodeOwner, newCodeOwner]} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.connect(pastCodeOwner).mint(code, {value: MINT_PRICE});

        await expect(rootRouter.connect(newCodeOwner)['safeTransferFrom(address,address,uint256,bytes)'](pastCodeOwner.address, newCodeOwner.address, code, [])).to.revertedWith(REASON_INSUFFICIENT_RIGHTS);
        await expect(rootRouter.connect(owner)['safeTransferFrom(address,address,uint256,bytes)'](pastCodeOwner.address, newCodeOwner.address, code, []))
            .to.emit(rootRouter, 'Transfer').withArgs(pastCodeOwner, newCodeOwner, code)
            .and.changeTokenBalances(rootRouter, [pastCodeOwner, newCodeOwner], [-1, 1]);
    });

    it('Method safeTransferFrom: if the call is valid', async () => {
        const {rootRouter, accounts: [pastCodeOwner, newCodeOwner]} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.connect(pastCodeOwner).mint(code, {value: MINT_PRICE});

        await expect(rootRouter.connect(pastCodeOwner)['safeTransferFrom(address,address,uint256,bytes)'](pastCodeOwner.address, newCodeOwner.address, code, []))
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
        expectCodeData(await rootRouter.getCodeData(code), {mode: CodeMode.Pool});
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
            sipDomain: newSipDomain
        });
    });

    it('Method setCodeSipDomain: if the code is blocked', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100, newSipDomain = 'test';

        await rootRouter.mint(code);
        await rootRouter.setCodeBlockedStatus(code, true);

        await expect(rootRouter.setCodeSipDomain(code, newSipDomain)).to.revertedWith(REASON_CODE_IS_NOT_ACTIVE);
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

        await expect(rootRouter.clearCodeSipDomain(code)).to.revertedWith(REASON_CODE_IS_NOT_ACTIVE);
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
            router: {
                chainId: newChainId,
                adr: newAdr,
                poolCodeLength: newPoolCodeLength
            }
        });
    });

    it('Method setCodeRouter: if the code is blocked', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100, newChainId = 1, newAdr = AddressZero, newPoolCodeLength = 3;

        await rootRouter.mint(code);
        await rootRouter.changeCodeMode(code);
        await rootRouter.setCodeBlockedStatus(code, true);

        await expect(rootRouter.setCodeRouter(code, newChainId, newAdr, newPoolCodeLength)).to.revertedWith(REASON_CODE_IS_NOT_ACTIVE);
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
            router: {
                chainId: newChainId,
                adr: newAdr,
                poolCodeLength: newPoolCodeLength
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

        await expect(rootRouter.clearCodeRouter(code)).to.revertedWith(REASON_CODE_IS_NOT_ACTIVE);
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

    it('Method getNodeData: if code is invalid', async () => {
        const {rootRouter} = await loadFixture(deploy);

        expectNodeData(await rootRouter.getNodeData(POOL_SIZE), {
            responseCode: 400,
            ttl: TTL,
            mode: CodeMode.Number,
            sipUri: '',
            router: {
                chainId: Zero,
                adr: '',
                poolCodeLength: Zero
            },
        });
    });

    it('Method getNodeData: if code is not active', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        expectNodeData(await rootRouter.getNodeData(code), {
            responseCode: 400,
            ttl: TTL,
            mode: CodeMode.Number,
            sipUri: '',
            router: {
                chainId: Zero,
                adr: '',
                poolCodeLength: Zero
            },
        });
    });

    it('Method getNodeData: if the code is a number with default sip domain', async () => {
        const {rootRouter, owner} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.mint(code);

        expectNodeData(await rootRouter.getNodeData(code), {
            responseCode: 200,
            ttl: TTL,
            mode: CodeMode.Number,
            sipUri: `${owner.address}@${DEFAULT_SIP_DOMAIN}`,
            router: {
                chainId: Zero,
                adr: '',
                poolCodeLength: Zero
            },
        });
    });

    it('Method getNodeData: if the code is a number with custom sip domain', async () => {
        const {rootRouter, owner} = await loadFixture(deploy);
        const code = 100, newSipDomain = 'sip.test';

        await rootRouter.mint(code);
        await rootRouter.setCodeSipDomain(code, newSipDomain)

        expectNodeData(await rootRouter.getNodeData(code), {
            responseCode: 200,
            ttl: TTL,
            mode: CodeMode.Number,
            sipUri: `${owner.address}@${newSipDomain}`,
            router: {
                chainId: Zero,
                adr: '',
                poolCodeLength: Zero
            },
        });
    });

    it('Method getNodeData: if the code is a pool without router', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100;

        await rootRouter.mint(code);
        await rootRouter.changeCodeMode(code);

        expectNodeData(await rootRouter.getNodeData(code), {
            responseCode: 200,
            ttl: TTL,
            mode: CodeMode.Pool,
            sipUri: '',
            router: {
                chainId: Zero,
                adr: '',
                poolCodeLength: Zero
            },
        });
    });

    it('Method getNodeData: if the code is a pool with router', async () => {
        const {rootRouter} = await loadFixture(deploy);
        const code = 100, newChainId = 1, newAdr = rootRouter.address, newPoolCodeLength = 3;

        await rootRouter.mint(code);
        await rootRouter.changeCodeMode(code);
        await rootRouter.setCodeRouter(code, newChainId, newAdr, newPoolCodeLength);

        expectNodeData(await rootRouter.getNodeData(code), {
            responseCode: 200,
            ttl: TTL,
            mode: CodeMode.Pool,
            sipUri: '',
            router: {
                chainId: newChainId,
                adr: newAdr,
                poolCodeLength: newPoolCodeLength
            }
        });
    });
});
