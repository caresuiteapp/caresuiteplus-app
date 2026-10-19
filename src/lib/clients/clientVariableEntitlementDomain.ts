const MAX_QUANTITY_SCALED = 99_999_999_999;

export type ClientVariableEntitlementKind = 'money' | 'hours' | 'days' | 'units';
export type ClientVariableEntitlementConsumptionKind = 'usage' | 'correction' | 'cancellation';

export type ClientVariableEntitlementVersion = {
  id: string;
  logicalEntitlementId: string;
  tenantId: string;
  clientId: string;
  financingPathId: string;
  version: number;
  entitlementKind: ClientVariableEntitlementKind;
  unit: string;
  allocatedQuantity: string;
  decisionDocumentId: string;
  decisionReference: string;
  decisionIssuedOn: string;
  validFrom: string;
  validUntil: string | null;
  predecessorVersionId: string | null;
  changeReason: string | null;
  basisFingerprint: string;
  recordedAt: string;
};

export type ClientVariableEntitlementConsumption = {
  id: string;
  tenantId: string;
  clientId: string;
  financingPathId: string;
  entitlementVersionId: string;
  logicalEntitlementId: string;
  entitlementVersion: number;
  entitlementKind: ClientVariableEntitlementKind;
  unit: string;
  basisFingerprint: string;
  serviceOn: string;
  quantity: string;
  eventKind: ClientVariableEntitlementConsumptionKind;
  supersedesEventId: string | null;
  evidenceReference: string;
  reason: string | null;
  recordedAt: string;
};

export type ClientVariableEntitlementProjection = {
  version: ClientVariableEntitlementVersion;
  allocatedQuantityScaled: number;
  consumedQuantityScaled: number;
  remainingQuantityScaled: number;
  effectiveEvents: ClientVariableEntitlementConsumption[];
  history: ClientVariableEntitlementConsumption[];
};

export type ClientVariableEntitlementEvaluation = {
  state: 'documented_current' | 'not_documented';
  version: ClientVariableEntitlementVersion | null;
  reason: string;
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

export function parseClientVariableEntitlementQuantity(value: string, label = 'Menge'): number {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(value)) throw new Error(`${label} ist ungültig.`);
  const [whole, fraction = ''] = value.split('.');
  const scaled = Number(whole) * 10_000 + Number(fraction.padEnd(4, '0'));
  if (!Number.isSafeInteger(scaled) || scaled < 0 || scaled > MAX_QUANTITY_SCALED) {
    throw new Error(`${label} ist ungültig.`);
  }
  return scaled;
}

function validateVersion(version: ClientVariableEntitlementVersion): void {
  for (const [value, label] of [
    [version.id, 'Anspruchsfassungs-ID'], [version.logicalEntitlementId, 'Logische Anspruchs-ID'],
    [version.tenantId, 'Mandant'], [version.clientId, 'Pflegefall'],
    [version.financingPathId, 'Finanzierungsweg'], [version.unit, 'Anspruchseinheit'],
    [version.decisionDocumentId, 'Bescheid-ID'], [version.decisionReference, 'Bescheidreferenz'],
    [version.basisFingerprint, 'Grundlagenfingerabdruck'], [version.recordedAt, 'Erfassungszeit'],
  ] as const) required(value, label);
  if (!Number.isInteger(version.version) || version.version < 1) throw new Error('Anspruchsversion ist ungültig.');
  if (!['money', 'hours', 'days', 'units'].includes(version.entitlementKind)) throw new Error('Anspruchsart ist ungültig.');
  if (parseClientVariableEntitlementQuantity(version.allocatedQuantity, 'Anspruchsmenge') <= 0) {
    throw new Error('Anspruchsmenge muss positiv sein.');
  }
  calendarDate(version.decisionIssuedOn, 'Bescheiddatum');
  calendarDate(version.validFrom, 'Anspruchsbeginn');
  if (version.validUntil !== null) {
    calendarDate(version.validUntil, 'Anspruchsende');
    if (version.validUntil < version.validFrom) throw new Error('Anspruchszeitraum ist umgekehrt.');
  }
  instantMicros(version.recordedAt, 'Erfassungszeit');
  if (version.version === 1) {
    if (version.predecessorVersionId !== null) throw new Error('Erste Anspruchsfassung darf keinen Vorgänger haben.');
    if (version.changeReason !== null) throw new Error('Erste Anspruchsfassung darf keinen Änderungsgrund behaupten.');
  } else {
    required(version.predecessorVersionId, 'Anspruchsvorgänger');
    required(version.changeReason, 'Änderungsgrund');
  }
}

