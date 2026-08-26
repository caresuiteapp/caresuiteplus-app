import AsyncStorage from '@react-native-async-storage/async-storage';
import { appendLocationPoint } from '@/lib/assist/assistTrackingPersistenceService';
import type { AssistLocationPointInsert } from '@/types/assistExecutionPersistence';

const STORAGE_KEY = 'caresuite:assist-location-point-queue:v1';
const MAX_QUEUED_POINTS = 2_000;

export type QueuedAssistLocationPoint = {
  id: string;
  tenantId: string;
  point: AssistLocationPointInsert;
  queuedAt: string;
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

async function readQueueUnlocked(): Promise<QueuedAssistLocationPoint[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed as QueuedAssistLocationPoint[] : [];
  } catch {
    return [];
  }
}

async function writeQueueUnlocked(queue: QueuedAssistLocationPoint[]): Promise<void> {
  if (queue.length === 0) {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return;
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue.slice(-MAX_QUEUED_POINTS)));
}

export async function enqueueAssistLocationPoint(
  tenantId: string,
  point: AssistLocationPointInsert,
): Promise<number> {
  return withQueueLock(async () => {
    const queue = await readQueueUnlocked();
    const duplicate = queue.some((item) =>
      item.tenantId === tenantId &&
      item.point.sessionId === point.sessionId &&
      item.point.recordedAt === point.recordedAt &&
      item.point.latitude === point.latitude &&
      item.point.longitude === point.longitude
    );
    if (!duplicate) {
      queue.push({ id: pointId(), tenantId, point, queuedAt: new Date().toISOString() });
      await writeQueueUnlocked(queue);
    }
    return queue.length;
  });
}

export async function persistAssistLocationPointDurably(
  tenantId: string,
  point: AssistLocationPointInsert,
): Promise<{ stored: boolean; queued: number }> {
  const result = await appendLocationPoint(tenantId, point);
  if (result.ok) return { stored: true, queued: 0 };
  return { stored: false, queued: await enqueueAssistLocationPoint(tenantId, point) };
}

export async function flushAssistLocationPointQueue(): Promise<{
  sent: number;
  remaining: number;
}> {
  return withQueueLock(async () => {
    const queue = await readQueueUnlocked();
    if (queue.length === 0) return { sent: 0, remaining: 0 };

    let sent = 0;
    const remaining: QueuedAssistLocationPoint[] = [];
    let connectionFailed = false;
    for (const item of queue) {
      if (connectionFailed) {
        remaining.push(item);
        continue;
      }
      const result = await appendLocationPoint(item.tenantId, item.point);
      if (result.ok) {
        sent += 1;
      } else {
        connectionFailed = true;
        remaining.push(item);
      }
    }
    await writeQueueUnlocked(remaining);
    return { sent, remaining: remaining.length };
  });
}

export async function getQueuedAssistLocationPointCount(): Promise<number> {
  return withQueueLock(async () => (await readQueueUnlocked()).length);
}

export async function resetAssistLocationPointQueueForTests(): Promise<void> {
  await withQueueLock(() => AsyncStorage.removeItem(STORAGE_KEY));
}
