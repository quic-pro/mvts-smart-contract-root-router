// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;



import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Strings.sol";



contract RootRouter is Ownable {
    using SafeMath for uint256;



    // ----- CUSTOM TYPES ----------------------------------------------------------------------------------------------

    enum CustomerNumberMode { Number, Pool }

    struct Router {
        uint128 chainId; // ────────┐
        uint128 poolCodeLength; // ─┘
        uint256 ttl;
        string adr;
    }

    struct CustomerNumber {
        bool isBlocked; // ─┐
        address owner; // ──┘
        uint256 subscriptionEndTime;
        CustomerNumberMode mode;
        string sipDomain;
        Router router;
    }

    struct NumberStatus {
        bool isBlocked; // ─────────┐
        bool isAvailable; //        │
        bool isHolded; //           │
        bool isAvailableForBuy; // ─┘
        uint256 subscriptionEndTime;
        uint256 holdingEndTime;
    }



    // ----- SETTINGS --------------------------------------------------------------------------------------------------

    uint256 constant public POOL_CODE_LENGTH = 3;
    uint256 constant public POOL_SIZE = 1000;

    uint256 public buyPrice = 10 ether;
    uint256 public subscriptionPrice = 7 ether;
    uint256 public modeChangePrice = 5 ether;
    uint256 public subscriptionDuration = 315532800; // 10 years
    uint256 public numberFreezeDuration = 7776000; // 3 months
    uint256 public defaultTtl = 864000; // 10 days

    string public defaultSipDomain = "sip.quic.pro";



    // ----- DATA ------------------------------------------------------------------------------------------------------

    CustomerNumber[POOL_SIZE] public pool;



    // ----- CONSTRUCTOR -----------------------------------------------------------------------------------------------

    constructor() {
        for (uint256 number; number < 100; number = number.add(1)) {
            pool[number].isBlocked = true;
        }
    }



    // ----- PUBLIC UTILS ----------------------------------------------------------------------------------------------

    function getTimestamp() public view returns(uint256) {
        return block.timestamp;
    }

    function isValidNumber(uint256 number) public pure returns(bool) {
        return (number < POOL_SIZE);
    }

    function isNumberOwner(uint256 number, address adr) public view returns(bool) {
        require(isValidNumber(number), "Invalid number!");
        return isNumberOwner(pool[number], adr);
    }

    function isAvailable(uint256 number) public view returns(bool) {
        require(isValidNumber(number), "Invalid number!");
        return isAvailable(pool[number]);
    }

    function isBlocked(uint256 number) public view returns(bool) {
        require(isValidNumber(number), "Invalid number!");
        return isBlocked(pool[number]);
    }

    function isHolded(uint256 number) public view returns(bool) {
        require(isValidNumber(number), "Invalid number!");
        return isHolded(pool[number]);
    }

    function isAvailableForBuy(uint256 number) public view returns(bool) {
        require(isValidNumber(number), "Invalid number!");
        return isAvailableForBuy(pool[number]);
    }

    function isNumberMode(uint256 number) internal view returns(bool) {
        require(isValidNumber(number), "Invalid number!");
        return isNumberMode(pool[number]);
    }

    function isPoolMode(uint256 number) internal view returns(bool) {
        require(isValidNumber(number), "Invalid number!");
        return isPoolMode(pool[number]);
    }

    function getMode(uint256 number) public view returns(CustomerNumberMode) {
        require(isValidNumber(number), "Invalid number!");
        return pool[number].mode;
    }

    function getNumberStatus(uint256 number) public view returns(NumberStatus memory) {
        require(isValidNumber(number), "Invalid number!");

        CustomerNumber storage customerNumber = pool[number];
        return NumberStatus(
            isBlocked(customerNumber),
            isAvailable(customerNumber),
            isHolded(customerNumber),
            isAvailableForBuy(customerNumber),
            customerNumber.subscriptionEndTime,
            customerNumber.subscriptionEndTime.add(numberFreezeDuration)
        );
    }

    function getBlockedNumbers() public view returns(bool[POOL_SIZE] memory) {
        bool[POOL_SIZE] memory blockedNumbers;
        for (uint256 number; number < POOL_SIZE; number = number.add(1)) {
            blockedNumbers[number] = isBlocked(number);
        }
        return blockedNumbers;
    }

    function getAvailableNumbers() public view returns(bool[POOL_SIZE] memory) {
        bool[POOL_SIZE] memory availableNumbers;
        for (uint256 number; number < POOL_SIZE; number = number.add(1)) {
            availableNumbers[number] = isAvailable(number);
        }
        return availableNumbers;
    }

    function getHoldedNumbers() public view returns(bool[POOL_SIZE] memory) {
        bool[POOL_SIZE] memory holdedNumbers;
        for (uint256 number; number < POOL_SIZE; number = number.add(1)) {
            holdedNumbers[number] = isHolded(number);
        }
        return holdedNumbers;
    }

    function getAvailableForBuyNumbers() public view returns(bool[POOL_SIZE] memory) {
        bool[POOL_SIZE] memory availableForBuyNumbers;
        for (uint256 number; number < POOL_SIZE; number = number.add(1)) {
            availableForBuyNumbers[number] = isAvailableForBuy(number);
        }
        return availableForBuyNumbers;
    }



    // ----- INTERNAL UTILS --------------------------------------------------------------------------------------------

    function checkPayment(uint256 expected, uint256 received) internal view returns(bool) {
        return ((received >= expected) || (msg.sender == owner()));
    }

    function isNumberOwner(CustomerNumber storage customerNumber, address adr) internal view returns(bool) {
        return (
            (adr == owner()) ||
            (
                (customerNumber.owner == adr) &&
                (block.timestamp < customerNumber.subscriptionEndTime.add(numberFreezeDuration))
            )
        );
    }

    function isAvailable(CustomerNumber storage customerNumber) internal view returns(bool) {
        return ((customerNumber.owner == address(0)) || (block.timestamp > customerNumber.subscriptionEndTime));
    }

    function isBlocked(CustomerNumber storage customerNumber) internal view returns(bool) {
        return customerNumber.isBlocked;
    }

    function isHolded(CustomerNumber storage customerNumber) internal view returns(bool) {
        return (
            (customerNumber.owner != address(0)) &&
            (block.timestamp > customerNumber.subscriptionEndTime) &&
            (block.timestamp < customerNumber.subscriptionEndTime.add(numberFreezeDuration))
        );
    }

    function isAvailableForBuy(CustomerNumber storage customerNumber) internal view returns(bool) {
        return (isAvailable(customerNumber) && !isBlocked(customerNumber) && !isHolded(customerNumber));
    }

    function isNumberMode(CustomerNumber storage customerNumber) internal view returns(bool) {
        return (customerNumber.mode == CustomerNumberMode.Number);
    }

    function isPoolMode(CustomerNumber storage customerNumber) internal view returns(bool) {
        return (customerNumber.mode == CustomerNumberMode.Pool);
    }

    function isEmptyString(string memory str) internal pure returns(bool) {
        return (bytes(str).length == 0);
    }

    function clearCustomerNumber(uint256 number) internal {
        delete pool[number];
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

    function setNumberFreezeDuration(uint256 newNumberFreezeDuration) external onlyOwner {
        numberFreezeDuration = newNumberFreezeDuration;
    }

    function setDefaultTtl(uint256 newDefaultTtl) external onlyOwner {
        defaultTtl = newDefaultTtl;
    }

    function setDefaultSipDomain(string memory newDefaultSipDomain) external onlyOwner {
        defaultSipDomain = newDefaultSipDomain;
    }

    function takeAwayOwnership(uint256 number) external onlyOwner {
        require(isValidNumber(number), "Invalid number!");

        clearCustomerNumber(number);
    }

    function setBlockedStatus(uint256 number, bool newBlockedStatus) external onlyOwner {
        require(isValidNumber(number), "Invalid number!");

        CustomerNumber storage customerNumber = pool[number];
        customerNumber.isBlocked = newBlockedStatus;
    }

    function setExpirationTime(uint256 number, uint256 newExpirationTime) external onlyOwner {
        require(isValidNumber(number), "Invalid number!");

        CustomerNumber storage customerNumber = pool[number];
        customerNumber.subscriptionEndTime = block.timestamp.add(newExpirationTime);
    }



    // ----- CUSTOMER NUMBER MANAGEMENT --------------------------------------------------------------------------------

    // TODO: Refactory to ERC721 (like ENS Name)
    function buy(uint256 number) external payable {
        require(isValidNumber(number), "Invalid number!");
        require(checkPayment(buyPrice, msg.value), "Insufficient funds!");

        CustomerNumber storage customerNumber = pool[number];
        require(isAvailableForBuy(customerNumber), "The number is not available for buy!");

        clearCustomerNumber(number);

        customerNumber.owner = msg.sender;
        customerNumber.subscriptionEndTime = block.timestamp.add(subscriptionDuration);
    }

    function renewSubscription(uint256 number) external payable returns(string[1] memory) {
        if (!isValidNumber(number)) return ["400"];
        if (!checkPayment(subscriptionPrice, msg.value)) return ["400"];

        CustomerNumber storage customerNumber = pool[number];
        if (!isNumberOwner(customerNumber, msg.sender)) return ["400"];

        customerNumber.subscriptionEndTime = customerNumber.subscriptionEndTime.add(subscriptionDuration);

        return ["200"];
    }

    function transferOwnershipOfCustomerNumber(uint256 number, address newOwner) external returns(string[1] memory) {
        if (!isValidNumber(number)) return ["400"];

        CustomerNumber storage customerNumber = pool[number];
        if (!isNumberOwner(customerNumber, msg.sender)) return ["400"];
        if (isHolded(customerNumber)) return ["400"];

        customerNumber.owner = newOwner;

        return ["200"];
    }

    function renounceOwnershipOfCustomerNumber(uint256 number) external returns(string[1] memory) {
        if (!isValidNumber(number)) return ["400"];

        CustomerNumber storage customerNumber = pool[number];
        if (!isNumberOwner(customerNumber, msg.sender)) return ["400"];

        clearCustomerNumber(number);

        return ["200"];
    }

    function changeCustomerNumberMode(uint256 number) external payable returns(string[1] memory) {
        if (!isValidNumber(number)) return ["400"];
        if (!checkPayment(modeChangePrice, msg.value)) return ["400"];

        CustomerNumber storage customerNumber = pool[number];
        if (!isNumberOwner(customerNumber, msg.sender)) return ["400"];
        if (isHolded(customerNumber)) return ["400"];

        if (isNumberMode(customerNumber)) {
            customerNumber.mode = CustomerNumberMode.Pool;
            delete customerNumber.sipDomain;
        } else {
            customerNumber.mode = CustomerNumberMode.Number;
            delete customerNumber.router;
        }

        return ["200"];
    }

    function setCustomerNumberSipDomain(uint256 number, string memory newSipDomain) external returns(string[1] memory) {
        if (!isValidNumber(number)) return ["400"];

        CustomerNumber storage customerNumber = pool[number];
        if (!isNumberOwner(customerNumber, msg.sender)) return ["400"];
        if (isHolded(customerNumber)) return ["400"];
        if (!isNumberMode(customerNumber)) return ["400"];

        customerNumber.sipDomain = newSipDomain;

        return ["200"];
    }

    function clearCustomerNumberSipDomain(uint256 number) external returns(string[1] memory) {
        if (!isValidNumber(number)) return ["400"];

        CustomerNumber storage customerNumber = pool[number];
        if (!isNumberOwner(customerNumber, msg.sender)) return ["400"];
        if (isHolded(customerNumber)) return ["400"];
        if (!isNumberMode(customerNumber)) return ["400"];

        delete customerNumber.sipDomain;

        return ["200"];
    }

    function setCustomerNumberRouter(uint256 number, Router memory newRouter) external returns(string[1] memory) {
        if (!isValidNumber(number)) return ["400"];

        CustomerNumber storage customerNumber = pool[number];
        if (!isNumberOwner(customerNumber, msg.sender)) return ["400"];
        if (isHolded(customerNumber)) return ["400"];
        if (!isPoolMode(customerNumber)) return ["400"];

        customerNumber.router = newRouter;

        return ["200"];
    }

    function clearCustomerNumberRouter(uint256 number) external returns(string[1] memory) {
        if (!isValidNumber(number)) return ["400"];

        CustomerNumber storage customerNumber = pool[number];
        if (!isNumberOwner(customerNumber, msg.sender)) return ["400"];
        if (isHolded(customerNumber)) return ["400"];
        if (!isPoolMode(customerNumber)) return ["400"];

        delete customerNumber.router;

        return ["200"];
    }

    function setCustomerNumberRouterTtl(uint256 number, uint256 newTtl) external returns(string[1] memory) {
        if (!isValidNumber(number)) return ["400"];

        CustomerNumber storage customerNumber = pool[number];
        if (!isNumberOwner(customerNumber, msg.sender)) return ["400"];
        if (isHolded(customerNumber)) return ["400"];
        if (!isPoolMode(customerNumber)) return ["400"];

        customerNumber.router.ttl = newTtl;

        return ["200"];
    }

    function clearCustomerNumberRouterTtl(uint256 number) external returns(string[1] memory) {
        if (!isValidNumber(number)) return ["400"];

        CustomerNumber storage customerNumber = pool[number];
        if (!isNumberOwner(customerNumber, msg.sender)) return ["400"];
        if (isHolded(customerNumber)) return ["400"];
        if (!isPoolMode(customerNumber)) return ["400"];

        delete customerNumber.router.ttl;

        return ["200"];
    }



    // ----- ROUTING ---------------------------------------------------------------------------------------------------

    function getNextNode(uint256 number) public view returns(string[5] memory) {
        if (!isValidNumber(number)) return ["400", "", "", "", ""];

        CustomerNumber storage customerNumber = pool[number];
        if (isBlocked(customerNumber)) return ["400", "", "", "", ""];
        if (isAvailable(customerNumber)) return ["400", "", "", "", ""];
        if (isHolded(customerNumber)) return ["400", "", "", "", ""];

        if (isNumberMode(customerNumber)) {
            return [
                "200",
                "0",
                Strings.toHexString(customerNumber.owner),
                (isEmptyString(customerNumber.sipDomain) ? defaultSipDomain : customerNumber.sipDomain),
                ""
            ];
        } else {
            return [
                "200",
                Strings.toString(customerNumber.router.poolCodeLength),
                Strings.toString(customerNumber.router.chainId),
                customerNumber.router.adr,
                Strings.toString(customerNumber.router.ttl == 0 ? defaultTtl : customerNumber.router.ttl)
            ];
        }
    }
}
