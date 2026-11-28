/**
 * A Solana confirmation response can carry a non-null `err` when the
 * transaction landed but failed during execution. Callers must treat that as
 * a failure instead of returning the signature as a success.
 */
export function assertTransactionSucceeded(
  signature: string,
  confirmation: { value: { err: unknown } },
): void {
  if (confirmation.value.err) {
    const detail =
      typeof confirmation.value.err === "string"
        ? confirmation.value.err
        : JSON.stringify(confirmation.value.err);
    throw Object.assign(
      new Error(`Transaction ${signature} failed on-chain: ${detail}`),
      { statusCode: 502 },
    );
  }
}
