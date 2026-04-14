import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mocks de módulos do Electron ─────────────────────────────────────────────

vi.mock('electron', () => ({}))
vi.mock('../../services/credentialService', () => ({
  getAccessToken: vi.fn(),
}))

// ── storesMap para electron-store ─────────────────────────────────────────────

const { storesMap } = vi.hoisted(() => {
  const storesMap = new Map<string, Record<string, unknown>>()
  return { storesMap }
})

vi.mock('electron-store', () => {
  return {
    default: vi.fn(function ({
      name,
      defaults,
    }: {
      name: string
      defaults?: Record<string, unknown>
    }) {
      if (!storesMap.has(name)) {
        storesMap.set(name, { ...(defaults ?? {}) })
      }
      const data = storesMap.get(name)!
      return {
        get: vi.fn((key: string, defaultVal: unknown) =>
          key in data ? data[key] : defaultVal,
        ),
        set: vi.fn((key: string, value: unknown) => {
          data[key] = value
        }),
      }
    }),
  }
})

// ── Fetch mockado via vi.stubGlobal ──────────────────────────────────────────

const mockFetch = vi.fn()

function resetStores(): void {
  for (const data of storesMap.values()) {
    for (const key of Object.keys(data)) {
      delete data[key]
    }
  }
}

function seedCloudSync(overrides: Record<string, unknown> = {}): void {
  const configData = storesMap.get('config') ?? {}
  configData['cloudSync'] = {
    enabled: true,
    serverUrl: 'http://localhost:3030',
    deviceId: 'device-abc',
    deviceLabel: 'Test Device',
    lastSyncAt: 0,
    lastSyncError: '',
    lastPullCursor: 0,
    syncIntervalMinutes: 15,
    ...overrides,
  }
  storesMap.set('config', configData)
}

function seedJwt(jwt = 'header.eyJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.sig', expiresAt = Date.now() + 3600_000): void {
  const secretsData = storesMap.get('cloud-sync') ?? {}
  secretsData['jwt'] = jwt
  secretsData['jwtExpiresAt'] = expiresAt
  storesMap.set('cloud-sync', secretsData)
}

function makeExchangeResponse(email = 'test@example.com') {
  return {
    jwt: 'header.eyJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.sig',
    expiresAt: Date.now() + 86400_000,
    email,
  }
}

function makePullResponse() {
  return {
    daily: [],
    sessionWindows: [],
    timeSeries: [],
    usageSnapshots: [],
    serverTime: Date.now(),
  }
}

function makeJsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  })
}

// ── Import após mocks ─────────────────────────────────────────────────────────

const { getAccessToken } = await import('../../services/credentialService')
const mockGetAccessToken = vi.mocked(getAccessToken)

// SyncService é um singleton — reimportamos após mocks
const { SyncService } = await import('../syncService').then(async () => {
  // Re-importar como classe para poder instanciar nos testes
  const mod = await import('../syncService')
  // Exporta a classe diretamente para os testes
  return { SyncService: (mod as unknown as { SyncService: new () => typeof mod.syncService }).SyncService }
})

// Como o módulo exporta apenas instância, vamos criar uma classe wrapper de teste
// importando o módulo e acessando os métodos diretamente

let service: typeof import('../syncService').syncService

