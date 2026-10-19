export type WebDesktopAccessibilityEvidence = Readonly<{
  tenantId: string;
  releaseCandidateId: string;
  buildSha256: string;
  actionInventorySha256: string;
  actions: readonly Readonly<{ actionId: string; route: string; requiredFieldSetSha256: string }>[];
  observations: readonly Readonly<{
    observationId: string;
    actionId: string;
    profile: 'keyboard_default' | 'zoom_200' | 'reflow_320' | 'screen_reader';
    browserEngine: 'chromium' | 'firefox' | 'webkit';
    browserVersion: string;
    observedAt: string;
    keyboardTraceSha256: string;
    accessibilityTreeSha256: string;
    screenshotSha256: string;
    focusOrderComplete: true;
    focusVisible: true;
    noKeyboardTrap: true;
    accessibleNameRoleStateComplete: true;
    errorsProgrammaticallyAssociated: true;
    errorsAnnounced: true;
    requiredFieldsReachable: true;
    requiredFieldsNotClipped: true;
    reflowWithoutTwoDimensionalScrolling: true;
  }>[];
  reviewedAt: string | null;
  status: 'accessibility_evidence_incomplete' | 'independent_accessibility_review_required' | 'accessibility_evidence_complete';
  requiredActionCoverageComplete: boolean;
  functionalAcceptanceInferred: false;
  careAcceptanceInferred: false;
  designAcceptanceInferred: false;
  legalAcceptanceInferred: false;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const VERSION = /^[0-9]+(?:\.[0-9]+){1,3}(?:[-+][a-z0-9.-]+)?$/;
const ROUTE = /^\/(?:[a-z0-9._~!$&'()*+,;=:@%-]+\/?)*$/;
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{1,6})(Z|([+-])(\d{2}):(\d{2}))$/;
const PROFILES = ['keyboard_default', 'zoom_200', 'reflow_320', 'screen_reader'] as const;

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new Error(`${label} ist kein unveraenderter Originaldatensatz.`);
  }
  return value as Record<string, unknown>;
}
function exactKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const actual = Object.keys(value);
  const unexpected = actual.filter((key) => !allowed.includes(key));
  const missing = allowed.filter((key) => !actual.includes(key));
  if (unexpected.length) throw new Error(`${label} enthaelt nicht erlaubte Felder: ${unexpected.join(', ')}.`);
  if (missing.length) throw new Error(`${label} ist unvollstaendig: ${missing.join(', ')}.`);
}
function own(value: Record<string, unknown>, key: string, label: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw new Error(`${label} ${key} fehlt als Originalwert.`);
  return descriptor.value;
}
function id(value: unknown, label: string): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new Error(`${label} ist keine native UUID.`);
  return value;
}
function hash(value: unknown, label: string): string {
  if (typeof value !== 'string' || !SHA256.test(value)) throw new Error(`${label} ist kein SHA-256-Originalwert.`);
  return value;
}
function route(value: unknown, label: string): string {
  if (typeof value !== 'string' || !ROUTE.test(value) || value.includes('//')) throw new Error(`${label} ist keine eindeutige interne Route.`);
  return value;
}
function integer(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} ist keine positive ganze Zahl.`);
  return value;
}
function instant(value: unknown, label: string): { text: string; micros: bigint } {
  if (typeof value !== 'string') throw new Error(`${label} ist kein vollstaendiger ISO-Zeitpunkt.`);
  const match = INSTANT.exec(value);
  if (!match) throw new Error(`${label} ist kein vollstaendiger ISO-Zeitpunkt.`);
  const [, y, m, d, h, min, s, fraction, zone, sign, zh, zm] = match;
  const year = Number(y), month = Number(m), day = Number(d), hour = Number(h), minute = Number(min), second = Number(s);
  const zoneHour = Number(zh ?? 0), zoneMinute = Number(zm ?? 0);
  const monthDays = month >= 1 && month <= 12 ? new Date(Date.UTC(year, month, 0)).getUTCDate() : 0;
  if (year < 1 || day < 1 || day > monthDays || hour > 23 || minute > 59 || second > 59
    || zoneHour > 23 || zoneMinute > 59) throw new Error(`${label} enthaelt kein gueltiges Kalenderdatum.`);
  const offset = zone === 'Z' ? 0 : (sign === '-' ? -1 : 1) * (zoneHour * 60 + zoneMinute);
  return { text: value, micros: BigInt(Date.UTC(year, month - 1, day, hour, minute, second) - offset * 60_000) * 1000n + BigInt(fraction.padEnd(6, '0')) };
}
function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} ist keine Originalmenge.`);
  return value;
}

