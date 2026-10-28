// Generated native presentation from src/lib/pflege/vitalCreateOriginalRead.web.ts. Update through scripts/port-native-workspaces.mjs.
import { cloneClientNativeOriginal as clone, freezeClientNativeOriginal as freeze } from "../clients/clientRecordNativeOriginal.native.ts";
import { getVitalDefinition } from './vitalCatalog.ts';
import { woundInstant } from './woundCareDomain.ts';
import type { VitalCreateRuntimeWeb, VitalCreateReadTicket, VitalCreateReadEnvelope, VitalCreateReadScope } from "./vitalCreateRuntime.native.ts";
import type { VitalClient, VitalChoice } from './vitalDocumentationService';
import type { ServiceResult } from '@/types';
type Row = Record<string, unknown>;
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const version = (v: unknown): v is string => typeof v === 'string' && woundInstant(v.replace(' ', 'T')) !== null;
const deliveries = new WeakMap<object, {
    runtime: VitalCreateRuntimeWeb;
    ticket: VitalCreateReadTicket;
    original: unknown;
    view: unknown;
}>();
/** Recognition is negative/own provenance only, never an independent permission grant. */
export function isOwnVitalCreateDeliveryWeb(token: unknown, runtime: VitalCreateRuntimeWeb, ticket: VitalCreateReadTicket, original: unknown, view: unknown) { const entry = token && typeof token === 'object' ? deliveries.get(token) : null; return !!entry && entry.runtime === runtime && entry.ticket === ticket && entry.original === original && entry.view === view; }
function method(runtime: VitalCreateRuntimeWeb, ticket: VitalCreateReadTicket, target: unknown, key: string, args: unknown[]) { const first = (target as Row)[key], second = (target as Row)[key]; if (typeof first !== 'function' || first !== second)
    throw Error('Nativer Originalabruf ist nicht bestätigt.'); runtime.assertCurrent(false, ticket); return Reflect.apply(first, target, args); }
async function page(runtime: VitalCreateRuntimeWeb, ticket: VitalCreateReadTicket, table: string, cursor: string | null, text = false): Promise<Row[]> {
    const { sdk } = runtime.assertCurrent(false, ticket);
    let q = method(runtime, ticket, sdk, 'from', [table]);
    q = method(runtime, ticket, q, 'select', ['*']);
    if (table === 'vital_sign_catalog')
        q = method(runtime, ticket, q, 'eq', ['is_active', true]);
    else
        q = method(runtime, ticket, q, 'eq', ['tenant_id', runtime.tenantId]);
    if (table === 'clients') {
        q = method(runtime, ticket, q, 'eq', ['status', 'active']);
        q = method(runtime, ticket, q, 'is', ['deleted_at', null]);
    }
    if (table === 'client_module_assignments') {
        q = method(runtime, ticket, q, 'eq', ['module_key', 'pflege']);
        q = method(runtime, ticket, q, 'eq', ['is_active', true]);
    }
    if (table === 'client_vital_sign_settings')
        q = method(runtime, ticket, q, 'eq', ['client_id', ticket.clientId]);
    const pk = text ? 'key' : 'id';
    q = method(runtime, ticket, q, 'order', [pk, { ascending: true }]);
    q = method(runtime, ticket, q, 'limit', [200]);
    if (cursor !== null)
        q = method(runtime, ticket, q, 'gt', [pk, cursor]);
    const first = (q as Row).then, second = (q as Row).then;
    if (typeof first !== 'function' || first !== second)
        throw Error('Unbestätigter nativer Thenabruf.');
    const raw = await new Promise<unknown>((resolve, reject) => { runtime.assertCurrent(false, ticket); Reflect.apply(first, q, [resolve, reject]); });
    runtime.assertCurrent(false, ticket);
    const response = clone(raw) as Row;
    runtime.assertCurrent(false, ticket);
    if (!response || typeof response !== 'object' || Array.isArray(response) || response.error !== null || response.status !== 200 || !Array.isArray(response.data) || response.data.length > 200)
        throw Error('Ganzer nativer Originalabruf ist unbekannt oder fehlgeschlagen.');
    const rows = response.data as Row[];
    for (const row of rows) {
        if (!row || typeof row !== 'object' || Array.isArray(row))
            throw Error('Nativer Originaleintrag fehlt.');
        if (text) {
            if (typeof row.key !== 'string' || !row.key || row.key.trim() !== row.key || row.is_active !== true)
                throw Error('Nativer Katalogschlüssel fehlt.');
        }
        else {
            if (!uuid(row.id) || row.tenant_id !== runtime.tenantId || table !== 'clients' && !uuid(row.client_id))
                throw Error('Nativer Originalbestand ist fremd.');
            if (table === 'clients' && (row.status !== 'active' || row.deleted_at != null) || table === 'client_module_assignments' && (row.module_key !== 'pflege' || row.is_active !== true || typeof row.status !== 'string') || table === 'client_vital_sign_settings' && row.client_id !== ticket.clientId)
                throw Error('Nativer Originalbestand hat einen anderen Abrufbezug.');
        }
    }
    runtime.assertCurrent(false, ticket);
    return freeze(rows);
}
async function pool(runtime: VitalCreateRuntimeWeb, ticket: VitalCreateReadTicket, table: string, text = false): Promise<Row[]> { const rows: Row[] = [], seen = new Set<string>(); let cursor: string | null = null; for (;;) {
    const supplied = await page(runtime, ticket, table, cursor, text);
    if (!supplied.length) {
        runtime.assertCurrent(false, ticket);
        return freeze(rows);
    }
    let previous: string | null = cursor;
    for (const row of supplied) {
        const id = (row[text ? 'key' : 'id'] as string), canonical = text ? id : id.toLowerCase();
        if (seen.has(canonical) || previous !== null && canonical <= (text ? previous : previous.toLowerCase()))
            throw Error('Nativer Originalabruf enthält doppelte oder nicht fortschreitende Kennungen.');
        seen.add(canonical);
        previous = id;
        rows.push(row);
    }
    cursor = previous;
} }
function deliver<T>(runtime: VitalCreateRuntimeWeb, ticket: VitalCreateReadTicket, original: unknown, view: T[]): VitalCreateReadEnvelope<T> { runtime.assertCurrent(false, ticket); const token = Object.freeze({}); deliveries.set(token, { runtime, ticket, original, view }); return runtime.acceptRead(ticket, original, view, token); }
export async function fetchVitalCreateClientsWeb(runtime: VitalCreateRuntimeWeb, scope: VitalCreateReadScope | null): Promise<ServiceResult<VitalCreateReadEnvelope<VitalClient>>> {
    try {
        const ticket = runtime.beginRead('clients', null, scope), clients = await pool(runtime, ticket, 'clients'), assignments = await pool(runtime, ticket, 'client_module_assignments');
        runtime.assertCurrent(false, ticket);
        // The filtered active-client subset need not contain legitimate inactive-client assignments.
        const active = new Set(assignments.filter(row => !['inactive', 'deactivated', 'archiviert'].includes(row.status as string)).map(row => row.client_id));
        const view = clients.filter(row => active.has(row.id)).map(row => ({ id: row.id as string, name: [row.first_name, row.last_name].filter(v => typeof v === 'string').join(' ').trim() || 'Name fehlt' })).sort((a, b) => a.name.localeCompare(b.name, 'de'));
        runtime.assertCurrent(false, ticket);
        return { ok: true, data: deliver(runtime, ticket, { clients, assignments }, view) };
    }
    catch {
        return { ok: false, error: 'Aktueller eigener Pflegeklientenbestand konnte nicht vollständig bestätigt werden.' };
    }
}
/** Exact known component/unit contract. GCS's native aggregate unit is the
 * actual total component range; E/V/M are preserved as distinct component ranges. */
