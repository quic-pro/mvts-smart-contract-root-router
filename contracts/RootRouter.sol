// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;



import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Strings.sol";



contract RootRouter is Ownable {
    using SafeMath for uint256;



    // ----- CUSTOM TYPES ----------------------------------------------------------------------------------------------

    enum CodeMode { Number, Pool }

    struct Router {
        string chainId;
        string adr;
        string poolCodeLength;
    }

    struct Code {
        bool isBlocked; // ───┐
        bool hasSipDomain; // │ Used if number mode
        bool hasRouter; //    │ Used if pool mode
        address owner; // ────┘
        uint256 subscriptionEndTime;
        CodeMode mode;
        string sipDomain; // Used if number mode
        Router router; // Used if pool mode
    }

    struct CodeStatus {
        bool isBlocked; // ─────────┐
        bool isAvailable; //        │
        bool isHolded; //           │
        bool isAvailableForBuy; // ─┘
        uint256 subscriptionEndTime;
        uint256 holdingEndTime;
    }



    // ----- SETTINGS --------------------------------------------------------------------------------------------------

    uint256 constant public POOL_SIZE = 1000;

    uint256 public buyPrice = 10 ether;
    uint256 public subscriptionPrice = 7 ether;
    uint256 public modeChangePrice = 5 ether;
    uint256 public subscriptionDuration = 315532800; // 10 years
    uint256 public codeFreezeDuration = 7776000; // 3 months
    string public ttl = "864000"; // 10 days

    string public defaultSipDomain = "sip.quic.pro";



    // ----- DATA ------------------------------------------------------------------------------------------------------

    Code[POOL_SIZE] public pool;



    // ----- CONSTRUCTOR -----------------------------------------------------------------------------------------------

    constructor() {
        for (uint256 code; code < 100; code = code.add(1)) {
            pool[code].isBlocked = true;
        }
    }



    // ----- PUBLIC UTILS ----------------------------------------------------------------------------------------------

    function getTimestamp() public view returns(uint256) {
        return block.timestamp;
    }

    function isValidCode(uint256 code) public pure returns(bool) {
        return (code < POOL_SIZE);
    }

    function isCodeOwner(uint256 code, address adr) public view returns(bool) {
        require(isValidCode(code), "Invalid code!");
        return (
            (adr == owner()) ||
            (
                (pool[code].owner == adr) &&
                (block.timestamp < pool[code].subscriptionEndTime.add(codeFreezeDuration))
            )
        );
    }

    function isAvailable(uint256 code) public view returns(bool) {
        require(isValidCode(code), "Invalid code!");
        return ((pool[code].owner == address(0)) || (block.timestamp > pool[code].subscriptionEndTime));
    }

    function isBlocked(uint256 code) public view returns(bool) {
        require(isValidCode(code), "Invalid code!");
        return pool[code].isBlocked;
    }

    function isHolded(uint256 code) public view returns(bool) {
        require(isValidCode(code), "Invalid code!");
        return (
            (pool[code].owner != address(0)) &&
            (block.timestamp > pool[code].subscriptionEndTime) &&
            (block.timestamp < pool[code].subscriptionEndTime.add(codeFreezeDuration))
        );
    }

    function isAvailableForBuy(uint256 code) public view returns(bool) {
        require(isValidCode(code), "Invalid code!");
        return (isAvailable(code) && !isBlocked(code) && !isHolded(code));
    }

    function isNumberMode(uint256 code) internal view returns(bool) {
        require(isValidCode(code), "Invalid code!");

        require(!isAvailable(code), "Code not in use!");

        return (pool[code].mode == CodeMode.Number);
    }

    function isPoolMode(uint256 code) internal view returns(bool) {
        require(isValidCode(code), "Invalid code!");

        require(!isAvailable(code), "Code not in use!");

        return (pool[code].mode == CodeMode.Pool);
    }

    function getMode(uint256 code) public view returns(CodeMode) {
        require(isValidCode(code), "Invalid code!");

        require(!isAvailable(code), "Code not in use!");

        return pool[code].mode;
    }

    function getCodeStatus(uint256 code) public view returns(CodeStatus memory) {
        require(isValidCode(code), "Invalid code!");

        return CodeStatus(
            isBlocked(code),
            isAvailable(code),
            isHolded(code),
            isAvailableForBuy(code),
            pool[code].subscriptionEndTime,
            pool[code].subscriptionEndTime.add(codeFreezeDuration)
        );
    }

    function getBlockedCodes() public view returns(bool[POOL_SIZE] memory) {
        bool[POOL_SIZE] memory blockedCodes;
        for (uint256 code; code < POOL_SIZE; code = code.add(1)) {
            blockedCodes[code] = isBlocked(code);
        }
        return blockedCodes;
    }

    function getAvailableCodes() public view returns(bool[POOL_SIZE] memory) {
        bool[POOL_SIZE] memory availableCodes;
        for (uint256 code; code < POOL_SIZE; code = code.add(1)) {
            availableCodes[code] = isAvailable(code);
        }
        return availableCodes;
    }

    function getHoldedCodes() public view returns(bool[POOL_SIZE] memory) {
        bool[POOL_SIZE] memory holdedCodes;
        for (uint256 code; code < POOL_SIZE; code = code.add(1)) {
            holdedCodes[code] = isHolded(code);
        }
        return holdedCodes;
    }

    function getAvailableForBuyCodes() public view returns(bool[POOL_SIZE] memory) {
        bool[POOL_SIZE] memory availableForBuyCodes;
        for (uint256 code; code < POOL_SIZE; code = code.add(1)) {
            availableForBuyCodes[code] = isAvailableForBuy(code);
        }
        return availableForBuyCodes;
    }

    function getPoolCodes() public view returns(bool[POOL_SIZE] memory) {
        bool[POOL_SIZE] memory poolCodes;
        for (uint256 code; code < POOL_SIZE; code = code.add(1)) {
            poolCodes[code] = (!isAvailableForBuy(code) && isPoolMode(code));
        }
        return poolCodes;
    }

    function getOwnerCodes(address adr) public view returns(bool[POOL_SIZE] memory) {
        bool[POOL_SIZE] memory ownerCodes;
        for (uint256 code; code < POOL_SIZE; code = code.add(1)) {
            ownerCodes[code] = (pool[code].owner == adr);
        }
        return ownerCodes;
    }



    // ----- INTERNAL UTILS --------------------------------------------------------------------------------------------

    function _checkPayment(uint256 expected, uint256 received) internal view returns(bool) {
        return ((received >= expected) || (msg.sender == owner()));
    }

    function _setCodeSipDomain(uint256 code, string memory newSipDomain) internal {
        pool[code].sipDomain = newSipDomain;
        pool[code].hasSipDomain = true;
    }

    function _clearCodeSipDomain(uint256 code) internal {
        delete pool[code].sipDomain;
        pool[code].hasSipDomain = false;
    }

    function _setCodeRouter(uint256 code, Router memory newRouter) internal {
        pool[code].router = newRouter;
        pool[code].hasRouter = true;
    }

    function _clearCodeRouter(uint256 code) internal {
        delete pool[code].router;
        pool[code].hasRouter = false;
    }



    // ----- SMART CONTRACT MANAGEMENT ---------------------------------------------------------------------------------

    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    function setBuyPrice(uint256 newBuyPrice) external onlyOwner {
        buyPrice = newBuyPrice;
    }

    function setSubscriptionPrice(uint256 newSubscriptionPrice) external onlyOwner {
        subscriptionPrice = newSubscriptionPrice;
    }

    function setModeChangePrice(uint256 newModeChangePrice) external onlyOwner {
        modeChangePrice = newModeChangePrice;
    }

    function setSubscriptionDuration(uint256 newSubscriptionDuration) external onlyOwner {
        subscriptionDuration = newSubscriptionDuration;
    }

    function setCodeFreezeDuration(uint256 newCodeFreezeDuration) external onlyOwner {
        codeFreezeDuration = newCodeFreezeDuration;
    }

    function setTtl(uint256 newTtl) external onlyOwner {
        ttl = Strings.toString(newTtl);
    }

    function setDefaultSipDomain(string memory newDefaultSipDomain) external onlyOwner {
        defaultSipDomain = newDefaultSipDomain;
    }

    function takeAwayOwnership(uint256 code) external onlyOwner {
        require(isValidCode(code), "Invalid code!");

        pool[code].owner = address(0);
        pool[code].subscriptionEndTime = 0;
    }

    function setBlockedStatus(uint256 code, bool newBlockedStatus) external onlyOwner {
        require(isValidCode(code), "Invalid code!");

        pool[code].isBlocked = newBlockedStatus;
    }

    function setExpirationTime(uint256 code, uint256 newExpirationTime) external onlyOwner {
        require(isValidCode(code), "Invalid code!");

        pool[code].subscriptionEndTime = block.timestamp.add(newExpirationTime);
    }



    // ----- CODE MANAGEMENT -------------------------------------------------------------------------------------------

    // TODO: Refactory to ERC721 (like ENS Name)
    function buy(uint256 code) external payable {
        require(isValidCode(code), "Invalid code!");
        require(_checkPayment(buyPrice, msg.value), "Insufficient funds!");

        require(isAvailableForBuy(code), "The code is not available for buy!");

        delete pool[code];

        pool[code].owner = msg.sender;
        pool[code].subscriptionEndTime = block.timestamp.add(subscriptionDuration);
    }

    function renewSubscription(uint256 code) external payable returns(string[1] memory) {
        if (!isValidCode(code)) return ["400"];
        if (!_checkPayment(subscriptionPrice, msg.value)) return ["400"];

        if (!isCodeOwner(code, msg.sender)) return ["400"];

        pool[code].subscriptionEndTime = pool[code].subscriptionEndTime.add(subscriptionDuration);

        return ["200"];
    }

    function transferOwnershipOfCode(uint256 code, address newOwner) external returns(string[1] memory) {
        if (!isValidCode(code)) return ["400"];

        if (!isCodeOwner(code, msg.sender)) return ["400"];

        pool[code].owner = newOwner;

        return ["200"];
    }

    function renounceOwnershipOfCode(uint256 code) external returns(string[1] memory) {
        if (!isValidCode(code)) return ["400"];

        if (!isCodeOwner(code, msg.sender)) return ["400"];

        pool[code].owner = address(0);
        pool[code].subscriptionEndTime = 0;

        return ["200"];
    }

    function changeCodeMode(uint256 code) external payable returns(string[1] memory) {
        if (!isValidCode(code)) return ["400"];
        if (!_checkPayment(modeChangePrice, msg.value)) return ["400"];

        if (!isCodeOwner(code, msg.sender)) return ["400"];
        if (isHolded(code)) return ["400"];

        if (isNumberMode(code)) {
            pool[code].mode = CodeMode.Pool;
            _clearCodeSipDomain(code);
        } else {
            pool[code].mode = CodeMode.Number;
            _clearCodeRouter(code);
        }

        return ["200"];
    }

    function setCodeSipDomain(uint256 code, string memory newSipDomain) external returns(string[1] memory) {
        if (!isValidCode(code)) return ["400"];

        if (!isCodeOwner(code, msg.sender)) return ["400"];
        if (isHolded(code)) return ["400"];
        if (!isNumberMode(code)) return ["400"];

        _setCodeSipDomain(code, newSipDomain);

        return ["200"];
    }

    function clearCodeSipDomain(uint256 code) external returns(string[1] memory) {
        if (!isValidCode(code)) return ["400"];

        if (!isCodeOwner(code, msg.sender)) return ["400"];
        if (isHolded(code)) return ["400"];
        if (!isNumberMode(code)) return ["400"];

        _clearCodeSipDomain(code);

        return ["200"];
    }

    function setCodeRouter(uint256 code, uint256 newChainId, string memory newAddress, uint256 newPoolCodeLength) external returns(string[1] memory) {
        if (!isValidCode(code)) return ["400"];

        if (!isCodeOwner(code, msg.sender)) return ["400"];
        if (isHolded(code)) return ["400"];
        if (!isPoolMode(code)) return ["400"];

        Router memory newRouter = Router(Strings.toString(newChainId), newAddress, Strings.toString(newPoolCodeLength));
        _setCodeRouter(code, newRouter);

        return ["200"];
    }

    function clearCodeRouter(uint256 code) external returns(string[1] memory) {
        if (!isValidCode(code)) return ["400"];

        if (!isCodeOwner(code, msg.sender)) return ["400"];
        if (isHolded(code)) return ["400"];
        if (!isPoolMode(code)) return ["400"];

        _clearCodeRouter(code);

        return ["200"];
    }



    // ----- ROUTING ---------------------------------------------------------------------------------------------------

    function getNextNode(uint256 code) public view returns(string[5] memory) {
        if (!isValidCode(code)) return ["400", "", "", "", ttl];

        if (isAvailable(code)) return ["400", "", "", "", ttl];
        if (isHolded(code)) return ["400", "", "", "", ttl];
        if (isBlocked(code)) return ["400", "", "", "", ttl];

        if (isNumberMode(code)) {
            return [
                "200", // Response code
                "0", // Pool code length
                Strings.toHexString(pool[code].owner),
                (pool[code].hasSipDomain ? pool[code].sipDomain : defaultSipDomain),
                ttl
            ];
        } else {
            return [
                (pool[code].hasRouter ? "200" : "400"), // Response code
                pool[code].router.poolCodeLength,
                pool[code].router.chainId,
                pool[code].router.adr,
                ttl
            ];
        }
    }
}