/**
 * Projects immutable browser accessibility evidence for every mandatory action.
 * Evidence completeness never decides functional, care, design, or legal acceptance.
 */
export function projectWebDesktopAccessibilityEvidence(input: unknown): WebDesktopAccessibilityEvidence {
  const root = record(input, 'Barrierearmutsnachweis');
  exactKeys(root, [
    'tenantId', 'releaseCandidateId', 'buildSha256', 'actionInventorySha256', 'actions', 'observations', 'review', 'evaluatedAt',
  ], 'Barrierearmutsnachweis');
  const tenantId = id(own(root, 'tenantId', 'Barrierearmutsnachweis'), 'Mandantenkennung');
  const releaseCandidateId = id(own(root, 'releaseCandidateId', 'Barrierearmutsnachweis'), 'Kandidatenkennung');
  const buildSha256 = hash(own(root, 'buildSha256', 'Barrierearmutsnachweis'), 'Buildsumme');
  const actionInventorySha256 = hash(own(root, 'actionInventorySha256', 'Barrierearmutsnachweis'), 'Aktionsinventarsumme');
  const evaluatedAt = instant(own(root, 'evaluatedAt', 'Barrierearmutsnachweis'), 'Auswertungszeit');

  const actionIds = new Set<string>();
  const actions = array(own(root, 'actions', 'Barrierearmutsnachweis'), 'Pflichtaktionen').map((value) => {
    const action = record(value, 'Pflichtaktion');
    exactKeys(action, ['actionId', 'tenantId', 'releaseCandidateId', 'route', 'requiredFieldSetSha256'], 'Pflichtaktion');
    if (id(own(action, 'tenantId', 'Pflichtaktion'), 'Aktionsmandant') !== tenantId
      || id(own(action, 'releaseCandidateId', 'Pflichtaktion'), 'Aktionskandidat') !== releaseCandidateId) {
      throw new Error('Pflichtaktion ist nicht an Mandant und Releasekandidat gebunden.');
    }
    const actionId = id(own(action, 'actionId', 'Pflichtaktion'), 'Aktionskennung');
    if (actionIds.has(actionId)) throw new Error('Pflichtaktionsmenge enthaelt doppelte Kennungen.');
    actionIds.add(actionId);
    return Object.freeze({ actionId, route: route(own(action, 'route', 'Pflichtaktion'), 'Aktionsroute'), requiredFieldSetSha256: hash(own(action, 'requiredFieldSetSha256', 'Pflichtaktion'), 'Pflichtfeldmengensumme') });
  });

  const observationKeys = new Set<string>();
  const observationTimes: bigint[] = [];
  const observations = array(own(root, 'observations', 'Barrierearmutsnachweis'), 'Bedienbeobachtungen').map((value) => {
    const observation = record(value, 'Bedienbeobachtung');
    exactKeys(observation, [
      'observationId', 'tenantId', 'releaseCandidateId', 'buildSha256', 'actionInventorySha256', 'actionId', 'route',
      'requiredFieldSetSha256', 'profile', 'browserEngine', 'browserVersion', 'viewportWidth', 'viewportHeight', 'zoomPercent',
      'assistiveTechnology', 'assistiveTechnologyVersion', 'observedAt', 'keyboardTraceSha256', 'accessibilityTreeSha256',
      'speechTranscriptSha256', 'screenshotSha256', 'focusOrderComplete', 'focusVisible', 'noKeyboardTrap',
      'accessibleNameRoleStateComplete', 'errorsProgrammaticallyAssociated', 'errorsAnnounced', 'requiredFieldsReachable',
      'requiredFieldsNotClipped', 'reflowWithoutTwoDimensionalScrolling',
    ], 'Bedienbeobachtung');
    const actionId = id(own(observation, 'actionId', 'Bedienbeobachtung'), 'Beobachtungsaktion');
    const action = actions.find((item) => item.actionId === actionId);
    if (!action || id(own(observation, 'tenantId', 'Bedienbeobachtung'), 'Beobachtungsmandant') !== tenantId
      || id(own(observation, 'releaseCandidateId', 'Bedienbeobachtung'), 'Beobachtungskandidat') !== releaseCandidateId
      || hash(own(observation, 'buildSha256', 'Bedienbeobachtung'), 'Beobachtungsbuildsumme') !== buildSha256
      || hash(own(observation, 'actionInventorySha256', 'Bedienbeobachtung'), 'Beobachtungsinventarsumme') !== actionInventorySha256
      || route(own(observation, 'route', 'Bedienbeobachtung'), 'Beobachtungsroute') !== action.route
      || hash(own(observation, 'requiredFieldSetSha256', 'Bedienbeobachtung'), 'Beobachtungspflichtfeldsumme') !== action.requiredFieldSetSha256) {
      throw new Error('Bedienbeobachtung ist nicht exakt an Aktion, Pflichtfelder, Mandant, Kandidat und Build gebunden.');
    }
    const profile = own(observation, 'profile', 'Bedienbeobachtung');
    if (typeof profile !== 'string' || !PROFILES.includes(profile as typeof PROFILES[number])) throw new Error('Bedienbeobachtung enthaelt kein erlaubtes Barrierearmutsprofil.');
    const key = `${actionId}:${profile}`;
    if (observationKeys.has(key)) throw new Error('Bedienbeobachtung enthaelt ein doppeltes Aktionsprofil.');
    observationKeys.add(key);
    const browserEngine = own(observation, 'browserEngine', 'Bedienbeobachtung');
    const browserVersion = own(observation, 'browserVersion', 'Bedienbeobachtung');
    if (!['chromium', 'firefox', 'webkit'].includes(String(browserEngine))
      || typeof browserVersion !== 'string' || !VERSION.test(browserVersion)) throw new Error('Bedienbeobachtung enthaelt keine konkrete erlaubte Browserversion.');
    const viewportWidth = integer(own(observation, 'viewportWidth', 'Bedienbeobachtung'), 'Viewportbreite');
    const viewportHeight = integer(own(observation, 'viewportHeight', 'Bedienbeobachtung'), 'Viewporthoehe');
    const zoomPercent = integer(own(observation, 'zoomPercent', 'Bedienbeobachtung'), 'Browserzoom');
    const assistiveTechnology = own(observation, 'assistiveTechnology', 'Bedienbeobachtung');
    const assistiveTechnologyVersion = own(observation, 'assistiveTechnologyVersion', 'Bedienbeobachtung');
    const speechTranscriptSha256 = own(observation, 'speechTranscriptSha256', 'Bedienbeobachtung');
    if (profile === 'keyboard_default' && (viewportWidth < 1024 || zoomPercent !== 100)) throw new Error('Tastaturprofil ist nicht exakt belegt.');
    if (profile === 'zoom_200' && (viewportWidth < 1024 || zoomPercent < 200)) throw new Error('Zoomprofil ist nicht exakt belegt.');
    if (profile === 'reflow_320' && (viewportWidth !== 320 || zoomPercent !== 100)) throw new Error('Reflowprofil ist nicht exakt belegt.');
    if (profile === 'screen_reader') {
      if (!['NVDA', 'JAWS', 'VoiceOver'].includes(String(assistiveTechnology))
        || typeof assistiveTechnologyVersion !== 'string' || !VERSION.test(assistiveTechnologyVersion)
        || hash(speechTranscriptSha256, 'Sprachausgabespursumme') === '') throw new Error('Screenreaderprofil ist nicht konkret belegt.');
    } else if (assistiveTechnology !== null || assistiveTechnologyVersion !== null || speechTranscriptSha256 !== null) {
      throw new Error('Nicht-Screenreaderprofil enthaelt unzulaessige Hilfstechnologiebelege.');
    }
    for (const gate of [
      'focusOrderComplete', 'focusVisible', 'noKeyboardTrap', 'accessibleNameRoleStateComplete',
      'errorsProgrammaticallyAssociated', 'errorsAnnounced', 'requiredFieldsReachable', 'requiredFieldsNotClipped',
      'reflowWithoutTwoDimensionalScrolling',
    ] as const) {
      if (own(observation, gate, 'Bedienbeobachtung') !== true) throw new Error(`Bedienbeobachtung bestaetigt ${gate} nicht.`);
    }
    const observedAt = instant(own(observation, 'observedAt', 'Bedienbeobachtung'), 'Beobachtungszeit');
    if (observedAt.micros > evaluatedAt.micros) throw new Error('Bedienbeobachtung liegt nach der Auswertung.');
    observationTimes.push(observedAt.micros);
    return Object.freeze({
      observationId: id(own(observation, 'observationId', 'Bedienbeobachtung'), 'Beobachtungskennung'), actionId,
      profile: profile as typeof PROFILES[number], browserEngine: browserEngine as 'chromium' | 'firefox' | 'webkit', browserVersion,
      observedAt: observedAt.text, keyboardTraceSha256: hash(own(observation, 'keyboardTraceSha256', 'Bedienbeobachtung'), 'Tastaturspursumme'),
      accessibilityTreeSha256: hash(own(observation, 'accessibilityTreeSha256', 'Bedienbeobachtung'), 'Barrierefreiheitsbaumsumme'),
      screenshotSha256: hash(own(observation, 'screenshotSha256', 'Bedienbeobachtung'), 'Bildsumme'),
      focusOrderComplete: true as const, focusVisible: true as const, noKeyboardTrap: true as const,
      accessibleNameRoleStateComplete: true as const, errorsProgrammaticallyAssociated: true as const, errorsAnnounced: true as const,
      requiredFieldsReachable: true as const, requiredFieldsNotClipped: true as const, reflowWithoutTwoDimensionalScrolling: true as const,
    });
  });

  const requiredActionCoverageComplete = actions.length > 0
    && actions.every((action) => PROFILES.every((profile) => observationKeys.has(`${action.actionId}:${profile}`)));
  const reviewValue = own(root, 'review', 'Barrierearmutsnachweis');
  let reviewedAt: string | null = null;
  let status: WebDesktopAccessibilityEvidence['status'] = requiredActionCoverageComplete
    ? 'independent_accessibility_review_required' : 'accessibility_evidence_incomplete';
  if (reviewValue !== null) {
    const review = record(reviewValue, 'Barrierearmutspruefung');
    exactKeys(review, [
      'reviewId', 'tenantId', 'releaseCandidateId', 'buildSha256', 'actionInventorySha256', 'reviewerProfileId',
      'permissionKey', 'permissionEvidenceId', 'reviewedAt', 'decision', 'observationCount',
    ], 'Barrierearmutspruefung');
    if (id(own(review, 'tenantId', 'Barrierearmutspruefung'), 'Pruefmandant') !== tenantId
      || id(own(review, 'releaseCandidateId', 'Barrierearmutspruefung'), 'Pruefkandidat') !== releaseCandidateId
      || hash(own(review, 'buildSha256', 'Barrierearmutspruefung'), 'Pruefbuildsumme') !== buildSha256
      || hash(own(review, 'actionInventorySha256', 'Barrierearmutspruefung'), 'Pruefinventarsumme') !== actionInventorySha256
      || own(review, 'permissionKey', 'Barrierearmutspruefung') !== 'accessibility.browser.review'
      || own(review, 'observationCount', 'Barrierearmutspruefung') !== observations.length) {
      throw new Error('Barrierearmutspruefung ist nicht exakt an Browserbelege und Pruefberechtigung gebunden.');
    }
    id(own(review, 'reviewId', 'Barrierearmutspruefung'), 'Pruefkennung');
    id(own(review, 'reviewerProfileId', 'Barrierearmutspruefung'), 'Prueferprofil');
    id(own(review, 'permissionEvidenceId', 'Barrierearmutspruefung'), 'Pruefberechtigungsbeleg');
    const reviewAt = instant(own(review, 'reviewedAt', 'Barrierearmutspruefung'), 'Pruefzeit');
    if (reviewAt.micros > evaluatedAt.micros || observationTimes.some((value) => value > reviewAt.micros)) throw new Error('Barrierearmutspruefung liegt ausserhalb der kausalen Ereignisfolge.');
    reviewedAt = reviewAt.text;
    const decision = own(review, 'decision', 'Barrierearmutspruefung');
    if (decision !== 'approved' && decision !== 'rejected') throw new Error('Barrierearmutspruefung enthaelt keine erlaubte Entscheidung.');
    if (decision === 'approved' && !requiredActionCoverageComplete) throw new Error('Unvollstaendige Barrierearmutsbelege koennen nicht freigegeben werden.');
    status = decision === 'approved' ? 'accessibility_evidence_complete' : 'independent_accessibility_review_required';
  }
  return Object.freeze({
    tenantId, releaseCandidateId, buildSha256, actionInventorySha256, actions: Object.freeze(actions),
    observations: Object.freeze(observations), reviewedAt, status, requiredActionCoverageComplete,
    functionalAcceptanceInferred: false, careAcceptanceInferred: false, designAcceptanceInferred: false, legalAcceptanceInferred: false,
  });
}
