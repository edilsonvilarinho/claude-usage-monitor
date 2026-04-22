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
  if (usd < 0.000001) return '$0.00';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function fmtCostFull(usd: number): string {
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

function fmtDate(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { day: '2-digit', month: '2-digit' }) +
    ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function hitBadge(hit: number | null): string {
  if (hit === null) return '';
  const pct = (hit * 100).toFixed(0);
  const cls = hit >= 0.8 ? 'good' : hit >= 0.5 ? 'warn' : 'bad';
  return `<span class="cli-hit-badge ${cls}">${pct}% cache</span>`;
}

function hitCell(hit: number | null): string {
  if (hit === null) return `<span class="cli-row-hit-cell none"><span class="cli-dot"></span><span class="cli-hit-pct">—</span></span>`;
  const pct = (hit * 100).toFixed(0);
  const cls = hit >= 0.8 ? 'good' : hit >= 0.5 ? 'warn' : 'bad';
  return `<span class="cli-row-hit-cell ${cls}"><span class="cli-dot"></span><span class="cli-hit-pct">${pct}%</span></span>`;
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

  const totalCost = sessions.reduce((acc, s) => acc + calcCost(s), 0);

  listEl.innerHTML = `
    <div class="cli-sessions-summary">
      <span>${sessions.length} sessões · Total: ${fmtCostFull(totalCost)}</span>
      <button id="cli-clear-all" class="cli-clear-all-btn" title="Limpar todas as sessões">Limpar tudo</button>
    </div>
    <div class="cli-sessions-table-head">
      <span>ID</span>
      <span>Horário</span>
      <span>Tokens</span>
      <span title="🟢 ≥80% ótimo · 🟡 50–80% médio · 🔴 &lt;50% baixo" style="cursor:help">Cache ⓘ</span>
      <span>Custo</span>
      <span></span>
    </div>
    ${sessions.map((s, i) => {
      const cost = calcCost(s);
      const hit = cacheHitRate(s);
      const totalTok = s.inputTokens + s.outputTokens + s.cacheReadTokens;
      return `<div class="cli-session-row" data-idx="${i}" style="animation-delay:${i * 30}ms">
        <span class="cli-row-id">${s.sessionId.slice(0, 8)}</span>
        <span class="cli-row-date">${fmtDate(s.ts)}</span>
        <span class="cli-row-tokens">${fmtTokens(totalTok)}</span>
        ${hitCell(hit)}
        <span class="cli-row-cost">${fmtCost(cost)}</span>
        <button class="cli-row-delete" data-session-id="${s.sessionId}" title="Apagar sessão">✕</button>
      </div>`;
    }).join('')}
  `;

  document.getElementById('cli-clear-all')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!confirm('Apagar todas as sessões CLI? Essa ação não pode ser desfeita.')) return;
    await window.claudeUsage.deleteAllCliSessions();
    renderList([]);
  });

  listEl.querySelectorAll<HTMLElement>('.cli-row-delete').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const sessionId = btn.dataset.sessionId!;
      await window.claudeUsage.deleteCliSession(sessionId);
      const remaining = sessions.filter(s => s.sessionId !== sessionId);
      renderList(remaining);
    });
  });

  listEl.querySelectorAll<HTMLElement>('.cli-session-row').forEach((row) => {
    row.addEventListener('click', () => {
      renderDetail(sessions[Number(row.dataset.idx)], listEl, detailEl);
    });
  });
}

