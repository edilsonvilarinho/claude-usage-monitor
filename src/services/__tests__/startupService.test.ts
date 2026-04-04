import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSetLoginItemSettings, mockGetLoginItemSettings } = vi.hoisted(() => ({
  mockSetLoginItemSettings: vi.fn(),
  mockGetLoginItemSettings: vi.fn(),
}))

vi.mock('electron', () => ({
  app: {
    setLoginItemSettings: mockSetLoginItemSettings,
    getLoginItemSettings: mockGetLoginItemSettings,
  },
}))

import { setLaunchAtStartup, isLaunchAtStartupEnabled } from '../startupService'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('setLaunchAtStartup()', () => {
  it('calls app.setLoginItemSettings with openAtLogin: true when enabled', () => {
    setLaunchAtStartup(true)

    expect(mockSetLoginItemSettings).toHaveBeenCalledOnce()
    expect(mockSetLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: true })
  })

  it('calls app.setLoginItemSettings with openAtLogin: false when disabled', () => {
    setLaunchAtStartup(false)

    expect(mockSetLoginItemSettings).toHaveBeenCalledOnce()
    expect(mockSetLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: false })
  })
})

describe('isLaunchAtStartupEnabled()', () => {
  it('returns true when app.getLoginItemSettings reports openAtLogin: true', () => {
    mockGetLoginItemSettings.mockReturnValue({ openAtLogin: true })

    expect(isLaunchAtStartupEnabled()).toBe(true)
  })

  it('returns false when app.getLoginItemSettings reports openAtLogin: false', () => {
    mockGetLoginItemSettings.mockReturnValue({ openAtLogin: false })

    expect(isLaunchAtStartupEnabled()).toBe(false)
  })
})
