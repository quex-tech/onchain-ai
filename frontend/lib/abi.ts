export const chatOracleAbi = [
  {
    type: "function",
    name: "sendMessage",
    inputs: [{ name: "prompt", type: "string" }],
    outputs: [{ name: "messageId", type: "uint256" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "getConversation",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "prompt", type: "string" },
          { name: "response", type: "string" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getMessageCount",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getUserSubscription",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "MessageSent",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "messageId", type: "uint256", indexed: true },
      { name: "prompt", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ResponseReceived",
    inputs: [
      { name: "messageId", type: "uint256", indexed: true },
      { name: "response", type: "string", indexed: false },
    ],
  },
] as const;
