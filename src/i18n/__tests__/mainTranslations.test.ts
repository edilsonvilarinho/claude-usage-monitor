import { describe, it, expect } from 'vitest'
import { getMainTranslations } from '../mainTranslations'

describe('getMainTranslations', () => {
  it('returns English strings for "en"', () => {
    const t = getMainTranslations('en')
    expect(t.notifTestTitle).toBe('Claude — Test Notification')
    expect(t.notifTestBody).toBe('Notifications are working correctly')
    expect(t.trayRefreshNow).toBe('Refresh Now')
    expect(t.trayLaunchAtStartup).toBe('Launch at Startup')
    expect(t.trayExit).toBe('Exit')
    expect(t.trayInitialTooltip).toBe('Claude Usage Monitor')
  })

  it('returns pt-BR strings for "pt-BR"', () => {
    const t = getMainTranslations('pt-BR')
    expect(t.notifTestTitle).toBe('Claude — Notificação de Teste')
    expect(t.notifTestBody).toBe('As notificações estão funcionando corretamente')
    expect(t.trayRefreshNow).toBe('Atualizar Agora')
    expect(t.trayLaunchAtStartup).toBe('Iniciar com o sistema')
    expect(t.trayExit).toBe('Sair')
  })

  it('falls back to English for undefined lang', () => {
    const t = getMainTranslations(undefined)
    expect(t.trayRefreshNow).toBe('Refresh Now')
    expect(t.trayExit).toBe('Exit')
  })

  it('falls back to English for unknown language code', () => {
    const t = getMainTranslations('fr')
    expect(t.trayRefreshNow).toBe('Refresh Now')
    expect(t.trayExit).toBe('Exit')
  })

  it('English function strings interpolate correctly', () => {
    const t = getMainTranslations('en')
    expect(t.notifSessionFreedBody(30)).toBe('Session usage dropped to 30% — limit has reset')
    expect(t.notifWeeklyFreedBody(45)).toBe('Weekly usage dropped to 45% — limit has reset')
    expect(t.notifSessionWarnBody(85, 80)).toBe('Session usage is at 85% (80% threshold reached)')
    expect(t.notifWeeklyWarnBody(90, 80)).toBe('Weekly usage is at 90% (80% threshold reached)')
    expect(t.trayTooltipLine1('55', '33')).toBe('Claude Usage — Session: 55% | Weekly: 33%')
    expect(t.trayTooltipLine2('4h 30m', '2d 10h')).toBe('Session resets in: 4h 30m | Weekly resets in: 2d 10h')
  })

  it('pt-BR function strings interpolate correctly', () => {
    const t = getMainTranslations('pt-BR')
    expect(t.notifSessionFreedBody(30)).toBe('Uso da sessão caiu para 30% — limite foi liberado')
    expect(t.notifWeeklyFreedBody(45)).toBe('Uso semanal caiu para 45% — limite foi liberado')
    expect(t.notifSessionWarnBody(85, 80)).toBe('Uso da sessão em 85% (limite de 80% atingido)')
    expect(t.notifWeeklyWarnBody(90, 80)).toBe('Uso semanal em 90% (limite de 80% atingido)')
    expect(t.trayTooltipLine1('55', '33')).toBe('Claude Usage — Sessão: 55% | Semanal: 33%')
    expect(t.trayTooltipLine2('4h 30m', '2d 10h')).toBe('Sessão reinicia em: 4h 30m | Semana reinicia em: 2d 10h')
  })

  it('has all required keys for "en"', () => {
    const t = getMainTranslations('en')
    const requiredKeys: (keyof typeof t)[] = [
      'notifTestTitle', 'notifTestBody',
      'notifSessionWindowResetTitle', 'notifSessionWindowResetBody',
      'notifWeeklyWindowResetTitle', 'notifWeeklyWindowResetBody',
      'notifSessionFreedTitle', 'notifSessionFreedBody',
      'notifWeeklyFreedTitle', 'notifWeeklyFreedBody',
      'notifSessionWarnTitle', 'notifSessionWarnBody',
      'notifWeeklyWarnTitle', 'notifWeeklyWarnBody',
      'trayInitialTooltip', 'trayTooltipLine1', 'trayTooltipLine2',
      'trayRefreshNow', 'trayLaunchAtStartup', 'trayExit',
    ]
    for (const key of requiredKeys) {
      expect(t[key]).toBeDefined()
    }
  })

  it('has all required keys for "pt-BR"', () => {
    const t = getMainTranslations('pt-BR')
    const requiredKeys: (keyof typeof t)[] = [
      'notifTestTitle', 'notifTestBody',
      'notifSessionWindowResetTitle', 'notifSessionWindowResetBody',
      'notifWeeklyWindowResetTitle', 'notifWeeklyWindowResetBody',
      'notifSessionFreedTitle', 'notifSessionFreedBody',
      'notifWeeklyFreedTitle', 'notifWeeklyFreedBody',
      'notifSessionWarnTitle', 'notifSessionWarnBody',
      'notifWeeklyWarnTitle', 'notifWeeklyWarnBody',
      'trayInitialTooltip', 'trayTooltipLine1', 'trayTooltipLine2',
      'trayRefreshNow', 'trayLaunchAtStartup', 'trayExit',
    ]
    for (const key of requiredKeys) {
      expect(t[key]).toBeDefined()
    }
  })
})
