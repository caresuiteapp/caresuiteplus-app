// Generated native presentation from src/lib/pflege/woundAssessmentComparison.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { sameWoundJson, woundInstant, woundUuid } from './woundCareDomain.ts';
import { woundDecimal } from './woundDocumentationDomain.ts';
import { validateWoundAssessmentCorrectionHistory } from './woundAssessmentCorrectionDomain.ts';
type Row = Record<string, unknown>;
export type WoundComparisonScope = {
    tenantId: string;
    clientId: string;
    woundId: string;
};
export type WoundComparisonOriginals = {
    row: Row;
    assessments: Row[];
    corrections: Row[];
    lifecycle: Row[];
    clientName: string;
};
const object = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);
/** Preserve complete native JSON, including unknown fields; a sparse or non-JSON original cannot be silently clipped. */
function json(v: unknown, seen = new Set<object>()): void {
    if (v === null || typeof v === 'string' || typeof v === 'boolean' || typeof v === 'number' && Number.isFinite(v))
        return;
    if (typeof v !== 'object' || !v || seen.has(v))
        throw Error('Vollständiger JSON-Originalbeleg ist ungültig.');
    if (!Array.isArray(v) && Object.getPrototypeOf(v) !== Object.prototype && Object.getPrototypeOf(v) !== null)
        throw Error('Originalobjekt ist kein JSON.');
    seen.add(v);
    const keys = Object.keys(v);
    if (Array.isArray(v) && (keys.length !== v.length || keys.some((k, i) => k !== String(i))))
        throw Error('Originalbestand enthält fehlende oder zusätzliche Arraypositionen.');
    for (const k of keys)
        json((v as Row)[k], seen);
    seen.delete(v);
}
function rows(v: unknown): Row[] { if (!Array.isArray(v))
    throw Error('Vollständiger Originalbestand fehlt.'); json(v); if (v.some(r => !object(r)))
    throw Error('Originalbestand ist ungültig.'); return v as Row[]; }
function instant(v: unknown) { if (typeof v !== 'string' || woundInstant(v) === null)
    throw Error('Nativer Originalzeitpunkt ist ungültig.'); }
function own(r: Row, s: WoundComparisonScope, woundField: string | null) { if (!woundUuid(r.id) || r.tenant_id !== s.tenantId || r.client_id !== s.clientId || (woundField && r[woundField] !== s.woundId))
    throw Error('Original gehört nicht zu diesem nativen Wundfall.'); instant(r.created_at); if (!woundUuid(r.recorded_by) || typeof r.recorded_by_name !== 'string')
    throw Error('Nativer Originalautor fehlt.'); }
