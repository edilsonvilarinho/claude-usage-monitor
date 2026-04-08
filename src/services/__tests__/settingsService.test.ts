import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted ensures storesMap is available inside the vi.mock factory
const { storesMap } = vi.hoisted(() => {
  const storesMap = new Map<string, Record<string, unknown>>()
  return { storesMap }
})

vi.mock('electron-store', () => {
  return {
    default: vi.fn(function({ name, defaults }: { name: string, defaults?: Record<string, unknown> }) {
      if (!storesMap.has(name)) {
        storesMap.set(name, { ...(defaults ?? {}) })
      }
      const data = storesMap.get(name)!
      return {
        get: vi.fn((key: string, defaultVal: unknown) => key in data ? data[key] : defaultVal),
        set: vi.fn((key: string, value: unknown) => { data[key] = value }),
      }
    }),
  }
})

import {
  getSettings,
  saveSettings,
  setActiveAccount,
  getActiveAccount,
  getAccountData,
  saveAccountData,
} from '../settingsService'

const defaultNotifications = {
  enabled: true,
  sessionThreshold: 80,
  weeklyThreshold: 80,
  resetThreshold: 50,
  notifyOnReset: false,
  notifyOnWindowReset: true,
  soundEnabled: true,
}

function resetStores(): void {
  // Mutate the existing data objects in-place so the store closures still point to them.
  // Clearing the Map would lose the references held by the module-level store instances.
  for (const data of storesMap.values()) {
    for (const key of Object.keys(data)) {
      delete data[key]
    }
  }
}

