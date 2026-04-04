import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- mock electron and settingsService before any imports -------------------

const { mockNotificationShow, mockNotificationIsSupported, mockShellBeep, mockGetSettings, MockNotification } = vi.hoisted(() => {
  const mockNotificationShow = vi.fn()
  const MockNotification = vi.fn(function() { return { show: mockNotificationShow } })
  return {
    mockNotificationShow,
    mockNotificationIsSupported: vi.fn(() => true),
    mockShellBeep: vi.fn(),
    mockGetSettings: vi.fn(),
    MockNotification,
  }
})

vi.mock('electron', () => ({
  Notification: Object.assign(MockNotification, { isSupported: mockNotificationIsSupported }),
  shell: { beep: mockShellBeep },
}))

vi.mock('../settingsService', () => ({ getSettings: mockGetSettings }))

// ---- types ------------------------------------------------------------------

import type { UsageData } from '../../models/usageData'

// ---- lazy-imported module refs (reset per test via vi.resetModules) ----------

let checkAndNotify: (data: UsageData) => void
let syncWindowState: (data: UsageData) => void
let sendTestNotification: () => void

// ---- helpers ----------------------------------------------------------------

type NotificationSettings = {
  enabled: boolean
  sessionThreshold: number
  weeklyThreshold: number
  resetThreshold: number
  notifyOnReset: boolean
  notifyOnWindowReset: boolean
  soundEnabled: boolean
}

function defaultSettings(overrides: Partial<NotificationSettings> = {}): { notifications: NotificationSettings } {
  return {
    notifications: {
      enabled: true,
      sessionThreshold: 80,
      weeklyThreshold: 80,
      resetThreshold: 50,
      notifyOnReset: false,
      notifyOnWindowReset: true,
      soundEnabled: true,
      ...overrides,
    },
  }
}

function makeData(
  sessionPct: number,
  weeklyPct: number,
  sessionResetsAt = '2026-03-26T12:00:00Z',
  weeklyResetsAt = '2026-03-30T12:00:00Z'
): UsageData {
  return {
    five_hour: { utilization: sessionPct, resets_at: sessionResetsAt },
    seven_day: { utilization: weeklyPct, resets_at: weeklyResetsAt },
  }
}

// ---- setup ------------------------------------------------------------------

beforeEach(async () => {
  // Reset module registry so module-level state (state, prevSessionResetsAt, etc.)
  // starts fresh for every test.
  vi.resetModules()

  // Reset call history on the shared mock functions
  mockNotificationShow.mockReset()
  mockShellBeep.mockReset()
  mockGetSettings.mockReset()
  mockNotificationIsSupported.mockReset()
  mockNotificationIsSupported.mockReturnValue(true)
  MockNotification.mockClear()

  // Re-import notificationService so module-level state is initialised fresh
  const mod = await import('../notificationService')
  checkAndNotify = mod.checkAndNotify
  syncWindowState = mod.syncWindowState
  sendTestNotification = mod.sendTestNotification
})

// ---- tests ------------------------------------------------------------------

