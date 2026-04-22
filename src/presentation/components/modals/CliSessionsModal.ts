import type { CliSession } from '../../../domain/entities/Usage';

const RATES = {
  input: 3.0 / 1_000_000,
  output: 15.0 / 1_000_000,
  cacheRead: 0.3 / 1_000_000,
  cacheCreate: 3.75 / 1_000_000,
};

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtCost(usd: number): string {
  if (usd < 0.000001) return '$0.000000';
  return `$${usd.toFixed(6)}`;
}

function calcCost(s: CliSession): number {
  return (
    s.inputTokens * RATES.input +
    s.outputTokens * RATES.output +
    s.cacheReadTokens * RATES.cacheRead +
    s.cacheCreationTokens * RATES.cacheCreate
  );
}

function cacheHitRate(s: CliSession): number | null {
  const total = s.cacheReadTokens + s.cacheCreationTokens;
  if (total === 0) return null;
  return s.cacheReadTokens / total;
}

function renderList(sessions: CliSession[]): void {
  const listEl = document.getElementById('cli-sessions-list')!;
  const detailEl = document.getElementById('cli-sessions-detail')!;
  const emptyEl = document.getElementById('cli-sessions-empty')!;

  if (sessions.length === 0) {
    listEl.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
  detailEl.classList.add('hidden');
  listEl.classList.remove('hidden');

  listEl.innerHTML = sessions
    .map((s, i) => {
      const date = new Date(s.ts).toLocaleString([], {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
      const cost = calcCost(s);
      const shortId = s.sessionId.slice(0, 8);
      return `<div class="cli-session-card" data-idx="${i}">
        <span class="cli-session-id">${shortId}</span>
        <span class="cli-session-date">${date}</span>
        <span class="cli-session-tool">${s.toolName}</span>
        <span class="cli-session-cost">${fmtCost(cost)}</span>
      </div>`;
    })
    .join('');

  listEl.querySelectorAll<HTMLElement>('.cli-session-card').forEach((card) => {
    card.addEventListener('click', () => {
      const idx = Number(card.dataset.idx);
      renderDetail(sessions[idx], listEl, detailEl);
    });
  });
}

function renderDetail(s: CliSession, listEl: HTMLElement, detailEl: HTMLElement): void {
  const hit = cacheHitRate(s);
  const cost = calcCost(s);
  const date = new Date(s.ts).toLocaleString();

  detailEl.innerHTML = `
    <button id="cli-sessions-back" class="cli-sessions-back">← Voltar</button>
    <div class="cli-detail-id" title="${s.sessionId}">${s.sessionId}</div>
    <div class="cli-detail-row"><span>Data</span><span>${date}</span></div>
    <div class="cli-detail-row"><span>Evento</span><span>${s.toolName}</span></div>
    <div class="cli-detail-sep"></div>
    <div class="cli-detail-row"><span>Input</span><span>${fmtTokens(s.inputTokens)}</span></div>
    <div class="cli-detail-row"><span>Output</span><span>${fmtTokens(s.outputTokens)}</span></div>
    <div class="cli-detail-row"><span>Cache read</span><span>${fmtTokens(s.cacheReadTokens)}</span></div>
    <div class="cli-detail-row"><span>Cache create</span><span>${fmtTokens(s.cacheCreationTokens)}</span></div>
    ${hit !== null ? `<div class="cli-detail-row cli-detail-hit ${hit >= 0.8 ? 'good' : 'warn'}"><span>Cache hit rate</span><span>${(hit * 100).toFixed(1)}%</span></div>` : ''}
    <div class="cli-detail-sep"></div>
    <div class="cli-detail-row cli-detail-cost"><span>Custo est. (Sonnet)</span><span>${fmtCost(cost)}</span></div>
    <div class="cli-detail-note">$3/M in · $15/M out · $0.30/M cR · $3.75/M cW</div>
  `;

  listEl.classList.add('hidden');
  detailEl.classList.remove('hidden');

  document.getElementById('cli-sessions-back')?.addEventListener('click', () => {
    detailEl.classList.add('hidden');
    listEl.classList.remove('hidden');
  });
}

export function setupCliSessionsHandlers(): void {
  document.getElementById('cli-sessions-close')?.addEventListener('click', closeCliSessionsModal);
  document.getElementById('cli-sessions-modal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('cli-sessions-modal')) closeCliSessionsModal();
  });
}

export function closeCliSessionsModal(): void {
  document.getElementById('cli-sessions-modal')?.classList.add('hidden');
}

export async function openCliSessionsModal(): Promise<void> {
  const modal = document.getElementById('cli-sessions-modal')!;
  const listEl = document.getElementById('cli-sessions-list')!;
  modal.classList.remove('hidden');
  listEl.innerHTML = '<div class="cli-sessions-loading">Carregando…</div>';

  try {
    const sessions = await window.claudeUsage.getCliSessions();
    renderList(sessions);
  } catch {
    listEl.innerHTML = '<div class="cli-sessions-empty">Erro ao carregar sessões.</div>';
  }
}
