import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Alert, Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { usePathname } from 'expo-router';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { resolveMainModuleFromPath } from '@/lib/navigation/resolvemainmodule';
import { getSupabaseClient } from '@/lib/supabase/client';
import { invokeEdgeFunction } from '@/lib/supabase/edgeFunctions';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { AiApprovalSheet } from './AiApprovalSheet';
import { AiMiniPanel } from './AiMiniPanel';
import { dispatchAiNavigation, useAiNavigationBridge } from './aiNavigationBridge';
import { getRegisteredPageContext } from './registerAiPageContext';
import type {
  AiDispatchResult,
  AiFunctionCallEvent,
  AiNavigationInstruction,
  AiPendingActionSummary,
  AiRealtimeTokenResponse,
} from './aiToolTypes';
import { useAiStore } from './useAiStore';
import {
  getMicrophoneDeniedMessage,
  getRealtimeVoiceUnsupportedMessage,
  isRealtimeVoiceEnvironmentSupported,
  requestMicrophoneAccess,
} from '@/lib/platform/microphonePermission';
import { VoiceOrb } from './VoiceOrb';
import {
  extractRealtimeClientSecret,
  getRealtimeCallsUrl,
  parseVoiceErrorMessage,
} from './voiceRealtimeUtils';

type AiContextValue = {
  startVoice: () => Promise<void>;
  stopVoice: () => void;
  openPanel: () => void;
  closePanel: () => void;
  isConnected: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isStarting: boolean;
};

const AiContext = createContext<AiContextValue | null>(null);

type GlobalAiProviderProps = {
  children: ReactNode;
};

