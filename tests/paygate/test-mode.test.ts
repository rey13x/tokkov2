import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import path from 'path'
import { createMockFirestore } from './utils.mock'

let mockDb: ReturnType<typeof createMockFirestore> | null = null
let currentSession: any = null

// top-level mocks so vitest can hoist them
vi.mock('../../src/server/firebase-admin', () => ({ getFirebaseFirestore: () => mockDb }))
vi.mock('../../src/server/auth', () => ({ getServerAuthSession: () => currentSession }))

describe('Test Mode Service - createTestTransaction/Deposit/Withdrawal', () => {
  beforeEach(() => {
    mockDb = createMockFirestore()
    vi.resetModules()
    currentSession = { user: { id: 'userA' } }
  })

  afterEach(() => {
    vi.restoreAllMocks()
    mockDb = null
    currentSession = null
  })

  it('createTestTransaction - valid input succeeds', async () => {
    const mod = await import('../../src/server/paygate/test-mode')
    const doc = await mod.createTestTransaction({ req: new Request('http://localhost', { method: 'POST', body: JSON.stringify({ amount: 50000, customer: 'Test Customer', description: 'Test Payment' }) }) })
    expect(doc).toHaveProperty('id')
    expect(doc.environment).toBe('test')
    expect(doc.isTest).toBe(true)
    expect(doc.userId).toBe('userA')
  })

  it('createTestTransaction - invalid amounts rejected', async () => {
    const mod = await import('../../src/server/paygate/test-mode')
    const makeReq = (body: any) => new Request('http://localhost', { method: 'POST', body: JSON.stringify(body) })
    await expect(mod.createTestTransaction({ req: makeReq({ amount: 0, customer: 'A' }) })).rejects.toMatchObject({ status: 400 })
    await expect(mod.createTestTransaction({ req: makeReq({ amount: -100, customer: 'A' }) })).rejects.toMatchObject({ status: 400 })
    await expect(mod.createTestTransaction({ req: makeReq({ amount: 100.5, customer: 'A' }) })).rejects.toMatchObject({ status: 400 })
    await expect(mod.createTestTransaction({ req: makeReq({ amount: 1e9, customer: 'A' }) })).rejects.toMatchObject({ status: 400 })
    await expect(mod.createTestTransaction({ req: makeReq({ amount: 1000, customer: '' }) })).rejects.toMatchObject({ status: 400 })
  })

  it('createTestDeposit - validation and environment', async () => {
    const mod = await import('../../src/server/paygate/test-mode')
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ amount: 100000 }) })
    const doc = await mod.createTestDeposit({ req })
    expect(doc.environment).toBe('test')
    expect(doc.isTest).toBe(true)
    await expect(mod.createTestDeposit({ req: new Request('http://localhost', { method: 'POST', body: JSON.stringify({ amount: 0 }) }) })).rejects.toMatchObject({ status: 400 })
  })

  it('createTestWithdrawal - validation and fields required', async () => {
    const mod = await import('../../src/server/paygate/test-mode')
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ amount: 50000, bank: 'Demo Bank', accountNumber: '000000', accountName: 'Test' }) })
    const doc = await mod.createTestWithdrawal({ req })
    expect(doc.environment).toBe('test')
    expect(doc.isTest).toBe(true)
    await expect(mod.createTestWithdrawal({ req: new Request('http://localhost', { method: 'POST', body: JSON.stringify({ amount: 0, bank: 'B', accountNumber: '1', accountName: 'A' }) }) })).rejects.toMatchObject({ status: 400 })
    await expect(mod.createTestWithdrawal({ req: new Request('http://localhost', { method: 'POST', body: JSON.stringify({ amount: 1000 }) }) })).rejects.toMatchObject({ status: 400 })
  })
})
