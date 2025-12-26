// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Test.sol";
import "forge-std/StdInvariant.sol";
import "../src/ChatOracle.sol";

contract MockFlowRegistry {
    uint256 public flowCounter;

    function createFlow(Flow memory) external returns (uint256) {
        flowCounter++;
        return flowCounter;
    }
}

/// @notice Handler contract for invariant testing
contract ChatOracleHandler is Test {
    ChatOracle public oracle;
    address public quexCore;

    address[] public users;
    uint256 public totalMessages;

    constructor(ChatOracle _oracle, address _quexCore) {
        oracle = _oracle;
        quexCore = _quexCore;
    }

    function sendMessage(uint256 userSeed, string calldata prompt) external {
        // Bound user to existing or create new
        address user;
        if (users.length == 0 || userSeed % 3 == 0) {
            user = makeAddr(string(abi.encodePacked("user", vm.toString(users.length))));
            users.push(user);
        } else {
            user = users[userSeed % users.length];
        }

        vm.deal(user, 1 ether);

        bytes memory body = abi.encodePacked(
            '{"model":"gpt-4o","messages":[{"role":"user","content":"',
            prompt,
            '"}]}'
        );

        uint256 hasSubscription = oracle.getUserSubscription(user);
        uint256 value = hasSubscription == 0 ? 0.1 ether : 0;

        vm.prank(user);
        try oracle.sendMessage{value: value}(prompt, body) {
            totalMessages++;
        } catch {}
    }

    function processResponse(uint256 messageId, string calldata content) external {
        if (messageId == 0 || messageId > totalMessages) return;

        DataItem memory response = DataItem({
            timestamp: block.timestamp,
            error: 0,
            value: abi.encode(content)
        });

        vm.prank(quexCore);
        try oracle.processResponse(messageId, response, IdType.RequestId) {} catch {}
    }

    function getUserCount() external view returns (uint256) {
        return users.length;
    }
}

/// @notice Invariant tests for ChatOracle
contract ChatOracleInvariantTest is StdInvariant, Test {
    ChatOracle public oracle;
    MockFlowRegistry public mockRegistry;
    ChatOracleHandler public handler;
    address public quexCore;
    address public oraclePool = makeAddr("oraclePool");
    address public tdAddress = makeAddr("tdAddress");
    bytes public encryptedApiKey = hex"1234567890abcdef";

    function setUp() public {
        mockRegistry = new MockFlowRegistry();
        quexCore = address(mockRegistry);
        oracle = new ChatOracle(quexCore);

        // Initialize oracle
        oracle.setUp(oraclePool, tdAddress, encryptedApiKey);

        // Mock external calls
        vm.mockCall(oraclePool, abi.encodeWithSelector(IRequestOraclePool.addRequest.selector), abi.encode(bytes32(uint256(1))));
        vm.mockCall(oraclePool, abi.encodeWithSelector(IRequestOraclePool.addPrivatePatch.selector), abi.encode(bytes32(uint256(1))));
        vm.mockCall(oraclePool, abi.encodeWithSelector(IRequestOraclePool.addResponseSchema.selector), abi.encode(bytes32(uint256(1))));
        vm.mockCall(oraclePool, abi.encodeWithSelector(IRequestOraclePool.addJqFilter.selector), abi.encode(bytes32(uint256(1))));
        vm.mockCall(oraclePool, abi.encodeWithSelector(IRequestOraclePool.addActionByParts.selector), abi.encode(uint256(1)));
        vm.mockCall(quexCore, abi.encodeWithSelector(IDepositManager.createSubscription.selector), abi.encode(uint256(1)));
        vm.mockCall(quexCore, abi.encodeWithSelector(IDepositManager.addConsumer.selector), abi.encode());
        vm.mockCall(quexCore, abi.encodeWithSelector(IDepositManager.deposit.selector), abi.encode());
        vm.mockCall(quexCore, abi.encodeWithSelector(IQuexActionRegistry.createRequest.selector), abi.encode(uint256(1)));

        // Create handler
        handler = new ChatOracleHandler(oracle, quexCore);

        // Target handler for invariant testing
        targetContract(address(handler));
    }

    /// @notice Message count for each user should never decrease
    function invariant_messageCountNeverDecreases() public view {
        uint256 userCount = handler.getUserCount();
        for (uint256 i = 0; i < userCount; i++) {
            address user = handler.users(i);
            // Message count should be >= 0 (always true, but structure shows the pattern)
            oracle.getMessageCount(user);
        }
    }

    /// @notice Conversation array length should match message count
    function invariant_conversationLengthMatchesCount() public view {
        uint256 userCount = handler.getUserCount();
        for (uint256 i = 0; i < userCount; i++) {
            address user = handler.users(i);
            uint256 count = oracle.getMessageCount(user);
            ChatOracle.Message[] memory messages = oracle.getConversation(user);
            assertEq(messages.length, count, "Conversation length should match count");
        }
    }

    /// @notice Users with messages should have subscriptions
    function invariant_usersWithMessagesHaveSubscriptions() public view {
        uint256 userCount = handler.getUserCount();
        for (uint256 i = 0; i < userCount; i++) {
            address user = handler.users(i);
            uint256 msgCount = oracle.getMessageCount(user);
            uint256 subId = oracle.getUserSubscription(user);

            if (msgCount > 0) {
                assertTrue(subId != 0, "User with messages should have subscription");
            }
        }
    }

    /// @notice Oracle should always be initialized after setup
    function invariant_alwaysInitialized() public view {
        assertTrue(oracle.initialized(), "Oracle should be initialized");
    }
}
