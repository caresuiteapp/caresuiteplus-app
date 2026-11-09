import { getSupabaseClient } from '@/lib/supabase/client';
import { isUuid } from '@/lib/validation/uuid';
import { DOCUMENTATION_AREAS, DOCUMENTATION_CATEGORIES, validateDocumentation } from './model';
import type { DocumentationActor, DocumentationDraft, DocumentationFilters, DocumentationOption, DocumentationPage, DocumentationResult } from './model';

type Row = Record<string, unknown>;
const nameOrder = new Intl.Collator('de-DE', { sensitivity: 'base' });
const sortPeople = (people: DocumentationOption[]) => [...people].sort((a, b) => nameOrder.compare(a.name, b.name) || a.id.localeCompare(b.id));
function row(value: unknown): Row { return value !== null && typeof value === 'object' ? value as Row : {}; }
function failure(error: unknown, write = false): DocumentationResult<never> {
  const code = String(row(error).code ?? '');
  if (['42501', 'PGRST301', 'PGRST302'].includes(code)) return { ok: false, error: 'Die gemeinsame Dokumentation benötigt einen aktiven Teamzugang in diesem Unternehmen.' };
  if (['PGRST202', '42883', '42P01'].includes(code)) return { ok: false, error: 'Die Dokumentation ist noch nicht verfügbar. Bitte nach der Aktualisierung erneut laden.' };
  if (code.startsWith('22') || code.startsWith('23') || code === '40001') return { ok: false, error: 'Die Angaben wurden abgelehnt. Bitte Datum, Zuordnung und Inhalt prüfen.' };
  return { ok: false, uncertain: write, error: write
    ? 'Die Speicherbestätigung fehlt. Ihr Entwurf bleibt erhalten. Prüfen Sie denselben Speichervorgang erneut.'
    : 'Die Dokumentation konnte nicht geladen werden. Bitte erneut versuchen.' };
}
export async function documentationRequest(actor: DocumentationActor, name: string, args: Row) {
  if (!isUuid(actor.tenantId) || !isUuid(actor.userId)) throw { code: '42501' };
  const client = getSupabaseClient();
  if (!client) throw new Error('Keine Datenbankverbindung');
  const session = await client.auth.getUser();
  if (session.error || session.data.user?.id !== actor.userId) throw { code: '42501' };
  const result = await (client as unknown as { rpc(name: string, args: Row): PromiseLike<{ data: unknown; error: unknown }> }).rpc(name, { p_tenant_id: actor.tenantId, ...args });
  if (result.error) throw result.error;
  return row(result.data);
}
export async function listDocumentation(actor: DocumentationActor, filters: DocumentationFilters): Promise<DocumentationResult<DocumentationPage>> {
  try {
    const data = await documentationRequest(actor, 'office_documentation_workspace', { p_filters: filters });
    if (!Array.isArray(data.items) || data.items.length > 50 || !Number.isSafeInteger(data.total) || Number(data.total) < 0
      || !Array.isArray(data.clients) || !Array.isArray(data.employees) || !Array.isArray(data.months)
      || data.months.some(m => typeof m !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(m))) throw new Error('Ungültige Liste');
    for (const value of data.items) {
      const item = row(value);
      if (item.tenant_id !== actor.tenantId || !isUuid(item.id) || !['manual','visit'].includes(String(item.source))
        || !DOCUMENTATION_AREAS.some(a => a.value === item.area) || !DOCUMENTATION_CATEGORIES.some(c => c.value === item.category)
        || !['normal','important','urgent'].includes(String(item.priority))
        || ['title','body','author_name','client_name','employee_name'].some(k => typeof item[k] !== 'string')
        || (item.attachment_mime_types !== undefined && (!Array.isArray(item.attachment_mime_types) || item.attachment_mime_types.some(mime => typeof mime !== 'string')))
        || !Number.isFinite(Date.parse(String(item.occurred_at))) || !Number.isFinite(Date.parse(String(item.created_at)))
        || ['client_id','employee_id','visit_id'].some(k => item[k] !== null && !isUuid(item[k]))) throw new Error('Ungültiger Eintrag');
    }
    for (const value of [...data.clients, ...data.employees]) if (!isUuid(row(value).id) || typeof row(value).name !== 'string') throw new Error('Ungültige Zuordnung');
    const page = data as unknown as DocumentationPage;
    return { ok: true, data: { ...page, clients: sortPeople(page.clients), employees: sortPeople(page.employees) } };
  } catch (error) { return failure(error); }
}
export async function createDocumentation(actor: DocumentationActor, id: string, draft: DocumentationDraft): Promise<DocumentationResult<{ id: string }>> {
  const invalid = validateDocumentation(draft);
  if (invalid) return { ok: false, error: invalid };
  if (!isUuid(id)) return { ok: false, error: 'Der Eintrag hat keine gültige Kennung. Bitte neu öffnen.' };
  try {
    const data = await documentationRequest(actor, 'office_documentation_create', { p_id: id, p_draft: { ...draft, title: draft.title.trim(), body: draft.body.trim() } });
    if (data.id !== id || data.tenant_id !== actor.tenantId || !Number.isFinite(Date.parse(String(data.created_at)))) throw new Error('Ungültige Bestätigung');
    return { ok: true, data: { id } };
  } catch (error) { return failure(error, true); }
}
