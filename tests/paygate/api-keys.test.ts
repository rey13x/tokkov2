import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockFirestore } from './utils.mock'

let mockDb = createMockFirestore()
let currentSession: any = null
vi.mock('../../src/server/firebase-admin', () => ({ getFirebaseFirestore: () => mockDb }))
vi.mock('../../src/server/auth', () => ({ getServerAuthSession: () => currentSession }))

describe('API Keys - creation and revoke', () => {
  beforeEach(() => {
    mockDb = createMockFirestore()
    currentSession = { user: { id: 'userA' } }
    vi.resetModules()
  })

  it('createTestApiKey returns secret once and stores hash only', async () => {
    const mod = await import('../../src/server/paygate/test-mode')
    const res = await mod.createTestApiKey({ req: new Request('http://localhost', { method: 'POST', body: JSON.stringify({ name: 'Local Dev' }) }) })
    expect(res).toHaveProperty('secret')
    expect(res).toHaveProperty('id')
    // check stored record
    const stored = mockDb.__db['apiKeys']
    expect(stored.size).toBeGreaterThan(0)
    const [id, record] = Array.from(stored.entries())[0]
    expect(id).toBe(res.id)
    expect(record).toHaveProperty('hash')
    expect(record).not.toHaveProperty('secret')
  })

  it('revokeTestApiKey - owner can revoke, other user cannot', async () => {
    const mod = await import('../../src/server/paygate/test-mode')
    const created = await mod.createTestApiKey({ req: new Request('http://localhost', { method: 'POST', body: JSON.stringify({ name: 'Key' }) }) })
    // revoke as owner
    const revoked = await mod.revokeTestApiKey({ params: { keyId: created.id } })
    expect(revoked.status).toBe('revoked')

    // try revoke as another user
    currentSession = { user: { id: 'userB' } }
    const mod2 = await import('../../src/server/paygate/test-mode')
    await expect(mod2.revokeTestApiKey({ params: { keyId: created.id } })).rejects.toMatchObject({ status: 403 })
  })
})
