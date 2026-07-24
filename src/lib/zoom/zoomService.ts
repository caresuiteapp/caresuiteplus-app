import { invokeEdgeFunction } from '@/lib/supabase/edgeFunctions';

export type ZoomConnectionStatus =
  | 'not_connected'
  | 'authorizing'
  | 'connected'
  | 'degraded'
  | 'revoked'
  | 'error';

export type ZoomConnection = {
  status: ZoomConnectionStatus;
  email: string | null;
  displayName: string | null;
  accountType: number | null;
  scopes: string[];
  capabilities: {
    meetings: boolean;
    recordings: boolean;
    users: boolean;
    embeddedMeeting: boolean;
    webhooks: boolean;
  };
  settings: Record<string, unknown>;
};

export type ZoomMeeting = {
  id: string;
  topic: string;
  agenda: string | null;
  startTime: string;
  durationMinutes: number;
  timezone: string;
  status: 'scheduled' | 'started' | 'ended' | 'cancelled' | 'failed';
  clientId: string | null;
  employeeId: string | null;
  assignmentId: string | null;
  calendarEventId: string | null;
  consultationId: string | null;
  externalReference: string | null;
  portalReleased: boolean;
  portalJoinFrom: string | null;
  portalJoinUntil: string | null;
  recordingAllowed: boolean;
  consentRequired: boolean;
  consentStatus: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateZoomMeetingInput = {
  topic: string;
  agenda?: string;
  startTime: string;
  durationMinutes: number;
  timezone?: string;
  clientId?: string;
  employeeId?: string;
  assignmentId?: string;
  calendarEventId?: string;
  consultationId?: string;
  externalReference?: string;
  portalReleased?: boolean;
  portalJoinFrom?: string;
  portalJoinUntil?: string;
  waitingRoom?: boolean;
  joinBeforeHost?: boolean;
  muteUponEntry?: boolean;
  hostVideo?: boolean;
  participantVideo?: boolean;
  recordingAllowed?: boolean;
  recordingMode?: 'none' | 'local' | 'cloud';
  consentRequired?: boolean;
};

export type ZoomJoinContext = {
  meetingId: string;
  meetingNumber: string;
  topic: string;
  userName: string;
  userEmail?: string;
  passcode: string;
  joinUrl: string;
  sdkKey: string;
  signature: string;
  role: 0 | 1;
  zak?: string;
};

type AuthResponse = {
  connection?: ZoomConnection;
  authorizationUrl?: string;
};

async function zoomAction<T>(body: Record<string, unknown>): Promise<T> {
  const response = await invokeEdgeFunction<T>('zoom-api', body);
  if (!response.ok) throw new Error(response.error);
  return response.data;
}

export async function fetchZoomStatus(): Promise<ZoomConnection> {
  const response = await invokeEdgeFunction<AuthResponse>('zoom-auth', { action: 'status' });
  if (!response.ok) throw new Error(response.error);
  if (!response.data.connection) throw new Error('Zoom-Verbindungsstatus fehlt.');
  return response.data.connection;
}

export async function startZoomConnection(returnUrl: string): Promise<string> {
  const response = await invokeEdgeFunction<AuthResponse>('zoom-auth', {
    action: 'start',
    returnUrl,
  });
  if (!response.ok) throw new Error(response.error);
  if (!response.data.authorizationUrl) throw new Error('Zoom-Autorisierungsadresse fehlt.');
  return response.data.authorizationUrl;
}

export async function checkZoomConnection(): Promise<ZoomConnection> {
  const response = await invokeEdgeFunction<AuthResponse>('zoom-auth', { action: 'health' });
  if (!response.ok) throw new Error(response.error);
  if (!response.data.connection) throw new Error('Zoom-Verbindungsstatus fehlt.');
  return response.data.connection;
}

export async function disconnectZoom(): Promise<ZoomConnection> {
  const response = await invokeEdgeFunction<AuthResponse>('zoom-auth', { action: 'disconnect' });
  if (!response.ok) throw new Error(response.error);
  if (!response.data.connection) throw new Error('Zoom-Verbindungsstatus fehlt.');
  return response.data.connection;
}

export async function listZoomMeetings(): Promise<ZoomMeeting[]> {
  const response = await zoomAction<{ meetings: ZoomMeeting[] }>({ action: 'list' });
  return response.meetings;
}

export async function createZoomMeeting(input: CreateZoomMeetingInput): Promise<ZoomMeeting> {
  const response = await zoomAction<{ meeting: ZoomMeeting }>({ action: 'create', ...input });
  return response.meeting;
}

export async function cancelZoomMeeting(meetingId: string): Promise<ZoomMeeting> {
  const response = await zoomAction<{ meeting: ZoomMeeting }>({
    action: 'cancel',
    meetingId,
  });
  return response.meeting;
}

export async function getZoomJoinContext(
  meetingId: string,
  options: { host?: boolean; userName?: string; userEmail?: string } = {},
): Promise<ZoomJoinContext> {
  const response = await zoomAction<{ join: ZoomJoinContext }>({
    action: 'join-context',
    meetingId,
    ...options,
  });
  return response.join;
}