beforeEach(() => {
  resetStores()
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
    expect(settings.autoRefreshInterval).toBe(600)
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

// ─── Account store tests ──────────────────────────────────────────────────────

describe('getActiveAccount()', () => {
  it('returns "default" when no activeAccount is set', () => {
    expect(getActiveAccount()).toBe('default')
  })

  it('returns the saved activeAccount when one has been set', () => {
    // Directly prime the accounts store so we can test the getter independently
    const accountsData = storesMap.get('accounts') ?? {}
    accountsData['activeAccount'] = 'user@example.com'
    storesMap.set('accounts', accountsData)

    expect(getActiveAccount()).toBe('user@example.com')
  })
})

describe('setActiveAccount()', () => {
  it('does nothing when email is empty string', () => {
    setActiveAccount('')
    expect(getActiveAccount()).toBe('default')
  })

  it('does nothing when email is already the current activeAccount', () => {
    // First call sets it
    setActiveAccount('user@example.com')
    // Manually set accounts store so a second call would try to migrate (but shouldn't)
    const accountsData = storesMap.get('accounts') ?? {}
    // Remove the entry so migration would run if it were invoked
    const existingAccounts = (accountsData['accounts'] as Record<string, unknown>) ?? {}
    delete existingAccounts['user@example.com']
    accountsData['accounts'] = existingAccounts
    storesMap.set('accounts', accountsData)

    // Second call with same email — should be a no-op (current === email)
    setActiveAccount('user@example.com')

    // The deleted entry was NOT recreated because we returned early
    const finalAccounts = (storesMap.get('accounts')!['accounts'] as Record<string, unknown>)
    expect(finalAccounts['user@example.com']).toBeUndefined()
  })

  it('creates a new account entry with defaults when no legacy data exists', () => {
    setActiveAccount('new@example.com')

    const accountsData = storesMap.get('accounts')!
    expect(accountsData['activeAccount']).toBe('new@example.com')
    const accounts = accountsData['accounts'] as Record<string, unknown>
    expect(accounts['new@example.com']).toBeDefined()
    const entry = accounts['new@example.com'] as Record<string, unknown>
    expect(entry['usageHistory']).toEqual([])
    expect(entry['dailyHistory']).toEqual([])
    expect(entry['rateLimitedUntil']).toBe(0)
    expect(entry['rateLimitCount']).toBe(0)
    expect(entry['rateLimitResetAt']).toBe(0)
  })

  it('migrates legacy fields from config store when they are present', () => {
    // Seed legacy data in the config store
    const configData = storesMap.get('config') ?? {}
    configData['usageHistory'] = [{ ts: 1 }]
    configData['dailyHistory'] = [{ date: '2025-01-01' }]
    configData['rateLimitedUntil'] = 12345
    configData['rateLimitCount'] = 2
    configData['rateLimitResetAt'] = 99999
    storesMap.set('config', configData)

    setActiveAccount('migrated@example.com')

    const accountsData = storesMap.get('accounts')!
    const accounts = accountsData['accounts'] as Record<string, unknown>
    const entry = accounts['migrated@example.com'] as Record<string, unknown>

    expect(entry['usageHistory']).toEqual([{ ts: 1 }])
    expect(entry['dailyHistory']).toEqual([{ date: '2025-01-01' }])
    expect(entry['rateLimitedUntil']).toBe(12345)
    expect(entry['rateLimitCount']).toBe(2)
    expect(entry['rateLimitResetAt']).toBe(99999)

    // Legacy fields cleared in config store after migration
    const config = storesMap.get('config')!
    expect(config['usageHistory']).toEqual([])
    expect(config['dailyHistory']).toEqual([])
    expect(config['rateLimitedUntil']).toBe(0)
    expect(config['rateLimitCount']).toBe(0)
    expect(config['rateLimitResetAt']).toBe(0)
  })

  it('uses default account data when no legacy fields but accounts["default"] exists', () => {
    // Seed a 'default' placeholder in the accounts store
    const accountsData = storesMap.get('accounts') ?? { activeAccount: '', accounts: {} }
    const accounts = (accountsData['accounts'] as Record<string, unknown>) ?? {}
    accounts['default'] = {
      usageHistory: [{ ts: 42 }],
      dailyHistory: [],
      rateLimitedUntil: 777,
      rateLimitCount: 1,
      rateLimitResetAt: 888,
    }
    accountsData['accounts'] = accounts
    storesMap.set('accounts', accountsData)

    setActiveAccount('switched@example.com')

    const finalAccounts = storesMap.get('accounts')!
    const allAccounts = finalAccounts['accounts'] as Record<string, unknown>
    const entry = allAccounts['switched@example.com'] as Record<string, unknown>

    expect(entry['usageHistory']).toEqual([{ ts: 42 }])
    expect(entry['rateLimitedUntil']).toBe(777)
    // 'default' placeholder removed
    expect(allAccounts['default']).toBeUndefined()
  })

  it('does NOT overwrite existing account entry when email already exists in accounts', () => {
    // Pre-populate the accounts store with an existing entry
    const accountsData = storesMap.get('accounts') ?? { activeAccount: '', accounts: {} }
    const accounts = (accountsData['accounts'] as Record<string, unknown>) ?? {}
    accounts['existing@example.com'] = {
      usageHistory: [{ ts: 999 }],
      dailyHistory: [],
      rateLimitedUntil: 0,
      rateLimitCount: 0,
      rateLimitResetAt: 0,
    }
    // Set a different current activeAccount so the early-return won't fire
    accountsData['activeAccount'] = 'other@example.com'
    accountsData['accounts'] = accounts
    storesMap.set('accounts', accountsData)

    setActiveAccount('existing@example.com')

    const finalAccounts = storesMap.get('accounts')!['accounts'] as Record<string, unknown>
    const entry = finalAccounts['existing@example.com'] as Record<string, unknown>
    // Existing data preserved — not overwritten
    expect(entry['usageHistory']).toEqual([{ ts: 999 }])
  })
})

describe('getAccountData()', () => {
  it('returns defaults when active account has no data', () => {
    const data = getAccountData()

    expect(data.usageHistory).toEqual([])
    expect(data.dailyHistory).toEqual([])
    expect(data.rateLimitedUntil).toBe(0)
    expect(data.rateLimitCount).toBe(0)
    expect(data.rateLimitResetAt).toBe(0)
  })

  it('merges stored partial data with defaults', () => {
    // Seed partial data for the active account (which defaults to 'default')
    const accountsData = storesMap.get('accounts') ?? { activeAccount: '', accounts: {} }
    const accounts = (accountsData['accounts'] as Record<string, unknown>) ?? {}
    accounts['default'] = { usageHistory: [{ ts: 1 }], rateLimitedUntil: 500 }
    accountsData['accounts'] = accounts
    storesMap.set('accounts', accountsData)

    const data = getAccountData()

    expect(data.usageHistory).toEqual([{ ts: 1 }])
    expect(data.rateLimitedUntil).toBe(500)
    // Fields not in stored partial still come from defaults
    expect(data.dailyHistory).toEqual([])
    expect(data.rateLimitCount).toBe(0)
  })
})

describe('saveAccountData()', () => {
  it('saves partial data into the active account entry', () => {
    saveAccountData({ rateLimitedUntil: 12345, rateLimitCount: 3 })

    const data = getAccountData()
    expect(data.rateLimitedUntil).toBe(12345)
    expect(data.rateLimitCount).toBe(3)
    // Other fields remain at defaults
    expect(data.usageHistory).toEqual([])
  })

  it('creates an account entry if none exists', () => {
    // Accounts store is empty — calling saveAccountData should create the entry
    const accountsData = storesMap.get('accounts') ?? { activeAccount: '', accounts: {} }
    const accounts = (accountsData['accounts'] as Record<string, unknown>) ?? {}
    // Confirm 'default' key does not exist
    expect(accounts['default']).toBeUndefined()

    saveAccountData({ usageHistory: [{ ts: 7 }] as never })

    const data = getAccountData()
    expect(data.usageHistory).toEqual([{ ts: 7 }])
  })
})
