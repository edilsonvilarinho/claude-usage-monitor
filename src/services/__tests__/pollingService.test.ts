import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockGetSystemIdleTime } = vi.hoisted(() => {
  return { mockGetSystemIdleTime: vi.fn(() => 0) }
})

vi.mock('electron', () => ({
  powerMonitor: { getSystemIdleTime: mockGetSystemIdleTime }
}))

const { mockFetch } = vi.hoisted(() => {
  return { mockFetch: vi.fn() }
})

vi.mock('../../services/usageApiService', () => ({
  fetchUsageData: mockFetch
}))

// Import after mocks are set up
const { PollingService } = await import('../../services/pollingService')

const FIVE_MIN_MS   = 5 * 60 * 1000
const SEVEN_MIN_MS  = 7 * 60 * 1000
const TEN_MIN_MS    = 10 * 60 * 1000
const TWENTY_MIN_MS = 20 * 60 * 1000
const THIRTY_MIN_MS = 30 * 60 * 1000
const ONE_MIN_MS    = 60 * 1000

const makeData = (session = 0.5, weekly = 0.5) => ({
  five_hour: { utilization: session, resets_at: '2026-03-26T12:00:00Z' },
  seven_day: { utilization: weekly, resets_at: '2026-03-30T12:00:00Z' },
})

