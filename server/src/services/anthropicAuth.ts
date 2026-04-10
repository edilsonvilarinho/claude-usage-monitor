// Fase 2: validar accessToken contra api.anthropic.com/api/oauth/profile

export async function validateAccessToken(_accessToken: string): Promise<{ email: string }> {
  throw new Error('anthropicAuth not implemented yet (Fase 2)');
}
