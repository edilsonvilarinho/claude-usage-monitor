import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockIsEnabled, mockEnable, mockDisable } = vi.hoisted(() => ({
  mockIsEnabled: vi.fn(),
  mockEnable: vi.fn(),
  mockDisable: vi.fn(),
}))

vi.mock('auto-launch', () => ({
  default: vi.fn(function() {
    return {
      isEnabled: mockIsEnabled,
      enable: mockEnable,
      disable: mockDisable,
    }
  }),
}))

vi.mock('electron', () => ({
  app: { getPath: vi.fn().mockReturnValue('/mock/app.exe') },
}))

import { setLaunchAtStartup, isLaunchAtStartupEnabled } from '../startupService'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('setLaunchAtStartup()', () => {
  it('calls enable() when requested to enable and currently disabled', async () => {
    mockIsEnabled.mockResolvedValue(false)

    await setLaunchAtStartup(true)

    expect(mockEnable).toHaveBeenCalledOnce()
    expect(mockDisable).not.toHaveBeenCalled()
  })

  it('does NOT call enable() when already enabled', async () => {
    mockIsEnabled.mockResolvedValue(true)

    await setLaunchAtStartup(true)

    expect(mockEnable).not.toHaveBeenCalled()
  })

  it('calls disable() when requested to disable and currently enabled', async () => {
    mockIsEnabled.mockResolvedValue(true)

    await setLaunchAtStartup(false)

    expect(mockDisable).toHaveBeenCalledOnce()
    expect(mockEnable).not.toHaveBeenCalled()
  })

  it('does NOT call disable() when already disabled', async () => {
    mockIsEnabled.mockResolvedValue(false)

    await setLaunchAtStartup(false)

    expect(mockDisable).not.toHaveBeenCalled()
  })

  it('does not throw when autoLauncher throws — error is swallowed internally', async () => {
    mockIsEnabled.mockRejectedValue(new Error('permission denied'))

    await expect(setLaunchAtStartup(true)).resolves.not.toThrow()
  })
})

describe('isLaunchAtStartupEnabled()', () => {
  it('returns true when the auto-launcher reports enabled', async () => {
    mockIsEnabled.mockResolvedValue(true)

    expect(await isLaunchAtStartupEnabled()).toBe(true)
  })

  it('returns false when the auto-launcher reports disabled', async () => {
    mockIsEnabled.mockResolvedValue(false)

    expect(await isLaunchAtStartupEnabled()).toBe(false)
  })

  it('returns false when isEnabled() throws', async () => {
    mockIsEnabled.mockRejectedValue(new Error('registry error'))

    expect(await isLaunchAtStartupEnabled()).toBe(false)
  })
})
