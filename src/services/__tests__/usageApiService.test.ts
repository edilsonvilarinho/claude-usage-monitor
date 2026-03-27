import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('electron', () => ({}))

const mockExecSync = vi.fn()
vi.mock('child_process', () => ({ execSync: mockExecSync }))

const mockGetAccessToken = vi.fn()
vi.mock('../../services/credentialService', () => ({ getAccessToken: mockGetAccessToken }))

const mockRequest = vi.fn()
vi.mock('https', () => ({ request: mockRequest }))

function makeFakeReq() {
  return {
    on: vi.fn(),
    end: vi.fn(),
    setTimeout: vi.fn(),
    destroy: vi.fn(),
    write: vi.fn(),
  }
}

type OnFn = (event: string, handler: (...args: unknown[]) => void) => void

function setupHttpsResponse(
  statusCode: number,
  body: string,
  headers: Record<string, string> = {}
) {
  const req = makeFakeReq()
  const resOn: OnFn = (event, handler) => {
    if (event === 'data') handler(body)
    if (event === 'end') handler()
  }
  const res = { statusCode, headers, on: vi.fn(resOn) }

  mockRequest.mockImplementation((_opts: unknown, cb: (r: typeof res) => void) => {
    cb(res)
    return req
  })

  return { req, res }
}

const makeUsageData = () => ({
  five_hour: { utilization: 0.5, resets_at: '2026-03-26T12:00:00Z' },
  seven_day: { utilization: 0.3, resets_at: '2026-03-30T12:00:00Z' },
})

// MAX_RETRIES = 5; advance all backoff sleeps to exhaust retries
async function exhaustRetries() {
  for (let i = 0; i < 5; i++) {
    const backoff = Math.min(1000 * Math.pow(2, i), 16000)
    await vi.advanceTimersByTimeAsync(backoff + 100)
  }
}

