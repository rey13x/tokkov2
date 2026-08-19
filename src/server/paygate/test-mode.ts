// Stub test-mode helpers for paygate

export async function createTestWithdrawal(userId: string, amount: number) {
  return { id: `test-withdrawal-${Date.now()}`, userId, amount, status: "skipped" };
}

export async function createTestTransaction(userId: string, amount: number) {
  return { id: `test-transaction-${Date.now()}`, userId, amount, status: "skipped" };
}

export async function createTestDeposit(userId: string, amount: number) {
  return { id: `test-deposit-${Date.now()}`, userId, amount, status: "skipped" };
}

export async function createTestApiKey(userId: string) {
  return { id: `test-apikey-${Date.now()}`, key: "", userId };
}

export async function revokeTestApiKey(userId: string, keyId: string) {
  return { success: true };
}