export function projectClientVariableEntitlementHistory(
  versions: readonly ClientVariableEntitlementVersion[],
): ClientVariableEntitlementVersion[] {
  if (versions.length === 0) throw new Error('Anspruchshistorie fehlt.');
  const sorted = [...versions].sort((left, right) => left.version - right.version);
  const first = sorted[0]!;
  const ids = new Set<string>();
  for (let index = 0; index < sorted.length; index += 1) {
    const version = sorted[index]!;
    validateVersion(version);
    if (ids.has(version.id)) throw new Error('Anspruchsfassungs-ID ist nicht eindeutig.');
    ids.add(version.id);
    if (version.logicalEntitlementId !== first.logicalEntitlementId
      || version.tenantId !== first.tenantId || version.clientId !== first.clientId
      || version.financingPathId !== first.financingPathId
      || version.entitlementKind !== first.entitlementKind || version.unit !== first.unit) {
      throw new Error('Anspruchshistorie überschreitet Mandant, Pflegefall, Finanzierungsweg oder Anspruchsart.');
    }
    if (version.version !== index + 1) throw new Error('Anspruchsversionen sind nicht lückenlos.');
    if (index === 0) continue;
    const predecessor = sorted[index - 1]!;
    if (version.predecessorVersionId !== predecessor.id) {
      throw new Error('Anspruchsvorgänger ist nicht die unmittelbare Vorversion.');
    }
    if (predecessor.validUntil === null || predecessor.validUntil >= version.validFrom) {
      throw new Error('Anspruchsfassungen überlappen oder der Vorgänger ist nicht beendet.');
    }
    if (version.decisionIssuedOn <= predecessor.decisionIssuedOn) {
      throw new Error('Neuer Bescheid ist nicht später als die Vorfassung.');
    }
    if (version.decisionDocumentId === predecessor.decisionDocumentId
      || version.basisFingerprint === predecessor.basisFingerprint) {
      throw new Error('Anspruchsänderung benötigt eine neue individuelle Bescheidfassung.');
    }
    if (instantMicros(version.recordedAt, 'Erfassungszeit') <= instantMicros(predecessor.recordedAt, 'Erfassungszeit')) {
      throw new Error('Erfassungszeiten der Anspruchsfassungen sind nicht streng aufsteigend.');
    }
  }
  return sorted;
}

function validatedHistories(
  versions: readonly ClientVariableEntitlementVersion[],
): ClientVariableEntitlementVersion[][] {
  const grouped = new Map<string, ClientVariableEntitlementVersion[]>();
  const ids = new Set<string>();
  for (const version of versions) {
    if (ids.has(version.id)) throw new Error('Anspruchsfassungs-ID ist nicht global eindeutig.');
    ids.add(version.id);
    const existing = grouped.get(version.logicalEntitlementId) ?? [];
    existing.push(version);
    grouped.set(version.logicalEntitlementId, existing);
  }
  return [...grouped.values()].map(projectClientVariableEntitlementHistory);
}

