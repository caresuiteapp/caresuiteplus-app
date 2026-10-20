export type WebDesktopVisualEvidence = Readonly<{
  tenantId: string;
  releaseCandidateId: string;
  buildSha256: string;
  routeSetSha256: string;
  actions: readonly Readonly<{ actionId: string; route: string; labelSha256: string }>[];
  observations: readonly Readonly<{
    observationId: string;
    actionId: string;
    profile: 'wide' | 'narrow' | 'wide_navigation_open' | 'narrow_long_text';
    browserEngine: 'chromium' | 'firefox' | 'webkit';
    browserVersion: string;
    viewportWidth: number;
    viewportHeight: number;
    renderedAt: string;
    screenshotSha256: string;
    interactionTraceSha256: string;
    visible: true;
    reachable: true;
    notClipped: true;
    notObscured: true;
    contrastChecked: true;
    keyboardReachable: true;
  }>[];
  reviewedAt: string | null;
  status: 'browser_evidence_incomplete' | 'independent_visual_review_required' | 'browser_evidence_complete';
  requiredActionCoverageComplete: boolean;
  designAcceptanceInferred: false;
  functionalAcceptanceInferred: false;
  careAcceptanceInferred: false;
  legalAcceptanceInferred: false;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const VERSION = /^[0-9]+(?:\.[0-9]+){1,3}(?:[-+][a-z0-9.-]+)?$/;
const ROUTE = /^\/(?:[a-z0-9._~!$&'()*+,;=:@%-]+\/?)*$/;
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{1,6})(Z|([+-])(\d{2}):(\d{2}))$/;
const PROFILES = ['wide', 'narrow', 'wide_navigation_open', 'narrow_long_text'] as const;

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
  if (unexpected.length) throw new Error(`${label} enthaelt nicht erlaubte Felder: ${unexpected.join(', ')}.`);
  const missing = allowed.filter((key) => !actual.includes(key));
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
function positiveInteger(value: unknown, label: string): number {
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
 * Binds every declared mandatory action to four real-browser evidence profiles.
 * Completeness is not a design, function, care, or legal acceptance decision.
 */
export function projectWebDesktopVisualEvidence(input: unknown): WebDesktopVisualEvidence {
  const root = record(input, 'Darstellungsnachweis');
  exactKeys(root, [
    'tenantId', 'releaseCandidateId', 'buildSha256', 'routeSetSha256', 'actions', 'observations', 'review', 'evaluatedAt',
  ], 'Darstellungsnachweis');
  const tenantId = id(own(root, 'tenantId', 'Darstellungsnachweis'), 'Mandantenkennung');
  const releaseCandidateId = id(own(root, 'releaseCandidateId', 'Darstellungsnachweis'), 'Kandidatenkennung');
  const buildSha256 = hash(own(root, 'buildSha256', 'Darstellungsnachweis'), 'Buildsumme');
  const routeSetSha256 = hash(own(root, 'routeSetSha256', 'Darstellungsnachweis'), 'Routenmengensumme');
  const evaluatedAt = instant(own(root, 'evaluatedAt', 'Darstellungsnachweis'), 'Auswertungszeit');

  const actionIds = new Set<string>();
  const actions = array(own(root, 'actions', 'Darstellungsnachweis'), 'Pflichtaktionen').map((value) => {
    const action = record(value, 'Pflichtaktion');
    exactKeys(action, ['actionId', 'tenantId', 'releaseCandidateId', 'route', 'labelSha256'], 'Pflichtaktion');
    if (id(own(action, 'tenantId', 'Pflichtaktion'), 'Aktionsmandant') !== tenantId
      || id(own(action, 'releaseCandidateId', 'Pflichtaktion'), 'Aktionskandidat') !== releaseCandidateId) {
      throw new Error('Pflichtaktion ist nicht an Mandant und Releasekandidat gebunden.');
    }
    const actionId = id(own(action, 'actionId', 'Pflichtaktion'), 'Aktionskennung');
    if (actionIds.has(actionId)) throw new Error('Pflichtaktionsmenge enthaelt doppelte Kennungen.');
    actionIds.add(actionId);
    return Object.freeze({
      actionId,
      route: route(own(action, 'route', 'Pflichtaktion'), 'Aktionsroute'),
      labelSha256: hash(own(action, 'labelSha256', 'Pflichtaktion'), 'Aktionsbeschriftungssumme'),
    });
  });

  const observationKeys = new Set<string>();
  const observations = array(own(root, 'observations', 'Darstellungsnachweis'), 'Browserbeobachtungen').map((value) => {
    const observation = record(value, 'Browserbeobachtung');
    exactKeys(observation, [
      'observationId', 'tenantId', 'releaseCandidateId', 'buildSha256', 'routeSetSha256', 'actionId', 'route',
      'profile', 'browserEngine', 'browserVersion', 'viewportWidth', 'viewportHeight', 'deviceScaleFactor',
      'zoomPercent', 'fontScalePercent', 'navigationOpen', 'longTextFixtureSha256', 'renderedAt',
      'screenshotSha256', 'interactionTraceSha256', 'visible', 'reachable', 'notClipped', 'notObscured',
      'contrastChecked', 'keyboardReachable',
    ], 'Browserbeobachtung');
    const actionId = id(own(observation, 'actionId', 'Browserbeobachtung'), 'Beobachtungsaktion');
    const action = actions.find((item) => item.actionId === actionId);
    if (!action || id(own(observation, 'tenantId', 'Browserbeobachtung'), 'Beobachtungsmandant') !== tenantId
      || id(own(observation, 'releaseCandidateId', 'Browserbeobachtung'), 'Beobachtungskandidat') !== releaseCandidateId
      || hash(own(observation, 'buildSha256', 'Browserbeobachtung'), 'Beobachtungsbuildsumme') !== buildSha256
      || hash(own(observation, 'routeSetSha256', 'Browserbeobachtung'), 'Beobachtungsroutensumme') !== routeSetSha256
      || route(own(observation, 'route', 'Browserbeobachtung'), 'Beobachtungsroute') !== action.route) {
      throw new Error('Browserbeobachtung ist nicht exakt an Aktion, Mandant, Route und Build gebunden.');
    }
    const profile = own(observation, 'profile', 'Browserbeobachtung');
    if (typeof profile !== 'string' || !PROFILES.includes(profile as typeof PROFILES[number])) {
      throw new Error('Browserbeobachtung enthaelt kein erlaubtes Darstellungsprofil.');
    }
    const key = `${actionId}:${profile}`;
    if (observationKeys.has(key)) throw new Error('Browserbeobachtung enthaelt ein doppeltes Aktionsprofil.');
    observationKeys.add(key);
    const browserEngine = own(observation, 'browserEngine', 'Browserbeobachtung');
    if (!['chromium', 'firefox', 'webkit'].includes(String(browserEngine))) throw new Error('Browserbeobachtung stammt nicht aus einer erlaubten Browserengine.');
    const browserVersion = own(observation, 'browserVersion', 'Browserbeobachtung');
    if (typeof browserVersion !== 'string' || !VERSION.test(browserVersion)) throw new Error('Browserbeobachtung enthaelt keine konkrete Browserversion.');
    const viewportWidth = positiveInteger(own(observation, 'viewportWidth', 'Browserbeobachtung'), 'Viewportbreite');
    const viewportHeight = positiveInteger(own(observation, 'viewportHeight', 'Browserbeobachtung'), 'Viewporthoehe');
    const deviceScaleFactor = positiveInteger(own(observation, 'deviceScaleFactor', 'Browserbeobachtung'), 'Geraeteskalierung');
    const zoomPercent = positiveInteger(own(observation, 'zoomPercent', 'Browserbeobachtung'), 'Browserzoom');
    const fontScalePercent = positiveInteger(own(observation, 'fontScalePercent', 'Browserbeobachtung'), 'Schriftskalierung');
    const navigationOpen = own(observation, 'navigationOpen', 'Browserbeobachtung');
    const longTextFixtureSha256 = own(observation, 'longTextFixtureSha256', 'Browserbeobachtung');
    if (profile === 'wide' && (viewportWidth < 1024 || navigationOpen !== false || longTextFixtureSha256 !== null)) throw new Error('Breites Profil ist nicht exakt belegt.');
    if (profile === 'narrow' && (viewportWidth > 600 || navigationOpen !== false || longTextFixtureSha256 !== null)) throw new Error('Schmales Profil ist nicht exakt belegt.');
    if (profile === 'wide_navigation_open' && (viewportWidth < 1024 || navigationOpen !== true || longTextFixtureSha256 !== null)) throw new Error('Profil mit geoeffneter Navigation ist nicht exakt belegt.');
    if (profile === 'narrow_long_text' && (viewportWidth > 600 || navigationOpen !== false
      || hash(longTextFixtureSha256, 'Langtextfixturesumme') === '')) throw new Error('Schmales Langtextprofil ist nicht exakt belegt.');
    if (deviceScaleFactor > 4 || zoomPercent < 100 || zoomPercent > 400 || fontScalePercent < 100 || fontScalePercent > 300) {
      throw new Error('Browserbeobachtung enthaelt keine zulaessige Skalierung.');
    }
    for (const gate of ['visible', 'reachable', 'notClipped', 'notObscured', 'contrastChecked', 'keyboardReachable'] as const) {
      if (own(observation, gate, 'Browserbeobachtung') !== true) throw new Error(`Browserbeobachtung bestaetigt ${gate} nicht.`);
    }
    const renderedAt = instant(own(observation, 'renderedAt', 'Browserbeobachtung'), 'Darstellungszeit');
    if (renderedAt.micros > evaluatedAt.micros) throw new Error('Browserbeobachtung liegt nach der Auswertung.');
    return Object.freeze({
      observationId: id(own(observation, 'observationId', 'Browserbeobachtung'), 'Beobachtungskennung'),
      actionId, profile: profile as typeof PROFILES[number], browserEngine: browserEngine as 'chromium' | 'firefox' | 'webkit',
      browserVersion, viewportWidth, viewportHeight, renderedAt: renderedAt.text,
      screenshotSha256: hash(own(observation, 'screenshotSha256', 'Browserbeobachtung'), 'Bildsumme'),
      interactionTraceSha256: hash(own(observation, 'interactionTraceSha256', 'Browserbeobachtung'), 'Interaktionsspursumme'),
      visible: true as const, reachable: true as const, notClipped: true as const, notObscured: true as const,
      contrastChecked: true as const, keyboardReachable: true as const,
    });
  });

  const requiredActionCoverageComplete = actions.length > 0
    && actions.every((action) => PROFILES.every((profile) => observationKeys.has(`${action.actionId}:${profile}`)));
  const reviewValue = own(root, 'review', 'Darstellungsnachweis');
  let reviewedAt: string | null = null;
  let status: WebDesktopVisualEvidence['status'] = requiredActionCoverageComplete
    ? 'independent_visual_review_required' : 'browser_evidence_incomplete';
  if (reviewValue !== null) {
    const review = record(reviewValue, 'Sichtpruefung');
    exactKeys(review, [
      'reviewId', 'tenantId', 'releaseCandidateId', 'buildSha256', 'routeSetSha256', 'reviewerProfileId',
      'permissionKey', 'permissionEvidenceId', 'reviewedAt', 'decision', 'observationCount',
    ], 'Sichtpruefung');
    if (id(own(review, 'tenantId', 'Sichtpruefung'), 'Pruefmandant') !== tenantId
      || id(own(review, 'releaseCandidateId', 'Sichtpruefung'), 'Pruefkandidat') !== releaseCandidateId
      || hash(own(review, 'buildSha256', 'Sichtpruefung'), 'Pruefbuildsumme') !== buildSha256
      || hash(own(review, 'routeSetSha256', 'Sichtpruefung'), 'Pruefroutensumme') !== routeSetSha256
      || own(review, 'permissionKey', 'Sichtpruefung') !== 'design.browser.review'
      || own(review, 'observationCount', 'Sichtpruefung') !== observations.length) {
      throw new Error('Sichtpruefung ist nicht exakt an Browserbelege und Pruefberechtigung gebunden.');
    }
    id(own(review, 'reviewId', 'Sichtpruefung'), 'Pruefkennung');
    id(own(review, 'reviewerProfileId', 'Sichtpruefung'), 'Prueferprofil');
    id(own(review, 'permissionEvidenceId', 'Sichtpruefung'), 'Pruefberechtigungsbeleg');
    const reviewAt = instant(own(review, 'reviewedAt', 'Sichtpruefung'), 'Sichtpruefzeit');
    if (reviewAt.micros > evaluatedAt.micros || observations.some((item) => instant(item.renderedAt, 'Darstellungszeit').micros > reviewAt.micros)) {
      throw new Error('Sichtpruefung liegt ausserhalb der kausalen Ereignisfolge.');
    }
    reviewedAt = reviewAt.text;
    const decision = own(review, 'decision', 'Sichtpruefung');
    if (decision !== 'approved' && decision !== 'rejected') throw new Error('Sichtpruefung enthaelt keine erlaubte Entscheidung.');
    if (decision === 'approved' && !requiredActionCoverageComplete) throw new Error('Unvollstaendige Browserbelege koennen nicht freigegeben werden.');
    status = decision === 'approved' ? 'browser_evidence_complete' : 'independent_visual_review_required';
  }

  return Object.freeze({
    tenantId, releaseCandidateId, buildSha256, routeSetSha256, actions: Object.freeze(actions),
    observations: Object.freeze(observations), reviewedAt, status, requiredActionCoverageComplete,
    designAcceptanceInferred: false, functionalAcceptanceInferred: false, careAcceptanceInferred: false,
    legalAcceptanceInferred: false,
  });
}
