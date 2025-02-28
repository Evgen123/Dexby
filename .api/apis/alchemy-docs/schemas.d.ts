declare const GetTransaction: {
    readonly body: {
        readonly type: "object";
        readonly properties: {
            readonly id: {
                readonly type: "integer";
                readonly default: 1;
            };
            readonly jsonrpc: {
                readonly type: "string";
                readonly default: "2.0";
            };
            readonly method: {
                readonly default: "getTransaction";
                readonly type: "string";
            };
            readonly params: {
                readonly type: "array";
                readonly minItems: 2;
                readonly maxItems: 2;
                readonly prefixItems: {
                    readonly oneOf: readonly [{
                        readonly type: "string";
                        readonly description: "Returns transaction details for a confirmed transaction.";
                    }, {
                        readonly type: "object";
                        readonly properties: {
                            readonly encoding: {
                                readonly type: "string";
                                readonly description: "Data encoding for each returned transaction.\nAccepts one of the following strings:\n[\"json\" (Default), \"jsonParsed\", \"base58\" (slow), \"base64\"]\n\"jsonParsed\" encoding attempts to use program-specific parsers to make the transaction.message.instructions list more human-readable; if a parser cannot be found, the instruction falls back to default JSON.\n";
                                readonly default: "json";
                                readonly enum: readonly ["json", "jsonParsed", "base58", "base64"];
                            };
                            readonly commitment: {
                                readonly type: "string";
                                readonly default: "processed";
                                readonly description: "Configures the commitment level of the blocks queried.\nAccepts one of the following strings: [\"finalized\", \"confirmed\", \"processed\"]\n";
                                readonly enum: readonly ["finalized", "confirmed", "processed"];
                            };
                            readonly maxSupportedTransactionVersion: {
                                readonly type: "number";
                                readonly description: "Set the max transaction version to return in responses. If the requested transaction is a higher version, an error will be returned.";
                            };
                        };
                    }];
                };
                readonly items: {
                    readonly oneOf: readonly [{
                        readonly type: "string";
                        readonly description: "Returns transaction details for a confirmed transaction.";
                    }, {
                        readonly type: "object";
                        readonly properties: {
                            readonly encoding: {
                                readonly type: "string";
                                readonly description: "Data encoding for each returned transaction.\nAccepts one of the following strings:\n[\"json\" (Default), \"jsonParsed\", \"base58\" (slow), \"base64\"]\n\"jsonParsed\" encoding attempts to use program-specific parsers to make the transaction.message.instructions list more human-readable; if a parser cannot be found, the instruction falls back to default JSON.\n";
                                readonly default: "json";
                                readonly enum: readonly ["json", "jsonParsed", "base58", "base64"];
                            };
                            readonly commitment: {
                                readonly type: "string";
                                readonly default: "processed";
                                readonly description: "Configures the commitment level of the blocks queried.\nAccepts one of the following strings: [\"finalized\", \"confirmed\", \"processed\"]\n";
                                readonly enum: readonly ["finalized", "confirmed", "processed"];
                            };
                            readonly maxSupportedTransactionVersion: {
                                readonly type: "number";
                                readonly description: "Set the max transaction version to return in responses. If the requested transaction is a higher version, an error will be returned.";
                            };
                        };
                    }];
                };
            };
        };
        readonly $schema: "https://json-schema.org/draft/2020-12/schema#";
    };
    readonly metadata: {
        readonly allOf: readonly [{
            readonly type: "object";
            readonly properties: {
                readonly apiKey: {
                    readonly type: "string";
                    readonly default: "docs-demo";
                    readonly description: "<style>\n  .custom-style {\n    color: #048FF4;\n  }\n</style>\nFor higher throughput, <span class=\"custom-style\"><a href=\"https://alchemy.com/?a=docs-demo\" target=\"_blank\">create your own API key</a></span>\n";
                    readonly $schema: "https://json-schema.org/draft/2020-12/schema#";
                };
            };
            readonly required: readonly ["apiKey"];
        }];
    };
    readonly response: {
        readonly "200": {
            readonly type: "object";
            readonly properties: {
                readonly id: {
                    readonly type: "integer";
                };
                readonly jsonrpc: {
                    readonly type: "string";
                };
                readonly result: {
                    readonly type: "object";
                    readonly properties: {
                        readonly slot: {
                            readonly type: "integer";
                            readonly format: "int64";
                            readonly description: "The slot this transaction was processed in.";
                            readonly minimum: -9223372036854776000;
                            readonly maximum: 9223372036854776000;
                        };
                        readonly transaction: {
                            readonly type: "object";
                            readonly description: "Tx object, either in JSON format or encoded binary data, depending on encoding parameter.";
                            readonly additionalProperties: true;
                        };
                        readonly blockTime: {
                            readonly type: "integer";
                            readonly format: "int64";
                            readonly description: "Estimated production time, as Unix timestamp (seconds since the Unix epoch) of when the transaction was processed.";
                            readonly minimum: -9223372036854776000;
                            readonly maximum: 9223372036854776000;
                        };
                        readonly meta: {
                            readonly type: "object";
                            readonly description: "Transaction status metadata object.";
                            readonly properties: {
                                readonly err: {
                                    readonly type: "string";
                                    readonly description: "If transaction failed, error messaage. If transaction succeeded null.";
                                };
                                readonly fee: {
                                    readonly type: "integer";
                                    readonly description: "u64 - Fee for this transaction.";
                                };
                                readonly preBalances: {
                                    readonly type: "array";
                                    readonly description: "Array of u64s - Account balances from before the transaction was processed.";
                                    readonly items: {
                                        readonly type: "integer";
                                    };
                                };
                                readonly postBalances: {
                                    readonly type: "array";
                                    readonly description: "Array of u64s - Account balances after the transaction was processed.";
                                    readonly items: {};
                                };
                                readonly innerInstructions: {
                                    readonly type: "array";
                                    readonly description: "List of inner instructions. null if not enabled during this transaction";
                                    readonly items: {
                                        readonly type: "string";
                                    };
                                };
                                readonly preTokenBalances: {
                                    readonly type: "array";
                                    readonly description: "List of token balances from before the transaction was processed or Undefined if token balance recording was not yet enabled during this transaction.";
                                    readonly items: {
                                        readonly type: "integer";
                                    };
                                };
                                readonly postTokenBalances: {
                                    readonly type: "array";
                                    readonly description: "List of token balances from after the transaction was processed. Undefined if token balance recording was not yet enabled during this transaction";
                                    readonly items: {
                                        readonly type: "integer";
                                    };
                                };
                                readonly logMessages: {
                                    readonly type: "array";
                                    readonly description: "Array of string log messages. null if log message recording was not enabled during this transaction.";
                                    readonly items: {
                                        readonly type: "string";
                                    };
                                };
                                readonly loadedAddresses: {
                                    readonly type: "array";
                                    readonly description: "Transaction addresses loaded from address lookup tables. Undefined if maxSupportedTransactionVersion was not set in request params.";
                                    readonly items: {
                                        readonly type: "object";
                                        readonly properties: {
                                            readonly writable: {
                                                readonly type: "array";
                                                readonly description: "Array[String Base-58 Encoded Addresses] - Ordered list addresses for writable loaded accounts.";
                                                readonly items: {
                                                    readonly type: "object";
                                                    readonly additionalProperties: true;
                                                };
                                            };
                                            readonly readonly: {
                                                readonly type: "array";
                                                readonly description: "Array[String Base-58 Encoded Addresses] - Ordered list addresses for read only loaded accounts.";
                                                readonly items: {
                                                    readonly type: "object";
                                                    readonly additionalProperties: true;
                                                };
                                            };
                                        };
                                    };
                                };
                                readonly rewards: {
                                    readonly type: "array";
                                    readonly description: "Array of object - Object present if rewards are requested.";
                                    readonly items: {
                                        readonly type: "object";
                                        readonly properties: {
                                            readonly pubkey: {
                                                readonly type: "string";
                                                readonly description: "Base-58 Encoded String - The public key of the account that received the reward.";
                                            };
                                            readonly lamports: {
                                                readonly type: "integer";
                                                readonly description: "i64- Number of reward lamports credited or debited by the account, as a i64.";
                                            };
                                            readonly postBalance: {
                                                readonly type: "integer";
                                                readonly description: "u64 - Account balance in lamports after the reward was applied.";
                                            };
                                            readonly rewardType: {
                                                readonly type: "string";
                                                readonly description: "Type of reward - [\"fee\", \"rent\", \"voting\", \"staking\"].\n\n`fee` `rent` `voting` `staking`";
                                                readonly enum: readonly ["fee", "rent", "voting", "staking"];
                                            };
                                            readonly commission: {
                                                readonly type: "integer";
                                                readonly description: "Vote account commission when the reward was credited, only present for voting and staking rewards.";
                                            };
                                        };
                                    };
                                };
                            };
                        };
                        readonly version: {
                            readonly type: "number";
                            readonly description: "Transaction version. Undefined if maxSupportedTransactionVersion is not set in request params.";
                        };
                    };
                };
            };
            readonly $schema: "https://json-schema.org/draft/2020-12/schema#";
        };
    };
};
export { GetTransaction };
