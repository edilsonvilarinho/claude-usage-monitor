// Fase 2: geração e verificação de JWT próprio (jose)

export function signJwt(_payload: Record<string, unknown>): Promise<string> {
  return Promise.reject(new Error('jwt.signJwt not implemented yet (Fase 2)'));
}

export function verifyJwt(_token: string): Promise<Record<string, unknown>> {
  return Promise.reject(new Error('jwt.verifyJwt not implemented yet (Fase 2)'));
}
