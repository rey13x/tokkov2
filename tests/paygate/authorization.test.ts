import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockFirestore } from './utils.mock'

let mockDb = createMockFirestore()
let currentSession: any = null
vi.mock('../../src/server/firebase-admin', () => ({ getFirebaseFirestore: () => mockDb }))
vi.mock('../../src/server/auth', () => ({ getServerAuthSession: () => currentSession }))

describe('Authorization and User Isolation', () => {
  beforeEach(() => {
    mockDb = createMockFirestore()
    currentSession = null
    vi.resetModules()
  })

  it('unauthenticated requests are rejected', async () => {
    currentSession = null
    const mod = await import('../../src/server/paygate/test-mode')
    await expect(mod.createTestTransaction({ req: new Request('http://localhost', { method: 'POST', body: JSON.stringify({ amount: 1000, customer: 'A' }) }) })).rejects.toMatchObject({ status: 401 })
  })

  it('client-supplied userId is ignored', async () => {
    currentSession = { user: { id: 'userA' } }
    const mod = await import('../../src/server/paygate/test-mode')
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ amount: 1000, customer: 'A', userId: 'userB' }) })
    const doc = await mod.createTestTransaction({ req })
    expect(doc.userId).toBe('userA')
  })

  it('user isolation prevents access/revoke by others', async () => {
    currentSession = { user: { id: 'userA' } }
    const mod = await import('../../src/server/paygate/test-mode')
    const txn = await mod.createTestTransaction({ req: new Request('http://localhost', { method: 'POST', body: JSON.stringify({ amount: 1000, customer: 'A' }) }) })
    // attempt to revoke as userB
    const key = await mod.createTestApiKey({ req: new Request('http://localhost', { method: 'POST', body: JSON.stringify({ name: 'k' }) }) })
    currentSession = { user: { id: 'userB' } }
    const mod2 = await import('../../src/server/paygate/test-mode')
    await expect(mod2.revokeTestApiKey({ params: { keyId: key.id } })).rejects.toMatchObject({ status: 403 })
  })
})
