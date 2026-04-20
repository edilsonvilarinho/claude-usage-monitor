let registered = false;

export function useCredentials(): void {
  if (registered) return;
  registered = true;

  window.claudeUsage.onCredentialMissing((credPath: string) => {
    console.log('[Renderer] onCredentialMissing:', credPath);
  });

  window.claudeUsage.onCredentialsExpired(() => {
    console.log('[Renderer] onCredentialsExpired fired');
  });
}
