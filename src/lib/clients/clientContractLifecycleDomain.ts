export type ClientContractLifecycleKind = 'initial' | 'amendment' | 'closure';

export type ClientContractLifecycleEvent = {
  id: string;
  logicalContractId: string;
  sourceContractId: string;
  tenantId: string;
  clientId: string;
  version: number;
  kind: ClientContractLifecycleKind;
  effectiveOn: string;
  changeReason: string | null;
  consequences: string | null;
  predecessorEventId: string | null;
  contractNumber: string;
  contractPartner: string;
  serviceBasis: string;
  documentReference: string;
  contentFingerprint: string;
  recordedAt: string;
};

export type ClientContractServiceBinding = {
  id: string;
  tenantId: string;
  clientId: string;
  logicalContractId: string;
  lifecycleEventId: string;
  lifecycleVersion: number;
  lifecycleFingerprint: string;
  serviceEvidenceId: string;
  serviceOccurredOn: string;
  linkedAt: string;
};

export type ClientContractLifecycleProjection = {
  events: ClientContractLifecycleEvent[];
  state: 'active' | 'closed';
  currentEvent: ClientContractLifecycleEvent;
};

function required(value: string | null, label: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} fehlt.`);
}

function calendarDate(value: string, label: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} ist ungültig.`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} ist ungültig.`);
  }
}

function instantMicros(value: string, label: string): bigint {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?Z$/.exec(value);
  if (!match) throw new Error(`${label} ist ungültig.`);
  const wholeSecond = Date.parse(`${match[1]}Z`);
  if (Number.isNaN(wholeSecond) || new Date(wholeSecond).toISOString().slice(0, 19) !== match[1]) {
    throw new Error(`${label} ist ungültig.`);
  }
  return BigInt(wholeSecond) * 1000n + BigInt((match[2] ?? '').padEnd(6, '0'));
}

function validateEvent(event: ClientContractLifecycleEvent): void {
  for (const [value, label] of [
    [event.id, 'Lebenszyklus-ID'], [event.logicalContractId, 'Logische Vertrags-ID'],
    [event.sourceContractId, 'Native Vertrags-ID'],
    [event.tenantId, 'Mandant'], [event.clientId, 'Pflegefall'],
    [event.contractNumber, 'Vertragsnummer'], [event.contractPartner, 'Vertragspartner'],
    [event.serviceBasis, 'Leistungsgrundlage'], [event.documentReference, 'Originalbeleg'],
    [event.contentFingerprint, 'Inhaltsfingerprint'], [event.recordedAt, 'Erfassungszeitpunkt'],
  ] as const) required(value, label);
  if (!Number.isInteger(event.version) || event.version < 1) throw new Error('Vertragsversion ist ungültig.');
  if (!['initial', 'amendment', 'closure'].includes(event.kind)) throw new Error('Lebenszyklusart ist ungültig.');
  calendarDate(event.effectiveOn, 'Wirksamkeitsdatum');
  instantMicros(event.recordedAt, 'Erfassungszeitpunkt');
  if (event.kind === 'initial') {
    if (event.version !== 1 || event.predecessorEventId !== null) throw new Error('Erstfassung darf keinen Vorgänger haben.');
    if (event.changeReason !== null || event.consequences !== null) throw new Error('Erstfassung darf keine Änderungs- oder Schließungsfolge behaupten.');
  } else {
    if (event.version < 2) throw new Error('Änderung oder Schließung benötigt eine Folgeversion.');
    required(event.predecessorEventId, 'Native Vorgänger-ID');
    required(event.changeReason, 'Änderungs- oder Schließungsgrund');
    required(event.consequences, 'Dokumentierte Folgen');
  }
}

export function projectClientContractLifecycle(
  events: readonly ClientContractLifecycleEvent[],
): ClientContractLifecycleProjection {
  if (events.length === 0) throw new Error('Vertragshistorie fehlt.');
  const sorted = [...events].sort((left, right) => left.version - right.version);
  const ids = new Set<string>();
  const first = sorted[0]!;
  for (let index = 0; index < sorted.length; index += 1) {
    const event = sorted[index]!;
    validateEvent(event);
    if (ids.has(event.id)) throw new Error('Lebenszyklus-ID ist nicht eindeutig.');
    ids.add(event.id);
    if (event.tenantId !== first.tenantId || event.clientId !== first.clientId
      || event.logicalContractId !== first.logicalContractId || event.sourceContractId !== first.sourceContractId) {
      throw new Error('Vertragshistorie überschreitet Mandant, Pflegefall oder Vertragsidentität.');
    }
    if (event.version !== index + 1) throw new Error('Vertragsversionen sind nicht lückenlos.');
    if (index === 0) {
      if (event.kind !== 'initial') throw new Error('Vertragshistorie muss mit einer Erstfassung beginnen.');
      continue;
    }
    const predecessor = sorted[index - 1]!;
    if (predecessor.kind === 'closure') throw new Error('Nach einer Schließung ist keine Folgefassung zulässig.');
    if (event.predecessorEventId !== predecessor.id) throw new Error('Vertragsvorgänger ist nicht die unmittelbare Vorversion.');
    if (event.effectiveOn <= predecessor.effectiveOn) throw new Error('Wirksamkeitsdaten sind nicht streng aufsteigend.');
    if (instantMicros(event.recordedAt, 'Erfassungszeitpunkt') <= instantMicros(predecessor.recordedAt, 'Erfassungszeitpunkt')) {
      throw new Error('Erfassungszeiten sind nicht streng aufsteigend.');
    }
  }
  const currentEvent = sorted[sorted.length - 1]!;
  return { events: sorted, state: currentEvent.kind === 'closure' ? 'closed' : 'active', currentEvent };
}

export function selectClientContractEventForServiceDate(
  events: readonly ClientContractLifecycleEvent[],
  serviceOccurredOn: string,
): ClientContractLifecycleEvent | null {
  calendarDate(serviceOccurredOn, 'Leistungsdatum');
  const projection = projectClientContractLifecycle(events);
  const applicable = projection.events.filter((event) => event.effectiveOn <= serviceOccurredOn).at(-1);
  if (!applicable || applicable.kind === 'closure') return null;
  return applicable;
}

export function validateClientContractServiceBinding(
  binding: ClientContractServiceBinding,
  events: readonly ClientContractLifecycleEvent[],
): ClientContractLifecycleEvent {
  for (const [value, label] of [
    [binding.id, 'Zuordnungs-ID'], [binding.tenantId, 'Mandant'], [binding.clientId, 'Pflegefall'],
    [binding.logicalContractId, 'Logische Vertrags-ID'], [binding.lifecycleEventId, 'Lebenszyklus-ID'],
    [binding.lifecycleFingerprint, 'Lebenszyklus-Fingerprint'], [binding.serviceEvidenceId, 'Leistungsreferenz'],
    [binding.linkedAt, 'Zuordnungszeitpunkt'],
  ] as const) required(value, label);
  calendarDate(binding.serviceOccurredOn, 'Leistungsdatum');
  const linkedAtMicros = instantMicros(binding.linkedAt, 'Zuordnungszeitpunkt');
  if (!Number.isInteger(binding.lifecycleVersion) || binding.lifecycleVersion < 1) throw new Error('Gebundene Vertragsversion ist ungültig.');
  const projection = projectClientContractLifecycle(events);
  if (binding.tenantId !== projection.currentEvent.tenantId
    || binding.clientId !== projection.currentEvent.clientId
    || binding.logicalContractId !== projection.currentEvent.logicalContractId) {
    throw new Error('Leistungsreferenz gehört nicht zum Vertragsscope.');
  }
  const applicable = selectClientContractEventForServiceDate(projection.events, binding.serviceOccurredOn);
  if (!applicable) throw new Error('Für das Leistungsdatum ist keine aktive Vertragsfassung dokumentiert.');
  if (binding.lifecycleEventId !== applicable.id
    || binding.lifecycleVersion !== applicable.version
    || binding.lifecycleFingerprint !== applicable.contentFingerprint) {
    throw new Error('Leistungsreferenz ist nicht an die datumsgültige konkrete Vertragsfassung gebunden.');
  }
  if (linkedAtMicros < instantMicros(applicable.recordedAt, 'Erfassungszeitpunkt')) {
    throw new Error('Leistungsreferenz wurde vor der Vertragsfassung zugeordnet.');
  }
  return applicable;
}

export function validateClientContractLifecycleAppend(
  existingEvents: readonly ClientContractLifecycleEvent[],
  existingBindings: readonly ClientContractServiceBinding[],
  candidate: ClientContractLifecycleEvent,
): ClientContractLifecycleProjection {
  const existing = projectClientContractLifecycle(existingEvents);
  for (const binding of existingBindings) validateClientContractServiceBinding(binding, existing.events);
  if (candidate.tenantId !== existing.currentEvent.tenantId
    || candidate.clientId !== existing.currentEvent.clientId
    || candidate.logicalContractId !== existing.currentEvent.logicalContractId
    || candidate.sourceContractId !== existing.currentEvent.sourceContractId) {
    throw new Error('Neue Vertragsfassung gehört nicht zur bestehenden Vertragsidentität.');
  }
  if (existingBindings.some((binding) => binding.serviceOccurredOn >= candidate.effectiveOn)) {
    throw new Error('Rückwirkende Vertragsfassung würde bereits gebundene Leistungsreferenzen entwerten.');
  }
  return projectClientContractLifecycle([...existing.events, candidate]);
}
