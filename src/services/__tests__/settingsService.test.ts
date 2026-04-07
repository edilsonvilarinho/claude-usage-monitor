import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted ensures storeData is available inside the vi.mock factory
const { storeRef } = vi.hoisted(() => {
  const storeRef = { data: {} as Record<string, unknown> }
  return { storeRef }
})

vi.mock('electron-store', () => {
  return {
    default: vi.fn(function({ defaults }: { defaults: Record<string, unknown> }) {
      storeRef.data = { ...defaults }
      return {
        get: vi.fn((key: string, defaultVal: unknown) => {
          return key in storeRef.data ? storeRef.data[key] : defaultVal
        }),
        set: vi.fn((key: string, value: unknown) => {
          storeRef.data[key] = value
        }),
      }
    }),
  }
})

import { getSettings, saveSettings } from '../settingsService'

const defaultNotifications = {
  enabled: true,
  sessionThreshold: 80,
  weeklyThreshold: 80,
  resetThreshold: 50,
  notifyOnReset: false,
  notifyOnWindowReset: true,
  soundEnabled: true,
}

beforeEach(() => {
  // Reset to empty so getSettings() falls back to the hardcoded defaults in the service
  storeRef.data = {}
})

describe('getSettings()', () => {
  it('returns all defaults when no data has been saved', () => {
    const settings = getSettings()

    expect(settings.launchAtStartup).toBe(false)
    expect(settings.alwaysVisible).toBe(false)
    expect(settings.theme).toBe('system')
    expect(settings.language).toBe('en')
    expect(settings.pollIntervalMinutes).toBe(7)
    expect(settings.windowSize).toBe('large')
    expect(settings.autoRefresh).toBe(false)
    expect(settings.autoRefreshInterval).toBe(300)
    expect(settings.rateLimitedUntil).toBe(0)
    expect(settings.rateLimitCount).toBe(0)
    expect(settings.rateLimitResetAt).toBe(0)
    expect(settings.notifications.enabled).toBe(true)
    expect(settings.notifications.sessionThreshold).toBe(80)
    expect(settings.notifications.weeklyThreshold).toBe(80)
    expect(settings.notifications.soundEnabled).toBe(true)
  })
})

describe('saveSettings()', () => {
  it('updating a single key updates only that key and leaves others at defaults', () => {
    saveSettings({ theme: 'dark' })

    const settings = getSettings()
    expect(settings.theme).toBe('dark')
    expect(settings.language).toBe('en')
  })

  it('updating multiple keys in one call updates all of them', () => {
    saveSettings({ theme: 'light', language: 'pt-BR', pollIntervalMinutes: 5 })

    const settings = getSettings()
    expect(settings.theme).toBe('light')
    expect(settings.language).toBe('pt-BR')
    expect(settings.pollIntervalMinutes).toBe(5)
  })

  it('saving a partial notifications object replaces the notifications block', () => {
    saveSettings({
      notifications: { ...defaultNotifications, sessionThreshold: 90 },
    })

    const settings = getSettings()
    expect(settings.notifications.sessionThreshold).toBe(90)
    // Other notification fields remain as supplied
    expect(settings.notifications.enabled).toBe(true)
    expect(settings.notifications.weeklyThreshold).toBe(80)
  })

  it('getSettings() after save returns the updated value', () => {
    saveSettings({ launchAtStartup: true })

    expect(getSettings().launchAtStartup).toBe(true)
  })

  it('persists rateLimitedUntil and rateLimitCount', () => {
    saveSettings({ rateLimitedUntil: 9999999, rateLimitCount: 3 })

    const settings = getSettings()
    expect(settings.rateLimitedUntil).toBe(9999999)
    expect(settings.rateLimitCount).toBe(3)
  })

  it('passing undefined for a key does NOT overwrite the previously saved value', () => {
    saveSettings({ theme: 'dark' })
    saveSettings({ theme: undefined as unknown as 'dark' | 'light' | 'system' })

    expect(getSettings().theme).toBe('dark')
  })

  it('multiple saves in succession all persist', () => {
    saveSettings({ theme: 'dark' })
    saveSettings({ language: 'pt-BR' })
    saveSettings({ pollIntervalMinutes: 3 })

    const settings = getSettings()
    expect(settings.theme).toBe('dark')
    expect(settings.language).toBe('pt-BR')
    expect(settings.pollIntervalMinutes).toBe(3)
  })

  it('saves and reads lastUpdateCheck correctly', () => {
    const ts = '2025-01-01T00:00:00Z'
    const tsMs = new Date(ts).getTime()
    saveSettings({ lastUpdateCheck: tsMs })

    expect(getSettings().lastUpdateCheck).toBe(tsMs)
  })

  it('saves and reads skippedVersion correctly', () => {
    saveSettings({ skippedVersion: 'v3.1.0' })

    expect(getSettings().skippedVersion).toBe('v3.1.0')
  })

  it('saves and reads rateLimitResetAt correctly', () => {
    const ts = '2025-01-01T01:00:00Z'
    const tsMs = new Date(ts).getTime()
    saveSettings({ rateLimitResetAt: tsMs })

    expect(getSettings().rateLimitResetAt).toBe(tsMs)
  })

  it('saves alwaysVisible, windowSize, autoRefresh, and autoRefreshInterval', () => {
    saveSettings({
      alwaysVisible: true,
      windowSize: 'medium',
      autoRefresh: true,
      autoRefreshInterval: 60,
    })

    const settings = getSettings()
    expect(settings.alwaysVisible).toBe(true)
    expect(settings.windowSize).toBe('medium')
    expect(settings.autoRefresh).toBe(true)
    expect(settings.autoRefreshInterval).toBe(60)
  })
})
