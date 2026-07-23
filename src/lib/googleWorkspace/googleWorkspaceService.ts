import { invokeEdgeFunction } from '@/lib/supabase/edgeFunctions';

export type GoogleWorkspaceCapability =
  | 'gmail'
  | 'calendar'
  | 'meet'
  | 'drive'
  | 'docs'
  | 'sheets'
  | 'slides'
  | 'tasks'
  | 'contacts'
  | 'chat';

export type GoogleWorkspaceConnectionStatus =
  | 'not_connected'
  | 'authorizing'
  | 'connected'
  | 'degraded'
  | 'revoked'
  | 'error';

export type GoogleWorkspaceConnection = {
  status: GoogleWorkspaceConnectionStatus;
  email: string | null;
  domain: string | null;
  expiresAt: string | null;
  scopes: string[];
  capabilities: Record<GoogleWorkspaceCapability, boolean>;
};

type AuthResponse = {
  connection?: GoogleWorkspaceConnection;
  authorizationUrl?: string;
};

export async function fetchGoogleWorkspaceStatus(): Promise<GoogleWorkspaceConnection> {
  const response = await invokeEdgeFunction<AuthResponse>('google-workspace-auth', { action: 'status' });
  if (!response.ok) throw new Error(response.error);
  if (!response.data.connection) throw new Error('Google-Workspace-Status fehlt.');
  return response.data.connection;
}
export async function startGoogleWorkspaceConnection(returnUrl: string): Promise<string> {
  const response = await invokeEdgeFunction<AuthResponse>('google-workspace-auth', {
    action: 'start',
    returnUrl,
  });
  if (!response.ok) throw new Error(response.error);
  if (!response.data.authorizationUrl) throw new Error('Google-Autorisierungsadresse fehlt.');
  return response.data.authorizationUrl;
}

export async function disconnectGoogleWorkspace(): Promise<GoogleWorkspaceConnection> {
  const response = await invokeEdgeFunction<AuthResponse>('google-workspace-auth', { action: 'disconnect' });
  if (!response.ok) throw new Error(response.error);
  if (!response.data.connection) throw new Error('Google-Workspace-Status fehlt.');
  return response.data.connection;
}

export async function invokeGoogleWorkspaceAction<T>(
  action: string,
  payload: Record<string, unknown> = {},
  confirmed = false,
): Promise<T> {
  const response = await invokeEdgeFunction<{ data: T }>('google-workspace-proxy', {
    action,
    payload,
    confirmed,
  });
  if (!response.ok) throw new Error(response.error);
  return response.data.data;
}