export function GlobalAiProvider({ children }: GlobalAiProviderProps) {
  const pathname = usePathname();
  const { isAuthenticated, authReady } = useAuth();
  const tenantId = useServiceTenantId();
  const currentModule = resolveMainModuleFromPath(pathname);
  const currentRoute = pathname;

  useAiNavigationBridge();

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isToolLoading, setIsToolLoading] = useState(false);

  const {
    sessionId,
    setSessionId,
    pendingActions,
    addPendingAction,
    setCurrentContext,
    panelOpen,
    setPanelOpen,
    status,
    setStatus,
    messages,
    lastGoal,
    lastStep,
    memorySummary,
    setErrorMessage,
  } = useAiStore();

  useEffect(() => {
    setCurrentContext({
      tenantId: tenantId ?? undefined,
      currentModule,
      currentRoute,
    });
  }, [tenantId, currentModule, currentRoute, setCurrentContext]);

  const teardownVoiceConnection = useCallback(() => {
    dcRef.current?.close();
    dcRef.current = null;

    pcRef.current?.close();
    pcRef.current = null;

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;

    if (audioRef.current) {
      audioRef.current.srcObject = null;
      audioRef.current = null;
    }
  }, []);

  const cleanupVoice = useCallback(
    (options?: { preserveError?: boolean }) => {
      setIsListening(false);
      setIsConnected(false);
      setIsSpeaking(false);
      setIsToolLoading(false);
      if (!options?.preserveError) {
        setStatus('ready');
      }
      teardownVoiceConnection();
    },
    [setStatus, teardownVoiceConnection],
  );

  useEffect(() => () => teardownVoiceConnection(), [teardownVoiceConnection]);

  const handleToolResult = useCallback(
    (data: AiDispatchResult | null, errorMessage?: string) => {
      if (errorMessage) {
        setErrorMessage(errorMessage);
        return { ok: false, error: errorMessage };
      }

      const result = data?.result;
      if (result && typeof result === 'object' && 'pending_action_id' in result) {
        addPendingAction(result as AiPendingActionSummary);
      }

      if (
        result &&
        typeof result === 'object' &&
        'type' in result &&
        result.type === 'navigation_instruction'
      ) {
        dispatchAiNavigation(result as AiNavigationInstruction);
      }

      return data ?? { ok: false, error: 'Keine Antwort vom Tool-Dispatcher.' };
    },
    [addPendingAction, setErrorMessage],
  );

  const runToolCall = useCallback(
    async (functionCall: AiFunctionCallEvent) => {
      if (!tenantId) return;

      const activeSessionId = useAiStore.getState().sessionId;
      if (!activeSessionId) return;

      const toolName = functionCall.name ?? functionCall.item?.name;
      const callId = functionCall.call_id ?? functionCall.item?.call_id;
      const rawArgs = functionCall.arguments ?? functionCall.item?.arguments ?? '{}';

      if (!toolName || !callId) return;

      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs =
          typeof rawArgs === 'string' ? (JSON.parse(rawArgs) as Record<string, unknown>) : rawArgs;
      } catch {
        parsedArgs = {};
      }

      setIsToolLoading(true);
      setStatus('tool_loading');

      const dispatch = await invokeEdgeFunction<AiDispatchResult>('ai-action-dispatch', {
        tenant_id: tenantId,
        session_id: activeSessionId,
        tool_name: toolName,
        arguments: parsedArgs,
        page_context: getRegisteredPageContext(),
      });

      setIsToolLoading(false);

      const output = dispatch.ok
        ? handleToolResult(dispatch.data)
        : { ok: false, error: dispatch.error };

      if (!dispatch.ok) {
        setErrorMessage(dispatch.error);
      } else {
        setStatus(pendingActions.length > 0 ? 'pending' : 'ready');
      }

      dcRef.current?.send(
        JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: callId,
            output: JSON.stringify(output),
          },
        }),
      );

      dcRef.current?.send(JSON.stringify({ type: 'response.create' }));
    },
    [handleToolResult, pendingActions.length, setErrorMessage, setStatus, tenantId],
  );

  const handleRealtimeEvent = useCallback(
    async (event: AiFunctionCallEvent) => {
      if (event.type === 'response.output_audio.delta') {
        setIsSpeaking(true);
        setStatus('speaking');
        return;
      }

      if (event.type === 'response.done') {
        window.setTimeout(() => {
          setIsSpeaking(false);
          setStatus('ready');
        }, 600);
      }

      if (event.type === 'conversation.item.done' && event.item?.type === 'function_call') {
        await runToolCall(event.item);
      }

      if (event.type === 'response.function_call_arguments.done') {
        await runToolCall(event);
      }
    },
    [runToolCall, setStatus],
  );

  const formatVoiceError = useCallback((error: unknown): string => {
    const raw = parseVoiceErrorMessage(
      error instanceof Error ? error.message : String(error ?? ''),
    );

    if (/NotAllowedError|Permission denied|permission/i.test(raw)) {
      return getMicrophoneDeniedMessage();
    }
    if (/NotFoundError|Requested device not found/i.test(raw)) {
      return 'Kein Mikrofon gefunden. Bitte schließe ein Mikrofon an oder prüfe die Geräteeinstellungen.';
    }
    if (/invalid jwt|jwt expired|invalid token|401|unauthorized/i.test(raw)) {
      return 'Bitte melde dich erneut an, um die Sprachsteuerung zu nutzen.';
    }
    if (/OPENAI_API_KEY not configured|server-konfiguration|OpenAI API-Schlüssel/i.test(raw)) {
      return 'Sprachassistent ist derzeit nicht eingerichtet (Server-Konfiguration). Text-Chat bleibt verfügbar.';
    }
    if (/No tenant access|Kein Zugriff auf den Mandanten|tenant_id/i.test(raw)) {
      return 'Kein Zugriff auf den Mandanten für den Sprachassistenten.';
    }
    if (/Nicht angemeldet|access_token/i.test(raw)) {
      return 'Bitte melde dich erneut an, um die Sprachsteuerung zu nutzen.';
    }
    if (/Realtime client secret fehlt/i.test(raw)) {
      return 'Sprachverbindung konnte nicht vorbereitet werden. Bitte versuche es später erneut.';
    }
    if (/model_not_found|does not exist|nicht verfügbar/i.test(raw)) {
      return 'Das Realtime-Sprachmodell ist derzeit nicht verfügbar. Text-Chat bleibt nutzbar.';
    }
    if (/invalid schema|invalid tools|Tool-Konfiguration/i.test(raw)) {
      return 'Sprachassistent startet im eingeschränkten Modus. Bitte erneut versuchen oder Text-Chat nutzen.';
    }
    if (/Failed to fetch|NetworkError|network|Netzwerkfehler/i.test(raw)) {
      return 'Netzwerkfehler bei der Sprachverbindung. Bitte Internetverbindung prüfen und erneut versuchen.';
    }
    if (/Edge Function returned a non-2xx|FunctionsHttpError/i.test(raw)) {
      return 'Sprachverbindung fehlgeschlagen. Bitte versuche es erneut oder nutze den Text-Chat.';
    }

    const trimmed = raw.trim();
    if (trimmed.length > 180) {
      return 'Sprachverbindung fehlgeschlagen. Bitte versuche es erneut oder nutze den Text-Chat.';
    }
    return trimmed || 'Sprachverbindung fehlgeschlagen. Bitte versuche es erneut oder nutze den Text-Chat.';
  }, []);

  const startVoice = useCallback(async () => {
    if (!tenantId) {
      Alert.alert('VoiceCore', 'Kein Mandant am Profil hinterlegt.');
      return;
    }

    if (!isSupabaseConfigured()) {
      Alert.alert('VoiceCore', 'Live-Sprachassistent benötigt eine Supabase-Verbindung.');
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      Alert.alert('VoiceCore', 'Supabase-Client nicht verfügbar.');
      return;
    }

    if (isStarting || isConnected) {
      return;
    }

    setPanelOpen(true);
    setErrorMessage(null);
    setIsStarting(true);
    setStatus('thinking');

    let preflightStream: MediaStream | null = null;

    try {
      const micAccess = await requestMicrophoneAccess();
      if (!micAccess.ok) {
        throw new Error(micAccess.error);
      }
      preflightStream = micAccess.stream;

      if (!isRealtimeVoiceEnvironmentSupported()) {
        throw new Error(getRealtimeVoiceUnsupportedMessage());
      }

      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.warn('[VoiceCore] session refresh failed:', refreshError.message);
      }

      const { data: authData } = await supabase.auth.getSession();
      if (!authData.session?.access_token) {
        throw new Error('Nicht angemeldet');
      }

      const tokenResponse = await invokeEdgeFunction<AiRealtimeTokenResponse>('ai-realtime-token', {
        tenant_id: tenantId,
        session_id: sessionId,
        current_module: currentModule,
        current_route: currentRoute,
      });

      if (!tokenResponse.ok) {
        throw new Error(parseVoiceErrorMessage(tokenResponse.error));
      }

      const payload = tokenResponse.data;
      if (payload.session_id) {
        setSessionId(payload.session_id);
      }

      const clientSecret = extractRealtimeClientSecret(payload);

      if (!clientSecret) {
        throw new Error('Realtime client secret fehlt — OPENAI_API_KEY gesetzt?');
      }

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      audioRef.current = document.createElement('audio');
      audioRef.current.autoplay = true;

      pc.ontrack = (event) => {
        if (audioRef.current) {
          audioRef.current.srcObject = event.streams[0];
        }
        setIsSpeaking(true);
        setStatus('speaking');
        window.setTimeout(() => {
          setIsSpeaking(false);
          setStatus('ready');
        }, 800);
      };

      const mediaStream = preflightStream;
      if (!mediaStream) {
        throw new Error('Mikrofon-Stream nicht verfügbar.');
      }

      mediaStreamRef.current = mediaStream;
      const audioTrack = mediaStream.getAudioTracks()[0];
      if (!audioTrack) {
        throw new Error('Kein Mikrofon-Audiokanal verfügbar.');
      }
      pc.addTrack(audioTrack, mediaStream);

      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.onopen = () => {
        setIsConnected(true);
        setIsListening(true);
        setStatus('listening');
      };

      dc.onclose = () => {
        cleanupVoice();
      };

      dc.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as AiFunctionCallEvent;
          void handleRealtimeEvent(payload);
        } catch {
          // ignore malformed events
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch(getRealtimeCallsUrl(), {
        method: 'POST',
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${clientSecret}`,
          'Content-Type': 'application/sdp',
        },
      });

      if (!sdpResponse.ok) {
        const sdpError = await sdpResponse.text();
        throw new Error(
          sdpResponse.status === 401 || sdpResponse.status === 403
            ? 'Sprachverbindung abgelehnt — Sitzung abgelaufen oder ungültig.'
            : sdpError || `OpenAI Realtime Fehler (${sdpResponse.status})`,
        );
      }

      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp,
      });
    } catch (error) {
      preflightStream?.getTracks().forEach((track) => track.stop());
      cleanupVoice({ preserveError: true });
      const message = formatVoiceError(error);
      setErrorMessage(message);
    } finally {
      setIsStarting(false);
    }
  }, [
    cleanupVoice,
    currentModule,
    currentRoute,
    formatVoiceError,
    handleRealtimeEvent,
    isConnected,
    isStarting,
    sessionId,
    setErrorMessage,
    setPanelOpen,
    setSessionId,
    setStatus,
    tenantId,
  ]);

  const stopVoice = useCallback(() => {
    cleanupVoice();
  }, [cleanupVoice]);

  const resetVoiceUiState = useCallback(() => {
    if (!isConnected && !isStarting) {
      setErrorMessage(null);
      setStatus('ready');
    }
  }, [isConnected, isStarting, setErrorMessage, setStatus]);

  const openPanel = useCallback(() => {
    resetVoiceUiState();
    setPanelOpen(true);
  }, [resetVoiceUiState, setPanelOpen]);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
    resetVoiceUiState();
  }, [resetVoiceUiState, setPanelOpen]);

  const value = useMemo(
    () => ({
      startVoice,
      stopVoice,
      openPanel,
      closePanel,
      isConnected,
      isListening,
      isSpeaking,
      isStarting,
    }),
    [
      closePanel,
      isConnected,
      isListening,
      isSpeaking,
      isStarting,
      openPanel,
      startVoice,
      stopVoice,
    ],
  );

  const showAi =
    authReady &&
    isAuthenticated &&
    Boolean(tenantId) &&
    !pathname.startsWith('/auth') &&
    pathname !== '/';

  const handleOrbPress = useCallback(() => {
    openPanel();
  }, [openPanel]);

  const aiOverlayStyle = useMemo((): ViewStyle => {
    if (Platform.OS === 'web') {
      return {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 150,
        pointerEvents: 'box-none',
      } as ViewStyle;
    }
    return { ...StyleSheet.absoluteFillObject, zIndex: 150, pointerEvents: 'box-none' };
  }, []);

  return (
    <AiContext.Provider value={value}>
      {children}
      {showAi ? (
        <View style={aiOverlayStyle} pointerEvents="box-none">
          <VoiceOrb
            isConnected={isConnected}
            isListening={isListening}
            isSpeaking={isSpeaking}
            isToolLoading={isToolLoading}
            hasPending={pendingActions.length > 0}
            status={status}
            onPress={handleOrbPress}
            onLongPress={stopVoice}
            disabled={isStarting}
          />
          <AiMiniPanel
            visible={panelOpen}
            onClose={closePanel}
            tenantId={tenantId!}
            currentModule={currentModule}
            currentRoute={currentRoute}
            pendingActions={pendingActions}
            messages={messages}
            lastGoal={lastGoal}
            lastStep={lastStep}
            memorySummary={memorySummary}
            onStartVoice={() => void startVoice()}
            onStopVoice={stopVoice}
            isListening={isListening}
            isStartingVoice={isStarting}
            voiceAvailable={Platform.OS === 'web'}
            onReviewDraft={() => closePanel()}
          />
          <AiApprovalSheet pendingActions={pendingActions} tenantId={tenantId!} />
        </View>
      ) : null}
    </AiContext.Provider>
  );
}

export function useCareAi(): AiContextValue {
  const ctx = useContext(AiContext);
  if (!ctx) {
    throw new Error('useCareAi must be used inside GlobalAiProvider');
  }
  return ctx;
}
