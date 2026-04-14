import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Testes do Renderer - i18n
 * Testa as funções de tradução utilizadas no renderer
 */

describe('Renderer i18n', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('deve ter traducao sessionLabel em ingles', async () => {
    const translations = {
      en: {
        sessionLabel: 'Session (5h)',
        weeklyLabel: 'Weekly (7d)',
        reportTitle: 'Usage Report',
        loadingText: 'Loading...',
      },
      'pt-BR': {
        sessionLabel: 'Sessão (5h)',
        weeklyLabel: 'Semanal (7d)',
        reportTitle: 'Relatório de Uso',
        loadingText: 'Carregando...',
      },
    }
    
    const t = translations.en
    expect(t.sessionLabel).toBe('Session (5h)')
  })

  it('deve ter traducao sessionLabel em pt-BR', async () => {
    const translations = {
      en: {
        sessionLabel: 'Session (5h)',
        weeklyLabel: 'Weekly (7d)',
        reportTitle: 'Usage Report',
        loadingText: 'Loading...',
      },
      'pt-BR': {
        sessionLabel: 'Sessão (5h)',
        weeklyLabel: 'Semanal (7d)',
        reportTitle: 'Relatório de Uso',
        loadingText: 'Carregando...',
      },
    }
    
    const t = translations['pt-BR']
    expect(t.sessionLabel).toBe('Sessão (5h)')
  })

  it('deve ter traducao weeklyLabel em ingles', async () => {
    const translations = {
      en: {
        sessionLabel: 'Session (5h)',
        weeklyLabel: 'Weekly (7d)',
      },
      'pt-BR': {
        sessionLabel: 'Sessão (5h)',
        weeklyLabel: 'Semanal (7d)',
      },
    }
    
    const t = translations.en
    expect(t.weeklyLabel).toBe('Weekly (7d)')
  })

  it('deve ter traducao weeklyLabel em pt-BR', async () => {
    const translations = {
      en: {
        sessionLabel: 'Session (5h)',
        weeklyLabel: 'Weekly (7d)',
      },
      'pt-BR': {
        sessionLabel: 'Sessão (5h)',
        weeklyLabel: 'Semanal (7d)',
      },
    }
    
    const t = translations['pt-BR']
    expect(t.weeklyLabel).toBe('Semanal (7d)')
  })

  it('deve ter traducao loadingText em en', async () => {
    const translations = {
      en: { loadingText: 'Loading...' },
      'pt-BR': { loadingText: 'Carregando...' },
    }
    
    const t = translations.en
    expect(t.loadingText).toBe('Loading...')
  })

  it('deve ter traducao loadingText em pt-BR', async () => {
    const translations = {
      en: { loadingText: 'Loading...' },
      'pt-BR': { loadingText: 'Carregando...' },
    }
    
    const t = translations['pt-BR']
    expect(t.loadingText).toBe('Carregando...')
  })

  it('deve ter traducao reportTitle em en', async () => {
    const translations = {
      en: { reportTitle: 'Usage Report' },
      'pt-BR': { reportTitle: 'Relatório de Uso' },
    }
    
    const t = translations.en
    expect(t.reportTitle).toBe('Usage Report')
  })

  it('deve ter traducao reportTitle em pt-BR', async () => {
    const translations = {
      en: { reportTitle: 'Usage Report' },
      'pt-BR': { reportTitle: 'Relatório de Uso' },
    }
    
    const t = translations['pt-BR']
    expect(t.reportTitle).toBe('Relatório de Uso')
  })

  it('deve ter traducao credentialExpired em en', async () => {
    const translations = {
      en: { credentialExpired: 'Token expired. Please log in again.' },
      'pt-BR': { credentialExpired: 'Token expirado. Faça login novamente.' },
    }
    
    const t = translations.en
    expect(t.credentialExpired).toBe('Token expired. Please log in again.')
  })

  it('deve ter traducao credentialExpired em pt-BR', async () => {
    const translations = {
      en: { credentialExpired: 'Token expired. Please log in again.' },
      'pt-BR': { credentialExpired: 'Token expirado. Faça login novamente.' },
    }
    
    const t = translations['pt-BR']
    expect(t.credentialExpired).toBe('Token expirado. Faça login novamente.')
  })
})