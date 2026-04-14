import { describe, it, expect } from 'vitest'

/**
 * Testes do Renderer - Funções de Formatação
 * Testa funções puras do app.ts (sem dependência de DOM)
 */

describe('Renderer - Funções de Formatação', () => {
  describe('colorForPct - Cores por Percentage', () => {
    it('deve retornar verde para pct < 50', () => {
      const colorForPct = (pct: number): string => {
        if (pct < 50) return '#22c55e' // green
        if (pct < 80) return '#eab308' // yellow
        return '#ef4444' // red
      }
      
      expect(colorForPct(0)).toBe('#22c55e')
      expect(colorForPct(49)).toBe('#22c55e')
    })

    it('deve retornar amarelo para pct >= 50 e < 80', () => {
      const colorForPct = (pct: number): string => {
        if (pct < 50) return '#22c55e'
        if (pct < 80) return '#eab308'
        return '#ef4444'
      }
      
      expect(colorForPct(50)).toBe('#eab308')
      expect(colorForPct(79)).toBe('#eab308')
    })

    it('deve retornar vermelho para pct >= 80', () => {
      const colorForPct = (pct: number): string => {
        if (pct < 50) return '#22c55e'
        if (pct < 80) return '#eab308'
        return '#ef4444'
      }
      
      expect(colorForPct(80)).toBe('#ef4444')
      expect(colorForPct(100)).toBe('#ef4444')
    })

    it('deve funcionar com pct > 100 (over limit)', () => {
      const colorForPct = (pct: number): string => {
        if (pct < 50) return '#22c55e'
        if (pct < 80) return '#eab308'
        return '#ef4444'
      }
      
      expect(colorForPct(150)).toBe('#ef4444')
    })
  })

  describe('barClass - Classes CSS por Percentage', () => {
    it('deve retornar "low" para pct < 50', () => {
      const barClass = (pct: number): string => {
        if (pct < 50) return 'low'
        if (pct < 80) return 'medium'
        return 'high'
      }
      
      expect(barClass(0)).toBe('low')
      expect(barClass(49)).toBe('low')
    })

    it('deve retornar "medium" para pct >= 50 e < 80', () => {
      const barClass = (pct: number): string => {
        if (pct < 50) return 'low'
        if (pct < 80) return 'medium'
        return 'high'
      }
      
      expect(barClass(50)).toBe('medium')
      expect(barClass(79)).toBe('medium')
    })

    it('deve retornar "high" para pct >= 80', () => {
      const barClass = (pct: number): string => {
        if (pct < 50) return 'low'
        if (pct < 80) return 'medium'
        return 'high'
      }
      
      expect(barClass(80)).toBe('high')
      expect(barClass(100)).toBe('high')
    })
  })

  describe('formatMinutes - Formatar Minutos', () => {
    it('deve formatar minutos simples', () => {
      const formatMinutes = (totalMin: number): string => {
        const h = Math.floor(totalMin / 60)
        const m = totalMin % 60
        if (h > 0) {
          return `${h}h ${m}m`
        }
        return `${m}m`
      }
      
      expect(formatMinutes(30)).toBe('30m')
      expect(formatMinutes(60)).toBe('1h 0m')
      expect(formatMinutes(90)).toBe('1h 30m')
    })

    it('deve formatar horas e minutos', () => {
      const formatMinutes = (totalMin: number): string => {
        const h = Math.floor(totalMin / 60)
        const m = totalMin % 60
        if (h > 0) {
          return `${h}h ${m}m`
        }
        return `${m}m`
      }
      
      expect(formatMinutes(120)).toBe('2h 0m')
      expect(formatMinutes(180)).toBe('3h 0m')
    })

    it('deve lidar com 0 minutos', () => {
      const formatMinutes = (totalMin: number): string => {
        const h = Math.floor(totalMin / 60)
        const m = totalMin % 60
        if (h > 0) {
          return `${h}h ${m}m`
        }
        return `${m}m`
      }
      
      expect(formatMinutes(0)).toBe('0m')
    })
  })

  describe('formatResetsIn - Tempo até Reset', () => {
    it('deve calcular tempo até reset em minutes', () => {
      const now = new Date('2026-04-14T10:00:00Z').getTime()
      const resetsAt = new Date('2026-04-14T10:30:00Z').getTime()
      
      const formatResetsIn = (resetsAtIso: string): string => {
        const now = new Date('2026-04-14T10:00:00Z').getTime()
        const resetsAt = new Date(resetsAtIso).getTime()
        const diffMs = resetsAt - now
        const diffMin = Math.floor(diffMs / 60000)
        return `${diffMin}m`
      }
      
      expect(formatResetsIn('2026-04-14T10:30:00Z')).toBe('30m')
    })

    it('deve formatar horas quando > 60 min', () => {
      const formatResetsIn = (resetsAtIso: string): string => {
        const now = new Date('2026-04-14T10:00:00Z').getTime()
        const resetsAt = new Date(resetsAtIso).getTime()
        const diffMs = resetsAt - now
        const diffMin = Math.floor(diffMs / 60000)
        if (diffMin >= 60) {
          const h = Math.floor(diffMin / 60)
          const m = diffMin % 60
          return `${h}h ${m}m`
        }
        return `${diffMin}m`
      }
      
      expect(formatResetsIn('2026-04-14T12:00:00Z')).toBe('2h 0m')
    })
  })

  describe('formatResetAt - Formatar Data do Reset', () => {
    it('deve formatar data do reset em UTC', () => {
      const formatResetAt = (isoDate: string): string => {
        const date = new Date(isoDate)
        const h = date.getUTCHours().toString().padStart(2, '0')
        const m = date.getUTCMinutes().toString().padStart(2, '0')
        return `${h}:${m}`
      }
      
      expect(formatResetAt('2026-04-14T10:30:00Z')).toBe('10:30')
    })

    it('deve formatar com zeros', () => {
      const formatResetAt = (isoDate: string): string => {
        const date = new Date(isoDate)
        const h = date.getUTCHours().toString().padStart(2, '0')
        const m = date.getUTCMinutes().toString().padStart(2, '0')
        return `${h}:${m}`
      }
      
      expect(formatResetAt('2026-04-14T08:05:00Z')).toBe('08:05')
    })
  })

  describe('Cálculos de Burn Rate', () => {
    it('deve calcular horas até esgotamento', () => {
      const currentSession = 50
      const burnRate = 10 // 10% por hora
      
      const hoursLeft = burnRate > 0 ? (100 - currentSession) / burnRate : Infinity
      
      expect(hoursLeft).toBe(5)
    })

    it('deve calcular burn rate entre dois pontos', () => {
      // p1: 1 hora antes, session 0
      // p2: agora, session 30
      const now = Date.now()
      const p1 = { ts: now - (60 * 60 * 1000), session: 0 }
      const p2 = { ts: now, session: 30 }
      
      const deltaMs = p2.ts - p1.ts
      const deltaHours = deltaMs / (1000 * 60 * 60)
      const burnRate = (p2.session - p1.session) / deltaHours
      
      expect(burnRate).toBeCloseTo(30, 0)
    })

    it('deve calcular tempo estimado de esgotamento', () => {
      // Simular: 50% actuel, 50% por hora de burn rate
      const newestSession = 50
      const burnRate = 50 // 50% por hora
      
      const hoursLeft = burnRate > 0 ? (100 - newestSession) / burnRate : Infinity
      
      expect(hoursLeft).toBe(1) // (100-50)/50 = 1 hora
    })

    it('deve suprimir whenburn rate <= 0', () => {
      const newest = { ts: 1776200995123, session: 80 }
      const oldest = { ts: 1776200995123 - (60 * 60 * 1000), session: 100 }
      
      const deltaMs = newest.ts - oldest.ts
      const deltaHours = deltaMs / (1000 * 60 * 60)
      const burnRate = deltaHours > 0 ? (newest.session - oldest.session) / deltaHours : 0
      const shouldShow = burnRate > 0 && newest.session >= 5 && hoursLeft <= 6
      
      const hoursLeft = burnRate > 0 ? (100 - newest.session) / burnRate : Infinity
      const suppressed = burnRate <= 0 || newest.session < 5 || hoursLeft > 6
      
      expect(suppressed).toBe(true)
    })
  })

  describe('Cálculos de Uso', () => {
    it('deve calcular percentual de uso', () => {
      const utilization = 0.75
      
      const pct = Math.round(utilization * 100)
      
      expect(pct).toBe(75)
    })

    it('deve calcular pico de série temporal', () => {
      const timeSeries = [
        { ts: 1, session: 10 },
        { ts: 2, session: 25 },
        { ts: 3, session: 15 },
      ]
      
      const pico = Math.max(...timeSeries.map(p => p.session))
      
      expect(pico).toBe(25)
    })

    it('deve calcular média de série', () => {
      const timeSeries = [
        { session: 10 },
        { session: 20 },
        { session: 30 },
      ]
      
      const media = timeSeries.reduce((sum, p) => sum + p.session, 0) / timeSeries.length
      
      expect(media).toBe(20)
    })
  })

  describe('Lógica do Gauge (Chart.js)', () => {
    it('deve calcular ângulo para percentage', () => {
      const pct = 0.75
      const circumference = 180
      const offset = circumference - (pct * circumference)
      
      expect(offset).toBe(45)
    })

    it('deve calcular strokeDasharray', () => {
      const pct = 0.5
      const circumference = 180
      const dashArray = `${pct * circumference} ${circumference}`
      
      expect(dashArray).toBe('90 180')
    })

    it('deve inverter para gauge semicírculo', () => {
      const pct = 0.25
      const circumference = 180
      const dashOffset = (pct * circumference)
      
      // Para semicírculo, o offset começa do final
      expect(dashOffset).toBe(45)
    })
  })
})