import { cloneClientNativeOriginal, freezeClientNativeOriginal } from '../clients/clientRecordNativeOriginal.web.ts';
import { withServiceQueryTimeout } from '../services/queryTimeout.ts';

type Row = Readonly<Record<string, unknown>>;
export type VitalCaseRow = Readonly<{
  id: string;
  tenant_id: string;
  first_name: string;
  last_name: string;
  client_number: string | null;
}>;

const pageSize = 200;
const keys = ['id', 'tenant_id', 'first_name', 'last_name', 'client_number'];
const detailKeys = [...keys, 'vital_path', 'respiratory_path'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const failed = () => new Error('Die Pflegefallauswahl konnte nicht bestätigt werden.');
const isObject = (value: unknown): value is Row => !!value && typeof value === 'object' && !Array.isArray(value);

async function caseRpc(
  sdk: unknown,
  name: 'list_ambulatory_vital_cases' | 'get_ambulatory_vital_case',
  args: Row,
  check: () => void,
  beforePage?: () => Promise<void>,
): Promise<Readonly<{ response: Row; data: readonly unknown[] }> | null> {
  await beforePage?.();
  check();
  const target = sdk as Row;
  const method = target.rpc;
  if (typeof method !== 'function' || target.rpc !== method) throw failed();
  check();
  const query = Reflect.apply(method, sdk, [name, Object.freeze(args)]) as Row;
  const then = query.then;
  if (typeof then !== 'function' || query.then !== then) throw failed();
  const raw = await withServiceQueryTimeout(new Promise<unknown>((resolve, reject) => {
    check();
    Reflect.apply(then, query, [resolve, reject]);
  }), 'Pflegefallauswahl', 20_000);
  check();
  const response = freezeClientNativeOriginal(cloneClientNativeOriginal(raw));
  check();
  if (!isObject(response)) throw failed();
  // Older environments can use the existing read-only path during rollout.
  if (response.status === 404 && isObject(response.error) && response.error.code === 'PGRST202') return null;
  if (response.status !== 200 || response.error !== null || !Array.isArray(response.data)) throw failed();
  await beforePage?.();
  check();
  return { response, data: response.data };
}

function validateCase(value: unknown, tenantId: string, expectedKeys: readonly string[] = keys): VitalCaseRow {
  if (!isObject(value) || Object.keys(value).length !== expectedKeys.length || !expectedKeys.every(key => Object.hasOwn(value, key)) ||
    typeof value.id !== 'string' || !uuid.test(value.id) || value.tenant_id !== tenantId ||
    typeof value.first_name !== 'string' || typeof value.last_name !== 'string' ||
    value.client_number !== null && typeof value.client_number !== 'string') throw failed();
  return value as VitalCaseRow;
}

export async function readVitalCasesWeb(sdk: unknown, tenantId: string, check: () => void, beforePage?: () => Promise<void>) {
  const rows: VitalCaseRow[] = [];
  const responses: Row[] = [];
  let cursor: string | null = null;
  for (;;) {
    const result = await caseRpc(sdk, 'list_ambulatory_vital_cases', { p_after_id: cursor, p_page_size: pageSize }, check, beforePage);
    if (!result) { if (cursor === null) return null; throw failed(); }
    responses.push(result.response);
    if (!result.data.length) return Object.freeze({ rows: Object.freeze(rows), responses: Object.freeze(responses) });
    if (result.data.length > pageSize) throw failed();
    for (const raw of result.data) {
      const item = validateCase(raw, tenantId);
      if (cursor && item.id.toLowerCase() <= cursor.toLowerCase()) throw failed();
      rows.push(item);
      cursor = item.id;
    }
  }
}

export async function readVitalCaseWeb(sdk: unknown, tenantId: string, clientId: string, check: () => void, beforePage?: () => Promise<void>) {
  const result = await caseRpc(sdk, 'get_ambulatory_vital_case', { p_client_id: clientId }, check, beforePage);
  if (!result) return null;
  if (result.data.length !== 1) throw failed();
  const item = validateCase(result.data[0], tenantId, detailKeys) as VitalCaseRow & { vital_path: boolean; respiratory_path: boolean };
  if (item.id.toLowerCase() !== clientId.toLowerCase() || typeof item.vital_path !== 'boolean' || typeof item.respiratory_path !== 'boolean') throw failed();
  return item;
}

export const vitalCaseName = (row: VitalCaseRow) => [row.first_name, row.last_name].join(' ').trim() || 'Name fehlt';

export function vitalCaseOptions(rows: readonly VitalCaseRow[]) {
  const names = new Map<string, number>();
  for (const item of rows) {
    const name = vitalCaseName(item);
    names.set(name, (names.get(name) ?? 0) + 1);
  }
  return rows.map(item => {
    const name = vitalCaseName(item);
    return { id: item.id, name: (names.get(name) ?? 0) > 1 ? `${name} · ${item.client_number || item.id.slice(-8)}` : name };
  }).sort((a, b) => a.name.localeCompare(b.name, 'de'));
}
