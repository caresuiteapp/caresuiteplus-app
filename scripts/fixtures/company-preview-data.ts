// Synthetic, memory-only services for local UI review. No accounts or API calls.
export const draft = { companyName: 'Musterbetrieb Pflege', legalForm: 'GmbH', industry: 'Ambulante Alltagsbegleitung', street: 'Musterstraße 12', zip: '44628', city: 'Herne', phone: '02323 000000', email: 'kontakt@example.test', adminFirstName: 'Anna', adminLastName: 'Muster', adminEmail: 'anna@example.test' };
const records: any[] = Array.from({ length: 53 }, (_, index) => {
 const id = `qa-${index + 1}`;
 return { id, tenantId: id, tenantName: index === 0 ? 'Musterbetrieb Pflege' : `Beispielunternehmen ${index + 1}`, slug: `beispiel-${index + 1}`, status: index === 2 ? 'suspended' : 'active', environmentMode: index === 1 ? 'unclassified' : index % 3 ? 'internal_test' : 'production', environmentNotes: index === 1 ? '' : 'Fiktiver Datensatz für die lokale UI-Prüfung.', planKey: 'free_platform', billingStatus: 'manual_free', lifecycleStatus: index % 2 ? 'live' : 'onboarding', createdAt: '2026-09-07T10:00:00Z', primary_contact_email: 'kontakt@example.test', primary_contact_name: 'Anna Muster', country: 'DE', timezone: 'Europe/Berlin' };
});
const pause = () => new Promise(resolve => setTimeout(resolve, 250));
export async function listPlatformCompanies(filters: any = {}) {
 await pause(); const search = (filters.search ?? '').toLowerCase();
 const items = records.filter(r => (!search || `${r.tenantName} ${r.slug} ${r.primary_contact_email}`.toLowerCase().includes(search)) && (!filters.status || r.status === filters.status) && (!filters.environment || r.environmentMode === filters.environment) && (!filters.billingStatus || r.billingStatus === filters.billingStatus));
 const offset = filters.offset ?? 0, limit = filters.limit ?? 50;
 return { ok: true, data: { items: items.slice(offset, offset + limit), offset, limit } };
}
export const listPlatformTenants = listPlatformCompanies;
export const resolvePlatformTenantDetailId = (row: any) => row.tenantId ?? row.id;
export async function getPlatformTenantDetail(id: string) {
 await pause(); const record = records.find(r => r.id === id);
 if (!record) return { ok: false, error: 'Das fiktive Unternehmen wurde nicht gefunden.' };
 return { ok: true, data: { tenant: { ...record, tenant_id: record.id, tenant_name: record.tenantName, legal_name: record.legalName ?? record.tenantName, primary_contact_name: record.primaryContactName ?? record.primary_contact_name, primary_contact_email: record.primaryContactEmail ?? record.primary_contact_email, primary_contact_phone: record.primaryContactPhone ?? record.primary_contact_phone, billing_email: record.billingEmail ?? record.billing_email, support_email: record.supportEmail ?? record.support_email }, modules: ['Office', 'Assist', 'Pflege', 'Beratung', 'Akademie', 'Stationär'].map(name => ({ moduleKey: name.toLowerCase(), moduleName: name, status: 'enabled' })), plan: { plan_key: 'free_platform' } } };
}
export async function updatePlatformTenantStatus(id: string, status: string) { await pause(); const row = records.find(r => r.id === id); if (!row) return { ok: false, error: 'Unternehmen fehlt.' }; row.status = status; return { ok: true, data: {} }; }
export async function updatePlatformTenantRecord(id: string, update: any) { await pause(); const row = records.find(r => r.id === id); if (!row) return { ok: false, error: 'Unternehmen fehlt.' }; Object.assign(row, update); return { ok: true, data: {} }; }
export async function registerBusinessTenant(input: any) {
 await pause(); records.unshift({ ...records[0], id: `qa-${records.length + 1}`, tenantId: `qa-${records.length + 1}`, tenantName: input.companyName, legalName: input.companyName, primary_contact_name: `${input.adminFirstName} ${input.adminLastName}`, primary_contact_email: input.adminEmail, status: 'active', environmentMode: 'production', lifecycleStatus: 'onboarding', createdAt: new Date().toISOString() });
 return { ok: true, data: { owner: { email: input.adminEmail } } };
}
export const platformRoleHasCapability = () => true;
export const getPlatformReleaseInfo = () => ({ environment: 'Lokale UI-Prüfung' });
export const PLATFORM_ROLE_LABELS = { super_admin: 'Testverwaltung' };
export const usePlatformAuth = () => ({ platformUser: { role: 'super_admin', email: 'support@example.test' } });
export const useAuth = () => ({ user: { id: 'qa-desktop' }, profile: { displayName: 'Testverwaltung', roleKey: 'business_admin' }, signOut: async () => { location.hash = '/auth/business-login'; } });
export const canAccessDeveloperTools = () => false;
const unavailable = async () => ({ ok: false, error: 'Diese Funktion gehört nicht zur lokalen UI-Vorschau.' });
export const completeFirstLogin = unavailable, loginBusinessUser = unavailable, loginEmployeePortal = unavailable, loginClientPortal = unavailable, completePortalLogin = unavailable, requestBusinessPasswordReset = unavailable, getSession = unavailable, signOut = unavailable, updatePassword = unavailable;
export const sanitizePortalUsernameInput = (value: string) => value;
export const normalizePortalCodeInput = (value: string) => value;
const memory = new Map([['caresuite.liquid.registration.v1', JSON.stringify(draft)]]);
export const storage = { getItem: async (key: string) => memory.get(key) ?? null, setItem: async (key: string, value: string) => { memory.set(key, value); }, multiSet: async (values: readonly (readonly [string, string])[]) => { values.forEach(([key, value]) => memory.set(key, value)); }, removeItem: async (key: string) => { memory.delete(key); } };
