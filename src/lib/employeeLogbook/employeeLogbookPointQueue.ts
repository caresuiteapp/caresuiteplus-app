import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LogbookPoint } from '@/types/modules/employeeLogbook';
import { appendLogbookPoints } from './employeeLogbookRepository.supabase';

const STORAGE_KEY = 'caresuite:employee-logbook-point-queue:v1';
const MAX_QUEUED_POINTS = 4_000;

type QueuedLogbookPoint = {
  id: string;
  tripId: string;
  tenantId: string;
  employeeId: string;
  point: LogbookPoint;
};

let queueLock: Promise<unknown> = Promise.resolve();

function withQueueLock<T>(task: () => Promise<T>): Promise<T> {
  const next = queueLock.then(task, task);
  queueLock = next.then(() => undefined, () => undefined);
  return next;
}

function pointId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function readQueueUnlocked(): Promise<QueuedLogbookPoint[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed as QueuedLogbookPoint[] : [];
  } catch {
    return [];
  }
}

async function writeQueueUnlocked(queue: QueuedLogbookPoint[]): Promise<void> {
  if (!queue.length) {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return;
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue.slice(-MAX_QUEUED_POINTS)));
}

async function enqueueLogbookPointUnlocked(input: Omit<QueuedLogbookPoint, 'id'>): Promise<number> {
  const queue = await readQueueUnlocked();
  const duplicate = queue.some((item) =>
    item.tripId === input.tripId &&
    item.point.recordedAt === input.point.recordedAt &&
    item.point.latitude === input.point.latitude &&
    item.point.longitude === input.point.longitude
  );
  if (!duplicate) queue.push({ ...input, id: pointId() });
  await writeQueueUnlocked(queue);
  return queue.length;
}

export async function persistLogbookPointDurably(input: {
  tripId: string;
  tenantId: string;
  employeeId: string;
  point: LogbookPoint;
}): Promise<{ stored: boolean; queued: number }> {
  try {
    await appendLogbookPoints(input.tripId, input.tenantId, input.employeeId, [input.point]);
    return { stored: true, queued: 0 };
  } catch {
    const queued = await withQueueLock(() => enqueueLogbookPointUnlocked(input));
    return { stored: false, queued };
  }
}

export async function flushLogbookPointQueue(): Promise<{ sent: number; remaining: number }> {
  return withQueueLock(async () => {
    const queue = await readQueueUnlocked();
    let sent = 0;
    const remaining: QueuedLogbookPoint[] = [];
    let connectionFailed = false;
    for (const item of queue) {
      if (connectionFailed) {
        remaining.push(item);
        continue;
      }
      try {
        await appendLogbookPoints(item.tripId, item.tenantId, item.employeeId, [item.point]);
        sent += 1;
      } catch {
        connectionFailed = true;
        remaining.push(item);
      }
    }
    await writeQueueUnlocked(remaining);
    return { sent, remaining: remaining.length };
  });
}

export async function resetLogbookPointQueueForTests(): Promise<void> {
  await withQueueLock(() => AsyncStorage.removeItem(STORAGE_KEY));
}
