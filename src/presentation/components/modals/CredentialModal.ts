import { tr } from '../../layouts/i18n';
import { fitWindow } from '../../layouts/PopupLayout';

export function setupCredentialForm(): void {
  const oauthLoginBtn = document.getElementById('oauth-login-btn') as HTMLButtonElement | null;
  const oauthLoginStatus = document.getElementById('oauth-login-status') as HTMLElement | null;

  if (oauthLoginBtn) {
    oauthLoginBtn.addEventListener('click', async () => {
      oauthLoginBtn.disabled = true;
      oauthLoginBtn.textContent = tr().credentialLoginWaiting;
      if (oauthLoginStatus) oauthLoginStatus.textContent = '';
      try {
        await window.claudeUsage.startOAuthLogin();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (oauthLoginStatus) oauthLoginStatus.textContent = `${tr().credentialLoginError}${message}`;
        oauthLoginBtn.disabled = false;
        oauthLoginBtn.textContent = tr().credentialLoginBrowserBtn;
      }
    });
  }

  window.claudeUsage.onOAuthLoginComplete(() => {
    if (oauthLoginStatus) oauthLoginStatus.textContent = tr().credentialLoginSuccess;
    (document.getElementById('credential-modal') as HTMLElement).classList.add('hidden');
    setTimeout(() => fitWindow(), 50);
  });

  window.claudeUsage.onOAuthLoginError((message: string) => {
    if (oauthLoginStatus) oauthLoginStatus.textContent = `${tr().credentialLoginError}${message}`;
    if (oauthLoginBtn) {
      oauthLoginBtn.disabled = false;
      oauthLoginBtn.textContent = tr().credentialLoginBrowserBtn;
    }
  });

  const saveManualCredsBtn = document.getElementById('save-manual-creds-btn');
  const manualCredsStatus = document.getElementById('manual-creds-status');
  if (saveManualCredsBtn) {
    saveManualCredsBtn.addEventListener('click', async () => {
      const accessToken = (document.getElementById('manual-access-token') as HTMLTextAreaElement)?.value?.trim();
      const refreshToken = (document.getElementById('manual-refresh-token') as HTMLTextAreaElement)?.value?.trim();
      if (!accessToken) {
        if (manualCredsStatus) manualCredsStatus.textContent = tr().credentialAccessTokenRequired;
        return;
      }
      try {
        if (manualCredsStatus) manualCredsStatus.textContent = tr().credentialSavingStatus;
        await window.claudeUsage.saveManualCredentials({ accessToken, refreshToken: refreshToken || undefined });
        if (manualCredsStatus) manualCredsStatus.textContent = tr().credentialSavedStatus;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (manualCredsStatus) manualCredsStatus.textContent = `${tr().errorPrefix}${message}`;
      }
    });
  }

  document.getElementById('credential-retry-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('credential-retry-btn') as HTMLButtonElement;
    const originalText = btn.textContent ?? '';
    btn.disabled = true;
    btn.textContent = tr().retryingText;
    try {
      await window.claudeUsage.forceRefreshNow();
    } catch {
      // Keep modal open
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });
}
