export type ClientServiceCombinationOutcome = 'allowed' | 'prohibited' | 'surcharge_required';

export type ClientServiceCombinationRule = {
  id: string;
  logicalRuleId: string;
  tenantId: string;
  version: number;
  financingKind: 'sgb_xi' | 'sgb_v' | 'private' | 'other';
  costCarrierReference: string;
  serviceTypeA: string;
  serviceTypeB: string;
  outcome: ClientServiceCombinationOutcome;
  surchargeServiceType: string | null;
  validFrom: string;
  validUntil: string | null;
  predecessorRuleId: string | null;
  ruleTitle: string;
  ruleReference: string;
  contentFingerprint: string;
  recordedAt: string;
};

export type ClientServiceCombinationReview = {
  id: string;
  tenantId: string;
  clientId: string;
  financingPathId: string;
  financingKind: ClientServiceCombinationRule['financingKind'];
  costCarrierReference: string;
  serviceTypeA: string;
  serviceTypeB: string;
  serviceOn: string;
  ruleId: string;
  logicalRuleId: string;
  ruleVersion: number;
  ruleFingerprint: string;
  outcome: ClientServiceCombinationOutcome;
  surchargeServiceType: string | null;
  evidenceReference: string;
  evaluatedAt: string;
};

export type ClientServiceCombinationEvaluation = {
  state: ClientServiceCombinationOutcome | 'not_documented';
  rule: ClientServiceCombinationRule | null;
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

function canonicalPair(first: string, second: string): [string, string] {
  required(first, 'Erste Leistungsart');
  required(second, 'Zweite Leistungsart');
  if (first === second) throw new Error('Leistungskombination benötigt zwei verschiedene Leistungsarten.');
  return first < second ? [first, second] : [second, first];
}

function validateRule(rule: ClientServiceCombinationRule): void {
  for (const [value, label] of [
    [rule.id, 'Regel-ID'], [rule.logicalRuleId, 'Logische Regel-ID'], [rule.tenantId, 'Mandant'],
    [rule.costCarrierReference, 'Kostenträgerreferenz'], [rule.serviceTypeA, 'Erste Leistungsart'],
    [rule.serviceTypeB, 'Zweite Leistungsart'], [rule.ruleTitle, 'Regelbezeichnung'],
    [rule.ruleReference, 'Regelreferenz'], [rule.contentFingerprint, 'Regelfingerabdruck'],
    [rule.recordedAt, 'Regelerfassungszeit'],
  ] as const) required(value, label);
  if (!Number.isInteger(rule.version) || rule.version < 1) throw new Error('Regelversion ist ungültig.');
  if (!['sgb_xi', 'sgb_v', 'private', 'other'].includes(rule.financingKind)) throw new Error('Finanzierungsart ist ungültig.');
  if (!['allowed', 'prohibited', 'surcharge_required'].includes(rule.outcome)) throw new Error('Regelergebnis ist ungültig.');
  const [first, second] = canonicalPair(rule.serviceTypeA, rule.serviceTypeB);
  if (first !== rule.serviceTypeA || second !== rule.serviceTypeB) throw new Error('Leistungsarten müssen kanonisch sortiert sein.');
  calendarDate(rule.validFrom, 'Regelbeginn');
  if (rule.validUntil !== null) {
    calendarDate(rule.validUntil, 'Regelende');
    if (rule.validUntil < rule.validFrom) throw new Error('Regelzeitraum ist umgekehrt.');
  }
  instantMicros(rule.recordedAt, 'Regelerfassungszeit');
  if (rule.outcome === 'surcharge_required') required(rule.surchargeServiceType, 'Zuschlagsleistung');
  else if (rule.surchargeServiceType !== null) throw new Error('Regel ohne Zuschlag darf keine Zuschlagsleistung behaupten.');
  if (rule.version === 1 && rule.predecessorRuleId !== null) throw new Error('Erste Regelversion darf keinen Vorgänger haben.');
  if (rule.version > 1) required(rule.predecessorRuleId, 'Regelvorgänger');
}

export function projectClientServiceCombinationRuleHistory(
  rules: readonly ClientServiceCombinationRule[],
): ClientServiceCombinationRule[] {
  if (rules.length === 0) throw new Error('Regelhistorie fehlt.');
  const sorted = [...rules].sort((left, right) => left.version - right.version);
  const first = sorted[0]!;
  const ids = new Set<string>();
  for (let index = 0; index < sorted.length; index += 1) {
    const rule = sorted[index]!;
    validateRule(rule);
    if (ids.has(rule.id)) throw new Error('Regel-ID ist nicht eindeutig.');
    ids.add(rule.id);
    if (rule.logicalRuleId !== first.logicalRuleId || rule.tenantId !== first.tenantId
      || rule.financingKind !== first.financingKind || rule.costCarrierReference !== first.costCarrierReference
      || rule.serviceTypeA !== first.serviceTypeA || rule.serviceTypeB !== first.serviceTypeB) {
      throw new Error('Regelhistorie überschreitet Mandant, Kostenträger oder Leistungskombination.');
    }
    if (rule.version !== index + 1) throw new Error('Regelversionen sind nicht lückenlos.');
    if (index === 0) continue;
    const predecessor = sorted[index - 1]!;
    if (rule.predecessorRuleId !== predecessor.id) throw new Error('Regelvorgänger ist nicht die unmittelbare Vorversion.');
    if (predecessor.validUntil === null || predecessor.validUntil >= rule.validFrom) {
      throw new Error('Regelversionen überlappen oder der Vorgänger ist nicht beendet.');
    }
    if (instantMicros(rule.recordedAt, 'Regelerfassungszeit') <= instantMicros(predecessor.recordedAt, 'Regelerfassungszeit')) {
      throw new Error('Regelerfassungszeiten sind nicht streng aufsteigend.');
    }
  }
  return sorted;
}

function validatedHistories(rules: readonly ClientServiceCombinationRule[]): ClientServiceCombinationRule[][] {
  const grouped = new Map<string, ClientServiceCombinationRule[]>();
  const ids = new Set<string>();
  for (const rule of rules) {
    if (ids.has(rule.id)) throw new Error('Regel-ID ist nicht global eindeutig.');
    ids.add(rule.id);
    const existing = grouped.get(rule.logicalRuleId) ?? [];
    existing.push(rule);
    grouped.set(rule.logicalRuleId, existing);
  }
  return [...grouped.values()].map(projectClientServiceCombinationRuleHistory);
}

export function evaluateClientServiceCombination(
  rules: readonly ClientServiceCombinationRule[],
  input: {
    tenantId: string;
    financingKind: ClientServiceCombinationRule['financingKind'];
    costCarrierReference: string;
    serviceTypeA: string;
    serviceTypeB: string;
    serviceOn: string;
  },
): ClientServiceCombinationEvaluation {
  required(input.tenantId, 'Mandant');
  required(input.costCarrierReference, 'Kostenträgerreferenz');
  if (!['sgb_xi', 'sgb_v', 'private', 'other'].includes(input.financingKind)) throw new Error('Finanzierungsart ist ungültig.');
  calendarDate(input.serviceOn, 'Leistungsdatum');
  const [serviceTypeA, serviceTypeB] = canonicalPair(input.serviceTypeA, input.serviceTypeB);
  const candidates = validatedHistories(rules).flat().filter((rule) => (
    rule.tenantId === input.tenantId
    && rule.financingKind === input.financingKind
    && rule.costCarrierReference === input.costCarrierReference
    && rule.serviceTypeA === serviceTypeA
    && rule.serviceTypeB === serviceTypeB
    && rule.validFrom <= input.serviceOn
    && (rule.validUntil === null || rule.validUntil >= input.serviceOn)
  ));
  if (candidates.length === 0) return {
    state: 'not_documented', rule: null,
    reason: 'Für Kostenträger, Leistungsarten und Datum ist keine eindeutige Regel dokumentiert.',
  };
  if (candidates.length > 1) throw new Error('Mehrere Regeln gelten gleichzeitig für dieselbe Leistungskombination.');
  const rule = candidates[0]!;
  const reason = rule.outcome === 'prohibited'
    ? `Unzulässige Kombination nach ${rule.ruleTitle} (${rule.ruleReference}), gültig ab ${rule.validFrom}.`
    : rule.outcome === 'surcharge_required'
      ? `Kombination verlangt ${rule.surchargeServiceType} nach ${rule.ruleTitle} (${rule.ruleReference}), gültig ab ${rule.validFrom}.`
      : `Kombination ist nach ${rule.ruleTitle} (${rule.ruleReference}), gültig ab ${rule.validFrom}, dokumentiert zulässig.`;
  return { state: rule.outcome, rule, reason };
}

export function validateClientServiceCombinationReview(
  review: ClientServiceCombinationReview,
  rules: readonly ClientServiceCombinationRule[],
): ClientServiceCombinationEvaluation {
  for (const [value, label] of [
    [review.id, 'Prüf-ID'], [review.tenantId, 'Mandant'], [review.clientId, 'Pflegefall'],
    [review.financingPathId, 'Finanzierungsweg'], [review.costCarrierReference, 'Kostenträgerreferenz'],
    [review.ruleId, 'Regel-ID'], [review.logicalRuleId, 'Logische Regel-ID'],
    [review.ruleFingerprint, 'Regelfingerabdruck'], [review.evidenceReference, 'Prüfbeleg'],
    [review.evaluatedAt, 'Prüfzeitpunkt'],
  ] as const) required(value, label);
  if (!Number.isInteger(review.ruleVersion) || review.ruleVersion < 1) throw new Error('Gebundene Regelversion ist ungültig.');
  const [first, second] = canonicalPair(review.serviceTypeA, review.serviceTypeB);
  if (first !== review.serviceTypeA || second !== review.serviceTypeB) throw new Error('Geprüfte Leistungsarten müssen kanonisch sortiert sein.');
  calendarDate(review.serviceOn, 'Leistungsdatum');
  const evaluatedAt = instantMicros(review.evaluatedAt, 'Prüfzeitpunkt');
  const evaluation = evaluateClientServiceCombination(rules, review);
  if (!evaluation.rule) throw new Error('Prüfung ist nicht an eine datumsgültige konkrete Regel gebunden.');
  const rule = evaluation.rule;
  if (review.ruleId !== rule.id || review.logicalRuleId !== rule.logicalRuleId
    || review.ruleVersion !== rule.version || review.ruleFingerprint !== rule.contentFingerprint) {
    throw new Error('Prüfung ist nicht an die datumsgültige konkrete Regelfassung gebunden.');
  }
  if (review.outcome !== rule.outcome || review.surchargeServiceType !== rule.surchargeServiceType) {
    throw new Error('Gespeichertes Prüfergebnis weicht von der konkreten Regel ab.');
  }
  if (evaluatedAt < instantMicros(rule.recordedAt, 'Regelerfassungszeit')) {
    throw new Error('Prüfung wurde vor der verwendeten Regelfassung erfasst.');
  }
  return evaluation;
}

export function validateClientServiceCombinationRuleAppend(
  existingRules: readonly ClientServiceCombinationRule[],
  candidate: ClientServiceCombinationRule,
): ClientServiceCombinationRule[] {
  const sameHistory = existingRules.filter((rule) => rule.logicalRuleId === candidate.logicalRuleId);
  const projected = projectClientServiceCombinationRuleHistory([...sameHistory, candidate]);
  const overlaps = existingRules.filter((rule) => rule.logicalRuleId !== candidate.logicalRuleId
    && rule.tenantId === candidate.tenantId
    && rule.financingKind === candidate.financingKind
    && rule.costCarrierReference === candidate.costCarrierReference
    && rule.serviceTypeA === candidate.serviceTypeA
    && rule.serviceTypeB === candidate.serviceTypeB
    && (rule.validUntil === null || rule.validUntil >= candidate.validFrom)
    && (candidate.validUntil === null || candidate.validUntil >= rule.validFrom));
  if (overlaps.length > 0) throw new Error('Neue Regelfassung überlappt eine andere Regel derselben Kombination.');
  return projected;
}
