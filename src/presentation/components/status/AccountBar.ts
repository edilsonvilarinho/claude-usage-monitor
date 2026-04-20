import { fitWindow } from '../../layouts/PopupLayout';

type Profile = { account: { display_name: string; email: string; has_claude_pro: boolean; has_claude_max: boolean } };

export function applyProfile(profile: Profile): void {
  const avatarEl = document.getElementById('account-avatar');
  const nameEl = document.getElementById('account-name');
  const emailEl = document.getElementById('account-email');
  const planEl = document.getElementById('account-plan');
  const barEl = document.getElementById('account-bar');

  const name = profile.account.display_name || profile.account.email.split('@')[0];
  if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();
  if (nameEl) nameEl.textContent = name;
  if (emailEl) emailEl.textContent = profile.account.email;
  if (planEl) {
    if (profile.account.has_claude_max) {
      planEl.textContent = 'Max';
      planEl.className = 'account-plan plan-max';
    } else if (profile.account.has_claude_pro) {
      planEl.textContent = 'Pro';
      planEl.className = 'account-plan plan-pro';
    } else {
      planEl.textContent = 'Free';
      planEl.className = 'account-plan plan-free';
    }
  }
  if (barEl) {
    barEl.dataset.hasProfile = 'true';
    barEl.style.display = '';
    fitWindow();
  }
}