export function evaluateClientVariableEntitlement(
  versions: readonly ClientVariableEntitlementVersion[],
  scope: {
    tenantId: string;
    clientId: string;
    financingPathId: string;
    entitlementKind: ClientVariableEntitlementKind;
    serviceOn: string;
  },
): ClientVariableEntitlementEvaluation {
  required(scope.tenantId, 'Mandant');
  required(scope.clientId, 'Pflegefall');
  required(scope.financingPathId, 'Finanzierungsweg');
  if (!['money', 'hours', 'days', 'units'].includes(scope.entitlementKind)) throw new Error('Anspruchsart ist ungültig.');
  calendarDate(scope.serviceOn, 'Leistungsdatum');
  const candidates = validatedHistories(versions).flat().filter((version) => (
    version.tenantId === scope.tenantId && version.clientId === scope.clientId
    && version.financingPathId === scope.financingPathId
    && version.entitlementKind === scope.entitlementKind
    && version.validFrom <= scope.serviceOn
    && (version.validUntil === null || version.validUntil >= scope.serviceOn)
  ));
  if (candidates.length === 0) return {
    state: 'not_documented', version: null,
    reason: 'Für Pflegefall, Finanzierungsweg, Anspruchsart und Datum ist keine aktuelle individuelle Grundlage dokumentiert.',
  };
  if (candidates.length > 1) throw new Error('Mehrere individuelle Anspruchsgrundlagen gelten gleichzeitig.');
  const version = candidates[0]!;
  return {
    state: 'documented_current', version,
    reason: `Aktuelle individuelle Grundlage: ${version.decisionReference} vom ${version.decisionIssuedOn}, Fassung ${version.version}.`,
  };
}

function validateConsumption(
  event: ClientVariableEntitlementConsumption,
  version: ClientVariableEntitlementVersion,
): void {
  for (const [value, label] of [
    [event.id, 'Verbrauchsereignis-ID'], [event.tenantId, 'Mandant'], [event.clientId, 'Pflegefall'],
    [event.financingPathId, 'Finanzierungsweg'], [event.entitlementVersionId, 'Anspruchsfassungs-ID'],
    [event.logicalEntitlementId, 'Logische Anspruchs-ID'], [event.unit, 'Anspruchseinheit'],
    [event.basisFingerprint, 'Grundlagenfingerabdruck'], [event.evidenceReference, 'Verbrauchsbeleg'],
    [event.recordedAt, 'Verbrauchserfassungszeit'],
  ] as const) required(value, label);
  calendarDate(event.serviceOn, 'Leistungsdatum');
  const quantity = parseClientVariableEntitlementQuantity(event.quantity, 'Verbrauchsmenge');
  instantMicros(event.recordedAt, 'Verbrauchserfassungszeit');
  if (event.tenantId !== version.tenantId || event.clientId !== version.clientId
    || event.financingPathId !== version.financingPathId
    || event.entitlementVersionId !== version.id || event.logicalEntitlementId !== version.logicalEntitlementId
    || event.entitlementVersion !== version.version || event.entitlementKind !== version.entitlementKind
    || event.unit !== version.unit || event.basisFingerprint !== version.basisFingerprint) {
    throw new Error('Verbrauch ist nicht an die konkrete individuelle Anspruchsfassung gebunden.');
  }
  if (event.serviceOn < version.validFrom || (version.validUntil !== null && event.serviceOn > version.validUntil)) {
    throw new Error('Verbrauchsdatum liegt außerhalb der gebundenen Anspruchsfassung.');
  }
  if (instantMicros(event.recordedAt, 'Verbrauchserfassungszeit') < instantMicros(version.recordedAt, 'Erfassungszeit')) {
    throw new Error('Verbrauch wurde vor der individuellen Anspruchsfassung erfasst.');
  }
  if (event.eventKind === 'usage') {
    if (event.supersedesEventId !== null) throw new Error('Erstverbrauch darf keinen Vorgänger ersetzen.');
    if (quantity === 0) throw new Error('Erstverbrauch muss positiv sein.');
  } else if (event.eventKind === 'correction') {
    required(event.supersedesEventId, 'Verbrauchsvorgänger');
    required(event.reason, 'Korrekturgrund');
    if (quantity === 0) throw new Error('Korrektur muss positiv sein.');
  } else if (event.eventKind === 'cancellation') {
    required(event.supersedesEventId, 'Verbrauchsvorgänger');
    required(event.reason, 'Stornogrund');
    if (quantity !== 0) throw new Error('Storno muss eine Verbrauchsmenge von null ausweisen.');
  } else throw new Error('Verbrauchsereignisart ist ungültig.');
}

