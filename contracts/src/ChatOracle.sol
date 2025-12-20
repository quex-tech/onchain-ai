// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/Ownable.sol";
import "quex-v1-interfaces/src/interfaces/core/IQuexActionRegistry.sol";
import "quex-v1-interfaces/src/interfaces/core/IDepositManager.sol";
import "quex-v1-interfaces/src/libraries/FlowBuilder.sol";

using FlowBuilder for FlowBuilder.FlowConfig;

contract ChatOracle is Ownable {
    struct Message {
        string prompt;
        string response;
    }

    struct MessageLocation {
        address user;
        uint256 index;
    }

    address public quexCore;
    uint256 public flowId;

    uint256 private _messageCounter;
    mapping(address => Message[]) private _conversations;
    mapping(uint256 => MessageLocation) private _messageLocations;
    mapping(uint256 => uint256) private _requestToMessage;
    mapping(address => uint256) private _userSubscriptions;

    event MessageSent(address indexed user, uint256 indexed messageId, string prompt);
    event ResponseReceived(uint256 indexed messageId, string response);
    event SubscriptionCreated(address indexed user, uint256 subscriptionId);

    constructor(address _quexCore) Ownable(msg.sender) {
        quexCore = _quexCore;
    }

    function setUp(
        address oraclePool,
        address tdAddress,
        bytes calldata encryptedApiKey
    ) external onlyOwner {
        require(flowId == 0, "Already initialized");

        RequestHeader[] memory headers = new RequestHeader[](1);
        headers[0] = RequestHeader({key: "Content-Type", value: "application/json"});

        RequestHeaderPatch[] memory privateHeaders = new RequestHeaderPatch[](1);
        privateHeaders[0] = RequestHeaderPatch({key: "Authorization", ciphertext: encryptedApiKey});

        bytes memory body = bytes(
            '{"model":"gpt-4o-mini","messages":[{"role":"system","content":"You are a helpful assistant responding to blockchain users. Keep responses concise."},{"role":"user","content":"Hello, please provide a brief friendly response."}]}'
        );

        FlowBuilder.FlowConfig memory config = FlowBuilder.create(
            quexCore,
            oraclePool,
            "api.openai.com",
            "/v1/chat/completions"
        );
        config = config.withMethod(RequestMethod.Post);
        config = config.withHeaders(headers);
        config = config.withBody(body);
        config = config.withTdAddress(tdAddress);
        config = config.withPrivateHeaders(privateHeaders);
        config = config.withFilter(".choices[0].message.content");
        config = config.withSchema("string");
        config = config.withCallback(address(this), this.processResponse.selector);

        flowId = config.build();
    }

    function sendMessage(string calldata prompt) external payable returns (uint256 messageId) {
        require(flowId != 0, "Flow not initialized");

        // Create subscription for user if needed
        uint256 subscriptionId = _userSubscriptions[msg.sender];
        if (subscriptionId == 0) {
            require(msg.value > 0, "First message requires deposit");
            subscriptionId = _createSubscription(msg.sender, msg.value);
        } else if (msg.value > 0) {
            _topUpSubscription(subscriptionId, msg.value);
        }

        // Store message
        _messageCounter++;
        messageId = _messageCounter;
        uint256 index = _conversations[msg.sender].length;
        _conversations[msg.sender].push(Message({prompt: prompt, response: ""}));
        _messageLocations[messageId] = MessageLocation({user: msg.sender, index: index});

        // Create request
        uint256 requestId = IQuexActionRegistry(quexCore).createRequest(flowId, subscriptionId);
        _requestToMessage[requestId] = messageId;

        emit MessageSent(msg.sender, messageId, prompt);
    }

    function processResponse(
        uint256 requestId,
        DataItem memory response,
        IdType idType
    ) external {
        require(msg.sender == quexCore, "Only Quex can call");
        require(idType == IdType.RequestId, "Invalid ID type");

        string memory content = abi.decode(response.value, (string));
        uint256 messageId = _requestToMessage[requestId];
        MessageLocation storage loc = _messageLocations[messageId];
        _conversations[loc.user][loc.index].response = content;

        emit ResponseReceived(messageId, content);
    }

    function getMessageCount(address user) external view returns (uint256) {
        return _conversations[user].length;
    }

    function getConversation(address user) external view returns (Message[] memory) {
        return _conversations[user];
    }

    function getUserSubscription(address user) external view returns (uint256) {
        return _userSubscriptions[user];
    }

    function _createSubscription(address user, uint256 deposit) private returns (uint256 subscriptionId) {
        IDepositManager depositManager = IDepositManager(quexCore);
        subscriptionId = depositManager.createSubscription();
        depositManager.addConsumer(subscriptionId, address(this));
        depositManager.deposit{value: deposit}(subscriptionId);
        _userSubscriptions[user] = subscriptionId;
        emit SubscriptionCreated(user, subscriptionId);
    }

    function _topUpSubscription(uint256 subscriptionId, uint256 amount) private {
        IDepositManager(quexCore).deposit{value: amount}(subscriptionId);
    }
}
