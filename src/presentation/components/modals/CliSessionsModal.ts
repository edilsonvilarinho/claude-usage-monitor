import type { CliSession } from '../../../domain/entities/Usage';
import { tr } from '../../layouts/i18n';
import { AnalyticsFormatter } from '../../../application/analyticsFormatter';
import { mountAnalyticsCharts, destroyAnalyticsCharts } from '../charts/SessionAnalyticsCharts';

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

let currentSessionId: string | null = null;

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
  const tl = tr();

  listEl.innerHTML = `
    <div class="cli-sessions-summary">
      <span>${tl.cliSummary(sessions.length, fmtCostFull(totalCost))}</span>
      <button id="cli-clear-all" class="cli-clear-all-btn" title="${tl.cliClearAllTitle}">${tl.cliClearAll}</button>
    </div>
    <div class="cli-sessions-table-head">
      <span>ID</span>
      <span>${tl.cliColTime}</span>
      <span>Tokens</span>
      <span class="cli-cache-th">Cache <span class="cli-cache-info-icon">ⓘ</span><div class="cli-cache-tooltip">${tl.cliCacheColTooltipHtml}</div></span>
      <span>${tl.cliColCost}</span>
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
        <button class="cli-row-delete" data-session-id="${s.sessionId}" title="${tl.cliDeleteSession}">✕</button>
      </div>`;
    }).join('')}
  `;

  document.getElementById('cli-clear-all')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!confirm(tl.cliClearAllConfirm)) return;
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

function renderDetail(s: CliSession, listEl: HTMLElement, detailEl: HTMLElement, skipScroll = false): void {
  void renderDetailAsync(s, listEl, detailEl, skipScroll);
}

async function renderDetailAsync(s: CliSession, listEl: HTMLElement, detailEl: HTMLElement, skipScroll = false): Promise<void> {
  destroyAnalyticsCharts();
  currentSessionId = s.sessionId;
  const hit = cacheHitRate(s);
  const cost = calcCost(s);
  const hitCls = hit !== null ? (hit >= 0.8 ? 'good' : hit >= 0.5 ? 'warn' : 'bad') : '';

  // Indicadores derivados
  const costInput    = s.inputTokens * RATES.input;
  const costOutput   = s.outputTokens * RATES.output;
  const costCacheR   = s.cacheReadTokens * RATES.cacheRead;
  const costCacheC   = s.cacheCreationTokens * RATES.cacheCreate;

  // Economia: quanto cacheRead custaria se fosse cobrado como input normal
  const cacheSaving  = s.cacheReadTokens * (RATES.input - RATES.cacheRead);
  const costNoCache  = costInput + costOutput + s.cacheReadTokens * RATES.input + costCacheC;

  // Distribuição de custo em %
  const pIn  = cost > 0 ? (costInput  / cost * 100) : 0;
  const pOut = cost > 0 ? (costOutput / cost * 100) : 0;
  const pCR  = cost > 0 ? (costCacheR / cost * 100) : 0;
  const pCC  = cost > 0 ? (costCacheC / cost * 100) : 0;

  const t = tr();
  function hint(text: string): string {
    return `<span class="cli-card-hint-wrap"><span class="cli-card-hint-icon">ⓘ</span><div class="cli-card-hint-tooltip">${text}</div></span>`;
  }

  detailEl.innerHTML = `
    <button id="cli-sessions-back" class="cli-sessions-back">${t.cliLabelBack}</button>
    <div class="cli-detail-header">
      <div class="cli-detail-id" title="${s.sessionId}">${s.sessionId}</div>
      <div class="cli-detail-meta">${new Date(s.ts).toLocaleString()} · ${s.toolName}</div>
    </div>

    <div class="cli-detail-cards">
      <div class="cli-detail-card">
        <div class="cli-card-label-row">
          <span class="cli-card-label">Input</span>
          ${hint(t.cliHintInput)}
        </div>
        <div class="cli-card-value">${fmtTokens(s.inputTokens)}</div>
        <div class="cli-card-sub">${fmtCostFull(costInput)}</div>
      </div>
      <div class="cli-detail-card">
        <div class="cli-card-label-row">
          <span class="cli-card-label">Output</span>
          ${hint(t.cliHintOutput)}
        </div>
        <div class="cli-card-value">${fmtTokens(s.outputTokens)}</div>
        <div class="cli-card-sub">${fmtCostFull(costOutput)}</div>
      </div>
      <div class="cli-detail-card">
        <div class="cli-card-label-row">
          <span class="cli-card-label">Cache read</span>
          ${hint(t.cliHintCacheRead)}
        </div>
        <div class="cli-card-value">${fmtTokens(s.cacheReadTokens)}</div>
        <div class="cli-card-sub">${fmtCostFull(costCacheR)}</div>
      </div>
      <div class="cli-detail-card">
        <div class="cli-card-label-row">
          <span class="cli-card-label">Cache create</span>
          ${hint(t.cliHintCacheCreate)}
        </div>
        <div class="cli-card-value">${fmtTokens(s.cacheCreationTokens)}</div>
        <div class="cli-card-sub">${fmtCostFull(costCacheC)}</div>
      </div>
    </div>

    ${hit !== null ? `
    <div class="cli-detail-hit-wrap">
      <div class="cli-detail-hit-label">
        <span class="cli-section-label-row">Cache hit rate ${hint(t.cliHintCacheHitRate)}</span>
      </div>
      <div class="cli-hit-bar-wrap">
        <div class="cli-hit-bar-fill ${hitCls}" style="width:${(hit * 100).toFixed(1)}%"></div>
      </div>
      <div class="cli-hit-bar-pct ${hitCls}">${(hit * 100).toFixed(1)}%${hit >= 0.8 ? ' ✓' : ''}</div>
    </div>` : ''}

    <div class="cli-detail-sep"></div>

    <div class="cli-dist-section">
      <div class="cli-dist-label">
        <span class="cli-section-label-row">${t.cliLabelCostDist} ${hint(t.cliHintCostDist)}</span>
      </div>
      <div class="cli-dist-bar">
        <div class="cli-dist-seg input"  style="width:${pIn.toFixed(1)}%"  title="Input ${pIn.toFixed(1)}%"></div>
        <div class="cli-dist-seg output" style="width:${pOut.toFixed(1)}%" title="Output ${pOut.toFixed(1)}%"></div>
        <div class="cli-dist-seg cacher" style="width:${pCR.toFixed(1)}%"  title="Cache read ${pCR.toFixed(1)}%"></div>
        <div class="cli-dist-seg cachec" style="width:${pCC.toFixed(1)}%"  title="Cache create ${pCC.toFixed(1)}%"></div>
      </div>
      <div class="cli-dist-legend">
        <span class="cli-dist-dot input"></span>In ${pIn.toFixed(0)}%
        <span class="cli-dist-dot output"></span>Out ${pOut.toFixed(0)}%
        <span class="cli-dist-dot cacher"></span>cR ${pCR.toFixed(0)}%
        <span class="cli-dist-dot cachec"></span>cW ${pCC.toFixed(0)}%
      </div>
    </div>

    ${cacheSaving > 0 ? `
    <div class="cli-saving-box">
      <div class="cli-saving-row">
        <span class="cli-section-label-row">${t.cliLabelCacheSaving} ${hint(t.cliHintCacheSaving)}</span>
        <span class="cli-saving-value">+${fmtCostFull(cacheSaving)}</span>
      </div>
      <div class="cli-saving-row cli-saving-sub">
        <span>${t.cliLabelCostNoCache}</span>
        <span>${fmtCostFull(costNoCache)}</span>
      </div>
      <div class="cli-saving-pct">${t.cliLabelCheaperWithCache(Math.round((cacheSaving / costNoCache) * 100))}</div>
    </div>` : ''}

    <div class="cli-detail-total">
      <span>${t.cliLabelEstimatedCost}</span>
      <span>${fmtCostFull(cost)}</span>
    </div>
    <div class="cli-detail-note">Sonnet · $3/M in · $15/M out · $0.30/M cR · $3.75/M cW</div>

    <div id="cli-analytics-section" class="cli-analytics-section">
      <div id="cli-analytics-kpis" class="cli-analytics-kpis cli-analytics-loading">
        <span class="cli-spinner"></span>
      </div>
    </div>

    <button id="cli-detail-delete" class="cli-detail-delete-btn">${t.cliLabelDeleteSession}</button>
  `;

  listEl.classList.add('hidden');
  detailEl.classList.remove('hidden');

  document.getElementById('cli-sessions-back')?.addEventListener('click', () => {
    destroyAnalyticsCharts();
    currentSessionId = null;
    detailEl.classList.add('hidden');
    listEl.classList.remove('hidden');
  });

  document.getElementById('cli-detail-delete')?.addEventListener('click', async () => {
    destroyAnalyticsCharts();
    await window.claudeUsage.deleteCliSession(s.sessionId);
    currentSessionId = null;
    detailEl.classList.add('hidden');
    listEl.classList.remove('hidden');
    const updated = await window.claudeUsage.getCliSessions();
    renderList(updated);
  });

  // Carrega analytics de forma assíncrona
  try {
    const turns = await window.claudeUsage.getCliSessionTurns(s.sessionId);
    const analytics = AnalyticsFormatter.compute(s, turns);
    const analyticsEl = document.getElementById('cli-analytics-kpis');
    if (!analyticsEl || currentSessionId !== s.sessionId) return;
    analyticsEl.classList.remove('cli-analytics-loading');
    analyticsEl.innerHTML = renderAnalyticsKpis(analytics) + renderHealthCard(analytics);
    const section = document.getElementById('cli-analytics-section');
    if (section) {
      section.insertAdjacentHTML('beforeend', `
        <div class="cli-analytics-charts">
          <div class="cli-analytics-chart-wrap">
            <div class="cli-analytics-chart-title">Cache read por turno</div>
            <canvas id="cli-chart-trend"></canvas>
          </div>
          <div class="cli-analytics-chart-wrap">
            <div class="cli-analytics-chart-title">Custo × Economia</div>
            <canvas id="cli-chart-efficiency"></canvas>
          </div>
        </div>
      `);
      mountAnalyticsCharts(s, analytics);
    }
  } catch {
    const analyticsEl = document.getElementById('cli-analytics-kpis');
    if (analyticsEl) analyticsEl.innerHTML = '';
  }
}

function renderAnalyticsKpis(analytics: ReturnType<typeof AnalyticsFormatter.compute>): string {
  const t = tr();
  function fmtK(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return n.toFixed(0);
  }
  return `
    <div class="cli-kpi-grid">
      <div class="cli-kpi-card">
        <div class="cli-kpi-label">${t.analyticsAvgContext}</div>
        <div class="cli-kpi-value">${fmtK(analytics.averageContextPerTurn)}</div>
      </div>
      <div class="cli-kpi-card">
        <div class="cli-kpi-label">${t.analyticsNextCost}</div>
        <div class="cli-kpi-value">$${analytics.nextInteractionCost.toFixed(4)}</div>
      </div>
      <div class="cli-kpi-card">
        <div class="cli-kpi-label">${t.analyticsSavings}</div>
        <div class="cli-kpi-value">+$${analytics.cacheSavingsUSD.toFixed(4)}</div>
      </div>
    </div>
  `;
}

function renderHealthCard(analytics: ReturnType<typeof AnalyticsFormatter.compute>): string {
  if (!analytics.isSaturated) return '';
  const t = tr();
  return `<div class="session-health-card saturated">${t.analyticsSaturated}</div>`;
}

export function setupCliSessionsHandlers(): void {
  document.getElementById('cli-sessions-close')?.addEventListener('click', closeCliSessionsModal);
  document.getElementById('cli-sessions-modal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('cli-sessions-modal')) closeCliSessionsModal();
  });
  document.getElementById('cli-sessions-refresh')?.addEventListener('click', () => void reloadCurrent());
}

async function reloadCurrent(): Promise<void> {
  const refreshBtn = document.getElementById('cli-sessions-refresh');
  refreshBtn?.classList.add('spinning');
  try {
    const sessions = await window.claudeUsage.getCliSessions();
    if (currentSessionId) {
      const updated = sessions.find(s => s.sessionId === currentSessionId);
      const listEl = document.getElementById('cli-sessions-list')!;
      const detailEl = document.getElementById('cli-sessions-detail')!;
      if (updated) {
        renderDetail(updated, listEl, detailEl);
      } else {
        // sessão foi deletada externamente — volta para a lista
        currentSessionId = null;
        detailEl.classList.add('hidden');
        listEl.classList.remove('hidden');
        renderList(sessions);
      }
    } else {
      renderList(sessions);
    }
  } catch {
    /* silencioso */
  } finally {
    refreshBtn?.classList.remove('spinning');
  }
}

async function reloadList(): Promise<void> {
  const listEl = document.getElementById('cli-sessions-list')!;
  const detailEl = document.getElementById('cli-sessions-detail')!;
  const refreshBtn = document.getElementById('cli-sessions-refresh');
  detailEl.classList.add('hidden');
  listEl.classList.remove('hidden');
  const trl = tr();
  listEl.innerHTML = `<div class="cli-sessions-loading"><span class="cli-spinner"></span> ${trl.cliLabelLoading}</div>`;
  refreshBtn?.classList.add('spinning');
  try {
    const sessions = await window.claudeUsage.getCliSessions();
    renderList(sessions);
  } catch {
    listEl.innerHTML = `<div class="cli-sessions-empty">${trl.cliLabelLoadError}</div>`;
  } finally {
    refreshBtn?.classList.remove('spinning');
  }
}

export function closeCliSessionsModal(): void {
  destroyAnalyticsCharts();
  document.getElementById('cli-sessions-modal')?.classList.add('hidden');
}

export async function openCliSessionsModal(): Promise<void> {
  document.getElementById('cli-sessions-modal')!.classList.remove('hidden');
  await reloadList();
}
