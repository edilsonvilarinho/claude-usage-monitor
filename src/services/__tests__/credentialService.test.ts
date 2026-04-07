import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs')
vi.mock('https')

import * as fs from 'fs'
import * as https from 'https'
import { CredentialsFile } from '../../models/usageData'

// Dynamically import after mocks so the module picks up the mocked fs/https
// We re-import in each test group via a local helper to avoid stale module state.
// credentialService has no module-level mutable state that depends on fs/https at
// import time, so a single static import is fine here.
import { getAccessToken } from '../credentialService'

// ---- helpers ----------------------------------------------------------------

const WIN_PATH_SUFFIX = '.claude\\.credentials.json'

function buildCreds(overrides: Partial<CredentialsFile['claudeAiOauth']> = {}): CredentialsFile {
  return {
    claudeAiOauth: {
      accessToken: 'valid-token',
      refreshToken: 'refresh-token',
      expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour from now
      ...overrides,
    },
  }
}

/**
 * Set up fs mocks so that:
 * - The Windows credential path exists
 * - The WSL base path does NOT exist (keeps things simple)
 * - statSync returns the supplied mtimeMs
 * - readFileSync returns the supplied credentials JSON
 */
function mockSingleCredFile(
  creds: CredentialsFile,
  mtimeMs: number = Date.now()
): void {
  vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
    const str = String(p)
    // WSL base – does not exist
    if (str === '\\\\wsl.localhost') return false
    // Windows credentials path
    if (str.endsWith(WIN_PATH_SUFFIX) || str.includes('.credentials.json')) return true
    return false
  })
  vi.mocked(fs.statSync).mockReturnValue({ mtimeMs } as ReturnType<typeof fs.statSync>)
  vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(creds))
}

/**
 * Simulate a successful https refresh response.
 */
function mockHttpsRefreshResponse(responseBody: object): void {
  const req = {
    on: vi.fn(),
    end: vi.fn(),
    setTimeout: vi.fn(),
    destroy: vi.fn(),
    write: vi.fn(),
  }
  const res = { on: vi.fn() }
  vi.mocked(res.on).mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
    if (event === 'data') cb(JSON.stringify(responseBody))
    if (event === 'end') cb()
    return res
  })
  vi.mocked(https.request).mockImplementation((_opts: unknown, cb: unknown) => {
    ;(cb as (r: typeof res) => void)(res)
    return req as unknown as ReturnType<typeof https.request>
  })
}

/**
 * Simulate an https request that emits an error.
 */
function mockHttpsError(err: Error): void {
  const req = {
    on: vi.fn((event: string, cb: (e: Error) => void) => {
      if (event === 'error') cb(err)
      return req
    }),
    end: vi.fn(),
    setTimeout: vi.fn(),
    destroy: vi.fn(),
    write: vi.fn(),
  }
  vi.mocked(https.request).mockImplementation(() => req as unknown as ReturnType<typeof https.request>)
}

// ---- tests ------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks()
  // Provide a sensible USERPROFILE so the winPath is deterministic
  process.env['USERPROFILE'] = 'C:\\Users\\testuser'
})

