export const SETTINGS_MODAL_HTML = `
<div id="settings-modal" class="modal-overlay hidden">
  <div class="modal-box settings-modal-box">
    <div class="settings-modal-header">
      <span class="settings-modal-title">Configurações</span>
      <button class="icon-btn" id="btn-settings-close" title="Fechar">✕</button>
    </div>
    <div class="settings-tabs">
      <button class="tab-btn active" data-tab="tab-geral">Geral</button>
      <button class="tab-btn" data-tab="tab-exibicao">Exibição</button>
      <button class="tab-btn" data-tab="tab-notif">Notificações</button>
      <button class="tab-btn" data-tab="tab-backup">Backup / Sync</button>
      <button class="tab-btn" data-tab="tab-smart-plan" data-i18n="settingsTabSmartPlan">Agenda</button>
    </div>
    <div class="settings-tab-content">

      <!-- ABA: Geral -->
      <div id="tab-geral" class="tab-pane">
        <div class="settings-group">
          <div class="settings-row">
            <label data-i18n="launchAtStartup">Launch at startup</label>
            <label class="toggle">
              <input type="checkbox" id="setting-startup" />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="settings-row">
            <label data-i18n="alwaysVisible">Always visible</label>
            <label class="toggle">
              <input type="checkbox" id="setting-always-visible" />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="settings-row">
            <label data-i18n="themeLabel">Theme</label>
            <select class="setting-select" id="setting-theme">
              <option value="system">System</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
          <div class="settings-row">
            <label data-i18n="languageLabel">Language</label>
            <select class="setting-select" id="setting-language">
              <option value="en">English</option>
              <option value="pt-BR">Português (BR)</option>
            </select>
          </div>
          <div class="settings-row">
            <label data-i18n="sizeLabel">Size</label>
            <select class="setting-select" id="setting-window-size">
              <option value="normal" data-i18n-opt="sizeNormal">Normal</option>
              <option value="medium" data-i18n-opt="sizeMedium">Medium</option>
              <option value="large" data-i18n-opt="sizeLarge">Large</option>
              <option value="xlarge" data-i18n-opt="sizeXLarge">Very Large</option>
            </select>
          </div>
          <div class="settings-row">
            <label data-i18n="autoRefreshLabel">Auto refresh</label>
            <label class="toggle">
              <input type="checkbox" id="setting-auto-refresh" />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="settings-row" id="row-auto-refresh-interval">
            <label data-i18n="autoRefreshIntervalLabel">Interval (s)</label>
            <div class="spinner-row">
              <input type="number" class="spinner-input" id="setting-auto-refresh-interval" min="60" max="3600" step="30" />
              <span class="spinner-unit">s</span>
            </div>
          </div>
          <div class="settings-hint" id="hint-auto-refresh" data-i18n="autoRefreshHint"></div>
          <div class="settings-row">
            <label data-i18n="compactModeLabel">Modo compacto</label>
            <label class="toggle">
              <input type="checkbox" id="setting-compact-mode" />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>

      <!-- ABA: Exibição -->
      <div id="tab-exibicao" class="tab-pane hidden">
        <div class="settings-group">
          <div class="settings-row">
            <label>Barra de conta</label>
            <label class="toggle">
              <input type="checkbox" id="setting-show-account-bar" />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="settings-row">
            <label data-i18n="showDailyChartLabel">Gráfico semanal</label>
            <label class="toggle">
              <input type="checkbox" id="setting-show-daily-chart" />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="settings-row">
            <label data-i18n="showExtraBarsLabel">Barras de créditos / Sonnet</label>
            <label class="toggle">
              <input type="checkbox" id="setting-show-extra-bars" />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="settings-row">
            <label data-i18n="showFooterLabel">Rodapé de atualização</label>
            <label class="toggle">
              <input type="checkbox" id="setting-show-footer" />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>

      <!-- ABA: Notificações -->
      <div id="tab-notif" class="tab-pane hidden">
        <div class="settings-group">
          <div class="settings-row">
            <label data-i18n="enable">Enable</label>
            <label class="toggle">
              <input type="checkbox" id="setting-notif-enabled" />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="settings-row">
            <label data-i18n="sound">Sound</label>
            <label class="toggle">
              <input type="checkbox" id="setting-sound-enabled" />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="settings-row">
            <label data-i18n="notifyOnReset">Notify on reset</label>
            <label class="toggle">
              <input type="checkbox" id="setting-notify-on-window-reset" />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="settings-row">
            <label data-i18n="notifyOnDropLabel">Notify when usage drops</label>
            <label class="toggle">
              <input type="checkbox" id="setting-notify-on-reset" />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="settings-row" id="row-reset-threshold">
            <label data-i18n="resetThresholdLabel">Reset threshold (%)</label>
            <div class="slider-row">
              <input type="range" id="setting-reset-threshold" min="1" max="99" value="50">
              <span id="lbl-reset-threshold" class="slider-value">50%</span>
            </div>
          </div>
          <div class="settings-row">
            <label data-i18n="sessionThreshold">Session limit</label>
            <div class="slider-row">
              <input type="range" id="setting-session-threshold" min="1" max="100" value="80">
              <span id="lbl-session-threshold" class="slider-value">80%</span>
            </div>
          </div>
          <div class="settings-row">
            <label data-i18n="weeklyThreshold">Weekly limit</label>
            <div class="slider-row">
              <input type="range" id="setting-weekly-threshold" min="1" max="100" value="80">
              <span id="lbl-weekly-threshold" class="slider-value">80%</span>
            </div>
          </div>
          <div class="settings-row">
            <label></label>
            <button class="test-btn" id="btn-test-notif" data-i18n="test">Test</button>
          </div>
        </div>
      </div>

      <!-- ABA: Backup / Sync -->
      <div id="tab-backup" class="tab-pane hidden">
        <div class="settings-group">
          <div class="settings-title" data-i18n="autoBackupTitle">Auto Backup</div>
          <div class="settings-row">
            <label data-i18n="autoBackupModeLabel">Modo</label>
            <select class="setting-select" id="setting-auto-backup-mode">
              <option value="never" data-i18n="autoBackupNever">Nunca</option>
              <option value="before" data-i18n="autoBackupBefore">Antes da consulta</option>
              <option value="after" data-i18n="autoBackupAfter">Após atualizar</option>
              <option value="always" data-i18n="autoBackupAlways">Sempre</option>
            </select>
          </div>
          <div class="settings-row" id="row-auto-backup-folder">
            <label data-i18n="autoBackupFolderLabel">Pasta</label>
            <button class="test-btn" id="btn-auto-backup-folder" data-i18n="autoBackupChoose">Escolher...</button>
          </div>
          <div class="settings-hint" id="lbl-auto-backup-folder"></div>
        </div>

        <div class="settings-group" id="settings-group-cloud-sync">
          <div class="settings-title">Cloud Sync</div>
          <div id="cloud-sync-setup">
            <div class="settings-row">
              <label>Server URL</label>
              <input type="text" class="sync-text-input" id="sync-server-url" placeholder="http://localhost:3030" />
            </div>
            <div class="settings-row">
              <label>Device label</label>
              <input type="text" class="sync-text-input" id="sync-device-label" placeholder="my-pc" />
            </div>
            <div class="settings-row">
              <label></label>
              <button class="test-btn" id="btn-sync-enable">Sign in &amp; enable</button>
            </div>
            <div id="sync-setup-error" class="sync-error-msg" style="display:none"></div>
          </div>
          <div id="cloud-sync-status" style="display:none">
            <div class="sync-status-panel">
              <div class="sync-status-row">
                <span class="sync-status-label" data-i18n="syncLabelAccount">Account</span>
                <span class="sync-status-value" id="sync-status-email">—</span>
              </div>
              <div class="sync-status-row">
                <span class="sync-status-label" data-i18n="syncLabelServer">Server</span>
                <span class="sync-status-value" id="sync-status-server">—</span>
              </div>
              <div class="sync-status-row">
                <span class="sync-status-label" data-i18n="syncLabelLast">Last sync</span>
                <span class="sync-status-value" id="sync-status-last">Never</span>
              </div>
              <div class="sync-status-row">
                <span class="sync-status-label" data-i18n="syncLabelNext">Next sync</span>
                <span class="sync-status-value" id="sync-status-next">—</span>
              </div>
              <div class="sync-status-row" id="sync-status-state-row">
                <span class="sync-status-label" data-i18n="syncLabelState">Status</span>
                <span class="sync-status-value" id="sync-status-state">—</span>
              </div>
            </div>
            <div class="sync-actions">
              <button class="test-btn" id="btn-sync-now" data-i18n="syncNowBtn">Sync now</button>
              <button class="test-btn sync-btn-disable" id="btn-sync-disable" data-i18n="syncDisableBtn">Disable</button>
              <button class="test-btn sync-btn-wipe" id="btn-sync-wipe" data-i18n="syncWipeBtn">Wipe remote</button>
            </div>
            <div id="sync-enabled-error" class="sync-error-msg" style="display:none"></div>
          </div>
        </div>
      </div>

      <!-- Tab: Smart Plan -->
      <div id="tab-smart-plan" class="tab-pane hidden">
        <div id="sp-validation-error" class="form-error hidden" data-i18n="smartPlanValidationError"></div>
        <div class="settings-group">
          <div class="settings-row">
            <label class="toggle">
              <input type="checkbox" id="sp-enabled">
              <span class="toggle-slider"></span>
            </label>
            <span data-i18n="smartPlanEnableLabel">Ativar agenda inteligente</span>
          </div>
        </div>
        <div class="settings-group">
          <div class="settings-row" style="flex-wrap:wrap; gap:4px;">
            <span data-i18n="smartPlanActiveDays" style="width:100%; margin-bottom:4px;">Dias ativos</span>
            <label><input type="checkbox" class="sp-day" id="sp-day-0"> <span data-i18n="dayShort0">Dom</span></label>
            <label><input type="checkbox" class="sp-day" id="sp-day-1"> <span data-i18n="dayShort1">Seg</span></label>
            <label><input type="checkbox" class="sp-day" id="sp-day-2"> <span data-i18n="dayShort2">Ter</span></label>
            <label><input type="checkbox" class="sp-day" id="sp-day-3"> <span data-i18n="dayShort3">Qua</span></label>
            <label><input type="checkbox" class="sp-day" id="sp-day-4"> <span data-i18n="dayShort4">Qui</span></label>
            <label><input type="checkbox" class="sp-day" id="sp-day-5"> <span data-i18n="dayShort5">Sex</span></label>
            <label><input type="checkbox" class="sp-day" id="sp-day-6"> <span data-i18n="dayShort6">Sáb</span></label>
          </div>
        </div>
        <div class="settings-group">
          <div class="settings-row">
            <label data-i18n="smartPlanWorkHours">Horário de trabalho</label>
          </div>
          <div class="settings-row">
            <span class="sp-time-label" data-i18n="smartPlanStart">Início</span>
            <input type="time" id="sp-work-start" class="sp-time-input">
            <span>–</span>
            <span class="sp-time-label" data-i18n="smartPlanEnd">Fim</span>
            <input type="time" id="sp-work-end" class="sp-time-input">
          </div>
        </div>
        <div class="settings-group">
          <div class="settings-row">
            <label data-i18n="smartPlanBreakHours">Intervalo</label>
          </div>
          <div class="settings-row">
            <span class="sp-time-label" data-i18n="smartPlanStart">Início</span>
            <input type="time" id="sp-break-start" class="sp-time-input">
            <span>–</span>
            <span class="sp-time-label" data-i18n="smartPlanEnd">Fim</span>
            <input type="time" id="sp-break-end" class="sp-time-input">
          </div>
        </div>
      </div>

    </div><!-- /settings-tab-content -->
  </div><!-- /settings-modal-box -->
</div><!-- /settings-modal -->
`;