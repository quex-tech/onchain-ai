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
    address public user = makeAddr("user");
    address public quexCore;
    address public oraclePool = makeAddr("oraclePool");
    address public tdAddress = makeAddr("tdAddress");
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

    function _buildBody(string memory prompt) internal pure returns (bytes memory) {
        return abi.encodePacked(
            '{"model":"gpt-4o","messages":[{"role":"user","content":"',
            prompt,
            '"}]}'
        );
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

    function test_setUp_canUpdateAddresses() public {
        oracle.setUp(oraclePool, tdAddress, encryptedApiKey);

        address newOraclePool = makeAddr("newOraclePool");
        oracle.setUp(newOraclePool, tdAddress, encryptedApiKey);

        assertEq(oracle.oraclePool(), newOraclePool);
    }

    // === sendMessage tests ===

    function test_sendMessage_requiresInitialized() public {
        vm.deal(user, 1 ether);
        vm.prank(user);
        vm.expectRevert("Not initialized");
        oracle.sendMessage{value: 0.1 ether}("Hello", _buildBody("Hello"));
    }

    function test_sendMessage_firstMessageRequiresDeposit() public {
        _initializeFlow();
        vm.prank(user);
        vm.expectRevert("First message requires deposit");
        oracle.sendMessage("Hello", _buildBody("Hello"));
    }

    function test_sendMessage_createsSubscriptionOnFirstMessage() public {
        _initializeFlow();
        vm.deal(user, 1 ether);
        vm.prank(user);
        oracle.sendMessage{value: 0.1 ether}("Hello", _buildBody("Hello"));

        assertTrue(oracle.getUserSubscription(user) != 0);
    }

    function test_sendMessage_storesMessage() public {
        _initializeFlow();
        vm.deal(user, 1 ether);
        vm.prank(user);
        uint256 messageId = oracle.sendMessage{value: 0.1 ether}("Hello, AI!", _buildBody("Hello, AI!"));

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
        oracle.sendMessage{value: 0.1 ether}("Hello, AI!", _buildBody("Hello, AI!"));
    }

    function test_sendMessage_subsequentMessagesNoDepositRequired() public {
        _initializeFlow();
        vm.deal(user, 1 ether);

        vm.prank(user);
        oracle.sendMessage{value: 0.1 ether}("First", _buildBody("First"));

        vm.prank(user);
        oracle.sendMessage("Second", _buildBody("Second")); // no value attached

        assertEq(oracle.getMessageCount(user), 2);
    }

    function test_sendMessage_usersHaveSeparateSubscriptions() public {
        _initializeFlow();
        address user2 = makeAddr("user2");
        vm.deal(user, 1 ether);
        vm.deal(user2, 1 ether);

        vm.prank(user);
        oracle.sendMessage{value: 0.1 ether}("User1 message", _buildBody("User1 message"));

        vm.prank(user2);
        oracle.sendMessage{value: 0.1 ether}("User2 message", _buildBody("User2 message"));

        assertEq(oracle.getMessageCount(user), 1);
        assertEq(oracle.getMessageCount(user2), 1);
    }

    // === processResponse tests ===

    function test_processResponse_onlyQuexCanCall() public {
        _initializeFlow();
        vm.deal(user, 1 ether);
        vm.prank(user);
        oracle.sendMessage{value: 0.1 ether}("Hello", _buildBody("Hello"));

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
        oracle.sendMessage{value: 0.1 ether}("Hello", _buildBody("Hello"));

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
        oracle.sendMessage{value: 0.1 ether}("Hello", _buildBody("Hello"));

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
        oracle.sendMessage{value: 0.1 ether}("Hello", _buildBody("Hello"));

        DataItem memory response = DataItem({
            timestamp: block.timestamp,
            error: 0,
            value: abi.encode("AI response")
        });

        vm.prank(quexCore);
        vm.expectRevert("Invalid ID type");
        oracle.processResponse(1, response, IdType.FlowId);
    }

    // === Fuzz tests ===

    function testFuzz_sendMessage_storesAnyPrompt(string calldata prompt) public {
        vm.assume(bytes(prompt).length > 0 && bytes(prompt).length < 1000);
        _initializeFlow();
        vm.deal(user, 1 ether);

        vm.prank(user);
        uint256 messageId = oracle.sendMessage{value: 0.1 ether}(prompt, _buildBody(prompt));

        ChatOracle.Message[] memory messages = oracle.getConversation(user);
        assertEq(messages[0].prompt, prompt);
        assertEq(messageId, 1);
    }

    function testFuzz_sendMessage_multipleUsers(address randomUser) public {
        vm.assume(randomUser != address(0) && randomUser != address(oracle));
        _initializeFlow();
        vm.deal(randomUser, 1 ether);

        vm.prank(randomUser);
        oracle.sendMessage{value: 0.1 ether}("Hello", _buildBody("Hello"));

        assertEq(oracle.getMessageCount(randomUser), 1);
        assertTrue(oracle.getUserSubscription(randomUser) != 0);
    }

    function testFuzz_sendMessage_variableDeposit(uint256 depositAmount) public {
        vm.assume(depositAmount > 0 && depositAmount < 100 ether);
        _initializeFlow();
        vm.deal(user, depositAmount);

        vm.prank(user);
        oracle.sendMessage{value: depositAmount}("Hello", _buildBody("Hello"));

        assertEq(oracle.getMessageCount(user), 1);
    }

    // === Dynamic flow tests ===

    function test_sendMessage_createsNewFlowPerMessage() public {
        _initializeFlow();
        vm.deal(user, 1 ether);

        // Each message should create its own flow
        vm.prank(user);
        uint256 messageId1 = oracle.sendMessage{value: 0.1 ether}("First prompt", _buildBody("First prompt"));

        vm.prank(user);
        uint256 messageId2 = oracle.sendMessage("Second prompt", _buildBody("Second prompt"));

        // Verify different flow IDs were created for each message
        uint256 flowId1 = oracle.getMessageFlowId(messageId1);
        uint256 flowId2 = oracle.getMessageFlowId(messageId2);

        assertTrue(flowId1 != flowId2, "Each message should have its own flow");
    }

    // === withdraw tests ===

    function test_withdraw_requiresSubscription() public {
        _initializeFlow();
        vm.prank(user);
        vm.expectRevert("No subscription");
        oracle.withdraw();
    }

    function test_withdraw_callsDepositManager() public {
        _initializeFlow();
        vm.deal(user, 1 ether);

        vm.prank(user);
        oracle.sendMessage{value: 0.1 ether}("Hello", _buildBody("Hello"));

        vm.mockCall(
            quexCore,
            abi.encodeWithSelector(IDepositManager.withdraw.selector),
            abi.encode()
        );

        vm.prank(user);
        oracle.withdraw();
    }

    function testFuzz_withdraw_anyUserWithSubscription(address randomUser) public {
        vm.assume(randomUser != address(0) && randomUser != address(oracle));
        _initializeFlow();
        vm.deal(randomUser, 1 ether);

        vm.prank(randomUser);
        oracle.sendMessage{value: 0.1 ether}("Hello", _buildBody("Hello"));

        vm.mockCall(
            quexCore,
            abi.encodeWithSelector(IDepositManager.withdraw.selector),
            abi.encode()
        );

        vm.prank(randomUser);
        oracle.withdraw();
    }

    // === getWithdrawableBalance tests ===

    function test_getWithdrawableBalance_zeroWithNoSubscription() public view {
        assertEq(oracle.getWithdrawableBalance(user), 0);
    }

    function test_getWithdrawableBalance_callsDepositManager() public {
        _initializeFlow();
        vm.deal(user, 1 ether);

        vm.prank(user);
        oracle.sendMessage{value: 0.1 ether}("Hello", _buildBody("Hello"));

        vm.mockCall(
            quexCore,
            abi.encodeWithSelector(IDepositManager.withdrawableBalance.selector),
            abi.encode(uint256(0.05 ether))
        );

        assertEq(oracle.getWithdrawableBalance(user), 0.05 ether);
    }

    function testFuzz_getWithdrawableBalance_anyAmount(uint256 balance) public {
        vm.assume(balance < 1000 ether);
        _initializeFlow();
        vm.deal(user, 1 ether);

        vm.prank(user);
        oracle.sendMessage{value: 0.1 ether}("Hello", _buildBody("Hello"));

        vm.mockCall(
            quexCore,
            abi.encodeWithSelector(IDepositManager.withdrawableBalance.selector),
            abi.encode(balance)
        );

        assertEq(oracle.getWithdrawableBalance(user), balance);
    }

    // === Edge case tests ===

    function test_sendMessage_emptyPromptStoresEmpty() public {
        _initializeFlow();
        vm.deal(user, 1 ether);

        vm.prank(user);
        oracle.sendMessage{value: 0.1 ether}("", _buildBody(""));

        ChatOracle.Message[] memory messages = oracle.getConversation(user);
        assertEq(messages[0].prompt, "");
    }

    function test_getConversation_emptyForNewUser() public view {
        ChatOracle.Message[] memory messages = oracle.getConversation(user);
        assertEq(messages.length, 0);
    }

    function test_getMessageCount_zeroForNewUser() public view {
        assertEq(oracle.getMessageCount(user), 0);
    }

    function test_getUserSubscription_zeroForNewUser() public view {
        assertEq(oracle.getUserSubscription(user), 0);
    }

    function test_getMessageFlowId_zeroForNonExistent() public view {
        assertEq(oracle.getMessageFlowId(999), 0);
    }

    // === Fuzz tests for message content ===

    function testFuzz_processResponse_storesAnyContent(string calldata content) public {
        vm.assume(bytes(content).length > 0 && bytes(content).length < 1000);
        _initializeFlow();
        vm.deal(user, 1 ether);

        vm.prank(user);
        oracle.sendMessage{value: 0.1 ether}("Hello", _buildBody("Hello"));

        DataItem memory response = DataItem({
            timestamp: block.timestamp,
            error: 0,
            value: abi.encode(content)
        });

        vm.prank(quexCore);
        oracle.processResponse(1, response, IdType.RequestId);

        ChatOracle.Message[] memory messages = oracle.getConversation(user);
        assertEq(messages[0].response, content);
    }

    // === Multiple message fuzz test ===

    function testFuzz_sendMessage_multipleMessagesSequence(uint8 messageCount) public {
        vm.assume(messageCount > 0 && messageCount <= 10);
        _initializeFlow();
        vm.deal(user, 10 ether);

        vm.prank(user);
        oracle.sendMessage{value: 0.1 ether}("First", _buildBody("First"));

        for (uint8 i = 1; i < messageCount; i++) {
            string memory prompt = string(abi.encodePacked("Message ", vm.toString(i)));
            vm.prank(user);
            oracle.sendMessage(prompt, _buildBody(prompt));
        }

        assertEq(oracle.getMessageCount(user), messageCount);
    }
}