describe('usageApiService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetModules()
    mockRequest.mockReset()
    mockExecSync.mockReset()
    mockGetAccessToken.mockReset()
    mockGetAccessToken.mockResolvedValue('test-token')
    mockExecSync.mockReturnValue('claude 2.1.0')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  async function importFetchUsageData() {
    const mod = await import('../../services/usageApiService')
    return mod.fetchUsageData
  }

  // 1. 200 with valid data → returns UsageData
  it('200 with valid data returns UsageData', async () => {
    const data = makeUsageData()
    setupHttpsResponse(200, JSON.stringify(data))

    const fetchUsageData = await importFetchUsageData()
    const result = await fetchUsageData()
    expect(result).toEqual(data)
  })

  // 2. 200 with missing five_hour → throws after all retries
  it('200 with missing five_hour throws shape error', async () => {
    const data = { seven_day: { utilization: 0.3, resets_at: '2026-03-30T12:00:00Z' } }
    setupHttpsResponse(200, JSON.stringify(data))

    const fetchUsageData = await importFetchUsageData()
    const promise = fetchUsageData()
    // Attach assertion before advancing timers so rejection is handled immediately
    const assertion = expect(promise).rejects.toThrow('Unexpected API response shape')
    await exhaustRetries()
    await assertion
  })

  // 3. 200 with missing seven_day → throws after all retries
  it('200 with missing seven_day throws shape error', async () => {
    const data = { five_hour: { utilization: 0.5, resets_at: '2026-03-26T12:00:00Z' } }
    setupHttpsResponse(200, JSON.stringify(data))

    const fetchUsageData = await importFetchUsageData()
    const promise = fetchUsageData()
    const assertion = expect(promise).rejects.toThrow('Unexpected API response shape')
    await exhaustRetries()
    await assertion
  })

  // 4. 429 no headers → throws with isRateLimit=true, no retryAfterMs, no resetAt
  it('429 no headers throws with isRateLimit=true', async () => {
    setupHttpsResponse(429, 'rate limited')

    const fetchUsageData = await importFetchUsageData()
    let thrown: unknown
    try {
      await fetchUsageData()
    } catch (e) {
      thrown = e
    }

    expect(thrown).toBeDefined()
    expect((thrown as { isRateLimit?: boolean }).isRateLimit).toBe(true)
    expect((thrown as { retryAfterMs?: number }).retryAfterMs).toBeUndefined()
    expect((thrown as { resetAt?: number }).resetAt).toBeUndefined()
  })

  // 5. 429 with retry-after header → retryAfterMs = retryAfter * 1000
  it('429 with retry-after header sets retryAfterMs', async () => {
    setupHttpsResponse(429, 'rate limited', { 'retry-after': '120' })

    const fetchUsageData = await importFetchUsageData()
    let thrown: unknown
    try {
      await fetchUsageData()
    } catch (e) {
      thrown = e
    }

    expect((thrown as { isRateLimit?: boolean }).isRateLimit).toBe(true)
    expect((thrown as { retryAfterMs?: number }).retryAfterMs).toBe(120 * 1000)
    expect((thrown as { resetAt?: number }).resetAt).toBeUndefined()
  })

  // 6. 429 with reset headers → resetAt = max of headers, retryAfterMs = resetAt - Date.now()
  it('429 with reset headers computes resetAt from max header', async () => {
    const now = Date.now()
    const resetTime1 = new Date(now + 5 * 60 * 1000).toISOString()
    const resetTime2 = new Date(now + 8 * 60 * 1000).toISOString()

    setupHttpsResponse(429, 'rate limited', {
      'anthropic-ratelimit-requests-reset': resetTime1,
      'anthropic-ratelimit-tokens-reset': resetTime2,
    })

    const fetchUsageData = await importFetchUsageData()
    let thrown: unknown
    try {
      await fetchUsageData()
    } catch (e) {
      thrown = e
    }

    expect((thrown as { isRateLimit?: boolean }).isRateLimit).toBe(true)
    const resetAt = (thrown as { resetAt?: number }).resetAt
    expect(resetAt).toBeDefined()
    expect(resetAt!).toBeGreaterThan(now + 7 * 60 * 1000)
    expect(resetAt!).toBeLessThanOrEqual(now + 8 * 60 * 1000 + 100)

    const retryAfterMs = (thrown as { retryAfterMs?: number }).retryAfterMs
    expect(retryAfterMs).toBeDefined()
    expect(retryAfterMs!).toBeGreaterThan(7 * 60 * 1000)
    expect(retryAfterMs!).toBeLessThanOrEqual(8 * 60 * 1000 + 100)
  })

  // 7. 401 first attempt → retries (second call succeeds)
  it('401 on first attempt retries and returns data on second', async () => {
    const data = makeUsageData()
    let callCount = 0

    mockRequest.mockImplementation((_opts: unknown, cb: (res: unknown) => void) => {
      callCount++
      const statusCode = callCount === 1 ? 401 : 200
      const body = callCount === 1 ? 'unauthorized' : JSON.stringify(data)
      const res = {
        statusCode,
        headers: {},
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          if (event === 'data') handler(body)
          if (event === 'end') handler()
        }),
      }
      cb(res)
      return makeFakeReq()
    })

    const fetchUsageData = await importFetchUsageData()
    const resultPromise = fetchUsageData()

    // flush the 500ms sleep after 401
    await vi.advanceTimersByTimeAsync(600)
    const result = await resultPromise

    expect(result).toEqual(data)
    expect(callCount).toBe(2)
  })

  // 8. 401 both attempts → throws Authentication failed
  it('401 on both attempts throws Authentication failed', async () => {
    let callCount = 0
    mockRequest.mockImplementation((_opts: unknown, cb: (res: unknown) => void) => {
      callCount++
      const res = {
        statusCode: 401,
        headers: {},
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          if (event === 'data') handler('unauthorized')
          if (event === 'end') handler()
        }),
      }
      cb(res)
      return makeFakeReq()
    })

    const fetchUsageData = await importFetchUsageData()
    const resultPromise = fetchUsageData()
    const assertion = expect(resultPromise).rejects.toThrow('Authentication failed')
    await vi.advanceTimersByTimeAsync(600)

    await assertion
    expect(callCount).toBe(2)
  })

  // 9. 500 → retries with exponential backoff, eventually throws
  it('500 retries with exponential backoff then throws', async () => {
    let callCount = 0
    mockRequest.mockImplementation((_opts: unknown, cb: (res: unknown) => void) => {
      callCount++
      const res = {
        statusCode: 500,
        headers: {},
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          if (event === 'data') handler('server error')
          if (event === 'end') handler()
        }),
      }
      cb(res)
      return makeFakeReq()
    })

    const fetchUsageData = await importFetchUsageData()
    const resultPromise = fetchUsageData()
    const assertion = expect(resultPromise).rejects.toThrow('API returned 500')

    await exhaustRetries()

    await assertion
    expect(callCount).toBe(5)
  })

  // 10. Network error → retries, eventually throws
  it('network error retries then throws', async () => {
    let callCount = 0
    mockRequest.mockImplementation((_opts: unknown, _cb: unknown) => {
      callCount++
      const req = makeFakeReq()
      req.on.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
        if (event === 'error') {
          // Fire error synchronously to avoid timer complications
          handler(new Error('ECONNREFUSED'))
        }
      })
      return req
    })

    const fetchUsageData = await importFetchUsageData()
    const resultPromise = fetchUsageData()
    const assertion = expect(resultPromise).rejects.toThrow()

    await exhaustRetries()

    await assertion
    expect(callCount).toBe(5)
  })

  // 11. getClaudeVersion falls back to '2.0.0' when execSync throws
  it('getClaudeVersion falls back to 2.0.0 when execSync throws', async () => {
    mockExecSync.mockImplementation(() => { throw new Error('claude not found') })

    const data = makeUsageData()
    let capturedHeaders: Record<string, string> = {}

    mockRequest.mockImplementation((opts: { headers: Record<string, string> }, cb: (res: unknown) => void) => {
      capturedHeaders = opts.headers
      const res = {
        statusCode: 200,
        headers: {},
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          if (event === 'data') handler(JSON.stringify(data))
          if (event === 'end') handler()
        }),
      }
      cb(res)
      return makeFakeReq()
    })

    const fetchUsageData = await importFetchUsageData()
    await fetchUsageData()

    expect(capturedHeaders['User-Agent']).toBe('claude-code/2.0.0')
  })

  // 12. getClaudeVersion parses version string from execSync output
  it('getClaudeVersion parses version string from execSync', async () => {
    mockExecSync.mockReturnValue('claude/3.5.1 (build 42)')

    const data = makeUsageData()
    let capturedHeaders: Record<string, string> = {}

    mockRequest.mockImplementation((opts: { headers: Record<string, string> }, cb: (res: unknown) => void) => {
      capturedHeaders = opts.headers
      const res = {
        statusCode: 200,
        headers: {},
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          if (event === 'data') handler(JSON.stringify(data))
          if (event === 'end') handler()
        }),
      }
      cb(res)
      return makeFakeReq()
    })

    const fetchUsageData = await importFetchUsageData()
    await fetchUsageData()

    expect(capturedHeaders['User-Agent']).toBe('claude-code/3.5.1')
  })
})
