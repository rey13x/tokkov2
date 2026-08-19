// Stub read APIs for paygate - return safe default values

export async function getPayGateAccount(userId: string) {
  return null; // no account
}

export async function getPayGateWithdrawals(userId: string, opts?: { limit?: number; cursor?: string }) {
  return { items: [], nextCursor: null };
}

export async function getPayGateTransactions(userId: string, opts?: { limit?: number; cursor?: string }) {
  return { items: [], nextCursor: null };
}

export async function getPayGateDeposits(userId: string, opts?: { limit?: number; cursor?: string }) {
  return { items: [], nextCursor: null };
}

export async function getPayGateApiKeys(userId: string) {
  return [] as any[];
}
