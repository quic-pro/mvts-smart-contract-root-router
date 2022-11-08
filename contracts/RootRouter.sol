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
        bool isBlocked;// ──────────┐
        bool isFree; //             │
        bool isHolded; //           │
        bool isAvailableForBuy; // ─┘
        uint256 subscriptionEndTime;
        uint256 holdingEndTime;
    }



    // ----- SETTINGS --------------------------------------------------------------------------------------------------

    uint256 constant public POOL_CODE_LENGTH = 3;
    uint256 constant public POOL_SIZE = 1000;
    uint256 constant public MIN_NUMBER = 100;
    uint256 constant public MAX_NUMBER = 999;

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
        for (uint256 number; number < MIN_NUMBER; number = number.add(1)) {
            pool[number].isBlocked = true;
        }
    }



    // ----- PUBLIC UTILS ----------------------------------------------------------------------------------------------

    function isValidNumber(uint256 number) internal pure returns(bool) {
        return ((number >= MIN_NUMBER) && (number <= MAX_NUMBER));
    }

    function checkPayment(uint256 received, uint256 expected) internal view returns(bool) {
        return ((received >= expected) || (msg.sender == owner()));
    }

    function isAddressNumberOwner(uint256 number, address addressNumberOwner) public view returns(bool) {
        if (!isValidNumber(number)) {
            return false;
        }

        CustomerNumber storage customerNumber = getCustomerNumber(number);
        return ((addressNumberOwner == owner()) || ((customerNumber.owner == addressNumberOwner) && (block.timestamp < customerNumber.subscriptionEndTime)));
    }

    function isFree(uint256 number) public view returns(bool) {
        return isFree(getCustomerNumber(number));
    }

    function isBlocked(uint256 number) public view returns(bool) {
        return isBlocked(getCustomerNumber(number));
    }

    function isHolded(uint256 number) public view returns(bool) {
        return isHolded(getCustomerNumber(number));
    }

    function isAvailableForBuy(uint256 number) public view returns(bool) {
        CustomerNumber storage customerNumber = getCustomerNumber(number);
        return isAvailableForBuy(customerNumber);
    }

    function getMode(uint256 number) public view returns(CustomerNumberMode) {
        CustomerNumber storage customerNumber = getCustomerNumber(number);
        return customerNumber.mode;
    }

    function getNumberStatus(uint256 number) public view returns(NumberStatus memory) {
        CustomerNumber storage customerNumber = getCustomerNumber(number);
        return NumberStatus(
            isBlocked(customerNumber),
            isFree(customerNumber),
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
        bool[POOL_SIZE] memory freeNumbers;
        for (uint256 number; number < POOL_SIZE; number = number.add(1)) {
            freeNumbers[number] = isFree(number);
        }
        return freeNumbers;
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

    function getCustomerNumber(uint256 number) internal view returns(CustomerNumber storage) {
        return pool[number];
    }

    function isFree(CustomerNumber storage customerNumber) internal view returns(bool) {
        return ((customerNumber.owner == address(0)) && (block.timestamp > customerNumber.subscriptionEndTime));
    }

    function isBlocked(CustomerNumber storage customerNumber) internal view returns(bool) {
        return customerNumber.isBlocked;
    }

    function isHolded(CustomerNumber storage customerNumber) internal view returns(bool) {
        return (
        (block.timestamp > customerNumber.subscriptionEndTime) &&
        (block.timestamp.sub(customerNumber.subscriptionEndTime) < numberFreezeDuration)
        );
    }

    function isAvailableForBuy(CustomerNumber storage customerNumber) internal view returns(bool) {
        return (!isFree(customerNumber) && !isBlocked(customerNumber) && !isHolded(customerNumber));
    }

    function isNumberMode(CustomerNumber storage customerNumber) internal view returns(bool) {
        return (customerNumber.mode == CustomerNumberMode.Number);
    }

    function isPoolMode(CustomerNumber storage customerNumber) internal view returns(bool) {
        return (customerNumber.mode == CustomerNumberMode.Pool);
    }

    function clearCustomerNumber(uint256 number) internal {
        CustomerNumber storage customerNumber = getCustomerNumber(number);
        customerNumber.isBlocked = false;
        customerNumber.owner = address(0);
        customerNumber.subscriptionEndTime = block.timestamp;
        customerNumber.mode = CustomerNumberMode.Number;
        customerNumber.sipDomain = "";
        customerNumber.router = Router(0, 0, 0, "");
    }

    function isEqualStrings(string memory a, string memory b) internal pure returns(bool) {
        return (keccak256(abi.encodePacked(a)) == keccak256(abi.encodePacked(b)));
    }



    // ----- SMART CONTRACT MANAGEMENT ---------------------------------------------------------------------------------

    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    function setBuyPrice(uint256 newBuyPrice) external onlyOwner {
        buyPrice = newBuyPrice;
    }

    function setSubscriptionPricePrice(uint256 newSubscriptionPrice) external onlyOwner {
        subscriptionPrice = newSubscriptionPrice;
    }

    function setNumberFreezeDuration(uint256 newNumberFreezeDuration) external onlyOwner {
        numberFreezeDuration = newNumberFreezeDuration;
    }

    function setModeChangePrice(uint256 newModeChangePrice) external onlyOwner {
        modeChangePrice = newModeChangePrice;
    }

    function setSubscriptionDuration(uint256 newSubscriptionDuration) external onlyOwner {
        subscriptionDuration = newSubscriptionDuration;
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

    function setBlockedStatus(uint256 number, bool blockedStatus) external onlyOwner {
        require(isValidNumber(number), "Invalid number!");

        CustomerNumber storage customerNumber = getCustomerNumber(number);
        customerNumber.isBlocked = blockedStatus;
    }

    function setExpirationTime(uint256 number, uint256 newExpirationTime) external onlyOwner {
        require(isValidNumber(number), "Invalid number!");

        CustomerNumber storage customerNumber = getCustomerNumber(number);
        customerNumber.subscriptionEndTime = block.timestamp.add(newExpirationTime);
    }



    // ----- CUSTOMER NUMBER MANAGEMENT --------------------------------------------------------------------------------

    // TODO: Refactory to ERC721 (like ENS Name)
    function buy(uint256 number) external payable {
        require(isValidNumber(number), "Invalid number!");
        require(checkPayment(msg.value, buyPrice), "Insufficient funds!");
        require(isFree(number), "The customerNumber already has an owner!");

        clearCustomerNumber(number);

        CustomerNumber storage customerNumber = getCustomerNumber(number);
        customerNumber.owner = msg.sender;
        customerNumber.subscriptionEndTime = block.timestamp.add(subscriptionDuration);
    }

    function renewSubscription(uint256 number) external payable returns(string[1] memory) {
        if (!isAddressNumberOwner(number, msg.sender) || !checkPayment(msg.value, subscriptionPrice)) {
            return ["400"];
        }

        CustomerNumber storage customerNumber = getCustomerNumber(number);
        customerNumber.subscriptionEndTime = customerNumber.subscriptionEndTime.add(subscriptionDuration);

        return ["200"];
    }

    function changeCustomerNumberMode(uint256 number) external payable returns(string[1] memory) {
        if (!isAddressNumberOwner(number, msg.sender) || !checkPayment(msg.value, modeChangePrice)) {
            return ["400"];
        }

        CustomerNumber storage customerNumber = getCustomerNumber(number);
        if (isNumberMode(customerNumber)) {
            customerNumber.mode = CustomerNumberMode.Pool;
        } else {
            customerNumber.mode = CustomerNumberMode.Number;
            customerNumber.router = Router(0, 0, 0, "");
        }

        return ["200"];
    }

    function setCustomerNumberSipDomain(uint256 number, string memory newSipDomain) external returns(string[1] memory) {
        if (!isAddressNumberOwner(number, msg.sender)) {
            return ["400"];
        }

        CustomerNumber storage customerNumber = getCustomerNumber(number);
        if (!isNumberMode(customerNumber)) {
            return ["400"];
        }

        customerNumber.sipDomain = newSipDomain;

        return ["200"];
    }

    function setCustomerNumberRouter(uint256 number, uint128 chainId, string memory adr, uint128 poolCodeLength, uint256 ttl) external returns(string[1] memory) {
        if (!isAddressNumberOwner(number, msg.sender)) {
            return ["400"];
        }

        CustomerNumber storage customerNumber = getCustomerNumber(number);
        if (!isPoolMode(customerNumber)) {
            return ["400"];
        }

        customerNumber.router = Router(chainId, poolCodeLength, ttl, adr);

        return ["200"];
    }

    function transferOwnershipOfCustomerNumber(uint256 number, address newOwner) external returns(string[1] memory) {
        if (!isAddressNumberOwner(number, msg.sender)) {
            return ["400"];
        }

        CustomerNumber storage customerNumber = getCustomerNumber(number);
        customerNumber.owner = newOwner;

        return ["200"];
    }



    // ----- ROUTING ---------------------------------------------------------------------------------------------------

    function getNextNode(uint256 number) public view returns(string[] memory) {
        if (!isValidNumber(number) || isFree(number)) {
            string[] memory result = new string[](1);
            result[0] = "400";
            return result;
        }

        CustomerNumber storage customerNumber = getCustomerNumber(number);
        if (isNumberMode(customerNumber)) {
            string[] memory result = new string[](5);
            result[0] = "200";
            result[1] = (customerNumber.isBlocked ? "1" : "0");
            result[2] = "0";
            result[3] = Strings.toHexString(customerNumber.owner);
            result[4] = (isEqualStrings(customerNumber.sipDomain, "") ? defaultSipDomain : customerNumber.sipDomain);

            return result;
        } else {
            string[] memory result = new string[](6);
            result[0] = "200";
            result[1] = (customerNumber.isBlocked ? "1" : "0");
            result[2] = Strings.toString(customerNumber.router.poolCodeLength);
            result[3] = Strings.toString(customerNumber.router.chainId);
            result[4] = customerNumber.router.adr;
            result[5] = Strings.toString(isEqualStrings(customerNumber.sipDomain, "") ? defaultTtl : customerNumber.router.ttl);

            return result;
        }
    }
}
