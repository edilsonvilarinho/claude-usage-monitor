import AutoLaunch from 'auto-launch';
import { app } from 'electron';

const autoLauncher = new AutoLaunch({
  name: 'Claude Usage Monitor',
  path: app.getPath('exe'),
});

export async function setLaunchAtStartup(enabled: boolean): Promise<void> {
  try {
    const isEnabled = await autoLauncher.isEnabled();
    if (enabled && !isEnabled) {
      await autoLauncher.enable();
    } else if (!enabled && isEnabled) {
      await autoLauncher.disable();
    }
  } catch (err) {
    console.error('[StartupService] Failed to update startup setting:', err);
  }
}

export async function isLaunchAtStartupEnabled(): Promise<boolean> {
  try {
    return await autoLauncher.isEnabled();
  } catch {
    return false;
  }
}
