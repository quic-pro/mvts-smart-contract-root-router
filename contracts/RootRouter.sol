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

    enum CodeStatus {AvailableForMinting, Active, Held, Blocked}

    struct Router {
        uint256 chainId;
        uint256 poolCodeLength;
        string adr;
    }

    struct Code {
        bool isBlocked;
        bool isVerified;
        uint256 subscriptionEndTime;
        uint256 holdEndTime;
        CodeMode mode;
        string sipDomain; // Used if number mode
        Router router; // Used if pool mode
    }

    struct CodeData {
        CodeStatus status;
        bool isVerified;
        uint256 subscriptionEndTime;
        uint256 holdEndTime;
        CodeMode mode;
        string sipDomain; // Used if number mode
        Router router; // Used if pool mode
    }

    struct NodeData {
        uint256 responseCode;
        uint256 ttl;
        CodeMode mode;
        string sipUri;
        Router router;
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

    address public verificationOperator;



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
        return (_exists(code) && (block.timestamp < _pool[code].holdEndTime));
    }

    function getCodeData(uint256 code) public view returns (CodeData memory) {
        require(_isValidCode(code), "Invalid code!");

        if (hasOwner(code)) {
            return CodeData({
                status: getCodeStatus(code),
                isVerified: _pool[code].isVerified,
                subscriptionEndTime: _pool[code].subscriptionEndTime,
                holdEndTime: _pool[code].holdEndTime,
                mode: _pool[code].mode,
                sipDomain: (bytes(_pool[code].sipDomain).length == 0) ? defaultSipDomain : _pool[code].sipDomain,
                router: _pool[code].router
            });
        } else {
            return CodeData({
                status: getCodeStatus(code),
                isVerified: false,
                subscriptionEndTime: 0,
                holdEndTime: 0,
                mode: CodeMode.Number,
                sipDomain: "",
                router: Router({
                    chainId: 0,
                    poolCodeLength: 0,
                    adr: ""
                })
            });
        }
    }

    function isVerified(uint256 code) public view returns (bool) {
        require(_isValidCode(code), "Invalid code!");
        return _pool[code].isVerified;
    }

    function getCodeStatus(uint256 code) public view returns (CodeStatus) {
        if (_pool[code].isBlocked) {
            return CodeStatus.Blocked;
        }

        if (_exists(code) && (block.timestamp < _pool[code].subscriptionEndTime)) {
            return CodeStatus.Active;
        }

        if (_exists(code) && (block.timestamp < _pool[code].holdEndTime)) {
            return CodeStatus.Held;
        }

        return CodeStatus.AvailableForMinting;
    }

    function getCodeStatuses() public view returns (CodeStatus[POOL_SIZE] memory) {
        CodeStatus[POOL_SIZE] memory statuses;
        for (uint256 code; code < POOL_SIZE; code = code.add(1)) {
            statuses[code] = getCodeStatus(code);
        }
        return statuses;
    }

    function getPoolCodes() public view returns (bool[POOL_SIZE] memory) {
        bool[POOL_SIZE] memory poolCodes;
        for (uint256 code; code < POOL_SIZE; code = code.add(1)) {
            poolCodes[code] = ((getCodeStatus(code) == CodeStatus.Active) && (_pool[code].mode == CodeMode.Pool));
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

    function _baseURI() internal view override returns (string memory) {
        return baseUri;
    }

    function _isValidCode(uint256 code) internal pure returns (bool) {
        return (code < POOL_SIZE);
    }

    function _isApprovedOrOwner(address adr, uint256 code) internal view override returns (bool) {
        return (hasOwner(code) && ERC721._isApprovedOrOwner(adr, code));
    }

    function _checkPayment(uint256 expected, uint256 received) internal view returns (bool) {
        return ((received >= expected) || (_msgSender() == owner()));
    }

    function _createNodeDataWithResponseCode(uint256 responseCode) internal view returns (NodeData memory) {
        NodeData memory nodeData;
        nodeData.ttl = ttl;
        nodeData.responseCode = responseCode;

        return nodeData;
    }

    function _setCodeSubscription(uint256 code, uint256 newSubscriptionEndTime, uint256 newHoldEndTime) internal {
        require(_isValidCode(code), "Invalid code!");
        require(newHoldEndTime >= newSubscriptionEndTime, "Invalid newHoldEndTime!");

        _pool[code].subscriptionEndTime = newSubscriptionEndTime;
        _pool[code].holdEndTime = newHoldEndTime;
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

    function setVerificationOperator(address newVerificationOperator) external onlyOwner {
        verificationOperator = newVerificationOperator;
    }

    function setCodeBlockedStatus(uint256 code, bool newBlockedStatus) external onlyOwner {
        require(_isValidCode(code), "Invalid code!");
        _pool[code].isBlocked = newBlockedStatus;
    }

    function setCodeVerifiedStatus(uint256 code, bool newVerifiedStatus) external {
        require((_msgSender() == owner()) || (_msgSender() == verificationOperator), "Insufficient rights!");
        require(_isValidCode(code), "Invalid code!");
        _pool[code].isVerified = newVerifiedStatus;
    }

    function setCodeSubscription(uint256 code, uint256 newSubscriptionEndTime, uint256 newHoldEndTime) external onlyOwner {
        require(_isValidCode(code), "Invalid code!");
        _setCodeSubscription(code, newSubscriptionEndTime, newHoldEndTime);
    }

    function setCodeSubscriptionEndTime(uint256 code, uint256 newSubscriptionEndTime) external onlyOwner {
        require(_isValidCode(code), "Invalid code!");

        uint256 currentHoldDuration = _pool[code].holdEndTime.sub(_pool[code].subscriptionEndTime);
        uint256 newHoldEndTime = newSubscriptionEndTime.add(currentHoldDuration);

        _setCodeSubscription(code, newSubscriptionEndTime, newHoldEndTime);
    }

    function setCodeHoldEndTime(uint256 code, uint256 newHoldEndTime) external onlyOwner {
        require(_isValidCode(code), "Invalid code!");
        _setCodeSubscription(code, _pool[code].subscriptionEndTime, newHoldEndTime);
    }



    // ----- CODE MANAGEMENT -------------------------------------------------------------------------------------------

    function mint(uint256 code) external payable {
        require(_isValidCode(code), "Invalid code!");
        require(getCodeStatus(code) == CodeStatus.AvailableForMinting, "Not available for minting!");
        require(_checkPayment(mintPrice, msg.value), "Insufficient funds!");

        if (_exists(code)) {
            _burn(code);
        }
        _safeMint(_msgSender(), code);

        delete _pool[code];
        _pool[code].subscriptionEndTime = block.timestamp.add(subscriptionDuration);
        _pool[code].holdEndTime = _pool[code].subscriptionEndTime.add(holdingDuration);
    }

    function renewSubscription(uint256 code) external payable {
        require(_isValidCode(code), "Invalid code!");
        require(_isApprovedOrOwner(_msgSender(), code) || ((_msgSender() == owner()) && hasOwner(code)), "Insufficient rights!");
        require(_checkPayment(subscriptionPrice, msg.value), "Insufficient funds!");

        _pool[code].subscriptionEndTime = _pool[code].subscriptionEndTime.add(subscriptionDuration);
        _pool[code].holdEndTime = _pool[code].subscriptionEndTime.add(holdingDuration);
    }

    function transferFrom(address from, address to, uint256 tokenId) public virtual override {
        require(_isValidCode(tokenId), "Invalid code!");
        require(_isApprovedOrOwner(_msgSender(), tokenId) || ((_msgSender() == owner()) && hasOwner(tokenId)), "Insufficient rights!");

        _transfer(from, to, tokenId);
        _pool[tokenId].isVerified = false;
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public virtual override {
        require(_isValidCode(tokenId), "Invalid code!");
        require(_isApprovedOrOwner(_msgSender(), tokenId) || ((_msgSender() == owner()) && hasOwner(tokenId)), "Insufficient rights!");

        _safeTransfer(from, to, tokenId, data);
        _pool[tokenId].isVerified = false;
    }

    function renounceOwnershipOfCode(uint256 code) external {
        require(_isValidCode(code), "Invalid code!");
        require(_isApprovedOrOwner(_msgSender(), code) || ((_msgSender() == owner()) && hasOwner(code)), "Insufficient rights!");

        _burn(code);
        delete _pool[code];
    }

    function changeCodeMode(uint256 code) external payable {
        require(_isValidCode(code), "Invalid code!");
        require(_isApprovedOrOwner(_msgSender(), code) || ((_msgSender() == owner()) && hasOwner(code)), "Insufficient rights!");
        require(_checkPayment(modeChangePrice, msg.value), "Insufficient funds!");

        if (_pool[code].mode == CodeMode.Number) {
            _pool[code].mode = CodeMode.Pool;
            delete _pool[code].sipDomain;
        } else {
            _pool[code].mode = CodeMode.Number;
            delete _pool[code].router;
        }
    }

    function setCodeSipDomain(uint256 code, string memory newSipDomain) external {
        require(_isValidCode(code), "Invalid code!");
        require(_isApprovedOrOwner(_msgSender(), code) || ((_msgSender() == owner()) && hasOwner(code)), "Insufficient rights!");
        require(getCodeStatus(code) != CodeStatus.Blocked, "Code blocked!");
        require(_pool[code].mode == CodeMode.Number, "Invalid code mode!");

        _pool[code].sipDomain = newSipDomain;
    }

    function clearCodeSipDomain(uint256 code) external {
        require(_isValidCode(code), "Invalid code!");
        require(_isApprovedOrOwner(_msgSender(), code) || ((_msgSender() == owner()) && hasOwner(code)), "Insufficient rights!");
        require(getCodeStatus(code) != CodeStatus.Blocked, "Code blocked!");
        require(_pool[code].mode == CodeMode.Number, "Invalid code mode!");

        delete _pool[code].sipDomain;
    }

    function setCodeRouter(uint256 code, uint256 newChainId, string memory newAdr, uint256 newPoolCodeLength) external {
        require(_isValidCode(code), "Invalid code!");
        require(_isApprovedOrOwner(_msgSender(), code) || ((_msgSender() == owner()) && hasOwner(code)), "Insufficient rights!");
        require(getCodeStatus(code) != CodeStatus.Blocked, "Code blocked!");
        require(_pool[code].mode == CodeMode.Pool, "Invalid code mode!");

        _pool[code].router = Router({
            chainId: newChainId,
            poolCodeLength: newPoolCodeLength,
            adr: newAdr
        });
    }

    function clearCodeRouter(uint256 code) external {
        require(_isValidCode(code), "Invalid code!");
        require(_isApprovedOrOwner(_msgSender(), code) || ((_msgSender() == owner()) && hasOwner(code)), "Insufficient rights!");
        require(getCodeStatus(code) != CodeStatus.Blocked, "Code blocked!");
        require(_pool[code].mode == CodeMode.Pool, "Invalid code mode!");

        delete _pool[code].router;
    }



    // ----- ROUTING ---------------------------------------------------------------------------------------------------

    function getNodeData(uint256 code) public view returns (NodeData memory) {
        if (!_isValidCode(code)) return _createNodeDataWithResponseCode(400);
        if (getCodeStatus(code) == CodeStatus.Blocked) return _createNodeDataWithResponseCode(400);
        if (getCodeStatus(code) == CodeStatus.Held) return _createNodeDataWithResponseCode(400);
        if (getCodeStatus(code) != CodeStatus.Active) return _createNodeDataWithResponseCode(400);

        if (_pool[code].mode == CodeMode.Number) {
            string memory sipDomain = (bytes(_pool[code].sipDomain).length == 0) ? defaultSipDomain : _pool[code].sipDomain;
            string memory codeOwner = Strings.toHexString(_ownerOf(code));

            return NodeData(
                200, // Response code
                ttl,
                _pool[code].mode,
                string(abi.encodePacked(codeOwner, "@", sipDomain)), // sipUri
                _pool[code].router
            );
        } else {
            return NodeData(
                200, // Response code
                ttl,
                _pool[code].mode,
                "", // sipUri
                _pool[code].router
            );
        }
    }
}
