// SPDX-License-Identifier: MIT


pragma solidity 0.8.7;


import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Strings.sol";


contract RootRouter is Ownable {
    using SafeMath for uint256;



    // ----- CUSTOM TYPES ------------------------------------------------------

    enum CustomerNumberMode { Number, Pool }

    struct Router {
        uint128 chainId;
        string adr;
        uint128 poolCodeLength;
    }

    struct CustomerNumber {
        address owner;
        uint256 subscriptionEndTime;
        bool isBlocked;
        CustomerNumberMode mode;
        Router router;
    }



    // ----- SETTINGS ----------------------------------------------------------

    uint256 constant public POOL_CODE_LENGTH = 3;
    uint256 constant public POOL_SIZE = 900;
    uint256 constant public MIN_NUMBER = 100;
    uint256 constant public MAX_NUMBER = 999;

    uint256 public buyPrice = 10 ether;
    uint256 public renewalOwnershipPrice = 7 ether;
    uint256 public modeChangePrice = 5 ether;
    uint256 public subscriptionDuration = 315532800; // 10 years
    uint256 public ttl = 864000; // 10 days

    string public sipDomain = "sip.quic.pro";



    // ----- DATA --------------------------------------------------------------

    CustomerNumber[POOL_SIZE] public pool;



    // ----- HELPERS -----------------------------------------------------------


    function isValidNumber(uint256 number) internal pure returns(bool) {
        return ((number >= MIN_NUMBER) && (number <= MAX_NUMBER));
    }

    // TODO rename to check payment
    function isEnoughFunds(uint256 received, uint256 expected) internal view returns(bool) {
        return ((received >= expected) || (msg.sender == owner()));
    }

    // TODO rename Customer to addres
    function isCustomerNumberOwner(uint256 number, address customerNumberOwner) public view returns(bool) {
        if (!isValidNumber(number)) {
            return false;
        }

        CustomerNumber storage customerNumber = getCustomerNumber(number);
        return ((customerNumberOwner == owner()) || ((customerNumber.owner == customerNumberOwner) && (customerNumber.subscriptionEndTime > block.timestamp)));
    }


    // TODO check internal and public
    // ----- UTILS -------------------------------------------------------------

    // TODO refactore to 1000 and remove sub 
    function getCustomerNumber(uint256 number) internal view returns(CustomerNumber storage) {
        return pool[number.sub(100)];
    }

    function isNumberMode(CustomerNumber storage customerNumber) internal view returns(bool) {
        return customerNumber.mode == CustomerNumberMode.Number;
    }

    function isPoolMode(CustomerNumber storage customerNumber) internal view returns(bool) {
        return customerNumber.mode == CustomerNumberMode.Pool;
    }

    function hasOwner(uint256 number) public view returns(bool) {
        CustomerNumber storage customerNumber = getCustomerNumber(number);
        return ((customerNumber.owner != address(0)) && (customerNumber.subscriptionEndTime > block.timestamp));
    }

    function clearCustomerNumber(uint256 number) internal {
        CustomerNumber storage customerNumber = getCustomerNumber(number);
        customerNumber.owner = address(0);
        customerNumber.subscriptionEndTime = block.timestamp;
        customerNumber.isBlocked = false;
        customerNumber.mode = CustomerNumberMode.Number;
        customerNumber.router = Router(0, Strings.toHexString(address(0)), 0);
    }



    // ----- SMART CONTRACT MANAGEMENT ------------------------------------------

    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    function setBuyPrice(uint256 newPrice) external onlyOwner {
        buyPrice = newPrice;
    }

    function setRenewalOwnershipPrice(uint256 newPrice) external onlyOwner {
        renewalOwnershipPrice = newPrice;
    }

    function setModeChangePrice(uint256 newPrice) external onlyOwner {
        modeChangePrice = newPrice;
    }

    function setSubscriptionDuration(uint256 newDuration) external onlyOwner {
        subscriptionDuration = newDuration;
    }

    function setTtl(uint256 newTtl) external onlyOwner {
        ttl = newTtl;
    }

    function setSipDomain(string memory newSipDomain) external onlyOwner {
        sipDomain = newSipDomain;
    }

    function takeAwayOwnership(uint256 number) external onlyOwner {
        require(isValidNumber(number), "Invalid number!");

        clearCustomerNumber(number);
    }

    function setExpirationTimeCustomerNumber(uint256 number, uint256 newExpirationTime) external onlyOwner {
        require(isValidNumber(number), "Invalid number!");

        CustomerNumber storage customerNumber = getCustomerNumber(number);
        customerNumber.subscriptionEndTime = block.timestamp.add(newExpirationTime);
    }

    function changeCustomerNumberStatus(uint256 number, bool isBlocked) external onlyOwner {
        require(isValidNumber(number), "Invalid number!");

        CustomerNumber storage customerNumber = getCustomerNumber(number);
        customerNumber.isBlocked = isBlocked;
    }



    // ----- CUSTOMER NUMBER MANAGEMENT -----------------------------------------

    function buy(uint256 number) external payable {
        require(isValidNumber(number), "Invalid number!");
        require(isEnoughFunds(msg.value, buyPrice), "Insufficient funds!");
        require(!hasOwner(number), "The customerNumber already has an owner!");

        clearCustomerNumber(number);

        CustomerNumber storage customerNumber = getCustomerNumber(number);
        customerNumber.owner = msg.sender;
        customerNumber.subscriptionEndTime = block.timestamp.add(subscriptionDuration);
    }

    function renewSubscription(uint256 number) external payable returns(string[1] memory) {
        if (!isCustomerNumberOwner(number, msg.sender) || !isEnoughFunds(msg.value, renewalOwnershipPrice)) {
            return ["400"];
        }

        CustomerNumber storage customerNumber = getCustomerNumber(number);
        customerNumber.subscriptionEndTime = customerNumber.subscriptionEndTime.add(subscriptionDuration);

        return ["200"];
    }

    function changeCustomerNumberMode(uint256 number) external payable returns(string[1] memory) {
        if (!isCustomerNumberOwner(number, msg.sender) || !isEnoughFunds(msg.value, modeChangePrice)) {
            return ["400"];
        }

        CustomerNumber storage customerNumber = getCustomerNumber(number);
        if (isNumberMode(customerNumber)) {
            customerNumber.mode = CustomerNumberMode.Pool;
        } else {
            customerNumber.mode = CustomerNumberMode.Number;
            customerNumber.router = Router(0, Strings.toHexString(address(0)), 0);
        }

        return ["200"];
    }

    function setCustomerNumberRouter(uint256 number, uint128 chainId, string memory adr, uint128 poolCodeLength) external returns(string[1] memory) {
        if (!isCustomerNumberOwner(number, msg.sender)) {
            return ["400"];
        }

        CustomerNumber storage customerNumber = getCustomerNumber(number);
        require(isPoolMode(customerNumber), "The CustomerNumber is not a pool!");

        customerNumber.router.chainId = chainId;
        customerNumber.router.adr = adr;
        customerNumber.router.poolCodeLength = poolCodeLength;

        return ["200"];
    }

    function transferOwnershipOfCustomerNumber(uint256 number, address newOwner) external returns(string[1] memory) {
        if (!isCustomerNumberOwner(number, msg.sender)) {
            return ["400"];
        }

        CustomerNumber storage customerNumber = getCustomerNumber(number);
        customerNumber.owner = newOwner;

        return ["200"];
    }



    // ----- ROUTING ------------------------------------------------------------

    function getNextNode(uint256 number) public view returns(string[] memory) {
        if (!isValidNumber(number) || !hasOwner(number)) {
            string[] memory result = new string[](1);
            result[0] = "400";
            return result;
        }

        CustomerNumber storage customerNumber = getCustomerNumber(number);
        if (isNumberMode(customerNumber)) {
            string[] memory result = new string[](5);
            result[0] = "200";
            result[1] = customerNumber.isBlocked ? "0" : "1";
            result[2] = "0";
            result[3] = Strings.toHexString(customerNumber.owner);
            result[4] = sipDomain;

            return result;
        } else {
            string[] memory result = new string[](6);
            result[0] = "200";
            result[1] = customerNumber.isBlocked ? "0" : "1";
            result[2] = Strings.toString(customerNumber.router.poolCodeLength);
            result[3] = Strings.toString(customerNumber.router.chainId);
            result[4] = customerNumber.router.adr;
            result[5] = Strings.toString(ttl);

            return result;
        }
    }
}