export function assertVitalCreateCatalogWeb(input: Row) { const row = clone(input); const definition = getVitalDefinition(row.key as string); if (!definition || !Array.isArray(row.components) || JSON.stringify(row.components) !== JSON.stringify(definition.components.map(c => c.key)) || row.category !== definition.category || typeof row.default_enabled !== 'boolean' || !version(row.updated_at))
    throw Error('Katalogdefinition und Originalstand sind nicht bestätigt.'); const unit = definition.key === 'gcs' ? definition.components.find(c => c.key === 'total')?.unit : new Set(definition.components.map(c => c.unit)).size === 1 ? definition.components[0].unit : null; if (unit === null || row.default_unit !== unit)
    throw Error('Die ganze native Messdefinition stimmt nicht mit den angezeigten Komponenten und Einheiten überein.'); }
export async function fetchVitalCreateChoicesWeb(runtime: VitalCreateRuntimeWeb, clientId: string, scope: VitalCreateReadScope | null): Promise<ServiceResult<VitalCreateReadEnvelope<VitalChoice>>> {
    try {
        const ticket = runtime.beginRead('choices', clientId, scope), catalog = await pool(runtime, ticket, 'vital_sign_catalog', true), settings = await pool(runtime, ticket, 'client_vital_sign_settings');
        runtime.assertCurrent(false, ticket);
        const byKey = new Map<string, Row>();
        for (const setting of settings) {
            if (typeof setting.vital_key !== 'string' || !setting.vital_key || byKey.has(setting.vital_key) || typeof setting.enabled !== 'boolean' || !version(setting.updated_at))
                throw Error('Ganzer nativer Konfigurationsbestand ist nicht eindeutig.');
            byKey.set(setting.vital_key, setting);
        }
        const view = catalog.map(row => { assertVitalCreateCatalogWeb(row); const setting = byKey.get(row.key as string); return { key: row.key as string, catalogVersion: row.updated_at as string, configurationVersion: setting ? setting.updated_at as string : 'none', enabled: setting ? setting.enabled as boolean : row.default_enabled as boolean, limits: setting?.limits ?? {} }; });
        runtime.assertCurrent(false, ticket);
        return { ok: true, data: deliver(runtime, ticket, { catalog, settings }, view) };
    }
    catch {
        return { ok: false, error: 'Aktueller ganzer Messkatalog, Einheit und Pflegefallkonfiguration konnten nicht bestätigt werden.' };
    }
}
