import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import type { LogbookPoint } from '@/types/modules/employeeLogbook';
import { flushLogbookPointQueue, persistLogbookPointDurably } from './employeeLogbookPointQueue';
import { persistAssistLocationPointDurably } from '@/features/liveTracking/assistLocationPointQueue';

const TASK = 'caresuite-employee-logbook-location';
const CONTEXT = 'caresuite-employee-logbook-active-context';
const ASSIST_CONTEXT = 'caresuite-assist-background-location-context';
type Context = {
  tripId: string;
  tenantId: string;
  employeeId: string;
  assistSessionId?: string;
  assistVisitId?: string;
};

type AssistContext = Required<Pick<Context, 'tenantId' | 'employeeId' | 'assistSessionId' | 'assistVisitId'>>;
export type AssistTrackingScope = Partial<AssistContext>;
export type LogbookTrackingScope = Partial<Pick<Context, 'tripId' | 'tenantId' | 'employeeId'>>;
export type LogbookTrackingOptions = { shouldContinue?: () => boolean; onError?: (error: Error) => void; onPointPersisted?: () => void };
type StartRequest = { context: Context; cancelled: boolean; shouldContinue: () => boolean };
let currentLogbookStart: StartRequest | null = null;
let currentAssistStart: { context: AssistContext; cancelled: boolean; shouldContinue: () => boolean } | null = null;
let contextMutation: Promise<void> = Promise.resolve();

function serializeContextMutation<T>(operation: () => Promise<T>): Promise<T> {
  const result = contextMutation.then(operation, operation);
  contextMutation = result.then(() => undefined, () => undefined);
  return result;
}

function matchesScope(context: Context | null, scope?: LogbookTrackingScope): boolean {
  return !!context && (!scope || Object.entries(scope).every(([key, value]) => context[key as keyof Context] === value));
}

function matchesAssistScope(context: AssistContext | null, scope?: AssistTrackingScope): boolean {
  return !!context && (!scope || Object.entries(scope).every(([key, value]) => context[key as keyof AssistContext] === value));
}

function parseContext<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function mapLocations(locations: Location.LocationObject[]): LogbookPoint[] { return locations.map((item) => ({ latitude: item.coords.latitude, longitude: item.coords.longitude, accuracy: item.coords.accuracy, altitude: item.coords.altitude, speed: item.coords.speed, heading: item.coords.heading, recordedAt: new Date(item.timestamp).toISOString() })); }

if (!TaskManager.isTaskDefined(TASK)) {
  TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(TASK, async ({ data, error }) => {
    if (error || !data) return;
    const [raw, assistRaw] = await Promise.all([
      AsyncStorage.getItem(CONTEXT),
      AsyncStorage.getItem(ASSIST_CONTEXT),
    ]);
    const context = parseContext<Context>(raw);
    const assistContext = parseContext<AssistContext>(assistRaw);
    // The same native provider serves both consumers. An assignment remains
    // visible in Assist after the approach trip has already been completed.
    if (!context && !assistContext) return;
    const locations = (data as { locations?: Location.LocationObject[] }).locations ?? [];
    for (const point of mapLocations(locations)) {
      if (context) {
        await persistLogbookPointDurably({ ...context, point });
      }
      if (assistContext) {
        await persistAssistLocationPointDurably(assistContext.tenantId, {
          sessionId: assistContext.assistSessionId,
          visitId: assistContext.assistVisitId,
          latitude: point.latitude,
          longitude: point.longitude,
          accuracyMeters: point.accuracy,
          recordedAt: point.recordedAt,
          source: 'device',
        });
      }
    }
  });
}

export async function requestLogbookLocationPermission(shouldContinue: () => boolean = () => true): Promise<boolean> {
  if (!shouldContinue()) return false;
  const existingForeground = await Location.getForegroundPermissionsAsync();
  if (!shouldContinue()) return false;
  const foreground = existingForeground.status === 'granted'
    ? existingForeground
    : await Location.requestForegroundPermissionsAsync();
  if (!shouldContinue()) return false;
  if (foreground.status !== 'granted') throw new Error('Standortzugriff wurde nicht freigegeben.');
  if (Platform.OS !== 'web') {
    const existingBackground = await Location.getBackgroundPermissionsAsync();
    if (!shouldContinue()) return false;
    const background = existingBackground.status === 'granted'
      ? existingBackground
      : await Location.requestBackgroundPermissionsAsync();
    if (!shouldContinue()) return false;
    if (background.status !== 'granted') throw new Error('Hintergrundstandort ist für die automatische Aufzeichnung erforderlich.');
  }
  return shouldContinue();
}

