// Stub test-mode helpers for PayGate test routes.

export async function createTestWithdrawal(input: unknown, amount = 0) {
  const userId = typeof input === "string" ? input : "test-user";
  return { id: `test-withdrawal-${Date.now()}`, userId, amount, status: "skipped" };
}

export async function createTestTransaction(input: unknown, amount = 0) {
  const userId = typeof input === "string" ? input : "test-user";
  return { id: `test-transaction-${Date.now()}`, userId, amount, status: "skipped" };
}

export async function createTestDeposit(input: unknown, amount = 0) {
  const userId = typeof input === "string" ? input : "test-user";
  return { id: `test-deposit-${Date.now()}`, userId, amount, status: "skipped" };
}

export async function createTestApiKey(input: unknown) {
  const userId = typeof input === "string" ? input : "test-user";
  return { id: `test-apikey-${Date.now()}`, key: "", userId };
}

export async function revokeTestApiKey(input: unknown, keyId = "") {
  const userId = typeof input === "string" ? input : "test-user";
  return { success: true, userId, keyId };
}
