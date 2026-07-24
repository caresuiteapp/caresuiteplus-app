import { useCallback, useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import {
  checkZoomConnection,
  createZoomMeeting,
  disconnectZoom,
  fetchZoomStatus,
  listZoomMeetings,
  startZoomConnection,
  type CreateZoomMeetingInput,
  type ZoomConnection,
  type ZoomMeeting,
} from '@/lib/zoom/zoomService';

export function useZoom() {
  const [connection, setConnection] = useState<ZoomConnection | null>(null);
  const [meetings, setMeetings] = useState<ZoomMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextConnection = await fetchZoomStatus();
      setConnection(nextConnection);
      setMeetings(nextConnection.status === 'connected' ? await listZoomMeetings() : []);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Zoom konnte nicht geladen werden.');
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
        : Linking.createURL('/business/connect/zoom');
      await Linking.openURL(await startZoomConnection(returnUrl));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Zoom-Verbindung konnte nicht gestartet werden.');
    } finally {
      setActionLoading(false);
    }
  }, []);

  const health = useCallback(async () => {
    setActionLoading(true);
    setError(null);
    try {
      setConnection(await checkZoomConnection());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Zoom-Verbindung konnte nicht geprüft werden.');
    } finally {
      setActionLoading(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setActionLoading(true);
    setError(null);
    try {
      setConnection(await disconnectZoom());
      setMeetings([]);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Zoom-Verbindung konnte nicht getrennt werden.');
    } finally {
      setActionLoading(false);
    }
  }, []);

  const createMeeting = useCallback(async (input: CreateZoomMeetingInput) => {
    setActionLoading(true);
    setError(null);
    try {
      const meeting = await createZoomMeeting(input);
      setMeetings((current) => [...current, meeting].sort((a, b) => a.startTime.localeCompare(b.startTime)));
      return meeting;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Zoom-Meeting konnte nicht erstellt werden.');
      return null;
    } finally {
      setActionLoading(false);
    }
  }, []);

  return {
    connection,
    meetings,
    loading,
    actionLoading,
    error,
    refresh,
    connect,
    health,
    disconnect,
    createMeeting,
  };
}