async function ensureNativeTrackingTaskStarted(shouldContinue: () => boolean = () => true): Promise<boolean> {
  if (!shouldContinue()) return false;
  if (Platform.OS === 'web') return true;
  if (!await requestLogbookLocationPermission(shouldContinue) || !shouldContinue()) return false;
  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(TASK);
  if (!shouldContinue()) return false;
  if (alreadyStarted) return true;
  await Location.startLocationUpdatesAsync(TASK, {
    accuracy: Location.Accuracy.High,
    distanceInterval: 5,
    timeInterval: 10000,
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: 'CareSuite GPS-Aufzeichnung aktiv',
      notificationBody: 'Live-Status und dienstliche Fahrten werden sicher im Hintergrund erfasst.',
      notificationColor: '#0878F9',
    },
    activityType: Location.ActivityType.AutomotiveNavigation,
    showsBackgroundLocationIndicator: true,
  });
  return shouldContinue();
}

async function stopNativeTaskWhenUnused(): Promise<void> {
  if (Platform.OS === 'web') return;
  const [logbookContext, assistContext] = await Promise.all([
    AsyncStorage.getItem(CONTEXT),
    AsyncStorage.getItem(ASSIST_CONTEXT),
  ]);
  if (logbookContext || assistContext) return;
  if (await Location.hasStartedLocationUpdatesAsync(TASK)) {
    await Location.stopLocationUpdatesAsync(TASK);
  }
}

export async function startNativeBackgroundTracking(context: Context, options?: LogbookTrackingOptions): Promise<boolean> {
  const request: StartRequest = { context, cancelled: false, shouldContinue: options?.shouldContinue ?? (() => true) };
  currentLogbookStart = request;
  const canContinue = () => !request.cancelled && currentLogbookStart === request && request.shouldContinue();
  if (!await requestLogbookLocationPermission(canContinue) || !canContinue()) return false;
  await flushLogbookPointQueue();
  if (!canContinue()) return false;
  return serializeContextMutation(async () => {
    if (!canContinue()) return false;
    let completed = false;
    try {
      await AsyncStorage.setItem(CONTEXT, JSON.stringify(context));
      if (canContinue() && await ensureNativeTrackingTaskStarted(canContinue) && canContinue()) { completed = true; return true; }
      return false;
    } finally {
      // This cleanup owns only this context. A newer employee's context and
      // the Assist consumer are preserved, including during a late native start.
      if (!completed || !canContinue()) {
        const stored = parseContext<Context>(await AsyncStorage.getItem(CONTEXT));
        if (matchesScope(stored, context)) await AsyncStorage.removeItem(CONTEXT);
        await stopNativeTaskWhenUnused();
      }
    }
  });
}

export async function stopNativeBackgroundTracking(scope?: LogbookTrackingScope) {
  if (currentLogbookStart && matchesScope(currentLogbookStart.context, scope)) currentLogbookStart.cancelled = true;
  await serializeContextMutation(async () => {
    const stored = parseContext<Context>(await AsyncStorage.getItem(CONTEXT));
    if (matchesScope(stored, scope)) await AsyncStorage.removeItem(CONTEXT);
    await stopNativeTaskWhenUnused();
  });
}

export async function linkActiveLogbookToAssistSession(input: {
  tenantId: string;
  employeeId: string;
  assistSessionId: string;
  assistVisitId: string;
}, options?: LogbookTrackingOptions): Promise<boolean> {
  const request = { context: input, cancelled: false, shouldContinue: options?.shouldContinue ?? (() => true) };
  currentAssistStart = request;
  const canContinue = () => !request.cancelled && currentAssistStart === request && request.shouldContinue();
  if (!await requestLogbookLocationPermission(canContinue) || !canContinue()) return false;
  return serializeContextMutation(async () => {
    if (!canContinue()) return false;
    let completed = false;
    try {
      await AsyncStorage.setItem(ASSIST_CONTEXT, JSON.stringify(input));
      if (canContinue() && await ensureNativeTrackingTaskStarted(canContinue) && canContinue()) { completed = true; return true; }
      return false;
    } finally {
      if (!completed || !canContinue()) {
        const stored = parseContext<AssistContext>(await AsyncStorage.getItem(ASSIST_CONTEXT));
        if (matchesAssistScope(stored, input)) await AsyncStorage.removeItem(ASSIST_CONTEXT);
        await stopNativeTaskWhenUnused();
      }
    }
  });
}

export async function stopNativeAssistBackgroundTracking(scope?: AssistTrackingScope): Promise<void> {
  if (currentAssistStart && matchesAssistScope(currentAssistStart.context, scope)) currentAssistStart.cancelled = true;
  await serializeContextMutation(async () => {
    const stored = parseContext<AssistContext>(await AsyncStorage.getItem(ASSIST_CONTEXT));
    if (matchesAssistScope(stored, scope)) await AsyncStorage.removeItem(ASSIST_CONTEXT);
    await stopNativeTaskWhenUnused();
  });
}

export async function getCurrentLogbookPoint(): Promise<LogbookPoint> {
  const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }); return mapLocations([location])[0];
}