export function projectClientVariableEntitlementConsumption(
  version: ClientVariableEntitlementVersion,
  events: readonly ClientVariableEntitlementConsumption[],
): ClientVariableEntitlementProjection {
  validateVersion(version);
  const byId = new Map<string, ClientVariableEntitlementConsumption>();
  for (const event of events) {
    validateConsumption(event, version);
    if (byId.has(event.id)) throw new Error('Verbrauchsereignis-ID ist nicht eindeutig.');
    byId.set(event.id, event);
  }
  const successorByPredecessor = new Map<string, string>();
  for (const event of events) {
    if (!event.supersedesEventId) continue;
    const predecessor = byId.get(event.supersedesEventId);
    if (!predecessor) throw new Error('Verbrauchsvorgänger fehlt.');
    if (predecessor.serviceOn !== event.serviceOn) {
      throw new Error('Korrektur oder Storno darf das ursprüngliche Leistungsdatum nicht verschieben.');
    }
    if (instantMicros(event.recordedAt, 'Verbrauchserfassungszeit')
      <= instantMicros(predecessor.recordedAt, 'Verbrauchserfassungszeit')) {
      throw new Error('Verbrauchskorrektur muss nach ihrem Vorgänger erfasst sein.');
    }
    if (successorByPredecessor.has(predecessor.id)) throw new Error('Verbrauchsvorgänger hat mehrere Nachfolger.');
    successorByPredecessor.set(predecessor.id, event.id);
  }
  for (const event of events) {
    const visited = new Set<string>();
    let current: ClientVariableEntitlementConsumption | undefined = event;
    while (current?.supersedesEventId) {
      if (visited.has(current.id)) throw new Error('Verbrauchshistorie enthält einen Zyklus.');
      visited.add(current.id);
      current = byId.get(current.supersedesEventId);
    }
  }
  const effectiveEvents = events.filter((event) => !successorByPredecessor.has(event.id));
  const consumedQuantityScaled = effectiveEvents.reduce((sum, event) => {
    if (event.eventKind === 'cancellation') return sum;
    const next = sum + parseClientVariableEntitlementQuantity(event.quantity, 'Verbrauchsmenge');
    if (!Number.isSafeInteger(next) || next > MAX_QUANTITY_SCALED) throw new Error('Gesamtverbrauch überschreitet die Mengenbegrenzung.');
    return next;
  }, 0);
  const allocatedQuantityScaled = parseClientVariableEntitlementQuantity(version.allocatedQuantity, 'Anspruchsmenge');
  return {
    version, allocatedQuantityScaled, consumedQuantityScaled,
    remainingQuantityScaled: allocatedQuantityScaled - consumedQuantityScaled,
    effectiveEvents: [...effectiveEvents].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.id.localeCompare(b.id)),
    history: [...events].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.id.localeCompare(b.id)),
  };
}

export function validateClientVariableEntitlementVersionAppend(
  existingVersions: readonly ClientVariableEntitlementVersion[],
  existingConsumption: readonly ClientVariableEntitlementConsumption[],
  candidate: ClientVariableEntitlementVersion,
): ClientVariableEntitlementVersion[] {
  const sameHistory = existingVersions.filter((version) => version.logicalEntitlementId === candidate.logicalEntitlementId);
  const projected = projectClientVariableEntitlementHistory([...sameHistory, candidate]);
  const overlaps = existingVersions.filter((version) => version.logicalEntitlementId !== candidate.logicalEntitlementId
    && version.tenantId === candidate.tenantId && version.clientId === candidate.clientId
    && version.financingPathId === candidate.financingPathId && version.entitlementKind === candidate.entitlementKind
    && (version.validUntil === null || version.validUntil >= candidate.validFrom)
    && (candidate.validUntil === null || candidate.validUntil >= version.validFrom));
  if (overlaps.length > 0) throw new Error('Neue Anspruchsfassung überlappt eine andere individuelle Grundlage derselben Anspruchsart.');
  if (existingConsumption.some((event) => event.tenantId === candidate.tenantId && event.clientId === candidate.clientId
    && event.financingPathId === candidate.financingPathId && event.entitlementKind === candidate.entitlementKind
    && event.serviceOn >= candidate.validFrom)) {
    throw new Error('Anspruchsänderung würde bereits gebundenen Verbrauch rückwirkend entwerten.');
  }
  return projected;
}
