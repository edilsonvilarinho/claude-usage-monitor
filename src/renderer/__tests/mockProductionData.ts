/**
 * Mock de dados reais de produção - Cliente de Produção
 * Exportado em 2026-04-14T21:14:52.982Z
 */

export const mockProductionData = {
  exportedAt: '2026-04-14T21:14:52.982Z',
  dailyHistory: [
    {
      date: '2026-04-10',
      maxWeekly: 20,
      maxSession: 100,
      sessionWindowCount: 1,
      sessionAccum: 0
    },
    {
      date: '2026-04-11',
      maxWeekly: 64,
      maxSession: 100,
      sessionWindowCount: 5,
      sessionAccum: 400
    },
    {
      date: '2026-04-12',
      maxWeekly: 100,
      maxSession: 100,
      maxCredits: 100,
      sessionWindowCount: 5,
      sessionAccum: 400
    },
    {
      date: '2026-04-13',
      maxWeekly: 100,
      maxSession: 0,
      maxCredits: 83,
      sessionWindowCount: 1,
      sessionAccum: 0
    },
    {
      date: '2026-04-14',
      maxWeekly: 100,
      maxSession: 0,
      maxCredits: 83,
      sessionWindowCount: 1,
      sessionAccum: 0
    }
  ],
  timeSeries: {
    '2026-04-10': [
      { ts: 1775858635200, session: 0, weekly: 8, credits: 78 },
      { ts: 1775859236671, session: 0, weekly: 8, credits: 78 },
      { ts: 1775859837177, session: 13, weekly: 10, credits: 78 },
      { ts: 1775860438124, session: 18, weekly: 10, credits: 78 },
      { ts: 1775861038767, session: 47, weekly: 13, credits: 78 },
      { ts: 1775861639594, session: 71, weekly: 16, credits: 78 },
      { ts: 1775862240247, session: 95, weekly: 19, credits: 78 },
      { ts: 1775862840800, session: 100, weekly: 20, credits: 87 },
      { ts: 1775863441567, session: 100, weekly: 20, credits: 101 },
      { ts: 1775864042130, session: 100, weekly: 20, credits: 101 }
    ],
    '2026-04-11': [
      { ts: 1775864642718, session: 0, weekly: 21, credits: 102 },
      { ts: 1775865243328, session: 0, weekly: 22, credits: 103 },
      { ts: 1775865843927, session: 0, weekly: 22, credits: 103 },
      { ts: 1775866444548, session: 0, weekly: 23, credits: 103 },
      { ts: 1775867045151, session: 0, weekly: 24, credits: 104 },
      { ts: 1775867645770, session: 0, weekly: 25, credits: 104 },
      { ts: 1775868246380, session: 14, weekly: 27, credits: 105 },
      { ts: 1775868846997, session: 22, weekly: 28, credits: 106 },
      { ts: 1775869447608, session: 35, weekly: 30, credits: 107 },
      { ts: 1775870048225, session: 43, weekly: 31, credits: 108 },
      { ts: 1775870648843, session: 57, weekly: 34, credits: 109 },
      { ts: 1775871249477, session: 64, weekly: 36, credits: 110 }
    ],
    '2026-04-14': [
      { ts: 1776200995123, session: 0, weekly: 100, credits: 83 },
      { ts: 1776201595789, session: 0, weekly: 100, credits: 83 },
      { ts: 1776202196456, session: 0, weekly: 100, credits: 84 }
    ]
  },
  sessionWindows: [
    {
      date: '2026-04-10',
      resetsAtMinute: 720,
      peak: 100,
      peakTs: 1775862840800,
      final: 100,
      windowIndex: 0
    },
    {
      date: '2026-04-11',
      resetsAtMinute: 240,
      peak: 22,
      peakTs: 1775868846997,
      final: 0,
      windowIndex: 0
    },
    {
      date: '2026-04-11',
      resetsAtMinute: 510,
      peak: 40,
      peakTs: 1775871249477,
      final: 64,
      windowIndex: 1
    },
    {
      date: '2026-04-11',
      resetsAtMinute: 750,
      peak: 25,
      peakTs: 1775874840600,
      final: 0,
      windowIndex: 2
    },
    {
      date: '2026-04-12',
      resetsAtMinute: 150,
      peak: 55,
      peakTs: 1775878441499,
      final: 0,
      windowIndex: 3
    }
  ]
}

// Dados de uso atuais do cliente
export const mockCurrentUsage = {
  five_hour: {
    utilization: 0,
    resets_at: '2026-04-14T20:00:00Z'
  },
  seven_day: {
    utilization: 1.0,
    resets_at: '2026-04-07T20:00:00Z'
  },
  extra_usage: {
    is_enabled: true,
    monthly_limit: 1000000,
    used_credits: 830000
  }
}

// Histórico de resets do cliente
export const mockResetHistory = [
  { date: '2026-04-10', resetsAtMinute: 720 },
  { date: '2026-04-11', resetsAtMinute: 240 },
  { date: '2026-04-11', resetsAtMinute: 510 },
  { date: '2026-04-11', resetsAtMinute: 750 },
  { date: '2026-04-12', resetsAtMinute: 150 }
]

// Configurações do cliente
export const mockSettings = {
  theme: 'dark',
  language: 'pt-BR',
  pollIntervalMinutes: 10,
  windowSize: 'normal',
  autoRefresh: true,
  autoRefreshInterval: 300,
  notifications: {
    enabled: true,
    sessionThreshold: 80,
    weeklyThreshold: 80,
    resetThreshold: 50,
    notifyOnReset: true,
    notifyOnWindowReset: true,
    soundEnabled: false
  },
  workSchedule: {
    enabled: true,
    activeDays: [1, 2, 3, 4, 5],
    workStart: '08:00',
    workEnd: '18:00',
    breakStart: '12:00',
    breakEnd: '13:00'
  },
  monthlyBudget: 50,
  costModel: 'sonnet'
}