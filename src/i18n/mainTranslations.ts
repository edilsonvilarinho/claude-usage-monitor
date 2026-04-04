export interface MainTranslations {
  notifTestTitle: string;
  notifTestBody: string;
  notifSessionWindowResetTitle: string;
  notifSessionWindowResetBody: string;
  notifWeeklyWindowResetTitle: string;
  notifWeeklyWindowResetBody: string;
  notifSessionFreedTitle: string;
  notifSessionFreedBody: (pct: number) => string;
  notifWeeklyFreedTitle: string;
  notifWeeklyFreedBody: (pct: number) => string;
  notifSessionWarnTitle: string;
  notifSessionWarnBody: (pct: number, threshold: number) => string;
  notifWeeklyWarnTitle: string;
  notifWeeklyWarnBody: (pct: number, threshold: number) => string;
  trayInitialTooltip: string;
  trayTooltipLine1: (sessionPct: string, weeklyPct: string) => string;
  trayTooltipLine2: (sessionResets: string, weeklyResets: string) => string;
  trayRefreshNow: string;
  trayLaunchAtStartup: string;
  trayExit: string;
}

const en: MainTranslations = {
  notifTestTitle: 'Claude — Test Notification',
  notifTestBody: 'Notifications are working correctly',
  notifSessionWindowResetTitle: 'Claude — Session Window Reset',
  notifSessionWindowResetBody: 'Your 5-hour usage window has reset',
  notifWeeklyWindowResetTitle: 'Claude — Weekly Window Reset',
  notifWeeklyWindowResetBody: 'Your weekly usage window has reset',
  notifSessionFreedTitle: 'Claude — Session Limit Freed',
  notifSessionFreedBody: (pct) => `Session usage dropped to ${pct}% — limit has reset`,
  notifWeeklyFreedTitle: 'Claude — Weekly Limit Freed',
  notifWeeklyFreedBody: (pct) => `Weekly usage dropped to ${pct}% — limit has reset`,
  notifSessionWarnTitle: 'Claude — Session Limit Warning',
  notifSessionWarnBody: (pct, threshold) => `Session usage is at ${pct}% (${threshold}% threshold reached)`,
  notifWeeklyWarnTitle: 'Claude — Weekly Limit Warning',
  notifWeeklyWarnBody: (pct, threshold) => `Weekly usage is at ${pct}% (${threshold}% threshold reached)`,
  trayInitialTooltip: 'Claude Usage Monitor',
  trayTooltipLine1: (sessionPct, weeklyPct) => `Claude Usage — Session: ${sessionPct}% | Weekly: ${weeklyPct}%`,
  trayTooltipLine2: (sessionResets, weeklyResets) => `Session resets in: ${sessionResets} | Weekly resets in: ${weeklyResets}`,
  trayRefreshNow: 'Refresh Now',
  trayLaunchAtStartup: 'Launch at Startup',
  trayExit: 'Exit',
};

const ptBR: MainTranslations = {
  notifTestTitle: 'Claude — Notificação de Teste',
  notifTestBody: 'As notificações estão funcionando corretamente',
  notifSessionWindowResetTitle: 'Claude — Sessão Reiniciada',
  notifSessionWindowResetBody: 'Sua janela de uso de 5 horas foi reiniciada',
  notifWeeklyWindowResetTitle: 'Claude — Semana Reiniciada',
  notifWeeklyWindowResetBody: 'Sua janela de uso semanal foi reiniciada',
  notifSessionFreedTitle: 'Claude — Limite de Sessão Liberado',
  notifSessionFreedBody: (pct) => `Uso da sessão caiu para ${pct}% — limite foi liberado`,
  notifWeeklyFreedTitle: 'Claude — Limite Semanal Liberado',
  notifWeeklyFreedBody: (pct) => `Uso semanal caiu para ${pct}% — limite foi liberado`,
  notifSessionWarnTitle: 'Claude — Aviso de Limite de Sessão',
  notifSessionWarnBody: (pct, threshold) => `Uso da sessão em ${pct}% (limite de ${threshold}% atingido)`,
  notifWeeklyWarnTitle: 'Claude — Aviso de Limite Semanal',
  notifWeeklyWarnBody: (pct, threshold) => `Uso semanal em ${pct}% (limite de ${threshold}% atingido)`,
  trayInitialTooltip: 'Claude Usage Monitor',
  trayTooltipLine1: (sessionPct, weeklyPct) => `Claude Usage — Sessão: ${sessionPct}% | Semanal: ${weeklyPct}%`,
  trayTooltipLine2: (sessionResets, weeklyResets) => `Sessão reinicia em: ${sessionResets} | Semana reinicia em: ${weeklyResets}`,
  trayRefreshNow: 'Atualizar Agora',
  trayLaunchAtStartup: 'Iniciar com o sistema',
  trayExit: 'Sair',
};

export function getMainTranslations(lang?: string): MainTranslations {
  if (lang === 'pt-BR') return ptBR;
  return en;
}
