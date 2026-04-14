export const CREDENTIAL_MODAL_HTML = `
<div id="credential-modal" class="modal-overlay hidden">
  <div class="modal-box credential-modal-box">
    <div class="credential-modal-icon">&#9888;</div>
    <h3 class="credential-modal-title">Credenciais não encontradas</h3>
    <p class="credential-modal-desc">
      Faça login no Claude Code para que o monitor possa acessar seus dados de uso.
    </p>
    <ol class="credential-steps">
      <li id="install-step-win">Instale o Claude Code:<br>
        <code>winget install Anthropic.Claude</code>
      </li>
      <li id="install-step-linux" style="display:none">Instale o Claude Code:<br>
        <code>npm install -g @anthropic-ai/claude-code</code>
      </li>
      <li>Abra um terminal e execute:<br>
        <code>claude</code>
      </li>
      <li>Siga o fluxo de login no navegador</li>
    </ol>
    <p class="credential-path-label">Arquivo esperado:</p>
    <code class="credential-path" id="credential-path-value"></code>
    <div class="modal-actions">
      <button id="credential-retry-btn">Tentar novamente</button>
    </div>
  </div>
</div>
`;