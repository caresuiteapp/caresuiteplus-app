import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { appendLogbookPoints } from './employeeLogbookRepository.supabase';
import type { LogbookPoint } from '@/types/modules/employeeLogbook';

const TASK = 'caresuite-employee-logbook-location';
const CONTEXT = 'caresuite-employee-logbook-active-context';
type Context = { tripId: string; tenantId: string; employeeId: string };

function mapLocations(locations: Location.LocationObject[]): LogbookPoint[] { return locations.map((item) => ({ latitude: item.coords.latitude, longitude: item.coords.longitude, accuracy: item.coords.accuracy, altitude: item.coords.altitude, speed: item.coords.speed, heading: item.coords.heading, recordedAt: new Date(item.timestamp).toISOString() })); }

if (!TaskManager.isTaskDefined(TASK)) {
  TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(TASK, async ({ data, error }) => {
    if (error || !data) return;
    const raw = await AsyncStorage.getItem(CONTEXT); if (!raw) return;
    const context = JSON.parse(raw) as Context;
    const locations = (data as { locations?: Location.LocationObject[] }).locations ?? [];
    if (locations.length) await appendLogbookPoints(context.tripId, context.tenantId, context.employeeId, mapLocations(locations));
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
  await requestLogbookLocationPermission(); await AsyncStorage.setItem(CONTEXT, JSON.stringify(context));
  if (Platform.OS === 'web') return;
  if (await Location.hasStartedLocationUpdatesAsync(TASK)) return;
  await Location.startLocationUpdatesAsync(TASK, { accuracy: Location.Accuracy.High, distanceInterval: 20, timeInterval: 15000, pausesUpdatesAutomatically: false, foregroundService: { notificationTitle: 'CareSuite Fahrtenbuch aktiv', notificationBody: 'Die dienstliche Fahrt wird sicher im Hintergrund aufgezeichnet.', notificationColor: '#0878F9' }, activityType: Location.ActivityType.AutomotiveNavigation, showsBackgroundLocationIndicator: true });
}

export async function stopNativeBackgroundTracking() {
  if (Platform.OS !== 'web' && await Location.hasStartedLocationUpdatesAsync(TASK)) await Location.stopLocationUpdatesAsync(TASK);
  await AsyncStorage.removeItem(CONTEXT);
}

export async function getCurrentLogbookPoint(): Promise<LogbookPoint> {
  const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }); return mapLocations([location])[0];
}
