// Generated native presentation from src/features/assistLive/liveStatusWorkspacePresentation.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeSessionStorage as sessionStorage} from '@/lib/platform/nativeWorkflowEnvironment.native';
import type { AssistLiveMonitoringRow } from './getAssistLiveMonitoring';
export type LiveStatusFilter = 'all' | 'active' | 'planned' | 'followup' | 'completed' | 'cancelled' | 'attention' | 'gps';
export type LiveWorkspaceState = {
    view: 'live' | 'problems';
    query: string;
    employeeId: string;
    status: LiveStatusFilter;
    selectedId: string | null;
};
export const LIVE_FILTERS: {
    value: LiveStatusFilter;
    label: string;
}[] = [
    { value: 'all', label: 'Alle Einsätze' }, { value: 'active', label: 'Aktiv' },
    { value: 'planned', label: 'Geplant' }, { value: 'followup', label: 'Nacharbeit offen' },
    { value: 'completed', label: 'Abgeschlossen' }, { value: 'cancelled', label: 'Abgesagt / nicht angetroffen' },
    { value: 'attention', label: 'Auffällig' }, { value: 'gps', label: 'Mit aktuellem GPS' },
];
export const LIVE_STATUS_LABELS: Record<string, string> = {
    geplant: 'Geplant', unterwegs: 'Unterwegs', angekommen: 'Angekommen', gestartet: 'Im Einsatz', pausiert: 'Pause',
    beendet: 'Beendet', doku_fehlt: 'Dokumentation offen', signatur_fehlt: 'Unterschrift offen', abgeschlossen: 'Abgeschlossen',
    kritisch: 'Klärung nötig', abgesagt: 'Abgesagt', verschoben: 'Verschoben', nicht_angetroffen: 'Nicht angetroffen',
};
export function emptyLiveWorkspaceState(): LiveWorkspaceState { return { view: 'live', query: '', employeeId: '', status: 'all', selectedId: null }; }
export function liveWorkspaceStorageKey(tenant: string | null, actor: string, windowId: string): string {
    return `cs-live-workspace:v1:${JSON.stringify([tenant, actor, windowId])}`;
}
export function restoreLiveWorkspaceState(key: string): LiveWorkspaceState {
    const fallback = emptyLiveWorkspaceState();
    try {
        const value = JSON.parse(sessionStorage.getItem(key) ?? 'null');
        if (!value || typeof value !== 'object')
            return fallback;
        return { view: value.view === 'problems' ? 'problems' : 'live', query: typeof value.query === 'string' ? value.query.slice(0, 200) : '',
            employeeId: typeof value.employeeId === 'string' ? value.employeeId.slice(0, 160) : '',
            status: LIVE_FILTERS.some(item => item.value === value.status) ? value.status : 'all',
            selectedId: typeof value.selectedId === 'string' ? value.selectedId.slice(0, 160) : null };
    }
    catch {
        return fallback;
    }
}
export function saveLiveWorkspaceState(key: string, value: LiveWorkspaceState): void {
    try {
        sessionStorage.setItem(key, JSON.stringify(value));
    }
    catch { /* Storage can be unavailable in private browsing. */ }
}
export function liveReadableName(value: string | null | undefined, fallback: string): string {
    const text = value?.trim();
    return text && !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(text) ? text : fallback;
}
export function isLiveRowActive(row: Pick<AssistLiveMonitoringRow, 'status'>): boolean { return ['unterwegs', 'angekommen', 'gestartet', 'pausiert'].includes(row.status); }
export function liveRowNeedsAttention(row: AssistLiveMonitoringRow): boolean {
    return row.problemStatus !== 'none' || row.cancelRequest || row.rescheduleRequest || (row.delayMinutes ?? 0) > 0 || (row.overrunMinutes ?? 0) > 0 ||
        row.docStatus === 'missing' || row.signatureStatus === 'missing' || Boolean((row as {
        trackingError?: string;
    }).trackingError);
}
export function matchesLiveStatus(row: AssistLiveMonitoringRow, filter: LiveStatusFilter, gpsFresh: boolean): boolean {
    if (filter === 'all')
        return true;
    if (filter === 'active')
        return isLiveRowActive(row);
    if (filter === 'planned')
        return ['geplant', 'bestaetigt'].includes(row.status);
    if (filter === 'followup')
        return ['beendet', 'dokumentation_offen', 'unterschrift_offen'].includes(row.status) || row.docStatus === 'missing' || row.signatureStatus === 'missing';
    if (filter === 'completed')
        return row.status === 'abgeschlossen';
    if (filter === 'cancelled')
        return ['storniert', 'nicht_erschienen'].includes(row.status);
    if (filter === 'gps')
        return gpsFresh;
    return liveRowNeedsAttention(row);
}
export function normalizeLiveSearch(value: string): string { return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('de-DE').trim(); }
export function liveSnapshotIsCurrent(generatedAt: string | null | undefined, nowMs: number): boolean {
    const age = generatedAt ? nowMs - Date.parse(generatedAt) : Number.NaN;
    return Number.isFinite(age) && age >= -5000 && age <= 90000;
}
export function liveTimerSeconds(seconds: number, activeTimer: string | null, timer: string, generatedAt: string | null | undefined, nowMs: number, allowTick: boolean): number {
    const base = Number.isFinite(seconds) && seconds >= 0 ? Math.floor(seconds) : 0;
    if (!allowTick || activeTimer !== timer || !liveSnapshotIsCurrent(generatedAt, nowMs))
        return base;
    return base + Math.max(0, Math.floor((nowMs - Date.parse(generatedAt!)) / 1000));
}
export function formatLiveTimer(seconds: number): string {
    const total = Math.max(0, Number.isFinite(seconds) ? Math.floor(seconds) : 0);
    return [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60].map(value => String(value).padStart(2, '0')).join(':');
}
export function formatLivePlannedTime(start: string, end: string): string {
    if (!Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)))
        return 'Uhrzeit nicht hinterlegt';
    const day = (value: string) => new Date(value).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit' });
    const time = (value: string) => new Date(value).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' });
    return day(start) === day(end) ? `${time(start)}–${time(end)} Uhr` : `${day(start)} ${time(start)} – ${day(end)} ${time(end)} Uhr`;
}
