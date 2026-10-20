import { useCallback, useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import {
  disconnectGoogleWorkspace,
  fetchGoogleWorkspaceStatus,
  startGoogleWorkspaceConnection,
  type GoogleWorkspaceConnection,
} from '@/lib/googleWorkspace/googleWorkspaceService';

export function useGoogleWorkspace() {
  const [connection, setConnection] = useState<GoogleWorkspaceConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setConnection(await fetchGoogleWorkspaceStatus());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Status konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const connect = useCallback(async () => {
    setActionLoading(true);
    setError(null);
    try {
      const returnUrl = typeof window !== 'undefined'
        ? window.location.href.split('?')[0]
        : Linking.createURL('/business/connect/google-workspace');
      await Linking.openURL(await startGoogleWorkspaceConnection(returnUrl));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Verbindung konnte nicht gestartet werden.');
    } finally {
      setActionLoading(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setActionLoading(true);
    setError(null);
    try {
      setConnection(await disconnectGoogleWorkspace());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Verbindung konnte nicht getrennt werden.');
    } finally {
      setActionLoading(false);
    }
  }, []);

  return { connection, loading, actionLoading, error, refresh, connect, disconnect };
}