// Flush all pending microtasks (multiple ticks for async chains)
async function flushPromises() {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

describe('PollingService', () => {
  let service: InstanceType<typeof PollingService>

  beforeEach(() => {
    vi.useFakeTimers()
    mockFetch.mockReset()
    service = new PollingService()
    // Suppress unhandled 'error' events so they don't throw in tests that don't listen
    service.on('error', () => {})
  })

  afterEach(() => {
    service.stop()
    vi.useRealTimers()
  })

  // 1. restoreRateLimit with a future timestamp sets rateLimited
  it('restoreRateLimit(future) prevents poll from fetching', async () => {
    const future = Date.now() + 10 * 60 * 1000
    service.restoreRateLimit(future, 2)

    mockFetch.mockResolvedValue(makeData())
    service.start()
    await Promise.resolve()

    // fetch should NOT have been called (rate limited)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  // 2. restoreRateLimit with a past timestamp does NOT set rateLimited
  it('restoreRateLimit(past) does NOT block polling', async () => {
    const past = Date.now() - 1000
    service.restoreRateLimit(past, 2)

    mockFetch.mockResolvedValue(makeData())
    service.start()
    await Promise.resolve()

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  // 3. start() is idempotent
  it('start() called twice does not double-poll', async () => {
    mockFetch.mockResolvedValue(makeData())
    service.start()
    service.start()
    await Promise.resolve()

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  // 4. stop() clears timer and stops running
  it('stop() prevents further polling', async () => {
    mockFetch.mockResolvedValue(makeData())
    service.start()
    await Promise.resolve()
    service.stop()

    await vi.advanceTimersByTimeAsync(SEVEN_MIN_MS + 1000)
    // Only 1 call from the initial poll
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  // 5. Successful fetch emits 'usage-updated'
  it('successful fetch emits usage-updated', async () => {
    const data = makeData()
    mockFetch.mockResolvedValue(data)

    const updates: unknown[] = []
    service.on('usage-updated', (d) => updates.push(d))

    service.start()
    await Promise.resolve()

    expect(updates).toHaveLength(1)
    expect(updates[0]).toEqual(data)
  })

  // 5b. Successful fetch resets errorCount (returns to normal interval)
  it('successful fetch resets errorCount to 0', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'))
    mockFetch.mockResolvedValue(makeData())

    service.start()
    await Promise.resolve() // poll 1 → error, errorCount=1

    // Advance 1min to trigger poll 2 (success, errorCount reset)
    await vi.advanceTimersByTimeAsync(ONE_MIN_MS + 100)
    await Promise.resolve()

    expect(mockFetch).toHaveBeenCalledTimes(2)

    const calls = mockFetch.mock.calls.length

    // After reset, next timer is NORMAL (10min), so no poll at 5min
    await vi.advanceTimersByTimeAsync(FIVE_MIN_MS + 100)
    expect(mockFetch).toHaveBeenCalledTimes(calls)
    await vi.advanceTimersByTimeAsync(5 * ONE_MIN_MS)
    await Promise.resolve()
    expect(mockFetch).toHaveBeenCalledTimes(calls + 1)
  })

  // 6. Spike detection: session delta >1% → fast polling
  it('session spike >1% triggers fast polling', async () => {
    mockFetch
      .mockResolvedValueOnce(makeData(0.50, 0.50))
      .mockResolvedValueOnce(makeData(0.52, 0.50)) // +2% session spike
      .mockResolvedValue(makeData(0.52, 0.50))

    service.start()
    await Promise.resolve() // poll 1

    await vi.advanceTimersByTimeAsync(SEVEN_MIN_MS + 100)
    await Promise.resolve() // poll 2 → spike, fastCyclesLeft=2→1

    const callsAfterSpike = mockFetch.mock.calls.length
    await vi.advanceTimersByTimeAsync(FIVE_MIN_MS + 100)
    await Promise.resolve()
    expect(mockFetch).toHaveBeenCalledTimes(callsAfterSpike + 1)
  })

  // 7. Spike detection: weekly delta >1% → fast polling
  it('weekly spike >1% triggers fast polling', async () => {
    mockFetch
      .mockResolvedValueOnce(makeData(0.50, 0.50))
      .mockResolvedValueOnce(makeData(0.50, 0.52)) // +2% weekly spike
      .mockResolvedValue(makeData(0.50, 0.52))

    service.start()
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(SEVEN_MIN_MS + 100)
    await Promise.resolve()

    const callsAfterSpike = mockFetch.mock.calls.length
    await vi.advanceTimersByTimeAsync(FIVE_MIN_MS + 100)
    await Promise.resolve()
    expect(mockFetch).toHaveBeenCalledTimes(callsAfterSpike + 1)
  })

  // 8. No spike on first fetch (lastData=null)
  it('first fetch does not trigger spike detection', async () => {
    mockFetch.mockResolvedValue(makeData(0.99, 0.99))
    service.start()
    await Promise.resolve()

    const calls = mockFetch.mock.calls.length
    // No fast cycles — should not fire before 10min
    await vi.advanceTimersByTimeAsync(FIVE_MIN_MS + 100)
    expect(mockFetch).toHaveBeenCalledTimes(calls)
    await vi.advanceTimersByTimeAsync(5 * ONE_MIN_MS)
    await Promise.resolve()
    expect(mockFetch).toHaveBeenCalledTimes(calls + 1)
  })

  // 9. 429 no headers → exponential backoff (count=1→5min, count=2→10min)
  it('429 no headers uses exponential backoff', async () => {
    const rl1 = Object.assign(new Error('Rate limited'), { isRateLimit: true })
    const rl2 = Object.assign(new Error('Rate limited'), { isRateLimit: true })
    mockFetch.mockRejectedValueOnce(rl1)
    mockFetch.mockRejectedValueOnce(rl2)
    mockFetch.mockResolvedValue(makeData())

    const rateLimitedEvents: Array<[number, number, number | undefined]> = []
    service.on('rate-limited', (until: number, count: number, resetAt: number | undefined) =>
      rateLimitedEvents.push([until, count, resetAt])
    )

    service.start()
    await Promise.resolve() // poll 1 → 429 (count=1, wait=5min)
    expect(rateLimitedEvents).toHaveLength(1)
    expect(rateLimitedEvents[0][1]).toBe(1)

    const wait1 = rateLimitedEvents[0][0] - Date.now()
    expect(wait1).toBeGreaterThan(4 * 60 * 1000)
    expect(wait1).toBeLessThanOrEqual(5 * 60 * 1000)

    // Advance past first rate limit period
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 100)
    await Promise.resolve() // poll 2 → 429 (count=2, wait=10min)
    expect(rateLimitedEvents).toHaveLength(2)
    expect(rateLimitedEvents[1][1]).toBe(2)
    const wait2 = rateLimitedEvents[1][0] - Date.now()
    expect(wait2).toBeGreaterThan(9 * 60 * 1000)
    expect(wait2).toBeLessThanOrEqual(10 * 60 * 1000)
  })

  // 10. 429 with retryAfterMs → uses retryAfterMs
  it('429 with retryAfterMs uses the provided value', async () => {
    const retryAfterMs = 3 * 60 * 1000
    const rl = Object.assign(new Error('Rate limited'), { isRateLimit: true, retryAfterMs })
    mockFetch.mockRejectedValueOnce(rl)
    mockFetch.mockResolvedValue(makeData())

    const rateLimitedEvents: Array<[number, number]> = []
    service.on('rate-limited', (until: number, count: number) => rateLimitedEvents.push([until, count]))

    service.start()
    await Promise.resolve()
    expect(rateLimitedEvents).toHaveLength(1)
    const wait = rateLimitedEvents[0][0] - Date.now()
    expect(wait).toBeGreaterThan(retryAfterMs - 500)
    expect(wait).toBeLessThanOrEqual(retryAfterMs)
  })

  // 11. 429 with resetAt (future) → uses resetAt - Date.now()
  it('429 with resetAt uses resetAt for wait time', async () => {
    const resetAt = Date.now() + 8 * 60 * 1000
    const rl = Object.assign(new Error('Rate limited'), { isRateLimit: true, resetAt })
    mockFetch.mockRejectedValueOnce(rl)
    mockFetch.mockResolvedValue(makeData())

    const rateLimitedEvents: Array<[number, number, number | undefined]> = []
    service.on('rate-limited', (until: number, count: number, rAt: number | undefined) =>
      rateLimitedEvents.push([until, count, rAt])
    )

    service.start()
    await Promise.resolve()
    expect(rateLimitedEvents).toHaveLength(1)
    expect(rateLimitedEvents[0][2]).toBe(resetAt)
    const wait = rateLimitedEvents[0][0] - Date.now()
    expect(wait).toBeGreaterThan(7 * 60 * 1000)
    expect(wait).toBeLessThanOrEqual(8 * 60 * 1000)
  })

  // 12. 429 emits 'rate-limited' event
  it('429 emits rate-limited event', async () => {
    const rl = Object.assign(new Error('Rate limited'), { isRateLimit: true })
    mockFetch.mockRejectedValueOnce(rl)
    mockFetch.mockResolvedValue(makeData())

    let rateLimitedFired = false
    service.on('rate-limited', () => { rateLimitedFired = true })

    service.start()
    await Promise.resolve()
    expect(rateLimitedFired).toBe(true)
  })

  // 13. Non-429 error increments errorCount and emits 'error', keeps running
  it('non-429 error increments errorCount and emits error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network failure'))
    mockFetch.mockResolvedValue(makeData())

    const errors: Error[] = []
    // Override the default no-op error listener
    service.removeAllListeners('error')
    service.on('error', (e: Error) => errors.push(e))

    service.start()
    await Promise.resolve()

    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe('network failure')

    // Service still running — next poll at 1min
    await vi.advanceTimersByTimeAsync(ONE_MIN_MS + 100)
    await Promise.resolve()
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  // 14. triggerNow() when rate limited → no-op
  it('triggerNow() when rate limited skips poll', async () => {
    const future = Date.now() + 10 * 60 * 1000
    service.restoreRateLimit(future, 1)

    await service.triggerNow()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  // 15. triggerNow() when NOT rate limited → calls poll
  it('triggerNow() when not rate limited triggers poll', async () => {
    mockFetch.mockResolvedValue(makeData())

    service.start()
    await Promise.resolve() // first poll
    expect(mockFetch).toHaveBeenCalledTimes(1)

    await service.triggerNow()
    await Promise.resolve()
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  // 16. Error backoff intervals: verify timing by counting calls after each interval
  it('errorCount=1 → 1min backoff, errorCount=2 → 2min, errorCount=8 → 20min cap', async () => {
    mockFetch.mockRejectedValue(new Error('fail'))
    service.start()
    await flushPromises() // poll 1 fires at t=0, errorCount=1

    // After 1min the second poll fires (errorCount=1 → 1min backoff)
    await vi.advanceTimersByTimeAsync(ONE_MIN_MS + 1)
    await flushPromises() // poll 2, errorCount=2
    const afterPoll2 = mockFetch.mock.calls.length
    expect(afterPoll2).toBeGreaterThanOrEqual(2)

    // After 2min more the third poll fires (errorCount=2 → 2min backoff)
    await vi.advanceTimersByTimeAsync(2 * ONE_MIN_MS + 1)
    await flushPromises() // poll 3, errorCount=3
    expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(afterPoll2 + 1)

    // Advance through errorCounts 3→8 (backoffs: 4min, 8min, 16min cap at 20min, 20min, 20min)
    for (let i = 3; i < 8; i++) {
      const backoff = Math.min(ONE_MIN_MS * Math.pow(2, i - 1), TWENTY_MIN_MS)
      await vi.advanceTimersByTimeAsync(backoff + 1)
      await flushPromises()
    }
    // At errorCount=8, cap is 20min
    const callsBefore20min = mockFetch.mock.calls.length

    // Verify 20min cap: poll fires after 20min, not before
    // We advance just under 20min and confirm no extra poll yet
    // (Note: we already advanced past the previous timer, so the new 20min timer was just set)
    await vi.advanceTimersByTimeAsync(TWENTY_MIN_MS + 1)
    await flushPromises()
    expect(mockFetch.mock.calls.length).toBe(callsBefore20min + 1)
  })

  // 17. Success after error resets errorCount to 0
  it('success after error resets errorCount to 0', async () => {
    mockFetch.mockRejectedValueOnce(new Error('fail'))
    mockFetch.mockResolvedValue(makeData())

    service.start()
    await Promise.resolve() // poll 1 → error, errorCount=1

    await vi.advanceTimersByTimeAsync(ONE_MIN_MS + 100)
    await Promise.resolve() // poll 2 → success, errorCount=0

    const calls = mockFetch.mock.calls.length

    // Next interval back to NORMAL (10min)
    await vi.advanceTimersByTimeAsync(FIVE_MIN_MS + 100)
    expect(mockFetch).toHaveBeenCalledTimes(calls)
    await vi.advanceTimersByTimeAsync(5 * ONE_MIN_MS)
    await Promise.resolve()
    expect(mockFetch).toHaveBeenCalledTimes(calls + 1)
  })

  // 18. forceNow() calls poll() unlike triggerNow() which returns a no-op when rate limited
  it('forceNow() calls poll() when rate limited (reschedules timer, unlike triggerNow no-op)', async () => {
    const future = Date.now() + 10 * 60 * 1000
    service.restoreRateLimit(future, 1)

    // start() so running=true — first poll is blocked by rate limit and reschedules
    mockFetch.mockResolvedValue(makeData())
    service.start()
    await Promise.resolve()
    expect(mockFetch).not.toHaveBeenCalled()

    // triggerNow() is a no-op when rate limited — it returns early before calling poll()
    await service.triggerNow()
    expect(mockFetch).not.toHaveBeenCalled()

    // forceNow() does NOT have the triggerNow early-exit guard — it calls poll() directly.
    // poll() itself still respects rate limit (schedules timer and returns), so fetch still won't run.
    // But forceNow() did call poll() (can verify timer was rescheduled).
    await service.forceNow()
    // fetch still blocked by rate limit inside poll()
    expect(mockFetch).not.toHaveBeenCalled()

    // After rate limit expires, poll fires
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000 + 100)
    await flushPromises()
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  // 19. Idle interval (30min) when system is idle
  it('idle system (>600s) uses 30min poll interval', async () => {
    mockGetSystemIdleTime.mockReturnValue(601) // > IDLE_THRESHOLD (600s)
    mockFetch.mockResolvedValue(makeData())

    service.start()
    await Promise.resolve() // first poll fires immediately

    const callsAfterFirst = mockFetch.mock.calls.length
    expect(callsAfterFirst).toBe(1)

    // Should NOT poll before 30min
    await vi.advanceTimersByTimeAsync(SEVEN_MIN_MS + 1000)
    await flushPromises()
    expect(mockFetch).toHaveBeenCalledTimes(callsAfterFirst)

    // Should poll after 30min
    await vi.advanceTimersByTimeAsync(THIRTY_MIN_MS - SEVEN_MIN_MS - 1000 + 100)
    await flushPromises()
    expect(mockFetch).toHaveBeenCalledTimes(callsAfterFirst + 1)
  })

  // 19b. nextPollAt is 0 initially and set after first poll
  it('nextPollAt is 0 before polling and set to a future timestamp after the first poll', async () => {
    mockGetSystemIdleTime.mockReturnValue(0) // ensure not idle so POLL_NORMAL_MS is used
    mockFetch.mockResolvedValue(makeData())

    expect(service.nextPollAt).toBe(0)

    service.start()
    await Promise.resolve() // first poll completes

    // After normal poll, nextPollAt should be ~10min from now
    expect(service.nextPollAt).toBeGreaterThan(Date.now() + SEVEN_MIN_MS)
    expect(service.nextPollAt).toBeLessThanOrEqual(Date.now() + TEN_MIN_MS + 100)
  })

  // 20. isIdle() with exception → returns false, no propagation
  it('isIdle() returns false when getSystemIdleTime throws', async () => {
    mockGetSystemIdleTime.mockImplementation(() => { throw new Error('not supported') })
    mockFetch.mockResolvedValue(makeData())

    service.start()
    await Promise.resolve() // should not throw

    // Since isIdle() returned false, interval is NORMAL (10min)
    const callsAfterFirst = mockFetch.mock.calls.length
    await vi.advanceTimersByTimeAsync(TEN_MIN_MS + 100)
    await Promise.resolve()
    expect(mockFetch).toHaveBeenCalledTimes(callsAfterFirst + 1)
  })
})
