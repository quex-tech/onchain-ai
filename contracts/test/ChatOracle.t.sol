// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Test.sol";
import "../src/ChatOracle.sol";

contract MockFlowRegistry {
    uint256 public flowCounter;

    function createFlow(Flow memory) external returns (uint256) {
        flowCounter++;
        return flowCounter;
    }
}

contract ChatOracleTest is Test {
    ChatOracle public oracle;
    MockFlowRegistry public mockRegistry;
    address public user = address(0x1);
    address public quexCore;
    address public oraclePool = address(0x3);
    address public tdAddress = address(0x4);
    bytes public encryptedApiKey = hex"1234567890abcdef";

    function setUp() public {
        mockRegistry = new MockFlowRegistry();
        quexCore = address(mockRegistry);
        oracle = new ChatOracle(quexCore);
    }

    function _mockQuexCalls() internal {
        vm.mockCall(oraclePool, abi.encodeWithSelector(IRequestOraclePool.addRequest.selector), abi.encode(bytes32(uint256(1))));
        vm.mockCall(oraclePool, abi.encodeWithSelector(IRequestOraclePool.addPrivatePatch.selector), abi.encode(bytes32(uint256(1))));
        vm.mockCall(oraclePool, abi.encodeWithSelector(IRequestOraclePool.addResponseSchema.selector), abi.encode(bytes32(uint256(1))));
        vm.mockCall(oraclePool, abi.encodeWithSelector(IRequestOraclePool.addJqFilter.selector), abi.encode(bytes32(uint256(1))));
        vm.mockCall(oraclePool, abi.encodeWithSelector(IRequestOraclePool.addActionByParts.selector), abi.encode(uint256(1)));
        vm.mockCall(quexCore, abi.encodeWithSelector(IDepositManager.createSubscription.selector), abi.encode(uint256(1)));
        vm.mockCall(quexCore, abi.encodeWithSelector(IDepositManager.addConsumer.selector), abi.encode());
        vm.mockCall(quexCore, abi.encodeWithSelector(IDepositManager.deposit.selector), abi.encode());
        vm.mockCall(quexCore, abi.encodeWithSelector(IQuexActionRegistry.createRequest.selector), abi.encode(uint256(1)));
    }

    function _initializeFlow() internal {
        oracle.setUp(oraclePool, tdAddress, encryptedApiKey);
        _mockQuexCalls();
    }

    // === setUp tests ===

    function test_setUp_setsInitialized() public {
        oracle.setUp(oraclePool, tdAddress, encryptedApiKey);
        assertTrue(oracle.initialized());
    }

    function test_setUp_requiresOwner() public {
        vm.prank(user);
        vm.expectRevert();
        oracle.setUp(oraclePool, tdAddress, encryptedApiKey);
    }

    function test_setUp_canOnlyBeCalledOnce() public {
        oracle.setUp(oraclePool, tdAddress, encryptedApiKey);
        vm.expectRevert("Already initialized");
        oracle.setUp(oraclePool, tdAddress, encryptedApiKey);
    }

    // === sendMessage tests ===

    function test_sendMessage_requiresInitialized() public {
        vm.deal(user, 1 ether);
        vm.prank(user);
        vm.expectRevert("Not initialized");
        oracle.sendMessage{value: 0.1 ether}("Hello");
    }

    function test_sendMessage_firstMessageRequiresDeposit() public {
        _initializeFlow();
        vm.prank(user);
        vm.expectRevert("First message requires deposit");
        oracle.sendMessage("Hello");
    }

    function test_sendMessage_createsSubscriptionOnFirstMessage() public {
        _initializeFlow();
        vm.deal(user, 1 ether);
        vm.prank(user);
        oracle.sendMessage{value: 0.1 ether}("Hello");

        assertTrue(oracle.getUserSubscription(user) != 0);
    }

    function test_sendMessage_storesMessage() public {
        _initializeFlow();
        vm.deal(user, 1 ether);
        vm.prank(user);
        uint256 messageId = oracle.sendMessage{value: 0.1 ether}("Hello, AI!");

        assertEq(messageId, 1);
        assertEq(oracle.getMessageCount(user), 1);

        ChatOracle.Message[] memory messages = oracle.getConversation(user);
        assertEq(messages[0].prompt, "Hello, AI!");
    }

    function test_sendMessage_emitsEvent() public {
        _initializeFlow();
        vm.deal(user, 1 ether);
        vm.prank(user);
        vm.expectEmit(true, true, false, true);
        emit ChatOracle.MessageSent(user, 1, "Hello, AI!");
        oracle.sendMessage{value: 0.1 ether}("Hello, AI!");
    }

    function test_sendMessage_subsequentMessagesNoDepositRequired() public {
        _initializeFlow();
        vm.deal(user, 1 ether);

        vm.prank(user);
        oracle.sendMessage{value: 0.1 ether}("First");

        vm.prank(user);
        oracle.sendMessage("Second"); // no value attached

        assertEq(oracle.getMessageCount(user), 2);
    }

    function test_sendMessage_usersHaveSeparateSubscriptions() public {
        _initializeFlow();
        address user2 = address(0x99);
        vm.deal(user, 1 ether);
        vm.deal(user2, 1 ether);

        vm.prank(user);
        oracle.sendMessage{value: 0.1 ether}("User1 message");

        vm.prank(user2);
        oracle.sendMessage{value: 0.1 ether}("User2 message");

        assertEq(oracle.getMessageCount(user), 1);
        assertEq(oracle.getMessageCount(user2), 1);
    }

    // === processResponse tests ===

    function test_processResponse_onlyQuexCanCall() public {
        _initializeFlow();
        vm.deal(user, 1 ether);
        vm.prank(user);
        oracle.sendMessage{value: 0.1 ether}("Hello");

        DataItem memory response = DataItem({
            timestamp: block.timestamp,
            error: 0,
            value: abi.encode("AI response")
        });

        vm.prank(user);
        vm.expectRevert("Only Quex can call");
        oracle.processResponse(1, response, IdType.RequestId);
    }

    function test_processResponse_storesResponse() public {
        _initializeFlow();
        vm.deal(user, 1 ether);
        vm.prank(user);
        oracle.sendMessage{value: 0.1 ether}("Hello");

        DataItem memory response = DataItem({
            timestamp: block.timestamp,
            error: 0,
            value: abi.encode("Hello human!")
        });

        vm.prank(quexCore);
        oracle.processResponse(1, response, IdType.RequestId);

        ChatOracle.Message[] memory messages = oracle.getConversation(user);
        assertEq(messages[0].response, "Hello human!");
    }

    function test_processResponse_emitsEvent() public {
        _initializeFlow();
        vm.deal(user, 1 ether);
        vm.prank(user);
        oracle.sendMessage{value: 0.1 ether}("Hello");

        DataItem memory response = DataItem({
            timestamp: block.timestamp,
            error: 0,
            value: abi.encode("Hello human!")
        });

        vm.prank(quexCore);
        vm.expectEmit(true, false, false, true);
        emit ChatOracle.ResponseReceived(1, "Hello human!");
        oracle.processResponse(1, response, IdType.RequestId);
    }

    function test_processResponse_requiresCorrectIdType() public {
        _initializeFlow();
        vm.deal(user, 1 ether);
        vm.prank(user);
        oracle.sendMessage{value: 0.1 ether}("Hello");

        DataItem memory response = DataItem({
            timestamp: block.timestamp,
            error: 0,
            value: abi.encode("AI response")
        });

        vm.prank(quexCore);
        vm.expectRevert("Invalid ID type");
        oracle.processResponse(1, response, IdType.FlowId);
    }

    // === Dynamic prompt tests ===

    function test_sendMessage_createsNewFlowPerMessage() public {
        _initializeFlow();
        vm.deal(user, 1 ether);

        // Each message should create its own flow with the user's prompt
        vm.prank(user);
        uint256 messageId1 = oracle.sendMessage{value: 0.1 ether}("First prompt");

        vm.prank(user);
        uint256 messageId2 = oracle.sendMessage("Second prompt");

        // Verify different flow IDs were created for each message
        uint256 flowId1 = oracle.getMessageFlowId(messageId1);
        uint256 flowId2 = oracle.getMessageFlowId(messageId2);

        assertTrue(flowId1 != flowId2, "Each message should have its own flow");
    }
}
