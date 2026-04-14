import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }))
vi.mock('https', () => ({ request: mockRequest }))

// Access the non-exported isNewer via checkForUpdate behaviour
// (We test isNewer indirectly through checkForUpdate tag_name comparisons.)
// For direct unit tests we re-export it via a dynamic import trick — but since
// isNewer is not exported, we test it only through checkForUpdate.

import { checkForUpdate } from '../updateService'

// ---- helpers ----------------------------------------------------------------

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

function setupHttpsResponse(statusCode: number, body: string) {
  const req = makeFakeReq()
  const resOn: OnFn = (event, handler) => {
    if (event === 'data') handler(body)
    if (event === 'end') handler()
  }
  const res = { statusCode, on: vi.fn(resOn) }

  mockRequest.mockImplementation((_opts: unknown, cb: (r: typeof res) => void) => {
    cb(res)
    return req
  })

  return { req, res }
}

function setupNetworkError() {
  const req = makeFakeReq()
  req.on.mockImplementation((event: string, handler: (e: Error) => void) => {
    if (event === 'error') handler(new Error('ECONNREFUSED'))
  })
  mockRequest.mockImplementation(() => req)
  return req
}

// ---- isNewer (tested via checkForUpdate) ------------------------------------

describe('isNewer (via checkForUpdate tag_name)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockRequest.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('major version bump → hasUpdate: true', async () => {
    setupHttpsResponse(200, JSON.stringify({ tag_name: 'v2.0.0', html_url: 'https://example.com' }))
    const result = await checkForUpdate('1.0.0')
    expect(result.hasUpdate).toBe(true)
    expect(result.latestVersion).toBe('2.0.0')
  })

  it('minor version bump → hasUpdate: true', async () => {
    setupHttpsResponse(200, JSON.stringify({ tag_name: 'v1.2.0', html_url: 'https://example.com' }))
    const result = await checkForUpdate('1.1.0')
    expect(result.hasUpdate).toBe(true)
  })

  it('patch version bump → hasUpdate: true', async () => {
    setupHttpsResponse(200, JSON.stringify({ tag_name: 'v1.1.1', html_url: 'https://example.com' }))
    const result = await checkForUpdate('1.1.0')
    expect(result.hasUpdate).toBe(true)
  })

  it('equal version → hasUpdate: false', async () => {
    setupHttpsResponse(200, JSON.stringify({ tag_name: 'v1.1.0', html_url: 'https://example.com' }))
    const result = await checkForUpdate('1.1.0')
    expect(result.hasUpdate).toBe(false)
  })

  it('older version → hasUpdate: false', async () => {
    setupHttpsResponse(200, JSON.stringify({ tag_name: 'v1.0.0', html_url: 'https://example.com' }))
    const result = await checkForUpdate('1.1.0')
    expect(result.hasUpdate).toBe(false)
  })

  it('v prefix in both sides → hasUpdate: true', async () => {
    setupHttpsResponse(200, JSON.stringify({ tag_name: 'v1.2.0', html_url: 'https://example.com' }))
    const result = await checkForUpdate('v1.1.0')
    expect(result.hasUpdate).toBe(true)
  })

  it('v prefix only on currentVersion side → hasUpdate: true when latest is newer', async () => {
    setupHttpsResponse(200, JSON.stringify({ tag_name: '2.0.0', html_url: 'https://example.com' }))
    const result = await checkForUpdate('v1.0.0')
    expect(result.hasUpdate).toBe(true)
  })

  it('v prefix only on tag_name side → hasUpdate: true', async () => {
    setupHttpsResponse(200, JSON.stringify({ tag_name: 'v2.0.0', html_url: 'https://example.com' }))
    const result = await checkForUpdate('1.0.0')
    expect(result.hasUpdate).toBe(true)
    // latestVersion strips v prefix
    expect(result.latestVersion).toBe('2.0.0')
  })
})

// ---- checkForUpdate ---------------------------------------------------------

describe('checkForUpdate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockRequest.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('200 with newer tag_name → hasUpdate: true and latestVersion set', async () => {
    setupHttpsResponse(200, JSON.stringify({ tag_name: 'v4.0.0', html_url: 'https://example.com/release' }))
    const result = await checkForUpdate('3.0.0')
    expect(result.hasUpdate).toBe(true)
    expect(result.latestVersion).toBe('4.0.0')
    expect(result.releaseUrl).toBe('https://github.com/edilsonvilarinho/claude-usage-monitor/releases')
  })

  it('200 with equal tag_name → hasUpdate: false', async () => {
    setupHttpsResponse(200, JSON.stringify({ tag_name: 'v3.0.0', html_url: 'https://example.com' }))
    const result = await checkForUpdate('3.0.0')
    expect(result.hasUpdate).toBe(false)
  })

  it('200 with older tag_name → hasUpdate: false', async () => {
    setupHttpsResponse(200, JSON.stringify({ tag_name: 'v2.0.0', html_url: 'https://example.com' }))
    const result = await checkForUpdate('3.0.0')
    expect(result.hasUpdate).toBe(false)
  })

  it('404 response → hasUpdate: false', async () => {
    setupHttpsResponse(404, 'Not Found')
    const result = await checkForUpdate('3.0.0')
    expect(result.hasUpdate).toBe(false)
    expect(result.latestVersion).toBe('')
  })

  it('network error → hasUpdate: false', async () => {
    setupNetworkError()
    const result = await checkForUpdate('3.0.0')
    expect(result.hasUpdate).toBe(false)
    expect(result.latestVersion).toBe('')
  })

  it('invalid JSON body → hasUpdate: false', async () => {
    setupHttpsResponse(200, 'not-json{{{{')
    const result = await checkForUpdate('3.0.0')
    expect(result.hasUpdate).toBe(false)
    expect(result.latestVersion).toBe('')
  })

  it('timeout → hasUpdate: false', async () => {
    // Set up a request that never responds (no data/end events)
    const req = makeFakeReq()
    mockRequest.mockImplementation((_opts: unknown, _cb: unknown) => req)

    const promise = checkForUpdate('3.0.0')
    // Advance past the 10 second timeout
    await vi.advanceTimersByTimeAsync(10001)

    const result = await promise
    expect(result.hasUpdate).toBe(false)
    expect(result.latestVersion).toBe('')
  })

  it('response with missing tag_name → hasUpdate: false', async () => {
    setupHttpsResponse(200, JSON.stringify({ html_url: 'https://example.com' }))
    const result = await checkForUpdate('3.0.0')
    expect(result.hasUpdate).toBe(false)
  })
})
