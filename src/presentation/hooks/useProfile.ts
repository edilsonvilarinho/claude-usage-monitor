let registered = false;

export function useProfile(): void {
  if (registered) return;
  registered = true;

  window.claudeUsage.onProfileUpdated(() => {
  });
}
