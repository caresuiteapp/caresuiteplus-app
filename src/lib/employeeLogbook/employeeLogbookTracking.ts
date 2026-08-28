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

export async function requestLogbookLocationPermission() {
  const existingForeground = await Location.getForegroundPermissionsAsync();
  const foreground = existingForeground.status === 'granted'
    ? existingForeground
    : await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') throw new Error('Standortzugriff wurde nicht freigegeben.');
  if (Platform.OS !== 'web') {
    const existingBackground = await Location.getBackgroundPermissionsAsync();
    const background = existingBackground.status === 'granted'
      ? existingBackground
      : await Location.requestBackgroundPermissionsAsync();
    if (background.status !== 'granted') throw new Error('Hintergrundstandort ist für die automatische Aufzeichnung erforderlich.');
  }
}

async function ensureNativeTrackingTaskStarted(): Promise<void> {
  if (Platform.OS === 'web') return;
  await requestLogbookLocationPermission();
  if (await Location.hasStartedLocationUpdatesAsync(TASK)) return;
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

export async function startNativeBackgroundTracking(context: Context) {
  await requestLogbookLocationPermission();
  await flushLogbookPointQueue();
  await AsyncStorage.setItem(CONTEXT, JSON.stringify(context));
  await ensureNativeTrackingTaskStarted();
}

export async function stopNativeBackgroundTracking() {
  await AsyncStorage.removeItem(CONTEXT);
  await stopNativeTaskWhenUnused();
}

export async function linkActiveLogbookToAssistSession(input: {
  tenantId: string;
  employeeId: string;
  assistSessionId: string;
  assistVisitId: string;
}): Promise<void> {
  await AsyncStorage.setItem(ASSIST_CONTEXT, JSON.stringify(input));
  await ensureNativeTrackingTaskStarted();
}

export async function stopNativeAssistBackgroundTracking(): Promise<void> {
  await AsyncStorage.removeItem(ASSIST_CONTEXT);
  await stopNativeTaskWhenUnused();
}

export async function getCurrentLogbookPoint(): Promise<LogbookPoint> {
  const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }); return mapLocations([location])[0];
}
