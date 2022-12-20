// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;


import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Strings.sol";


contract RootRouter is ERC721, Ownable {
    using SafeMath for uint256;



    // ----- CUSTOM TYPES ----------------------------------------------------------------------------------------------

    enum CodeMode {Number, Pool}

    struct Router {
        string chainId;
        string adr;
        string poolCodeLength;
    }

    struct Code {
        bool isBlocked;
        bool hasSipDomain; // Used if number mode
        bool hasRouter; // Used if pool mode
        uint256 subscriptionEndTime;
        CodeMode mode;
        string sipDomain; // Used if number mode
        Router router; // Used if pool mode
    }

    struct CodeStatus {
        bool isBlocked;
        bool hasOwner;
        bool isHeld;
        bool isAvailableForMint;
        uint256 subscriptionEndTime;
        uint256 holdEndTime;
    }



    // ----- SETTINGS --------------------------------------------------------------------------------------------------

    uint256 public mintPrice = 10 ether;
    uint256 public subscriptionPrice = 7 ether;
    uint256 public modeChangePrice = 5 ether;
    uint256 public subscriptionDuration = 3650 days; // ~10 years
    uint256 public holdingDuration = 30 days; // ~1 month
    uint256 public ttl = 10 days;

    string public baseUri = "https://mvts-metadata.io/";
    string public defaultSipDomain = "sip.quic.pro";



    // ----- DATA ------------------------------------------------------------------------------------------------------

    uint256 constant public POOL_SIZE = 1000;

    Code[POOL_SIZE] private _pool;



    // ----- CONSTRUCTOR -----------------------------------------------------------------------------------------------

    constructor() ERC721("MetaVerse Telecom Service", "MVTS") {
        for (uint256 code; code < 100; code = code.add(1)) {
            _pool[code].isBlocked = true;
        }
    }



    // ----- PUBLIC UTILS ----------------------------------------------------------------------------------------------

    function hasOwner(uint256 code) public view returns (bool) {
        require(_isValidCode(code), "Invalid code!");
        return (_exists(code) && (block.timestamp < _pool[code].subscriptionEndTime.add(holdingDuration)));
    }

    function getCodeData(uint256 code) public view returns (Code memory) {
        require(_isValidCode(code), "Invalid code!");
        require(hasOwner(code), "Code not in use!");

        return _pool[code];
    }

    function isBlocked(uint256 code) public view returns (bool) {
        require(_isValidCode(code), "Invalid code!");
        return _pool[code].isBlocked;
    }

    function isHeld(uint256 code) public view returns (bool) {
        require(_isValidCode(code), "Invalid code!");
        return (hasOwner(code) && (block.timestamp > _pool[code].subscriptionEndTime));
    }

    function isAvailableForMint(uint256 code) public view returns (bool) {
        require(_isValidCode(code), "Invalid code!");
        return (!hasOwner(code) && !isBlocked(code));
    }

    function isNumberMode(uint256 code) public view returns (bool) {
        require(_isValidCode(code), "Invalid code!");
        require(hasOwner(code), "Code not in use!");

        return (_pool[code].mode == CodeMode.Number);
    }

    function isPoolMode(uint256 code) public view returns (bool) {
        require(_isValidCode(code), "Invalid code!");
        require(hasOwner(code), "Code not in use!");

        return (_pool[code].mode == CodeMode.Pool);
    }

    function getMode(uint256 code) public view returns (CodeMode) {
        require(_isValidCode(code), "Invalid code!");
        require(hasOwner(code), "Code not in use!");

        return _pool[code].mode;
    }

    function getCodeStatus(uint256 code) public view returns (CodeStatus memory) {
        require(_isValidCode(code), "Invalid code!");

        if (hasOwner(code)) {
            return CodeStatus(
                isBlocked(code),
                true, // hasOwner
                isHeld(code),
                isAvailableForMint(code),
                _pool[code].subscriptionEndTime,
                _pool[code].subscriptionEndTime.add(holdingDuration)
            );
        } else {
            return CodeStatus(
                isBlocked(code),
                false, // hasOwner
                false, // isHeld
                isAvailableForMint(code),
                0, // subscriptionEndTime
                0 // holdEndTime
            );
        }
    }

    function getBlockedCodes() public view returns (bool[POOL_SIZE] memory) {
        bool[POOL_SIZE] memory blockedCodes;
        for (uint256 code; code < POOL_SIZE; code = code.add(1)) {
            blockedCodes[code] = isBlocked(code);
        }
        return blockedCodes;
    }

    function getHeldCodes() public view returns (bool[POOL_SIZE] memory) {
        bool[POOL_SIZE] memory heldCodes;
        for (uint256 code; code < POOL_SIZE; code = code.add(1)) {
            heldCodes[code] = isHeld(code);
        }
        return heldCodes;
    }

    function getAvailableForMintCodes() public view returns (bool[POOL_SIZE] memory) {
        bool[POOL_SIZE] memory availableForMintCodes;
        for (uint256 code; code < POOL_SIZE; code = code.add(1)) {
            availableForMintCodes[code] = isAvailableForMint(code);
        }
        return availableForMintCodes;
    }

    function getPoolCodes() public view returns (bool[POOL_SIZE] memory) {
        bool[POOL_SIZE] memory poolCodes;
        for (uint256 code; code < POOL_SIZE; code = code.add(1)) {
            poolCodes[code] = (!isAvailableForMint(code) && (_pool[code].mode == CodeMode.Pool));
        }
        return poolCodes;
    }

    function getOwnerCodes(address adr) public view returns (bool[POOL_SIZE] memory) {
        bool[POOL_SIZE] memory ownerCodes;
        for (uint256 code; code < POOL_SIZE; code = code.add(1)) {
            ownerCodes[code] = _isApprovedOrOwner(adr, code);
        }
        return ownerCodes;
    }



    // ----- INTERNAL UTILS --------------------------------------------------------------------------------------------

    function _isValidCode(uint256 code) internal pure returns (bool) {
        return (code < POOL_SIZE);
    }

    function _isApprovedOrOwner(address adr, uint256 code) internal view override returns (bool) {
        return (
            _exists(code) && ERC721._isApprovedOrOwner(adr, code) &&
            (block.timestamp < _pool[code].subscriptionEndTime.add(holdingDuration))
        );
    }

    function _checkPayment(uint256 expected, uint256 received) internal view returns (bool) {
        return ((received >= expected) || (msg.sender == owner()));
    }

    function _setCodeSipDomain(uint256 code, string memory newSipDomain) internal {
        _pool[code].sipDomain = newSipDomain;
        _pool[code].hasSipDomain = true;
    }

    function _clearCodeSipDomain(uint256 code) internal {
        delete _pool[code].sipDomain;
        _pool[code].hasSipDomain = false;
    }

    function _setCodeRouter(uint256 code, Router memory newRouter) internal {
        _pool[code].router = newRouter;
        _pool[code].hasRouter = true;
    }

    function _clearCodeRouter(uint256 code) internal {
        delete _pool[code].router;
        _pool[code].hasRouter = false;
    }

    function _baseURI() internal view override returns (string memory) {
        return baseUri;
    }



    // ----- SMART CONTRACT MANAGEMENT ---------------------------------------------------------------------------------

    function withdraw() external onlyOwner {
        address payable payableOwner = payable(owner());
        payableOwner.transfer(address(this).balance);
    }

    function setMintPrice(uint256 newMintPrice) external onlyOwner {
        mintPrice = newMintPrice;
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

    function setHoldingDuration(uint256 newHoldingDuration) external onlyOwner {
        holdingDuration = newHoldingDuration;
    }

    function setTtl(uint256 newTtl) external onlyOwner {
        ttl = newTtl;
    }

    function setDefaultSipDomain(string memory newDefaultSipDomain) external onlyOwner {
        defaultSipDomain = newDefaultSipDomain;
    }

    function setBaseUri(string memory newBaseUri) external onlyOwner {
        baseUri = newBaseUri;
    }

    function setCodeBlockedStatus(uint256 code, bool newBlockedStatus) external onlyOwner {
        require(_isValidCode(code), "Invalid code!");
        _pool[code].isBlocked = newBlockedStatus;
    }

    function setCodeSubscriptionEndTime(uint256 code, uint256 newSubscriptionEndTime) external onlyOwner {
        require(_isValidCode(code), "Invalid code!");
        _pool[code].subscriptionEndTime = newSubscriptionEndTime;
    }



    // ----- CODE MANAGEMENT -------------------------------------------------------------------------------------------

    function mint(uint256 code) external payable {
        require(_isValidCode(code), "Invalid code!");
        require(isAvailableForMint(code), "Not available for minting!");
        require(_checkPayment(mintPrice, msg.value), "Insufficient funds!");

        if (_exists(code)) {
            _burn(code);
        }
        _safeMint(msg.sender, code);

        delete _pool[code];
        _pool[code].subscriptionEndTime = block.timestamp.add(subscriptionDuration);
    }

    function renewSubscription(uint256 code) external payable {
        require(_isValidCode(code), "Invalid code!");
        require(_isApprovedOrOwner(msg.sender, code) || ((msg.sender == owner()) && hasOwner(code)), "Insufficient rights!");
        require(_checkPayment(subscriptionPrice, msg.value), "Insufficient funds!");

        _pool[code].subscriptionEndTime = _pool[code].subscriptionEndTime.add(subscriptionDuration);
    }

    function transferOwnershipOfCode(uint256 code, address newOwner) external {
        require(_isValidCode(code), "Invalid code!");
        require(_isApprovedOrOwner(msg.sender, code) || ((msg.sender == owner()) && hasOwner(code)), "Insufficient rights!");

        _transfer(ownerOf(code), newOwner, code);
    }

    function renounceOwnershipOfCode(uint256 code) external {
        require(_isValidCode(code), "Invalid code!");
        require(_isApprovedOrOwner(msg.sender, code) || ((msg.sender == owner()) && hasOwner(code)), "Insufficient rights!");

        _burn(code);
        delete _pool[code];
    }

    function changeCodeMode(uint256 code) external payable {
        require(_isValidCode(code), "Invalid code!");
        require(_isApprovedOrOwner(msg.sender, code) || ((msg.sender == owner()) && hasOwner(code)), "Insufficient rights!");
        require(_checkPayment(modeChangePrice, msg.value), "Insufficient funds!");

        if (isNumberMode(code)) {
            _pool[code].mode = CodeMode.Pool;
            _clearCodeSipDomain(code);
        } else {
            _pool[code].mode = CodeMode.Number;
            _clearCodeRouter(code);
        }
    }

    function setCodeSipDomain(uint256 code, string memory newSipDomain) external {
        require(_isValidCode(code), "Invalid code!");
        require(_isApprovedOrOwner(msg.sender, code) || ((msg.sender == owner()) && hasOwner(code)), "Insufficient rights!");
        require(!isBlocked(code), "Code blocked!");
        require(isNumberMode(code), "Invalid code mode!");

        _setCodeSipDomain(code, newSipDomain);
    }

    function clearCodeSipDomain(uint256 code) external {
        require(_isValidCode(code), "Invalid code!");
        require(_isApprovedOrOwner(msg.sender, code) || ((msg.sender == owner()) && hasOwner(code)), "Insufficient rights!");
        require(!isBlocked(code), "Code blocked!");
        require(isNumberMode(code), "Invalid code mode!");

        _clearCodeSipDomain(code);
    }

    function setCodeRouter(uint256 code, uint256 newChainId, string memory newAddress, uint256 newPoolCodeLength) external {
        require(_isValidCode(code), "Invalid code!");
        require(_isApprovedOrOwner(msg.sender, code) || ((msg.sender == owner()) && hasOwner(code)), "Insufficient rights!");
        require(!isBlocked(code), "Code blocked!");
        require(isPoolMode(code), "Invalid code mode!");

        Router memory newRouter = Router(Strings.toString(newChainId), newAddress, Strings.toString(newPoolCodeLength));
        _setCodeRouter(code, newRouter);
    }

    function clearCodeRouter(uint256 code) external {
        require(_isValidCode(code), "Invalid code!");
        require(_isApprovedOrOwner(msg.sender, code) || ((msg.sender == owner()) && hasOwner(code)), "Insufficient rights!");
        require(!isBlocked(code), "Code blocked!");
        require(isPoolMode(code), "Invalid code mode!");

        _clearCodeRouter(code);
    }



    // ----- ROUTING ---------------------------------------------------------------------------------------------------

    function getNextNode(uint256 code) public view returns (string[5] memory) {
        if (!_isValidCode(code)) return ["400", "", "", "", Strings.toString(ttl)];
        if (isBlocked(code)) return ["400", "", "", "", Strings.toString(ttl)];
        if (!hasOwner(code)) return ["400", "", "", "", Strings.toString(ttl)];
        if (isHeld(code)) return ["400", "", "", "", Strings.toString(ttl)];

        if (isNumberMode(code)) {
            return [
                "200", // Response code
                "0", // Pool code length
                Strings.toHexString(_ownerOf(code)),
                (_pool[code].hasSipDomain ? _pool[code].sipDomain : defaultSipDomain),
                Strings.toString(ttl)
            ];
        } else {
            return [
                (_pool[code].hasRouter ? "200" : "400"), // Response code
                _pool[code].router.poolCodeLength,
                _pool[code].router.chainId,
                _pool[code].router.adr,
                Strings.toString(ttl)
            ];
        }
    }
}
