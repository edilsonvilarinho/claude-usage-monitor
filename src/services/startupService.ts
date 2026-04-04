import { app } from 'electron';

export function setLaunchAtStartup(enabled: boolean): void {
  app.setLoginItemSettings({ openAtLogin: enabled });
}

export function isLaunchAtStartupEnabled(): boolean {
  return app.getLoginItemSettings().openAtLogin;
}