describe('getAccessToken', () => {
  it('returns existing token when valid and not expiring', async () => {
    const creds = buildCreds() // expiresAt is 1h from now
    mockSingleCredFile(creds)

    const token = await getAccessToken()

    expect(token).toBe('valid-token')
    expect(https.request).not.toHaveBeenCalled()
  })

  it('throws when no credential files are found', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)

    await expect(getAccessToken()).rejects.toThrow('Claude credentials not found')
  })

  it('throws when accessToken is missing from credentials', async () => {
    const creds = {
      claudeAiOauth: {
        accessToken: '',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 60 * 60 * 1000,
      },
    } as CredentialsFile
    mockSingleCredFile(creds)

    await expect(getAccessToken()).rejects.toThrow('missing accessToken')
  })

  it('triggers refresh when token expires in less than 5 minutes', async () => {
    const creds = buildCreds({ expiresAt: Date.now() + 4 * 60 * 1000 }) // 4 min
    mockSingleCredFile(creds)
    mockHttpsRefreshResponse({
      access_token: 'new-token',
      refresh_token: 'new-refresh',
      expires_in: 3600,
    })
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined)

    const token = await getAccessToken()

    expect(https.request).toHaveBeenCalled()
    expect(token).toBe('new-token')
  })

  it('refresh succeeds and returns new token', async () => {
    const creds = buildCreds({ expiresAt: Date.now() + 4 * 60 * 1000 })
    mockSingleCredFile(creds)
    mockHttpsRefreshResponse({
      access_token: 'new-token',
      refresh_token: 'new-refresh',
      expires_in: 3600,
    })
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined)

    const token = await getAccessToken()

    expect(token).toBe('new-token')
  })

  it('falls back to existing token when refresh throws a network error', async () => {
    const creds = buildCreds({ expiresAt: Date.now() + 4 * 60 * 1000 })
    mockSingleCredFile(creds)
    mockHttpsError(new Error('network failure'))

    const token = await getAccessToken()

    expect(token).toBe('valid-token')
  })

  it('falls back to existing token when refresh response is missing access_token', async () => {
    const creds = buildCreds({ expiresAt: Date.now() + 4 * 60 * 1000 })
    mockSingleCredFile(creds)
    // Response body has no access_token — refreshToken will throw internally
    mockHttpsRefreshResponse({})
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined)

    const token = await getAccessToken()

    // getAccessToken catches the throw from refreshToken and returns the old token
    expect(token).toBe('valid-token')
  })

  it('selects the most recently modified file when multiple credential paths exist', async () => {
    const olderCreds = buildCreds({ accessToken: 'older-token' })
    const newerCreds = buildCreds({ accessToken: 'newer-token' })

    const olderMtime = 1000
    const newerMtime = 9000

    // existsSync: winPath exists AND wslBase exists so we get a second candidate
    vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
      const str = String(p)
      if (str === '\\\\wsl.localhost') return true
      // homeBase inside WSL distro
      if (str.includes('home') && !str.includes('.credentials.json')) return true
      // Both credential paths exist
      if (str.includes('.credentials.json')) return true
      return false
    })

    // readdirSync: one distro with one user
    vi.mocked(fs.readdirSync).mockImplementation((p: fs.PathLike) => {
      const str = String(p)
      if (str === '\\\\wsl.localhost') return ['Ubuntu' as unknown as fs.Dirent]
      if (str.includes('home')) return ['wsluser' as unknown as fs.Dirent]
      return []
    })

    // statSync: windows path returns olderMtime, wsl path returns newerMtime
    vi.mocked(fs.statSync).mockImplementation((p: fs.PathLike) => {
      const str = String(p)
      if (str.includes('wsluser')) return { mtimeMs: newerMtime } as ReturnType<typeof fs.statSync>
      return { mtimeMs: olderMtime } as ReturnType<typeof fs.statSync>
    })

    // readFileSync: return different creds based on which path is read
    vi.mocked(fs.readFileSync).mockImplementation((p: fs.PathLike | fs.promises.FileHandle) => {
      const str = String(p)
      if (str.includes('wsluser')) return JSON.stringify(newerCreds)
      return JSON.stringify(olderCreds)
    })

    const token = await getAccessToken()

    expect(token).toBe('newer-token')
  })

  it('expired token without refreshToken returns existing token directly', async () => {
    // expiresAt in the past, no refreshToken field
    const creds: CredentialsFile = {
      claudeAiOauth: {
        accessToken: 'expired-but-only-token',
        refreshToken: undefined as unknown as string,
        expiresAt: Date.now() - 60 * 1000, // expired 1 min ago
      },
    }
    mockSingleCredFile(creds)

    const token = await getAccessToken()

    // No refresh attempted because refreshToken is absent
    expect(https.request).not.toHaveBeenCalled()
    expect(token).toBe('expired-but-only-token')
  })

  it('expiresAt undefined causes needsRefresh=true and triggers refresh attempt', async () => {
    const creds: CredentialsFile = {
      claudeAiOauth: {
        accessToken: 'token-without-expiry',
        refreshToken: 'some-refresh-token',
        expiresAt: undefined as unknown as number,
      },
    }
    mockSingleCredFile(creds)
    mockHttpsRefreshResponse({
      access_token: 'refreshed-token',
      refresh_token: 'new-refresh',
      expires_in: 3600,
    })
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined)

    const token = await getAccessToken()

    // needsRefresh = true because (undefined ?? 0) - Date.now() < 5min
    expect(https.request).toHaveBeenCalled()
    expect(token).toBe('refreshed-token')
  })

  it('falls back to existing token when refresh response contains invalid JSON', async () => {
    const creds = buildCreds({ expiresAt: Date.now() + 4 * 60 * 1000 })
    mockSingleCredFile(creds)

    const req = { on: vi.fn(), end: vi.fn(), setTimeout: vi.fn(), destroy: vi.fn(), write: vi.fn() }
    const res = { on: vi.fn() }
    vi.mocked(res.on).mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
      if (event === 'data') cb('not valid json {{{')
      if (event === 'end') cb()
      return res
    })
    vi.mocked(https.request).mockImplementation((_opts: unknown, cb: unknown) => {
      ;(cb as (r: typeof res) => void)(res)
      return req as unknown as ReturnType<typeof https.request>
    })

    const token = await getAccessToken()

    expect(token).toBe('valid-token')
  })

  it('falls back to existing token when refresh request times out', async () => {
    const creds = buildCreds({ expiresAt: Date.now() + 4 * 60 * 1000 })
    mockSingleCredFile(creds)

    let errorHandler: ((e: Error) => void) | null = null
    const req = {
      on: vi.fn((event: string, cb: (e: Error) => void) => {
        if (event === 'error') errorHandler = cb
        return req
      }),
      end: vi.fn(),
      setTimeout: vi.fn((_ms: number, cb: () => void) => {
        cb() // fire timeout callback immediately
      }),
      destroy: vi.fn((err: Error) => {
        errorHandler?.(err) // propagate to error handler, triggering rejection
      }),
      write: vi.fn(),
    }
    vi.mocked(https.request).mockImplementation(() => req as unknown as ReturnType<typeof https.request>)

    const token = await getAccessToken()

    expect(token).toBe('valid-token')
  })

  // ─── pickMostRecentFile — second file is NOT newer (false branch of mtime comparison) ───

  it('selects the windows path when it is more recent than the WSL path', async () => {
    const newerCreds = buildCreds({ accessToken: 'windows-token' })
    const olderCreds = buildCreds({ accessToken: 'wsl-token' })

    const newerMtime = 9000
    const olderMtime = 1000

    vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
      const str = String(p)
      if (str === '\\\\wsl.localhost') return true
      if (str.includes('home') && !str.includes('.credentials.json')) return true
      if (str.includes('.credentials.json')) return true
      return false
    })

    vi.mocked(fs.readdirSync).mockImplementation((p: fs.PathLike) => {
      const str = String(p)
      if (str === '\\\\wsl.localhost') return ['Ubuntu' as unknown as fs.Dirent]
      if (str.includes('home')) return ['wsluser' as unknown as fs.Dirent]
      return []
    })

    // Windows path is newer, WSL path is older
    vi.mocked(fs.statSync).mockImplementation((p: fs.PathLike) => {
      const str = String(p)
      if (str.includes('wsluser')) return { mtimeMs: olderMtime } as ReturnType<typeof fs.statSync>
      return { mtimeMs: newerMtime } as ReturnType<typeof fs.statSync>
    })

    vi.mocked(fs.readFileSync).mockImplementation((p: fs.PathLike | fs.promises.FileHandle) => {
      const str = String(p)
      if (str.includes('wsluser')) return JSON.stringify(olderCreds)
      return JSON.stringify(newerCreds)
    })

    const token = await getAccessToken()

    // Windows path has higher mtime — should be selected
    expect(token).toBe('windows-token')
  })

  // ─── refreshToken — optional response fields ──────────────────────────────

  it('refresh response without refresh_token does not update refreshToken in file', async () => {
    const creds = buildCreds({ expiresAt: Date.now() + 4 * 60 * 1000 })
    mockSingleCredFile(creds)

    // Response has access_token and expires_in but NO refresh_token
    mockHttpsRefreshResponse({
      access_token: 'new-token',
      expires_in: 3600,
    })

    const written: string[] = []
    vi.mocked(fs.writeFileSync).mockImplementation((_p, data) => {
      written.push(String(data))
    })

    const token = await getAccessToken()

    expect(token).toBe('new-token')
    // The written JSON should still have the original refreshToken
    expect(written).toHaveLength(1)
    const saved = JSON.parse(written[0]) as { claudeAiOauth: { refreshToken: string } }
    expect(saved.claudeAiOauth.refreshToken).toBe('refresh-token')
  })

  it('refresh response without expires_in does not update expiresAt in file', async () => {
    const originalExpiresAt = Date.now() + 4 * 60 * 1000
    const creds = buildCreds({ expiresAt: originalExpiresAt })
    mockSingleCredFile(creds)

    // Response has access_token and refresh_token but NO expires_in
    mockHttpsRefreshResponse({
      access_token: 'new-token',
      refresh_token: 'new-refresh',
    })

    const written: string[] = []
    vi.mocked(fs.writeFileSync).mockImplementation((_p, data) => {
      written.push(String(data))
    })

    const token = await getAccessToken()

    expect(token).toBe('new-token')
    // expiresAt should remain unchanged (original value)
    const saved = JSON.parse(written[0]) as { claudeAiOauth: { expiresAt: number } }
    expect(saved.claudeAiOauth.expiresAt).toBe(originalExpiresAt)
  })

  it('refresh response without refresh_token and without expires_in leaves both unchanged', async () => {
    const originalExpiresAt = Date.now() + 4 * 60 * 1000
    const creds = buildCreds({ expiresAt: originalExpiresAt })
    mockSingleCredFile(creds)

    // Response has only access_token
    mockHttpsRefreshResponse({
      access_token: 'new-token',
    })

    const written: string[] = []
    vi.mocked(fs.writeFileSync).mockImplementation((_p, data) => {
      written.push(String(data))
    })

    const token = await getAccessToken()

    expect(token).toBe('new-token')
    const saved = JSON.parse(written[0]) as { claudeAiOauth: { refreshToken: string; expiresAt: number } }
    expect(saved.claudeAiOauth.refreshToken).toBe('refresh-token')
    expect(saved.claudeAiOauth.expiresAt).toBe(originalExpiresAt)
  })

  it('does not check WSL paths when wslBase does not exist', async () => {
    const creds = buildCreds()

    vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
      const str = String(p)
      if (str === '\\\\wsl.localhost') return false
      if (str.includes('.credentials.json')) return true
      return false
    })
    vi.mocked(fs.statSync).mockReturnValue({ mtimeMs: Date.now() } as ReturnType<typeof fs.statSync>)
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(creds))

    await getAccessToken()

    // readdirSync should never have been called since wslBase did not exist
    expect(fs.readdirSync).not.toHaveBeenCalled()
  })
})