function assessment(r: Row, s: WoundComparisonScope) {
    own(r, s, 'wound_case_id');
    for (const k of ['observed_at', 'assessed_at'])
        if (r[k] != null)
            instant(r[k]);
    if (r.documentation_details != null && !object(r.documentation_details))
        throw Error('Originale Assessmentdetails ungültig.');
    if (r.photo_refs !== undefined && !Array.isArray(r.photo_refs))
        throw Error('Originale Bildreferenzen ungültig.');
    for (const k of ['length_cm', 'width_cm', 'depth_cm', 'pain_score'])
        if (r[k] != null && !(typeof r[k] === 'number' && Number.isFinite(r[k])))
            throw Error('Nativer Zahlenwert ist ungültig.');
    for (const k of ['wound_bed', 'exudate', 'odor', 'wound_edge', 'surrounding_skin', 'infection_signs', 'intervention', 'response'])
        if (r[k] != null && typeof r[k] !== 'string')
            throw Error('Originale Beobachtungsangabe ungültig.');
    const d = object(r.documentation_details) ? r.documentation_details : {};
    for (const k of ['measurementMethod', 'lengthState', 'lengthCm', 'lengthReason', 'widthState', 'widthCm', 'widthReason', 'depthState', 'depthCm', 'depthReason', 'painState', 'painScore', 'painReason', 'observedAt', 'nextReviewAt', 'reviewStatus', 'reviewPendingReason', 'woundBed', 'exudate', 'odor', 'woundEdge', 'surroundingSkin', 'infectionObservation', 'personalImpact', 'preferences', 'selfManagement', 'actualAction', 'response'])
        if (d[k] != null && typeof d[k] !== 'string')
            throw Error('Strukturierte Originalangabe ungültig.');
    for (const k of ['observedAt', 'nextReviewAt'])
        if (d[k] != null && d[k] !== '')
            instant(d[k]);
}
/** Only the Web read projection consumes this stricter whole-original guard. Historical writers and Android contracts remain unchanged. */
export function captureWoundComparisonOriginals(value: unknown, s: WoundComparisonScope): WoundComparisonOriginals {
    if (!s || ![s.tenantId, s.clientId, s.woundId].every(woundUuid) || !object(value) || !object(value.row) || typeof value.clientName !== 'string')
        throw Error('Eigener nativer Wund-Lesebezug fehlt.');
    json(value);
    const r = value.row;
    own(r, s, null);
    if (r.id !== s.woundId || !['draft', 'active', 'healing', 'healed', 'deteriorated', 'archived'].includes(String(r.status)))
        throw Error('Nativer Wundfall oder Status ist ungültig.');
    instant(r.updated_at);
    if (r.next_review_at != null)
        instant(r.next_review_at);
    if (r.documentation_details != null && !object(r.documentation_details))
        throw Error('Originale Falldetails ungültig.');
    const assessments = rows(value.assessments), corrections = rows(value.corrections), lifecycle = rows(value.lifecycle), ids = new Set<string>();
    for (const a of assessments) {
        assessment(a, s);
        if (ids.has(String(a.id).toLowerCase()))
            throw Error('Doppelte native Assessmentkennung.');
        ids.add(String(a.id).toLowerCase());
    }
    const correctionIds = new Set<string>();
    for (const c of corrections) {
        if (!woundUuid(c.id) || correctionIds.has(c.id.toLowerCase()))
            throw Error('Doppelte native Berichtigungskennung.');
        correctionIds.add(c.id.toLowerCase());
        if (!object(c.original_snapshot))
            throw Error('Vollständiger Berichtigungsoriginalbezug fehlt.');
        assessment(c.original_snapshot, s);
    }
    validateWoundAssessmentCorrectionHistory(corrections, s.tenantId, s.clientId, s.woundId, assessments);
    const eventIds = new Set<string>();
    for (const e of lifecycle) {
        own(e, s, 'wound_case_id');
        instant(e.occurred_at);
        if (eventIds.has(String(e.id).toLowerCase()) || !['close', 'reopen'].includes(String(e.action)) || (e.assessment_id != null && !ids.has(String(e.assessment_id).toLowerCase())))
            throw Error('Vollständiger Fallstatusverlauf ungültig.');
        eventIds.add(String(e.id).toLowerCase());
    }
    return structuredClone(value) as WoundComparisonOriginals;
}
const details = (r: Row): Row => object(r.documentation_details) ? r.documentation_details : {};
const present = (v: unknown) => typeof v === 'string' && !!v.trim();
export type WoundMeasureIssue = 'unknown' | 'not_measurable' | 'inconsistent' | 'different_method' | 'corrected';
function measurement(r: Row, key: string) {
    const d = details(r), value = r[key + '_cm'];
    const state = d[key + 'State'], raw = d[key + 'Cm'], reason = d[key + 'Reason'];
    const issues: WoundMeasureIssue[] = [];
    if (state === 'not_measurable') {
        issues.push('not_measurable');
        if (value != null || present(raw) || !present(reason))
            issues.push('inconsistent');
    }
    else if (state !== 'measured' || value == null || !present(raw) || !present(d.measurementMethod))
        issues.push('unknown');
    else if (typeof value !== 'number' || value < 0 || woundDecimal(String(raw)) !== value || present(reason))
        issues.push('inconsistent');
    return { value, state, raw, reason, method: d.measurementMethod, unit: 'cm' as const, issues };
}
function pain(r: Row) {
    const d = details(r), value = r.pain_score, issues: WoundMeasureIssue[] = [];
    if (d.painState === 'not_assessable') {
        issues.push('not_measurable');
        if (value != null || present(d.painScore) || !present(d.painReason))
            issues.push('inconsistent');
    }
    else if (d.painState !== 'NRS' || value == null || !present(d.painScore))
        issues.push('unknown');
    else if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 10 || !/^\d{1,2}$/.test(String(d.painScore)) || Number(d.painScore) !== value || present(d.painReason))
        issues.push('inconsistent');
    return { value, state: d.painState, raw: d.painScore, reason: d.painReason, unit: 'NRS 0–10' as const, issues };
}
/** An explicit pair is a technical comparison of original evidence, never a diagnosis, healing trend, execution, task completion or release. */
export function compareWoundAssessments(value: unknown, leftId: string, rightId: string, s: WoundComparisonScope) {
    const originals = captureWoundComparisonOriginals(value, s);
    if (!woundUuid(leftId) || !woundUuid(rightId) || leftId.toLowerCase() === rightId.toLowerCase())
        throw Error('Zwei unterschiedliche native Originalbefunde ausdrücklich auswählen.');
    const left = originals.assessments.find(a => a.id === leftId), right = originals.assessments.find(a => a.id === rightId);
    if (!left || !right)
        throw Error('Gewählter Originalbefund nicht im vollständigen Bestand.');
    const leftCorrections = originals.corrections.filter(c => c.assessment_id === leftId), rightCorrections = originals.corrections.filter(c => c.assessment_id === rightId);
    const corrected = (sections: string[]) => [...leftCorrections, ...rightCorrections].some(c => sections.includes(String(c.section)));
    const lo = left.observed_at == null ? null : woundInstant(left.observed_at), ro = right.observed_at == null ? null : woundInstant(right.observed_at);
    const observationIssues: string[] = [];
    if (lo === null || ro === null)
        observationIssues.push('unknown');
    if (corrected(['observation']))
        observationIssues.push('corrected');
    for (const a of [left, right]) {
        const d = details(a);
        if (present(d.observedAt) && (a.observed_at == null || woundInstant(d.observedAt) !== woundInstant(a.observed_at)))
            observationIssues.push('inconsistent');
    }
    const measures = (['length', 'width', 'depth'] as const).map(key => { const l = measurement(left, key), r = measurement(right, key), issues = [...l.issues, ...r.issues]; if (present(l.method) && present(r.method) && l.method !== r.method)
        issues.push('different_method'); if (corrected(['measurement', 'observation']))
        issues.push('corrected'); if (observationIssues.includes('unknown'))
        issues.push('unknown'); if (observationIssues.includes('inconsistent'))
        issues.push('inconsistent'); return { key, left: l, right: r, issues: [...new Set(issues)], state: issues.length ? 'not_comparable' : l.value === r.value ? 'same_values' : 'different_values' }; });
    const lp = pain(left), rp = pain(right), painIssues = [...lp.issues, ...rp.issues];
    if (corrected(['pain', 'observation']))
        painIssues.push('corrected');
    return { originals, left, right, leftCorrections, rightCorrections, measures, pain: { left: lp, right: rp, issues: [...new Set(painIssues)], state: painIssues.length ? 'not_comparable' : lp.value === rp.value ? 'same_values' : 'different_values' }, observation: { left: left.observed_at, right: right.observed_at, issues: [...new Set(observationIssues)], order: observationIssues.length ? 'unknown' : lo === ro ? 'same_instant' : lo! < ro! ? 'left_before_right' : 'right_before_left' }, clinicalConclusion: 'not_assessed' as const };
}
export function sameWoundComparisonOriginal(a: unknown, b: unknown) { try {
    json(a);
    json(b);
    return sameWoundJson(a, b);
}
catch {
    return false;
} }