function renderDetail(s: CliSession, listEl: HTMLElement, detailEl: HTMLElement): void {
  const hit = cacheHitRate(s);
  const cost = calcCost(s);
  const hitCls = hit !== null ? (hit >= 0.8 ? 'good' : hit >= 0.5 ? 'warn' : 'bad') : '';

  detailEl.innerHTML = `
    <button id="cli-sessions-back" class="cli-sessions-back">← Voltar</button>
    <div class="cli-detail-header">
      <div class="cli-detail-id" title="${s.sessionId}">${s.sessionId}</div>
      <div class="cli-detail-meta">${new Date(s.ts).toLocaleString()} · ${s.toolName}</div>
    </div>

    <div class="cli-detail-cards">
      <div class="cli-detail-card">
        <div class="cli-card-label">Input</div>
        <div class="cli-card-value">${fmtTokens(s.inputTokens)}</div>
        <div class="cli-card-sub">${fmtCostFull(s.inputTokens * RATES.input)}</div>
      </div>
      <div class="cli-detail-card">
        <div class="cli-card-label">Output</div>
        <div class="cli-card-value">${fmtTokens(s.outputTokens)}</div>
        <div class="cli-card-sub">${fmtCostFull(s.outputTokens * RATES.output)}</div>
      </div>
      <div class="cli-detail-card">
        <div class="cli-card-label">Cache read</div>
        <div class="cli-card-value">${fmtTokens(s.cacheReadTokens)}</div>
        <div class="cli-card-sub">${fmtCostFull(s.cacheReadTokens * RATES.cacheRead)}</div>
      </div>
      <div class="cli-detail-card">
        <div class="cli-card-label">Cache create</div>
        <div class="cli-card-value">${fmtTokens(s.cacheCreationTokens)}</div>
        <div class="cli-card-sub">${fmtCostFull(s.cacheCreationTokens * RATES.cacheCreate)}</div>
      </div>
    </div>

    ${hit !== null ? `
    <div class="cli-detail-hit-wrap">
      <div class="cli-detail-hit-label">Cache hit rate</div>
      <div class="cli-hit-bar-wrap">
        <div class="cli-hit-bar-fill ${hitCls}" style="width:${(hit * 100).toFixed(1)}%"></div>
      </div>
      <div class="cli-hit-bar-pct ${hitCls}">${(hit * 100).toFixed(1)}%${hit >= 0.8 ? ' ✓' : ''}</div>
    </div>` : ''}

    <div class="cli-detail-total">
      <span>Custo estimado</span>
      <span>${fmtCostFull(cost)}</span>
    </div>
    <div class="cli-detail-note">Sonnet · $3/M in · $15/M out · $0.30/M cR · $3.75/M cW</div>
    <button id="cli-detail-delete" class="cli-detail-delete-btn">Apagar esta sessão</button>
  `;

  listEl.classList.add('hidden');
  detailEl.classList.remove('hidden');

  document.getElementById('cli-sessions-back')?.addEventListener('click', () => {
    detailEl.classList.add('hidden');
    listEl.classList.remove('hidden');
  });

  document.getElementById('cli-detail-delete')?.addEventListener('click', async () => {
    await window.claudeUsage.deleteCliSession(s.sessionId);
    detailEl.classList.add('hidden');
    listEl.classList.remove('hidden');
    // recarrega lista atualizada
    const updated = await window.claudeUsage.getCliSessions();
    renderList(updated);
  });
}

export function setupCliSessionsHandlers(): void {
  document.getElementById('cli-sessions-close')?.addEventListener('click', closeCliSessionsModal);
  document.getElementById('cli-sessions-modal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('cli-sessions-modal')) closeCliSessionsModal();
  });
  document.getElementById('cli-sessions-refresh')?.addEventListener('click', () => void reloadList());
}

async function reloadList(): Promise<void> {
  const listEl = document.getElementById('cli-sessions-list')!;
  const detailEl = document.getElementById('cli-sessions-detail')!;
  const refreshBtn = document.getElementById('cli-sessions-refresh');
  detailEl.classList.add('hidden');
  listEl.classList.remove('hidden');
  listEl.innerHTML = '<div class="cli-sessions-loading"><span class="cli-spinner"></span> Carregando…</div>';
  refreshBtn?.classList.add('spinning');
  try {
    const sessions = await window.claudeUsage.getCliSessions();
    renderList(sessions);
  } catch {
    listEl.innerHTML = '<div class="cli-sessions-empty">Erro ao carregar sessões.</div>';
  } finally {
    refreshBtn?.classList.remove('spinning');
  }
}

export function closeCliSessionsModal(): void {
  document.getElementById('cli-sessions-modal')?.classList.add('hidden');
}

export async function openCliSessionsModal(): Promise<void> {
  document.getElementById('cli-sessions-modal')!.classList.remove('hidden');
  await reloadList();
}
