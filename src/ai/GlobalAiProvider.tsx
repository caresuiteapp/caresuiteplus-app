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
import { Alert, Platform } from 'react-native';
import { usePathname } from 'expo-router';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { resolveMainModuleFromPath } from '@/lib/navigation/resolvemainmodule';
import { getSupabaseClient } from '@/lib/supabase/client';
import { invokeEdgeFunction } from '@/lib/supabase/edgeFunctions';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { AiApprovalSheet } from './AiApprovalSheet';
import { dispatchAiNavigation, useAiNavigationBridge } from './aiNavigationBridge';
import type {
  AiDispatchResult,
  AiFunctionCallEvent,
  AiNavigationInstruction,
  AiPendingActionSummary,
  AiRealtimeTokenResponse,
} from './aiToolTypes';
import { useAiStore } from './useAiStore';
import { VoiceOrb } from './VoiceOrb';

type AiContextValue = {
  startVoice: () => Promise<void>;
  stopVoice: () => void;
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

  const {
    sessionId,
    setSessionId,
    pendingActions,
    addPendingAction,
    setCurrentContext,
  } = useAiStore();

  useEffect(() => {
    setCurrentContext({
      tenantId: tenantId ?? undefined,
      currentModule,
      currentRoute,
    });
  }, [tenantId, currentModule, currentRoute, setCurrentContext]);

  const cleanupVoice = useCallback(() => {
    setIsListening(false);
    setIsConnected(false);
    setIsSpeaking(false);

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

  useEffect(() => cleanupVoice, [cleanupVoice]);

  const handleToolResult = useCallback(
    (data: AiDispatchResult | null, errorMessage?: string) => {
      if (errorMessage) {
        return { ok: false, error: errorMessage };
      }

      const result = data?.result;
      if (result && 'pending_action_id' in result) {
        addPendingAction(result as AiPendingActionSummary);
      }

      if (result && 'type' in result && result.type === 'navigation_instruction') {
        dispatchAiNavigation(result as AiNavigationInstruction);
      }

      return data ?? { ok: false, error: 'Keine Antwort vom Tool-Dispatcher.' };
    },
    [addPendingAction],
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

      const dispatch = await invokeEdgeFunction<AiDispatchResult>('ai-action-dispatch', {
        tenant_id: tenantId,
        session_id: activeSessionId,
        tool_name: toolName,
        arguments: parsedArgs,
      });

      const output = dispatch.ok
        ? handleToolResult(dispatch.data)
        : { ok: false, error: dispatch.error };

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
    [handleToolResult, tenantId],
  );

  const handleRealtimeEvent = useCallback(
    async (event: AiFunctionCallEvent) => {
      if (event.type === 'response.output_audio.delta') {
        setIsSpeaking(true);
        return;
      }

      if (event.type === 'response.done') {
        window.setTimeout(() => setIsSpeaking(false), 600);
      }

      if (event.type === 'conversation.item.done' && event.item?.type === 'function_call') {
        await runToolCall(event.item);
      }

      if (event.type === 'response.function_call_arguments.done') {
        await runToolCall(event);
      }
    },
    [runToolCall],
  );

  const startVoice = useCallback(async () => {
    if (Platform.OS !== 'web') {
      Alert.alert(
        'VoiceCore',
        'Sprachsteuerung ist in der App v1 nur im Web verfügbar. Bitte CareSuite+ im Browser nutzen.',
      );
      return;
    }

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

    setIsStarting(true);
    try {
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
        throw new Error(tokenResponse.error);
      }

      const payload = tokenResponse.data;
      if (payload.session_id) {
        setSessionId(payload.session_id);
      }

      const clientSecret =
        payload.realtime?.value ?? payload.realtime?.client_secret?.value ?? null;

      if (!clientSecret) {
        throw new Error('Realtime client secret fehlt');
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
        window.setTimeout(() => setIsSpeaking(false), 800);
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = mediaStream;
      pc.addTrack(mediaStream.getTracks()[0]);

      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.onopen = () => {
        setIsConnected(true);
        setIsListening(true);
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

      const sdpResponse = await fetch('https://api.openai.com/v1/realtime?model=gpt-realtime', {
        method: 'POST',
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${clientSecret}`,
          'Content-Type': 'application/sdp',
        },
      });

      if (!sdpResponse.ok) {
        throw new Error(await sdpResponse.text());
      }

      await pc.setRemoteDescription({
        type: 'answer',
        sdp: await sdpResponse.text(),
      });
    } catch (error) {
      cleanupVoice();
      Alert.alert(
        'VoiceCore',
        error instanceof Error ? error.message : 'Sprachverbindung fehlgeschlagen.',
      );
    } finally {
      setIsStarting(false);
    }
  }, [
    cleanupVoice,
    currentModule,
    currentRoute,
    handleRealtimeEvent,
    sessionId,
    setSessionId,
    tenantId,
  ]);

  const stopVoice = useCallback(() => {
    cleanupVoice();
  }, [cleanupVoice]);

  const value = useMemo(
    () => ({
      startVoice,
      stopVoice,
      isConnected,
      isListening,
      isSpeaking,
      isStarting,
    }),
    [isConnected, isListening, isSpeaking, isStarting, startVoice, stopVoice],
  );

  const showAi =
    authReady &&
    isAuthenticated &&
    Boolean(tenantId) &&
    !pathname.startsWith('/auth') &&
    pathname !== '/';

  return (
    <AiContext.Provider value={value}>
      {children}
      {showAi ? (
        <>
          <VoiceOrb
            isConnected={isConnected}
            isListening={isListening}
            isSpeaking={isSpeaking}
            onPress={isConnected ? stopVoice : () => void startVoice()}
            disabled={isStarting}
          />
          <AiApprovalSheet pendingActions={pendingActions} tenantId={tenantId!} />
        </>
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
