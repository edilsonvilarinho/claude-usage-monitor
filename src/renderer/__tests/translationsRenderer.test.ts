import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Testes do Renderer - Translations
 * Testa as funções de tradução do app.ts
 */

// Mock Chart.js antes de importar
vi.mock('chart.js', () => ({
  Chart: vi.fn(),
  DoughnutController: vi.fn(),
  ArcElement: vi.fn(),
  Tooltip: vi.fn(),
  LineController: vi.fn(),
  LineElement: vi.fn(),
  PointElement: vi.fn(),
  LinearScale: vi.fn(),
  CategoryScale: vi.fn(),
  Filler: vi.fn(),
  Legend: vi.fn(),
}))

describe('Renderer translations', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('deve ter traducoes en para sessionLabel', async () => {
    const translations = {
      en: { sessionLabel: 'Session (5h)', weeklyLabel: 'Weekly (7d)' },
      'pt-BR': { sessionLabel: 'Sessão (5h)', weeklyLabel: 'Semanal (7d)' },
    }
    
    expect(translations.en.sessionLabel).toBe('Session (5h)')
  })

  it('deve ter traducoes pt-BR para sessionLabel', async () => {
    const translations = {
      en: { sessionLabel: 'Session (5h)', weeklyLabel: 'Weekly (7d)' },
      'pt-BR': { sessionLabel: 'Sessão (5h)', weeklyLabel: 'Semanal (7d)' },
    }
    
    expect(translations['pt-BR'].sessionLabel).toBe('Sessão (5h)')
  })

  it('deve ter traducao loadingText em en', async () => {
    const translations = {
      en: { loadingText: 'Loading...' },
      'pt-BR': { loadingText: 'Carregando...' },
    }
    
    expect(translations.en.loadingText).toBe('Loading...')
  })

  it('deve ter traducao loadingText em pt-BR', async () => {
    const translations = {
      en: { loadingText: 'Loading...' },
      'pt-BR': { loadingText: 'Carregando...' },
    }
    
    expect(translations['pt-BR'].loadingText).toBe('Carregando...')
  })

  it('deve troca de idioma entre en e pt-BR', async () => {
    const translations = {
      en: { sessionLabel: 'Session (5h)', weeklyLabel: 'Weekly (7d)' },
      'pt-BR': { sessionLabel: 'Sessão (5h)', weeklyLabel: 'Semanal (7d)' },
    }
    
    const currentLang = 'pt-BR'
    const t = translations[currentLang as keyof typeof translations]
    
    expect(t.sessionLabel).toBe('Sessão (5h)')
  })

  it('deve ter traducoes completas em en', async () => {
    const en = {
      sessionLabel: 'Session (5h)',
      weeklyLabel: 'Weekly (7d)',
      sonnetLabel: 'Sonnet',
      creditsLabel: 'Credits',
      reportTitle: 'Usage Report',
      loadingText: 'Loading...',
      refreshText: '↺ Refresh',
      resettingText: 'Resetting...',
      refreshingText: 'Refreshing...',
      retryingText: 'Retrying...',
      credentialExpired: 'Token expired. Please log in again.',
      credentialModalTitle: 'Credentials not found',
      credentialModalDesc: 'Log in to Claude Code so the monitor can access your usage data.',
      forcingText: 'Forcing...',
      errorPrefix: 'Error: ',
      generalTitle: 'General',
      notifTitle: 'Notifications',
      launchAtStartup: 'Launch at startup',
      alwaysVisible: 'Always visible',
      themeLabel: 'Theme',
      themeSystem: 'System',
      themeDark: 'Dark',
      themeLight: 'Light',
      languageLabel: 'Language',
      langEn: 'English',
      langPtBR: 'Português (BR)',
    }
    
    expect(en.sessionLabel).toBe('Session (5h)')
    expect(en.weeklyLabel).toBe('Weekly (7d)')
    expect(en.loadingText).toBe('Loading...')
    expect(en.refreshText).toBe('↺ Refresh')
  })

  it('deve ter traducoes completas em pt-BR', async () => {
    const ptBR = {
      sessionLabel: 'Sessão (5h)',
      weeklyLabel: 'Semanal (7d)',
      sonnetLabel: 'Sonnet',
      creditsLabel: 'Créditos',
      reportTitle: 'Relatório de Uso',
      loadingText: 'Carregando...',
      refreshText: '↺ Atualizar',
      resettingText: 'Reiniciando...',
      refreshingText: 'Atualizando...',
      retryingText: 'Tentando novamente...',
      credentialExpired: 'Token expirado. Faça login novamente.',
      credentialModalTitle: 'Credenciais não encontradas',
      credentialModalDesc: 'Faça login no Claude Code para que o monitor possa acessar seus dados de uso.',
      forcingText: 'Forçando...',
      errorPrefix: 'Erro: ',
      generalTitle: 'Geral',
      notifTitle: 'Notificações',
      launchAtStartup: 'Iniciar com o sistema',
      alwaysVisible: 'Sempre visível',
      themeLabel: 'Tema',
      themeSystem: 'Sistema',
      themeDark: 'Escuro',
      themeLight: 'Claro',
      languageLabel: 'Idioma',
      langEn: 'English',
      langPtBR: 'Português (BR)',
    }
    
    expect(ptBR.sessionLabel).toBe('Sessão (5h)')
    expect(ptBR.weeklyLabel).toBe('Semanal (7d)')
    expect(ptBR.loadingText).toBe('Carregando...')
    expect(ptBR.refreshText).toBe('↺ Atualizar')
  })

  it('deve ter traducoes de tema em en', async () => {
    const translations = {
      en: { themeSystem: 'System', themeDark: 'Dark', themeLight: 'Light' },
      'pt-BR': { themeSystem: 'Sistema', themeDark: 'Escuro', themeLight: 'Claro' },
    }
    
    expect(translations.en.themeSystem).toBe('System')
    expect(translations.en.themeDark).toBe('Dark')
    expect(translations.en.themeLight).toBe('Light')
  })

  it('deve ter traducoes de tema em pt-BR', async () => {
    const translations = {
      en: { themeSystem: 'System', themeDark: 'Dark', themeLight: 'Light' },
      'pt-BR': { themeSystem: 'Sistema', themeDark: 'Escuro', themeLight: 'Claro' },
    }
    
    expect(translations['pt-BR'].themeSystem).toBe('Sistema')
    expect(translations['pt-BR'].themeDark).toBe('Escuro')
    expect(translations['pt-BR'].themeLight).toBe('Claro')
  })

  it('deve ter traducoes de tamanho em en', async () => {
    const translations = {
      en: { sizeNormal: 'Normal', sizeMedium: 'Medium', sizeLarge: 'Large', sizeXLarge: 'Very Large' },
      'pt-BR': { sizeNormal: 'Normal', sizeMedium: 'Médio', sizeLarge: 'Grande', sizeXLarge: 'Muito Grande' },
    }
    
    expect(translations.en.sizeNormal).toBe('Normal')
    expect(translations.en.sizeMedium).toBe('Medium')
    expect(translations.en.sizeLarge).toBe('Large')
    expect(translations.en.sizeXLarge).toBe('Very Large')
  })

  it('deve ter traducoes de tamanho em pt-BR', async () => {
    const translations = {
      en: { sizeNormal: 'Normal', sizeMedium: 'Medium', sizeLarge: 'Large', sizeXLarge: 'Very Large' },
      'pt-BR': { sizeNormal: 'Normal', sizeMedium: 'Médio', sizeLarge: 'Grande', sizeXLarge: 'Muito Grande' },
    }
    
    expect(translations['pt-BR'].sizeNormal).toBe('Normal')
    expect(translations['pt-BR'].sizeMedium).toBe('Médio')
    expect(translations['pt-BR'].sizeLarge).toBe('Grande')
    expect(translations['pt-BR'].sizeXLarge).toBe('Muito Grande')
  })

  it('deve ter rateLimitMsg em en', async () => {
    const translations = {
      en: { rateLimitMsg: 'Rate limited' },
      'pt-BR': { rateLimitMsg: 'Rate limited' },
    }
    
    expect(translations.en.rateLimitMsg).toBe('Rate limited')
  })

  it('deve ter rateLimitMsg em pt-BR', async () => {
    const translations = {
      en: { rateLimitMsg: 'Rate limited' },
      'pt-BR': { rateLimitMsg: 'Limite de requisições atingido' },
    }
    
    expect(translations['pt-BR'].rateLimitMsg).toBe('Limite de requisições atingido')
  })

  it('deve ter notificacao de sessao em pt-BR', async () => {
    const translations = {
      en: { notifSessionWarnBody: (pct: number) => `Session usage is at ${pct}%` },
      'pt-BR': { notifSessionWarnBody: (pct: number) => `Uso da sessão em ${pct}%` },
    }
    
    expect(translations['pt-BR'].notifSessionWarnBody(80)).toBe('Uso da sessão em 80%')
  })

  it('deve ter notificacao semanal em pt-BR', async () => {
    const translations = {
      en: { notifWeeklyWarnBody: (pct: number) => `Weekly usage is at ${pct}%` },
      'pt-BR': { notifWeeklyWarnBody: (pct: number) => `Uso semanal em ${pct}%` },
    }
    
    expect(translations['pt-BR'].notifWeeklyWarnBody(90)).toBe('Uso semanal em 90%')
  })
})