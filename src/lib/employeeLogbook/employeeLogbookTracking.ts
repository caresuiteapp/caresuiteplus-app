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

function mapLocations(locations: Location.LocationObject[]): LogbookPoint[] { return locations.map((item) => ({ latitude: item.coords.latitude, longitude: item.coords.longitude, accuracy: item.coords.accuracy, altitude: item.coords.altitude, speed: item.coords.speed, heading: item.coords.heading, recordedAt: new Date(item.timestamp).toISOString() })); }

if (!TaskManager.isTaskDefined(TASK)) {
  TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(TASK, async ({ data, error }) => {
    if (error || !data) return;
    const raw = await AsyncStorage.getItem(CONTEXT); if (!raw) return;
    const context = JSON.parse(raw) as Context;
    const assistRaw = await AsyncStorage.getItem(ASSIST_CONTEXT);
    const assistContext = assistRaw
      ? JSON.parse(assistRaw) as Pick<Context, 'tenantId' | 'employeeId' | 'assistSessionId' | 'assistVisitId'>
      : null;
    const locations = (data as { locations?: Location.LocationObject[] }).locations ?? [];
    for (const point of mapLocations(locations)) {
      await persistLogbookPointDurably({ ...context, point });
      if (
        assistContext?.tenantId === context.tenantId &&
        assistContext.employeeId === context.employeeId &&
        assistContext.assistSessionId &&
        assistContext.assistVisitId
      ) {
        await persistAssistLocationPointDurably(context.tenantId, {
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
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') throw new Error('Standortzugriff wurde nicht freigegeben.');
  if (Platform.OS !== 'web') {
    const background = await Location.requestBackgroundPermissionsAsync();
    if (background.status !== 'granted') throw new Error('Hintergrundstandort ist für die automatische Aufzeichnung erforderlich.');
  }
}

export async function startNativeBackgroundTracking(context: Context) {
  await requestLogbookLocationPermission();
  await flushLogbookPointQueue();
  await AsyncStorage.setItem(CONTEXT, JSON.stringify(context));
  if (Platform.OS === 'web') return;
  if (await Location.hasStartedLocationUpdatesAsync(TASK)) return;
  await Location.startLocationUpdatesAsync(TASK, { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 10000, pausesUpdatesAutomatically: false, foregroundService: { notificationTitle: 'CareSuite Fahrtenbuch aktiv', notificationBody: 'Die dienstliche Fahrt wird sicher im Hintergrund aufgezeichnet.', notificationColor: '#0878F9' }, activityType: Location.ActivityType.AutomotiveNavigation, showsBackgroundLocationIndicator: true });
}

export async function stopNativeBackgroundTracking() {
  if (Platform.OS !== 'web' && await Location.hasStartedLocationUpdatesAsync(TASK)) await Location.stopLocationUpdatesAsync(TASK);
  await AsyncStorage.removeItem(CONTEXT);
  await AsyncStorage.removeItem(ASSIST_CONTEXT);
}

export async function linkActiveLogbookToAssistSession(input: {
  tenantId: string;
  employeeId: string;
  assistSessionId: string;
  assistVisitId: string;
}): Promise<void> {
  await AsyncStorage.setItem(ASSIST_CONTEXT, JSON.stringify(input));
}

export async function getCurrentLogbookPoint(): Promise<LogbookPoint> {
  const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }); return mapLocations([location])[0];
}