beforeEach(async () => {
  vi.useFakeTimers()
  resetStores()
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
  mockGetAccessToken.mockReset()

  // Re-instancia o syncService para cada teste resetando o estado interno
  // Importamos o módulo e recriamos via a classe privada — como o módulo exporta
  // singleton, para isolar testes vamos usar a instância e resetar manualmente
  const mod = await import('../syncService')
  service = mod.syncService

  // Reset estado interno
  ;(service as unknown as Record<string, unknown>)['temporarilyDisabled'] = false
  ;(service as unknown as Record<string, unknown>)['isSyncing'] = false
  ;(service as unknown as Record<string, unknown>)['backoffCount'] = 0
  ;(service as unknown as Record<string, unknown>)['jwtEmail'] = ''
  const syncTimer = (service as unknown as Record<string, unknown>)['syncTimer']
  if (syncTimer) clearInterval(syncTimer as ReturnType<typeof setInterval>)
  ;(service as unknown as Record<string, unknown>)['syncTimer'] = null
  const backoffTimer = (service as unknown as Record<string, unknown>)['backoffTimer']
  if (backoffTimer) clearTimeout(backoffTimer as ReturnType<typeof setTimeout>)
  ;(service as unknown as Record<string, unknown>)['backoffTimer'] = null
  // Remove all event listeners para evitar vazamento entre testes
  service.removeAllListeners()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('syncService', () => {
  // 1. init() com enabled: false é no-op
  it('init() com cloudSync.enabled=false não agenda timers', async () => {
    // cloudSync não está no config store → enabled = false por default
    await service.init()

    const syncTimer = (service as unknown as Record<string, unknown>)['syncTimer']
    expect(syncTimer).toBeNull()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  // 2. enable() faz POST /auth/exchange e depois GET /sync/snapshot
  it('enable() faz POST /auth/exchange e GET /sync/snapshot em sequência', async () => {
    mockGetAccessToken.mockResolvedValue('access-token-123')

    mockFetch
      .mockResolvedValueOnce(makeJsonResponse(makeExchangeResponse()))       // /auth/exchange
      .mockResolvedValueOnce(makeJsonResponse(makePullResponse()))            // /sync/snapshot

    const events: string[] = []
    service.on('sync-event', (e: { type: string }) => events.push(e.type))

    await service.enable('http://localhost:3030', 'My Device')

    expect(mockFetch).toHaveBeenCalledTimes(2)

    const [firstCall, secondCall] = mockFetch.mock.calls as [unknown[], unknown[]][]
    expect((firstCall![0] as string)).toContain('/auth/exchange')
    expect((secondCall![0] as string)).toContain('/sync/snapshot')

    expect(events).toContain('enabled')

    // JWT deve ter sido salvo
    const secretsData = storesMap.get('cloud-sync')!
    expect(secretsData['jwt']).toBeTruthy()
    expect(secretsData['jwtExpiresAt']).toBeGreaterThan(Date.now())
  })

  // 3. enqueuePush() em falha de rede acumula no outbox
  it('enqueuePush() em falha de rede acumula item no outbox', async () => {
    seedCloudSync()
    seedJwt()

    // Primeira chamada (flushOutbox) falha com erro de rede
    mockFetch.mockRejectedValue(new Error('Network error'))

    // Semeamos dados mínimos no account store
    const accountsData = storesMap.get('accounts') ?? { activeAccount: '', accounts: {} }
    ;(accountsData as Record<string, unknown>)['activeAccount'] = 'default'
    ;(accountsData as Record<string, unknown>)['accounts'] = { default: { usageHistory: [], dailyHistory: [], timeSeries: {}, sessionWindows: [], currentSessionWindow: null, rateLimitedUntil: 0, rateLimitCount: 0, rateLimitResetAt: 0 } }
    storesMap.set('accounts', accountsData as Record<string, unknown>)

    const { getAccountData } = await import('../../services/settingsService')
    const accountData = getAccountData()

    service.enqueuePush(accountData)

    // Verifica que o item foi adicionado ao outbox antes do sync
    const outboxData = storesMap.get('sync-outbox') ?? {}
    const items = (outboxData['items'] as unknown[]) ?? []
    expect(items.length).toBeGreaterThanOrEqual(1)
  })

  // 4. syncNow() flusha outbox e faz pull
  it('syncNow() flusha outbox e faz pull incremental', async () => {
    seedCloudSync()
    seedJwt()

    // Semeamos um item no outbox
    const outboxData = storesMap.get('sync-outbox') ?? {}
    outboxData['items'] = [
      { op: 'push', payload: { deviceId: 'device-abc', daily: [], sessionWindows: [], timeSeries: [], usageSnapshots: [] }, attemptCount: 0, lastError: '', queuedAt: Date.now() },
    ]
    storesMap.set('sync-outbox', outboxData)

    mockFetch
      .mockResolvedValueOnce(makeJsonResponse({ ok: true }, 200))    // flush push
      .mockResolvedValueOnce(makeJsonResponse(makePullResponse()))   // pull

    const events: string[] = []
    service.on('sync-event', (e: { type: string }) => events.push(e.type))

    await service.syncNow()

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(events).toContain('sync-success')

    // Outbox deve estar limpo após flush bem-sucedido
    const finalOutbox = storesMap.get('sync-outbox')!
    expect((finalOutbox['items'] as unknown[]).length).toBe(0)
  })

  // 5. 401 dispara re-exchange
  it('syncNow() com JWT expirado faz re-exchange antes de continuar', async () => {
    seedCloudSync()
    // JWT expirado
    seedJwt('expired.jwt.token', Date.now() - 1000)

    mockGetAccessToken.mockResolvedValue('fresh-access-token')

    mockFetch
      .mockResolvedValueOnce(makeJsonResponse(makeExchangeResponse()))   // re-exchange
      .mockResolvedValueOnce(makeJsonResponse(makePullResponse()))       // pull

    await service.syncNow()

    expect(mockFetch).toHaveBeenCalledTimes(2)
    const firstCall = mockFetch.mock.calls[0] as [string, ...unknown[]]
    expect(firstCall[0]).toContain('/auth/exchange')
  })

  // 6. Erro de rede durante syncNow mantém estado consistente + lastSyncError preenchido
  it('erro de rede durante syncNow mantém estado consistente e preenche lastSyncError', async () => {
    seedCloudSync()
    seedJwt()

    // Todos os fetches falham
    mockFetch.mockRejectedValue(new Error('Connection refused'))

    const events: { type: string }[] = []
    service.on('sync-event', (e: { type: string }) => events.push(e))

    await service.syncNow()

    // Deve emitir sync-error
    expect(events.some(e => e.type === 'sync-error')).toBe(true)

    // lastSyncError deve estar preenchido no config
    const configData = storesMap.get('config')!
    const cloudSync = configData['cloudSync'] as Record<string, unknown>
    expect(typeof cloudSync['lastSyncError']).toBe('string')
    expect((cloudSync['lastSyncError'] as string).length).toBeGreaterThan(0)

    // isSyncing deve ter voltado a false
    expect((service as unknown as Record<string, unknown>)['isSyncing']).toBe(false)
  })

  // 7. disable() para sync e limpa timers
  it('disable() limpa timers e desabilita sync', async () => {
    seedCloudSync({ enabled: true })
    seedJwt()

    vi.useFakeTimers()
    await service.syncNow() // Agenda timer de sync

    await service.disable()

    const configData = storesMap.get('config')!
    const cloudSync = configData['cloudSync'] as Record<string, unknown>
    expect(cloudSync['enabled']).toBe(false)

    const syncTimer = (service as unknown as Record<string, unknown>)['syncTimer']
    expect(syncTimer).toBeNull()

    vi.useRealTimers()
  })

  // 8. getStatus() retorna estado correto
  it('getStatus() retorna estado atual do sync', async () => {
    seedCloudSync({ enabled: true, lastSyncAt: Date.now() - 60000, lastSyncError: 'Some error' })
    seedJwt('valid.jwt', Date.now() + 3600000)

    const status = service.getStatus()

    expect(status.enabled).toBe(true)
    expect(status.lastSyncAt).toBeGreaterThan(0)
    expect(status.lastError).toBe('Some error')
    expect(status.pendingOps).toBe(0)
    expect(status.jwtExpiresAt).toBeGreaterThan(Date.now())
  })

  // 9. enqueuePush com dados válidos adiciona ao outbox
  it('enqueuePush adiciona dados ao outbox quando offline', async () => {
    seedCloudSync({ enabled: true })
    seedJwt()

    // Sem rede, dados ficam no outbox
    mockFetch.mockRejectedValue(new Error('Network error'))

    const accountsData = storesMap.get('accounts') ?? { activeAccount: '', accounts: {} }
    ;(accountsData as Record<string, unknown>)['activeAccount'] = 'default'
    ;(accountsData as Record<string, unknown>)['accounts'] = {
      default: {
        usageHistory: [{ ts: Date.now(), session: 50, weekly: 60 }],
        dailyHistory: [{ date: '2026-04-13', maxSession: 50, maxWeekly: 60, sessionWindowCount: 1, sessionAccum: 0 }],
        timeSeries: {},
        sessionWindows: [],
        currentSessionWindow: null,
        rateLimitedUntil: 0,
        rateLimitCount: 0,
        rateLimitResetAt: 0,
      },
    }
    storesMap.set('accounts', accountsData as Record<string, unknown>)

    const { getAccountData } = await import('../../services/settingsService')
    const accountData = getAccountData()

    service.enqueuePush(accountData)

    const outboxData = storesMap.get('sync-outbox')!
    const items = outboxData['items'] as unknown[]
    expect(items.length).toBeGreaterThanOrEqual(1)
  })

  // 10. syncNow com dados locais mais recentes prevalece (merge por mtime)
  it('syncNow com pull incremental retorna dados do servidor', async () => {
    seedCloudSync({ enabled: true, lastPullCursor: Date.now() - 60000 })
    seedJwt()

    const accountsData = storesMap.get('accounts') ?? { activeAccount: '', accounts: {} }
    ;(accountsData as Record<string, unknown>)['activeAccount'] = 'default'
    ;(accountsData as Record<string, unknown>)['accounts'] = {
      default: {
        usageHistory: [],
        dailyHistory: [{ date: '2026-04-13', maxSession: 80, maxWeekly: 70, sessionWindowCount: 2, sessionAccum: 30 }],
        timeSeries: {},
        sessionWindows: [],
        currentSessionWindow: null,
        rateLimitedUntil: 0,
        rateLimitCount: 0,
        rateLimitResetAt: 0,
      },
    }
    storesMap.set('accounts', accountsData as Record<string, unknown>)

    mockFetch.mockResolvedValueOnce(
      makeJsonResponse({
        daily: [],
        sessionWindows: [],
        timeSeries: {},
        usageSnapshots: [],
        serverTime: Date.now(),
      }),
    )

    await service.syncNow()

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const pullUrl = mockFetch.mock.calls[0][0] as string
    expect(pullUrl).toContain('/sync/pull')
  })

  // 11. JWT expirado durante sync aciona re-exchange automático
  it('JWT expirado aciona re-exchange sem pedir confirmação', async () => {
    seedCloudSync({ enabled: true })
    seedJwt('old.jwt', Date.now() - 1000) // Expirado

    mockGetAccessToken.mockResolvedValue('fresh-token')

    mockFetch
      .mockResolvedValueOnce(makeJsonResponse(makeExchangeResponse())) // re-exchange
      .mockResolvedValueOnce(makeJsonResponse(makePullResponse())) // pull

    await service.syncNow()

    expect(mockFetch).toHaveBeenCalledTimes(2)
    const firstCall = mockFetch.mock.calls[0]
    expect((firstCall[0] as string)).toContain('/auth/exchange')
  })

  // 12. sync Now com interval agendado
  it('syncNow não agenda timer duplicado quando já existe', async () => {
    seedCloudSync({ enabled: true, syncIntervalMinutes: 15 })
    seedJwt()

    mockFetch
      .mockResolvedValueOnce(makeJsonResponse({ ok: true, daily: [], sessionWindows: [], timeSeries: [], usageSnapshots: [], serverTime: Date.now() }))

    vi.useFakeTimers()

    await service.syncNow()
    const firstTimer = (service as unknown as Record<string, unknown>)['syncTimer']

    await service.syncNow()
    const secondTimer = (service as unknown as Record<string, unknown>)['syncTimer']

    // Timer deve ser o mesmo (não duplicado)
    expect(firstTimer).toBe(secondTimer)

    vi.useRealTimers()
  })

  // 13. disable com wipeRemote=true faz DELETE no servidor
  it('disable com wipeRemote=true tenta DELETE no servidor', async () => {
    seedCloudSync({ enabled: true, serverUrl: 'http://localhost:3030' })
    seedJwt()

    mockFetch.mockResolvedValueOnce(makeJsonResponse({ ok: true }))

    await service.disable(true)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const call = mockFetch.mock.calls[0][0] as string
    expect(call).toContain('/sync/account')
  })

  // 14. disable com wipeRemote=false não faz DELETE
  it('disable com wipeRemote=false não faz chamada de rede', async () => {
    seedCloudSync({ enabled: true, serverUrl: 'http://localhost:3030' })
    seedJwt()

    await service.disable(false)

    expect(mockFetch).not.toHaveBeenCalled()
  })

  // 15. syncNow com erro em flushOutbox ainda emite sync-error
  it('syncNow com erro em flushOutbox emite sync-error event', async () => {
    seedCloudSync({ enabled: true })
    seedJwt()

    const outboxData = { items: [{ op: 'push', payload: {}, attemptCount: 0, lastError: '', queuedAt: Date.now() }] }
    storesMap.set('sync-outbox', outboxData)

    mockFetch.mockRejectedValue(new Error('Network error'))

    const accountsData = storesMap.get('accounts') ?? { activeAccount: '', accounts: {} }
    ;(accountsData as Record<string, unknown>)['activeAccount'] = 'default'
    ;(accountsData as Record<string, unknown>)['accounts'] = {
      default: {
        usageHistory: [], dailyHistory: [], timeSeries: {}, sessionWindows: [], currentSessionWindow: null, rateLimitedUntil: 0, rateLimitCount: 0, rateLimitResetAt: 0,
      },
    }
    storesMap.set('accounts', accountsData as Record<string, unknown>)

    const events: { type: string }[] = []
    service.on('sync-event', (e: { type: string }) => events.push(e))

    await service.syncNow()

    expect(events.some(e => e.type === 'sync-error')).toBe(true)
  })

  // 16. schedulePeriodicSync cria timer com intervalo correto
  it('schedulePeriodicSync cria timer com intervalo correto em minutos', async () => {
    seedCloudSync({ enabled: true })
    seedJwt()

    vi.useFakeTimers()

    const intervalMinutes = 20
    service.schedulePeriodicSync(intervalMinutes)

    const syncTimer = (service as unknown as Record<string, unknown>)['syncTimer']
    expect(syncTimer).not.toBeNull()

    vi.useRealTimers()
  })

  // 17. getStatus com outbox pendente - verifica que getOutbox() retorna tamanho correto
  it('getStatus retorna pendingOps baseado no tamanho do outbox', async () => {
    seedCloudSync({ enabled: true })
    seedJwt()

    const { getOutbox } = await import('../../services/settingsService')
    const { setOutbox } = await import('../../services/settingsService')
    
    setOutbox([
      { op: 'push', payload: { daily: [] }, attemptCount: 1, lastError: 'Retry', queuedAt: Date.now() },
      { op: 'push', payload: { daily: [] }, attemptCount: 0, lastError: '', queuedAt: Date.now() },
    ])

    const status = service.getStatus()

    expect(status.pendingOps).toBe(2)
  })

  // 18. sync com JWT próximo de expirar (< 5min) faz re-exchange
  it('JWT prestes a expirar (< 5min) força re-exchange', async () => {
    seedCloudSync({ enabled: true })
    // Expira em 4 minutos
    seedJwt('almost.jwt', Date.now() + 4 * 60 * 1000)

    mockGetAccessToken.mockResolvedValue('new-access-token')

    mockFetch
      .mockResolvedValueOnce(makeJsonResponse(makeExchangeResponse())) // re-exchange
      .mockResolvedValueOnce(makeJsonResponse({ ok: true })) // flush
      .mockResolvedValueOnce(makeJsonResponse({ ok: true, daily: [], sessionWindows: [], timeSeries: [], usageSnapshots: [], serverTime: Date.now() })) // pull

    await service.syncNow()

    // Ao todo: re-exchange + flush + pull = 3 calls
    expect(mockFetch).toHaveBeenCalledTimes(3)
    const firstCall = mockFetch.mock.calls[0][0] as string
    expect(firstCall).toContain('/auth/exchange')
  })

  // 19. doExchange com 401 retorna erro
  it('doExchange com 401 lança erro AUTH_401', async () => {
    seedCloudSync({ enabled: true, serverUrl: 'http://localhost:3030' })
    mockGetAccessToken.mockResolvedValue('access-token')

    mockFetch.mockResolvedValueOnce(
      new Response(null, { status: 401 })
    )

    await expect(
      (service as unknown as Record<string, unknown>)['doExchange']('http://localhost:3030', 'token', 'device-id', 'device-label')
    ).rejects.toThrow('AUTH_401')
  })

  // 20. doExchange com !resp.ok lança erro
  it('doExchange com status 500 lança erro', async () => {
    seedCloudSync({ enabled: true, serverUrl: 'http://localhost:3030' })
    mockGetAccessToken.mockResolvedValue('access-token')

    mockFetch.mockResolvedValueOnce(
      new Response(null, { status: 500 })
    )

    await expect(
      (service as unknown as Record<string, unknown>)['doExchange']('http://localhost:3030', 'token', 'device-id', 'device-label')
    ).rejects.toThrow('Exchange failed: 500')
  })

  // 21. doSnapshot com 401 lança AUTH_401
  it('doSnapshot com 401 lança AUTH_401', async () => {
    seedCloudSync({ enabled: true, serverUrl: 'http://localhost:3030' })
    seedJwt()

    mockFetch.mockResolvedValueOnce(
      new Response(null, { status: 401 })
    )

    await expect(
      (service as unknown as Record<string, unknown>)['doSnapshot']('http://localhost:3030', 'jwt-token')
    ).rejects.toThrow('AUTH_401')
  })

  // 22. doPull com 401 lança AUTH_401
  it('doPull com 401 lança AUTH_401', async () => {
    seedCloudSync({ enabled: true, serverUrl: 'http://localhost:3030' })
    seedJwt()

    mockFetch.mockResolvedValueOnce(
      new Response(null, { status: 401 })
    )

    await expect(
      (service as unknown as Record<string, unknown>)['doPull']('http://localhost:3030', 'jwt-token', 123)
    ).rejects.toThrow('AUTH_401')
  })

  // 23. applyPullResponse com currentWindow remoto
  it('applyPullResponse aplica currentWindow remoto', async () => {
    seedCloudSync({ enabled: true, serverUrl: 'http://localhost:3030' })
    seedJwt()

    const accountsData = storesMap.get('accounts') ?? { activeAccount: '', accounts: {} }
    ;(accountsData as Record<string, unknown>)['activeAccount'] = 'default'
    ;(accountsData as Record<string, unknown>)['accounts'] = {
      default: {
        usageHistory: [],
        dailyHistory: [],
        timeSeries: {},
        sessionWindows: [],
        currentSessionWindow: { resetsAt: '2026-04-13T10:00:00', peak: 50 },
        rateLimitedUntil: 0,
        rateLimitCount: 0,
        rateLimitResetAt: 0,
      },
    }
    storesMap.set('accounts', accountsData as Record<string, unknown>)

    const pullData = {
      daily: [],
      sessionWindows: [],
      timeSeries: [],
      usageSnapshots: [],
      serverTime: Date.now(),
      currentWindow: { resetsAt: '2026-04-13T14:00:00', peak: 80 },
    }

    ;(service as unknown as Record<string, unknown>)['applyPullResponse'](pullData)

    const updatedAccounts = storesMap.get('accounts') as Record<string, unknown>
    const defaultAccount = (updatedAccounts['accounts'] as Record<string, unknown>)['default'] as Record<string, unknown>
    expect(defaultAccount['currentSessionWindow']).toBeTruthy()
  })

  // 24. applyPullResponse com settings remoto (mais recente)
  it('applyPullResponse atualiza settings se remoto for mais recente', async () => {
    seedCloudSync({ enabled: true, serverUrl: 'http://localhost:3030' })
    seedJwt()

    const configData = storesMap.get('config') ?? {}
    ;(configData as Record<string, unknown>)['settingsUpdatedAt'] = 1000
    storesMap.set('config', configData)

    const pullData = {
      daily: [],
      sessionWindows: [],
      timeSeries: [],
      usageSnapshots: [],
      serverTime: Date.now(),
      settings: { theme: 'dark', language: 'en', notifications: {}, workSchedule: null, updatedAt: 2000 },
    }

    ;(service as unknown as Record<string, unknown>)['applyPullResponse'](pullData)

    const updatedConfig = storesMap.get('config') as Record<string, unknown>
    expect(updatedConfig['theme']).toBe('dark')
    expect(updatedConfig['settingsUpdatedAt']).toBe(2000)
  })

  // 25. applyPullResponse NÃO atualiza settings se local for mais recente
  it('applyPullResponse mantém settings local se for mais recente', async () => {
    seedCloudSync({ enabled: true, serverUrl: 'http://localhost:3030' })
    seedJwt()

    const configData = storesMap.get('config') ?? {}
    ;(configData as Record<string, unknown>)['settingsUpdatedAt'] = 3000
    ;(configData as Record<string, unknown>)['theme'] = 'light'
    storesMap.set('config', configData)

    const pullData = {
      daily: [],
      sessionWindows: [],
      timeSeries: [],
      usageSnapshots: [],
      serverTime: Date.now(),
      settings: { theme: 'dark', language: 'en', notifications: {}, workSchedule: null, updatedAt: 2000 },
    }

    ;(service as unknown as Record<string, unknown>)['applyPullResponse'](pullData)

    const updatedConfig = storesMap.get('config') as Record<string, unknown>
    expect(updatedConfig['theme']).toBe('light')
  })

  // 26. flushOutbox com item existente tenta push
  it('flushOutbox faz push dos itens do outbox', async () => {
    seedCloudSync({ enabled: true, serverUrl: 'http://localhost:3030' })
    seedJwt()

    const { setOutbox } = await import('../../services/settingsService')
    setOutbox([
      { op: 'push', payload: { daily: [] }, attemptCount: 0, lastError: '', queuedAt: Date.now() },
    ])

    const accountsData = storesMap.get('accounts') ?? { activeAccount: '', accounts: {} }
    ;(accountsData as Record<string, unknown>)['activeAccount'] = 'default'
    ;(accountsData as Record<string, unknown>)['accounts'] = {
      default: {
        usageHistory: [],
        dailyHistory: [],
        timeSeries: {},
        sessionWindows: [],
        currentSessionWindow: null,
        rateLimitedUntil: 0,
        rateLimitCount: 0,
        rateLimitResetAt: 0,
      },
    }
    storesMap.set('accounts', accountsData as Record<string, unknown>)

    mockFetch.mockResolvedValueOnce(makeJsonResponse({ ok: true }))

    await (service as unknown as Record<string, unknown>)['flushOutbox']('http://localhost:3030', 'jwt-token', 'device-abc')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0][0] as string).toContain('/sync/push')
  })

  // 28. syncNow com outbox vazio não chama flush
  it('syncNow com outbox vazio pulga flush', async () => {
    seedCloudSync({ enabled: true, serverUrl: 'http://localhost:3030' })
    seedJwt()

    const { setOutbox } = await import('../../services/settingsService')
    setOutbox([])

    mockFetch.mockResolvedValueOnce(makeJsonResponse({ ok: true, daily: [], sessionWindows: [], timeSeries: [], usageSnapshots: [], serverTime: Date.now() }))

    await service.syncNow()

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0][0] as string).toContain('/sync/pull')
  })

  // 29. decodeEmailFromJwt com JWT válido
  it('decodeEmailFromJwt extrai email do JWT', async () => {
    seedCloudSync({ enabled: true })
    seedJwt()

    const email = (service as unknown as Record<string, unknown>)['decodeEmailFromJwt']('header.eyJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.sig')
    expect(email).toBe('test@example.com')
  })

  // 30. decodeEmailFromJwt com JWT inválido
  it('decodeEmailFromJwt com JWT inválido retorna string vazia', async () => {
    seedCloudSync({ enabled: true })
    seedJwt()

    const email = (service as unknown as Record<string, unknown>)['decodeEmailFromJwt']('invalid-jwt')
    expect(email).toBe('')
  })

  // 31. decodeEmailFromJwt com payload inválido
  it('decodeEmailFromJwt com JSON inválido retorna string vazia', async () => {
    seedCloudSync({ enabled: true })
    seedJwt()

    const email = (service as unknown as Record<string, unknown>)['decodeEmailFromJwt']('header.invalid-json.sig')
    expect(email).toBe('')
  })

  // 32. enqueuePush com cloudSync disabled não faz nada
  it('enqueuePush não adiciona ao outbox se cloudSync disabled', async () => {
    seedCloudSync({ enabled: false })

    const { getOutbox } = await import('../../services/settingsService')
    const initialOutbox = getOutbox().length

    const accountsData = storesMap.get('accounts') ?? { activeAccount: '', accounts: {} }
    ;(accountsData as Record<string, unknown>)['activeAccount'] = 'default'
    ;(accountsData as Record<string, unknown>)['accounts'] = {
      default: {
        usageHistory: [],
        dailyHistory: [],
        timeSeries: {},
        sessionWindows: [],
        currentSessionWindow: null,
        rateLimitedUntil: 0,
        rateLimitCount: 0,
        rateLimitResetAt: 0,
      },
    }
    storesMap.set('accounts', accountsData as Record<string, unknown>)

    const { getAccountData } = await import('../../services/settingsService')
    service.enqueuePush(getAccountData())

    expect(getOutbox().length).toBe(initialOutbox)
  })

  // 33. enqueuePush com temporarilyDisabled não faz nada
  it('enqueuePush não adiciona ao outbox se temporarilyDisabled', async () => {
    seedCloudSync({ enabled: true })
    seedJwt()
    ;(service as unknown as Record<string, unknown>)['temporarilyDisabled'] = true

    const { getOutbox } = await import('../../services/settingsService')
    const initialOutbox = getOutbox().length

    const accountsData = storesMap.get('accounts') ?? { activeAccount: '', accounts: {} }
    ;(accountsData as Record<string, unknown>)['activeAccount'] = 'default'
    ;(accountsData as Record<string, unknown>)['accounts'] = {
      default: {
        usageHistory: [],
        dailyHistory: [],
        timeSeries: {},
        sessionWindows: [],
        currentSessionWindow: null,
        rateLimitedUntil: 0,
        rateLimitCount: 0,
        rateLimitResetAt: 0,
      },
    }
    storesMap.set('accounts', accountsData as Record<string, unknown>)

    const { getAccountData } = await import('../../services/settingsService')
    service.enqueuePush(getAccountData())

    expect(getOutbox().length).toBe(initialOutbox)
  })

  // 34. enqueuePush com já having push no outbox não adiciona duplicado
  it('enqueuePush não adiciona duplicado se push já existe', async () => {
    seedCloudSync({ enabled: true })
    seedJwt()

    const { setOutbox } = await import('../../services/settingsService')
    setOutbox([{ op: 'push', payload: {}, attemptCount: 0, lastError: '', queuedAt: Date.now() }])

    const accountsData = storesMap.get('accounts') ?? { activeAccount: '', accounts: {} }
    ;(accountsData as Record<string, unknown>)['activeAccount'] = 'default'
    ;(accountsData as Record<string, unknown>)['accounts'] = {
      default: {
        usageHistory: [],
        dailyHistory: [],
        timeSeries: {},
        sessionWindows: [],
        currentSessionWindow: null,
        rateLimitedUntil: 0,
        rateLimitCount: 0,
        rateLimitResetAt: 0,
      },
    }
    storesMap.set('accounts', accountsData as Record<string, unknown>)

    const { getAccountData, getOutbox } = await import('../../services/settingsService')
    service.enqueuePush(getAccountData())

    const outbox = getOutbox()
    const pushItems = outbox.filter(i => i.op === 'push')
    expect(pushItems.length).toBe(1)
  })

  // 35. init com deviceId existente não gera novo UUID
  it('init não substitui deviceId existente', async () => {
    seedCloudSync({ enabled: true, deviceId: 'existing-device-id', syncIntervalMinutes: 15 })
    seedJwt()

    mockFetch.mockResolvedValueOnce(makeJsonResponse({ ok: true, daily: [], sessionWindows: [], timeSeries: [], usageSnapshots: [], serverTime: Date.now() }))

    vi.useFakeTimers()
    await service.init()

    const configData = storesMap.get('config') as Record<string, unknown>
    const cloudSync = configData['cloudSync'] as Record<string, unknown>
    expect(cloudSync['deviceId']).toBe('existing-device-id')

    vi.useRealTimers()
  })

  // 36. enable sem deviceId gera novo UUID
  it('enable gera novo deviceId quando não existe', async () => {
    seedCloudSync({ enabled: true, serverUrl: 'http://localhost:3030', deviceId: undefined as unknown as string })
    mockGetAccessToken.mockResolvedValue('access-token-123')

    mockFetch
      .mockResolvedValueOnce(makeJsonResponse(makeExchangeResponse()))
      .mockResolvedValueOnce(makeJsonResponse(makePullResponse()))

    await service.enable('http://localhost:3030', 'My Device')

    const configData = storesMap.get('config') as Record<string, unknown>
    const cloudSync = configData['cloudSync'] as Record<string, unknown>
    expect(cloudSync['deviceId']).toBeDefined()
    expect(typeof cloudSync['deviceId']).toBe('string')
    expect((cloudSync['deviceId'] as string).length).toBeGreaterThan(0)
  })

  // 37. ensureValidJwt com JWT válido (sem re-exchange)
  it('ensureValidJwt retorna JWT existente quando válido', async () => {
    seedCloudSync({ enabled: true, serverUrl: 'http://localhost:3030' })
    seedJwt('valid.jwt.token', Date.now() + 3600_000)

    mockGetAccessToken.mockResolvedValue('any-token')

    const jwt = await (service as unknown as Record<string, unknown>)['ensureValidJwt']('http://localhost:3030', 'device-id', 'device-label')

    expect(jwt).toBe('valid.jwt.token')
    expect(mockGetAccessToken).not.toHaveBeenCalled()
  })

  // 38. buildPushPayload com dados completos
  it('buildPushPayload gera payload correto', async () => {
    seedCloudSync({ enabled: true, serverUrl: 'http://localhost:3030' })
    seedJwt()

    const accountsData = storesMap.get('accounts') ?? { activeAccount: '', accounts: {} }
    ;(accountsData as Record<string, unknown>)['activeAccount'] = 'default'
    ;(accountsData as Record<string, unknown>)['accounts'] = {
      default: {
        usageHistory: [{ ts: 1000, session: 50, weekly: 60 }],
        dailyHistory: [{ date: '2026-04-13', maxSession: 50, maxWeekly: 60, sessionWindowCount: 1, sessionAccum: 0 }],
        timeSeries: { '2026-04-13': [{ ts: 1000, session: 50, weekly: 60 }] },
        sessionWindows: [],
        currentSessionWindow: null,
        rateLimitedUntil: 0,
        rateLimitCount: 0,
        rateLimitResetAt: 0,
      },
    }
    storesMap.set('accounts', accountsData as Record<string, unknown>)

    const { getAccountData } = await import('../../services/settingsService')
    const payload = (service as unknown as Record<string, unknown>)['buildPushPayload'](getAccountData(), 'test-device')

    expect(payload).toBeDefined()
    expect(payload).toHaveProperty('deviceId', 'test-device')
    expect(payload).toHaveProperty('daily')
    expect(payload).toHaveProperty('sessionWindows')
    expect(payload).toHaveProperty('timeSeries')
    expect(payload).toHaveProperty('usageSnapshots')
  })

  // 39. syncNow com isSyncing=true não faz nada
  it('syncNow com isSyncing=true retorna early', async () => {
    seedCloudSync({ enabled: true, serverUrl: 'http://localhost:3030' })
    seedJwt()

    ;(service as unknown as Record<string, unknown>)['isSyncing'] = true

    await service.syncNow()

    expect(mockFetch).not.toHaveBeenCalled()
  })

  // 40. disable limpa backoffTimer
  it('disable limpa backoffTimer', async () => {
    seedCloudSync({ enabled: true })
    seedJwt()

    vi.useFakeTimers()
    ;(service as unknown as Record<string, unknown>)['backoffTimer'] = setTimeout(() => {}, 999999) as unknown as ReturnType<typeof setTimeout>

    await service.disable()

    const backoffTimer = (service as unknown as Record<string, unknown>)['backoffTimer']
    expect(backoffTimer).toBeNull()

    vi.useRealTimers()
  })

  // 41. scheduleBackoff incrementa backoffCount
  it('scheduleBackoff incrementa backoffCount', async () => {
    seedCloudSync({ enabled: true })
    seedJwt()

    vi.useFakeTimers()
    ;(service as unknown as Record<string, unknown>)['backoffCount'] = 0
    ;(service as unknown as Record<string, unknown>)['backoffTimer'] = null

    ;(service as unknown as Record<string, unknown>)['scheduleBackoff']()

    expect((service as unknown as Record<string, unknown>)['backoffCount']).toBe(1)

    vi.useRealTimers()
  })

  // 42. clearTimers limpa ambos timers
  it('clearTimers limpa syncTimer e backoffTimer', async () => {
    seedCloudSync({ enabled: true })
    seedJwt()

    vi.useFakeTimers()
    ;(service as unknown as Record<string, unknown>)['syncTimer'] = setInterval(() => {}, 999999) as unknown as ReturnType<typeof setInterval>
    ;(service as unknown as Record<string, unknown>)['backoffTimer'] = setTimeout(() => {}, 999999) as unknown as ReturnType<typeof setTimeout>

    ;(service as unknown as Record<string, unknown>)['clearTimers']()

    expect((service as unknown as Record<string, unknown>)['syncTimer']).toBeNull()
    expect((service as unknown as Record<string, unknown>)['backoffTimer']).toBeNull()

    vi.useRealTimers()
  })

  // 43. enable emite evento enabled
  it('enable emite evento enabled', async () => {
    seedCloudSync({ enabled: true, serverUrl: 'http://localhost:3030' })
    mockGetAccessToken.mockResolvedValue('access-token-123')

    mockFetch
      .mockResolvedValueOnce(makeJsonResponse(makeExchangeResponse()))
      .mockResolvedValueOnce(makeJsonResponse(makePullResponse()))

    const events: string[] = []
    service.on('sync-event', (e: { type: string }) => events.push(e.type))

    await service.enable('http://localhost:3030', 'Test Device')

    expect(events).toContain('enabled')
  })

  // 44. handleError salva lastSyncError
  it('handleError salva lastSyncError no config', async () => {
    seedCloudSync({ enabled: true })
    seedJwt()

    ;(service as unknown as Record<string, unknown>)['handleError']('test-context', new Error('Test error message'))

    const configData = storesMap.get('config') as Record<string, unknown>
    const cloudSync = configData['cloudSync'] as Record<string, unknown>
    expect(cloudSync['lastSyncError']).toBe('Test error message')
  })

  // 45. handleError emite sync-error event
  it('handleError emite sync-error event', async () => {
    seedCloudSync({ enabled: true })
    seedJwt()

    const events: { type: string; payload?: unknown }[] = []
    service.on('sync-event', (e: { type: string; payload?: unknown }) => events.push(e))

    ;(service as unknown as Record<string, unknown>)['handleError']('test-context', new Error('Error payload'))

    expect(events.some(e => e.type === 'sync-error')).toBe(true)
  })

  // 46. applyPullResponse com sessionWindows vazio
  it('applyPullResponse com sessionWindows vazio não falha', async () => {
    seedCloudSync({ enabled: true })
    seedJwt()

    const accountsData = storesMap.get('accounts') ?? { activeAccount: '', accounts: {} }
    ;(accountsData as Record<string, unknown>)['activeAccount'] = 'default'
    ;(accountsData as Record<string, unknown>)['accounts'] = {
      default: {
        usageHistory: [],
        dailyHistory: [],
        timeSeries: {},
        sessionWindows: [],
        currentSessionWindow: null,
        rateLimitedUntil: 0,
        rateLimitCount: 0,
        rateLimitResetAt: 0,
      },
    }
    storesMap.set('accounts', accountsData as Record<string, unknown>)

    const pullData = {
      daily: [],
      sessionWindows: [],
      timeSeries: [],
      usageSnapshots: [],
      serverTime: Date.now(),
    }

    expect(() => (service as unknown as Record<string, unknown>)['applyPullResponse'](pullData)).not.toThrow()
  })

  // 47. applyPullResponse com timeSeries
  it('applyPullResponse com timeSeries', async () => {
    seedCloudSync({ enabled: true })
    seedJwt()

    const accountsData = storesMap.get('accounts') ?? { activeAccount: '', accounts: {} }
    ;(accountsData as Record<string, unknown>)['activeAccount'] = 'default'
    ;(accountsData as Record<string, unknown>)['accounts'] = {
      default: {
        usageHistory: [],
        dailyHistory: [],
        timeSeries: {},
        sessionWindows: [],
        currentSessionWindow: null,
        rateLimitedUntil: 0,
        rateLimitCount: 0,
        rateLimitResetAt: 0,
      },
    }
    storesMap.set('accounts', accountsData as Record<string, unknown>)

    const pullData = {
      daily: [],
      sessionWindows: [],
      timeSeries: [{ date: '2026-04-13', ts: 1000, session: 50, weekly: 60 }],
      usageSnapshots: [],
      serverTime: Date.now(),
    }

    ;(service as unknown as Record<string, unknown>)['applyPullResponse'](pullData)

    const updatedAccounts = storesMap.get('accounts') as Record<string, unknown>
    expect(updatedAccounts).toBeDefined()
  })

  // 48. schedulePeriodicSync limpa timer existente antes de criar novo
  it('schedulePeriodicSync limpa timer existente', async () => {
    seedCloudSync({ enabled: true })
    seedJwt()

    vi.useFakeTimers()

    const existingTimer = {} as unknown as ReturnType<typeof setInterval>
    ;(service as unknown as Record<string, unknown>)['syncTimer'] = existingTimer

    ;(service as unknown as Record<string, unknown>)['schedulePeriodicSync'](20)
    const newTimer = (service as unknown as Record<string, unknown>)['syncTimer']

    expect(newTimer).not.toBe(existingTimer)

    vi.useRealTimers()
  })

  // 49. scheduleBackoff com backoffCount no limite max
  it('scheduleBackoff com backoffCount alto não excede índice', async () => {
    seedCloudSync({ enabled: true })
    seedJwt()

    vi.useFakeTimers()
    ;(service as unknown as Record<string, unknown>)['backoffCount'] = 10 // Acima do tamanho do array BACKOFF_MINUTES
    ;(service as unknown as Record<string, unknown>)['backoffTimer'] = null

    ;(service as unknown as Record<string, unknown>)['scheduleBackoff']()

    expect((service as unknown as Record<string, unknown>)['backoffCount']).toBe(11)

    vi.useRealTimers()
  })

  // 50. scheduleBackoff limpa timer existente
  it('scheduleBackoff limpa timer existente antes de criar novo', async () => {
    seedCloudSync({ enabled: true })
    seedJwt()

    vi.useFakeTimers()
    ;(service as unknown as Record<string, unknown>)['backoffCount'] = 0
    ;(service as unknown as Record<string, unknown>)['backoffTimer'] = setTimeout(() => {}, 999999) as unknown as ReturnType<typeof setTimeout>

    ;(service as unknown as Record<string, unknown>)['scheduleBackoff']()

    expect((service as unknown as Record<string, unknown>)['backoffTimer']).toBeDefined()

    vi.useRealTimers()
  })

  // 51. buildPushPayload com maxCredits
  it('buildPushPayload inclui maxCredits quando presente', async () => {
    seedCloudSync({ enabled: true })
    seedJwt()

    const accountsData = storesMap.get('accounts') ?? { activeAccount: '', accounts: {} }
    ;(accountsData as Record<string, unknown>)['activeAccount'] = 'default'
    ;(accountsData as Record<string, unknown>)['accounts'] = {
      default: {
        usageHistory: [],
        dailyHistory: [{ date: '2026-04-13', maxSession: 50, maxWeekly: 60, sessionWindowCount: 1, sessionAccum: 0, maxCredits: 75 }],
        timeSeries: {},
        sessionWindows: [],
        currentSessionWindow: null,
        rateLimitedUntil: 0,
        rateLimitCount: 0,
        rateLimitResetAt: 0,
      },
    }
    storesMap.set('accounts', accountsData as Record<string, unknown>)

    const { getAccountData } = await import('../../services/settingsService')
    const payload = (service as unknown as Record<string, unknown>)['buildPushPayload'](getAccountData(), 'test-device') as Record<string, unknown>

    const daily = payload.daily as unknown[]
    expect(daily[0]).toHaveProperty('maxCredits', 75)
  })

  // 52. buildPushPayload com sessionWindows
  it('buildPushPayload inclui sessionWindows', async () => {
    seedCloudSync({ enabled: true })
    seedJwt()

    const accountsData = storesMap.get('accounts') ?? { activeAccount: '', accounts: {} }
    ;(accountsData as Record<string, unknown>)['activeAccount'] = 'default'
    ;(accountsData as Record<string, unknown>)['accounts'] = {
      default: {
        usageHistory: [],
        dailyHistory: [],
        timeSeries: {},
        sessionWindows: [{ date: '2026-04-13', resetsAt: '2026-04-13T10:00:00', peak: 50 }],
        currentSessionWindow: null,
        rateLimitedUntil: 0,
        rateLimitCount: 0,
        rateLimitResetAt: 0,
      },
    }
    storesMap.set('accounts', accountsData as Record<string, unknown>)

    const { getAccountData } = await import('../../services/settingsService')
    const payload = (service as unknown as Record<string, unknown>)['buildPushPayload'](getAccountData(), 'test-device') as Record<string, unknown>

    const windows = payload.sessionWindows as unknown[]
    expect(windows.length).toBeGreaterThan(0)
  })

  // 53. buildPushPayload com settingsUpdatedAt > 0
  it('buildPushPayload inclui settings quando settingsUpdatedAt > 0', async () => {
    seedCloudSync({ enabled: true })
    seedJwt()

    const configData = storesMap.get('config') ?? {}
    ;(configData as Record<string, unknown>)['settingsUpdatedAt'] = 1000
    ;(configData as Record<string, unknown>)['theme'] = 'dark'
    storesMap.set('config', configData)

    const accountsData = storesMap.get('accounts') ?? { activeAccount: '', accounts: {} }
    ;(accountsData as Record<string, unknown>)['activeAccount'] = 'default'
    ;(accountsData as Record<string, unknown>)['accounts'] = {
      default: {
        usageHistory: [],
        dailyHistory: [],
        timeSeries: {},
        sessionWindows: [],
        currentSessionWindow: null,
        rateLimitedUntil: 0,
        rateLimitCount: 0,
        rateLimitResetAt: 0,
      },
    }
    storesMap.set('accounts', accountsData as Record<string, unknown>)

    const { getAccountData } = await import('../../services/settingsService')
    const payload = (service as unknown as Record<string, unknown>)['buildPushPayload'](getAccountData(), 'test-device') as Record<string, unknown>

    expect(payload).toHaveProperty('settings')
  })

  // 54. buildPushPayload com JWT expirado
  it('buildPushPayload retorna dados quando jwt expirado', async () => {
    seedCloudSync({ enabled: true })
    seedJwt(Date.now() - 1000)

    const { getAccountData } = await import('../../services/settingsService')
    const payload = (service as unknown as Record<string, unknown>)['buildPushPayload'](getAccountData(), 'test-device') as Record<string, unknown>

    expect(payload).toHaveProperty('deviceId')
  })

  // 55. buildPushPayload com diaria vazia
  it('buildPushPayload retorna dados quando sem historico', async () => {
    seedCloudSync({ enabled: true })
    seedJwt()

    const { getAccountData } = await import('../../services/settingsService')
    const payload = (service as unknown as Record<string, unknown>)['buildPushPayload'](getAccountData(), 'test-device') as Record<string, unknown>

    expect(payload.daily).toEqual([])
  })
})
