export type AuthProviderType = 'stellar-wallet' | 'oauth' | 'api-key';
export type AuthProviderStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type SorobanAuthMode = 'Enforce' | 'Record' | 'RecordAllowNonroot';

export interface AuthProvider {
  id: string;
  type: AuthProviderType;
  label: string;
  description: string;
  status: AuthProviderStatus;
  identity?: string;
  errorMessage?: string;
  lastVerified?: string;
}

export interface AuthModeProbeResult {
  mode: SorobanAuthMode;
  status: 'ok' | 'diverged' | 'untested';
  notes?: string;
}

export function formatVerified(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return `Verified ${d.toLocaleString()}`;
  } catch {
    return '';
  }
}

export function validateAuthProvider(provider: AuthProvider): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!provider.id) errors.push('Provider ID is required');
  if (!['stellar-wallet', 'oauth', 'api-key'].includes(provider.type)) {
    errors.push('Invalid provider type');
  }
  
  if (provider.status === 'connected') {
    if (!provider.identity) errors.push('Identity is required when connected');
    if (!provider.lastVerified) errors.push('Last verified timestamp is required when connected');
  }
  
  if (provider.status === 'error' && !provider.errorMessage) {
    errors.push('Error message is required when status is error');
  }
  
  return { isValid: errors.length === 0, errors };
}

export function simulateAuthProbe(mode: SorobanAuthMode): Omit<AuthModeProbeResult, 'mode'> {
  switch (mode) {
    case 'Enforce':
      return { status: 'ok', notes: 'All invocations authorised correctly.' };
    case 'Record':
      return { status: 'diverged', notes: 'Unexpected auth footprint in 2 seeds.' };
    case 'RecordAllowNonroot':
      return { status: 'ok', notes: 'Non-root auth recorded successfully.' };
    default:
      return { status: 'untested' };
  }
}