describe('checkAndNotify', () => {
  it('sends no notification when notifications are disabled', () => {
    mockGetSettings.mockReturnValue(defaultSettings({ enabled: false }))

    checkAndNotify(makeData(90, 90))

    expect(mockNotificationShow).not.toHaveBeenCalled()
  })

  it('sends no notification when usage is below threshold', () => {
    mockGetSettings.mockReturnValue(defaultSettings())

    checkAndNotify(makeData(50, 50))

    expect(mockNotificationShow).not.toHaveBeenCalled()
  })

  it('sends session limit warning when session crosses threshold', async () => {
    mockGetSettings.mockReturnValue(defaultSettings())

    checkAndNotify(makeData(82, 50))

    expect(mockNotificationShow).toHaveBeenCalledTimes(1)
    // The Notification constructor receives the options; inspect its call args
    const ctorCall = MockNotification.mock.calls[0][0] as { title: string }
    expect(ctorCall.title).toContain('Session Limit Warning')
  })

  it('does not send duplicate session notification on subsequent calls', async () => {
    mockGetSettings.mockReturnValue(defaultSettings())

    checkAndNotify(makeData(82, 50))
    checkAndNotify(makeData(82, 50))

    expect(mockNotificationShow).toHaveBeenCalledTimes(1)
  })

  it('sends weekly limit warning when weekly crosses threshold', async () => {
    mockGetSettings.mockReturnValue(defaultSettings())

    checkAndNotify(makeData(50, 82))

    expect(mockNotificationShow).toHaveBeenCalledTimes(1)
    const ctorCall = MockNotification.mock.calls[0][0] as { title: string }
    expect(ctorCall.title).toContain('Weekly Limit Warning')
  })

  it('sends both session and weekly notifications when both cross threshold', () => {
    mockGetSettings.mockReturnValue(defaultSettings())

    checkAndNotify(makeData(82, 82))

    expect(mockNotificationShow).toHaveBeenCalledTimes(2)
  })

  it('sends "Session Limit Freed" when usage drops below resetThreshold after being notified and notifyOnReset=true', async () => {
    mockGetSettings.mockReturnValue(defaultSettings({ notifyOnReset: true }))

    // First call: cross threshold (sessionNotified = true)
    checkAndNotify(makeData(82, 50))
    mockNotificationShow.mockReset()
    MockNotification.mockClear()

    // Second call: drop below resetThreshold
    checkAndNotify(makeData(30, 50))

    const titles = MockNotification.mock.calls.map((c) => (c[0] as { title: string }).title)
    expect(titles.some((t) => t.includes('Session Limit Freed'))).toBe(true)
  })

  it('does NOT send "Session Limit Freed" when notifyOnReset=false', async () => {
    mockGetSettings.mockReturnValue(defaultSettings({ notifyOnReset: false }))

    checkAndNotify(makeData(82, 50))
    mockNotificationShow.mockReset()
    MockNotification.mockClear()

    checkAndNotify(makeData(30, 50))

    const titles = MockNotification.mock.calls.map((c) => (c[0] as { title: string }).title)
    expect(titles.some((t) => t.includes('Session Limit Freed'))).toBe(false)
  })

  it('sends session window reset notification when resets_at changes, notifyOnWindowReset=true', async () => {
    mockGetSettings.mockReturnValue(defaultSettings({ notifyOnWindowReset: true }))

    // First call establishes prevSessionResetsAt
    checkAndNotify(makeData(50, 50, '2026-03-26T10:00:00Z', 'W1'))
    mockNotificationShow.mockReset()
    MockNotification.mockClear()

    // Second call with resets_at advanced by 2 hours (genuine window reset)
    checkAndNotify(makeData(50, 50, '2026-03-26T12:00:00Z', 'W1'))

    const titles = MockNotification.mock.calls.map((c) => (c[0] as { title: string }).title)
    expect(titles.some((t) => t.includes('Session Window Reset'))).toBe(true)
  })

  it('does NOT send session window reset notification when notifyOnWindowReset=false', async () => {
    mockGetSettings.mockReturnValue(defaultSettings({ notifyOnWindowReset: false }))

    checkAndNotify(makeData(50, 50, '2026-03-26T10:00:00Z', 'W1'))
    mockNotificationShow.mockReset()
    MockNotification.mockClear()

    checkAndNotify(makeData(50, 50, '2026-03-26T12:00:00Z', 'W1'))

    expect(mockNotificationShow).not.toHaveBeenCalled()
  })

  it('does NOT send window reset notification on the very first call (prevSessionResetsAt is null)', async () => {
    mockGetSettings.mockReturnValue(defaultSettings({ notifyOnWindowReset: true }))

    // First call ever — prevSessionResetsAt starts as null
    checkAndNotify(makeData(50, 50, 'anything', 'anything'))

    const titles = MockNotification.mock.calls.map((c) => (c[0] as { title: string }).title)
    expect(titles.some((t) => t.includes('Window Reset'))).toBe(false)
  })

  it('syncWindowState prevents window reset notification when resets_at matches synced value', async () => {
    mockGetSettings.mockReturnValue(defaultSettings({ notifyOnWindowReset: true }))

    const data = makeData(50, 50, '2026-03-26T12:00:00Z', '2026-03-30T12:00:00Z')

    // syncWindowState sets prevSessionResetsAt to the same value as data
    syncWindowState(data)

    // checkAndNotify with the same resets_at → no change detected
    checkAndNotify(data)

    const titles = MockNotification.mock.calls.map((c) => (c[0] as { title: string }).title)
    expect(titles.some((t) => t.includes('Window Reset'))).toBe(false)
  })

  it('calls shell.beep() before showing notification when soundEnabled=true', () => {
    mockGetSettings.mockReturnValue(defaultSettings({ soundEnabled: true }))

    checkAndNotify(makeData(82, 50))

    expect(mockShellBeep).toHaveBeenCalled()
    expect(mockNotificationShow).toHaveBeenCalled()
    // beep should come before show — check call order via invocation counts
    // Both must have been called; ordering verified by the implementation always
    // calling beep before new Notification().show()
    expect(mockShellBeep.mock.invocationCallOrder[0]).toBeLessThan(
      mockNotificationShow.mock.invocationCallOrder[0]
    )
  })

  it('does NOT call shell.beep() when soundEnabled=false', () => {
    mockGetSettings.mockReturnValue(defaultSettings({ soundEnabled: false }))

    checkAndNotify(makeData(82, 50))

    expect(mockShellBeep).not.toHaveBeenCalled()
    expect(mockNotificationShow).toHaveBeenCalled()
  })

  it('shows no notification at all when Notification.isSupported() returns false', () => {
    mockNotificationIsSupported.mockReturnValue(false)
    mockGetSettings.mockReturnValue(defaultSettings())

    checkAndNotify(makeData(82, 82))

    expect(mockNotificationShow).not.toHaveBeenCalled()
  })
})

describe('sendTestNotification', () => {
  it('shows a notification when called', () => {
    mockGetSettings.mockReturnValue(defaultSettings())

    sendTestNotification()

    expect(mockNotificationShow).toHaveBeenCalledTimes(1)
  })
})
