import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getPayload } from 'payload'
import { authenticateVendorOrMember } from '../../src/utils/mediaLibrary'
import { refreshMemberMembershipPayment } from '../../src/services/MemberMembershipService'
import { GET } from '../../src/app/api/member-membership/route'

vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return { ...actual, getPayload: vi.fn() }
})
vi.mock('@payload-config', () => ({ default: Promise.resolve({}) }))
vi.mock('../../src/utils/mediaLibrary', () => ({ authenticateVendorOrMember: vi.fn() }))
vi.mock('../../src/services/MemberMembershipService', () => ({
  refreshMemberMembershipPayment: vi.fn(),
}))

describe('member membership status route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the configured fee when PayMongo status refresh fails', async () => {
    const payment = {
      id: 40,
      amount: 50,
      currency: 'PHP',
      status: 'pending',
      createdAt: '2026-10-14T00:00:00.000Z',
    }
    const payload = {
      findGlobal: vi.fn().mockResolvedValue({
        membership: { memberMembershipFeePhp: 50 },
      }),
      find: vi.fn().mockResolvedValue({ docs: [payment] }),
      findByID: vi.fn().mockResolvedValue({
        memberMembershipStatus: 'pending_payment',
        memberMembershipPaidAt: null,
      }),
    }
    vi.mocked(getPayload).mockResolvedValue(payload as never)
    vi.mocked(authenticateVendorOrMember).mockResolvedValue({
      id: 7,
      role: 'member',
    } as never)
    vi.mocked(refreshMemberMembershipPayment).mockRejectedValue(
      new Error('PAYMONGO_INTENT_STATUS_FAILED:404'),
    )
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await GET(new NextRequest('http://localhost/api/member-membership'))
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result).toMatchObject({
      membershipStatus: 'pending_payment',
      membershipFeeAmount: 50,
      payment: { amount: 50, currency: 'PHP', status: 'pending' },
    })
    expect(logError).toHaveBeenCalledWith(
      '[member-membership] PayMongo status refresh error:',
      expect.any(Error),
    )
    logError.mockRestore()
  })
})
