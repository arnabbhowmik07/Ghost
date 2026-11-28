import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertTransactionSucceeded } from "../src/confirm.js";

describe("assertTransactionSucceeded", () => {
  it("accepts a confirmed transaction with no error", () => {
    assert.doesNotThrow(() =>
      assertTransactionSucceeded("sig", { value: { err: null } }),
    );
  });

  it("throws when the transaction failed on-chain", () => {
    assert.throws(
      () =>
        assertTransactionSucceeded("sig", {
          value: { err: { InstructionError: [0, { Custom: 1 }] } },
        }),
      /failed on-chain/,
    );
  });

  it("includes a string error detail", () => {
    assert.throws(
      () =>
        assertTransactionSucceeded("sig", {
          value: { err: "AccountNotFound" },
        }),
      /AccountNotFound/,
    );
  });
});
