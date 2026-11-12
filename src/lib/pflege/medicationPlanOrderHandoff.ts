import { randomUUID } from 'expo-crypto';
import { woundUuid } from './woundCareDomain';

type ActorScope = { tenantId: string; actorId: string };
export type MedicationPlanOrderHandoff = ActorScope & { clientId: string; importId: string; rowIndex: number };

const ttlMs = 5 * 60_000;
const maxEntries = 8;
const pending = new Map<string, { coordinates: MedicationPlanOrderHandoff; expiresAt: number; timer: ReturnType<typeof setTimeout> }>();

export function discardMedicationPlanOrderHandoff(token: string): void {
  const entry = pending.get(token);
  if (!entry) return;
  clearTimeout(entry.timer);
  pending.delete(token);
}

/** Only opaque tickets travel through navigation; the checked plan is read again at the destination. */
export function startMedicationPlanOrderHandoff(input: MedicationPlanOrderHandoff): string {
  const { tenantId, actorId, clientId, importId, rowIndex } = input;
  if (![tenantId, actorId, clientId, importId].every(woundUuid) || !Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= 200) {
    throw Error('Die bestätigte Position konnte nicht zum Formular geöffnet werden.');
  }
  const token = randomUUID();
  if (!woundUuid(token) || pending.has(token)) throw Error('Das Formular konnte nicht sicher geöffnet werden.');
  while (pending.size >= maxEntries) {
    const oldest = pending.keys().next().value;
    if (oldest === undefined) break;
    discardMedicationPlanOrderHandoff(oldest);
  }
  const timer = setTimeout(() => discardMedicationPlanOrderHandoff(token), ttlMs);
  pending.set(token, { coordinates: { tenantId, actorId, clientId, importId, rowIndex }, expiresAt: Date.now() + ttlMs, timer });
  return token;
}

export function takeMedicationPlanOrderHandoff(token: unknown, scope: ActorScope): MedicationPlanOrderHandoff | null {
  if (!woundUuid(token)) return null;
  const entry = pending.get(token);
  if (!entry) return null;
  discardMedicationPlanOrderHandoff(token);
  if (entry.expiresAt <= Date.now() || entry.coordinates.tenantId !== scope.tenantId || entry.coordinates.actorId !== scope.actorId) return null;
  return entry.coordinates;
}
