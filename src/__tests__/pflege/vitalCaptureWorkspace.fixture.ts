/** Synthetic view fixture; never connects to an account, repository or clinical endpoint. */
import {useState} from 'react';

export const tenantId = '10000000-0000-4000-8000-000000000001';
export const profileId = '20000000-0000-4000-8000-000000000002';
export const userId = '50000000-0000-4000-8000-000000000005';
export const mara = {id: '30000000-0000-4000-8000-000000000003', name: 'Mara Beispiel'};
export const julian = {id: '40000000-0000-4000-8000-000000000004', name: 'Julian Muster'};
export const people = [mara, julian];
export const additionalPeople = Array.from({length: 10}, (_, i) => ({
  id: `60000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
  name: `Testfall ${i + 1}`,
}));
const stamp = '2026-11-14T10:20:00+01:00';
const choice = (key: string, enabled: boolean) => ({key, enabled, catalogVersion: stamp, configurationVersion: 'none'});
export const choices = [
  choice('blood_pressure', true), choice('pulse', true), choice('oxygen', true), choice('rass', true),
  choice('fluid_balance', true), choice('gcs', true), choice('pain_score', true), choice('body_surface_area', false),
];
const measurement = (suffix: number, type: string, display: string, unit: string) => ({
  id: `70000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`,
  type, display, unit, occurredAt: stamp, recordedAt: stamp, legacyAt: stamp,
  actor: 'Pflegekraft Beispiel', flagStatus: null, collectionExtent: null,
  followUps: [], invalidations: [],
});
export const measurements = [
  measurement(1, 'blood_pressure', '120/80', 'mmHg'), measurement(2, 'pulse', '72', '/min'),
  measurement(3, 'oxygen', '96', '%'), measurement(4, 'temperature', '36,8', '°C'),
];
const grants = Object.freeze(['pflege.access', 'pflege.vitals.view', 'pflege.vitals.manage']);
export const fixture = {
  auth: {
    authReady: true, isLoading: false, isAuthenticated: true, portalSession: null,
    profile: {id: profileId, tenantId, roleKey: 'nurse'}, user: {id: userId},
  },
  router: {
    push: (_target: string) => undefined as void,
    replace: (_target: string) => undefined as void,
    back: () => undefined as void,
  },
  historyPeople: [...people],
  createPeople: [...people],
  mayRead: true,
  mayManage: true,
  enabledQueryKeys: new Set<string>(),
};
export const useRouter = () => fixture.router;
export const useAuth = () => fixture.auth;
export const useServiceTenantId = () => tenantId;
export const isDemoMode = () => false;
export const useCareRuntimePermissions = () => ({
  tenantId, roleKey: 'nurse', permissions: grants,
  can: (key: string) => fixture.mayRead && grants.includes(key) && (key !== 'pflege.vitals.manage' || fixture.mayManage),
  loading: false, error: null, refreshPermissions: () => undefined,
});
export const carePermissionOwner = () => fixture.mayRead
  ? {tenantId, profileId, authUserId: userId, roleKey: 'nurse'} : null;

const viewScope = {};
const historyScope = {};
const noRefresh = async () => undefined;
type View = {clientId: string | null};
type Action = {view: View};
export const createVitalHistoryViewRuntimeWeb = () => ({});
export const closeVitalHistoryViewRuntimeWeb = () => undefined;
export const captureVitalHistoryViewReadWeb = () => fixture.mayRead ? viewScope : null;
export const createVitalHistoryViewWeb = (): View => ({clientId: null});
export const closeVitalHistoryViewWeb = () => undefined;
export const bindVitalHistoryViewQueryWeb = () => undefined;
export const beginVitalHistoryViewChoicesWeb = () => viewScope;
export const acceptVitalHistoryViewChoicesWeb = () => undefined;
export const vitalHistoryViewPeopleWeb = () => fixture.mayRead ? fixture.historyPeople : null;
export const captureVitalHistoryViewActionWeb = (view: View, forHistory = false): Action | null =>
  fixture.mayRead && (!forHistory || !!view.clientId) ? {view} : null;
export const mayUseVitalHistoryChoiceActionWeb = (action: Action | null) => !!action && fixture.mayRead;
export const mayUseVitalHistoryViewActionWeb = mayUseVitalHistoryChoiceActionWeb;
export const vitalHistoryViewManageWeb = () => fixture.mayRead && fixture.mayManage;
export const selectVitalHistoryViewClientWeb = (action: Action | null, id: string) => {
  if (!action || !fixture.mayRead || !fixture.historyPeople.some(c => c.id === id)) return false;
  action.view.clientId = id;
  return true;
};
export const captureVitalHistoryViewFetchWeb = (view: View) => view.clientId ? historyScope : null;
export const vitalHistoryViewRowsWeb = (view: View) => view.clientId ? measurements : null;
export const captureVitalHistoryViewChartWeb = () => null;
export const selectVitalHistoryViewComponentWeb = () => true;
export const clearVitalHistoryViewSelectionWeb = () => true;
export const mayReloadVitalHistoryViewWeb = () => true;
export const mayReloadVitalHistoryChoicesWeb = () => true;
export const fetchVitalHistoryClientsOriginalReadWeb = noRefresh;
export const fetchVitalHistoryViewWeb = noRefresh;
export const vitalHistoryViewCsvWeb = () => null;

const readScope = {};
const stop = () => undefined;
export class VitalCreateRuntimeWeb {
  tenantId = tenantId;
  role = 'nurse';
  originalDraftVersion = 0;
  readScopeVersion = 0;
  private mounted = true;
  mount = () => { this.mounted = true; };
  dispose = () => { this.mounted = false; };
  subscribeOriginal = () => stop;
  captureReadScope = () => readScope;
  setView = stop;
  canRead = () => this.mounted && fixture.mayRead;
  canManage = () => this.canRead() && fixture.mayManage;
  visible = (_key: string, data: unknown) => Array.isArray(data) ? data : undefined;
  maySelect = (_key: string, data: unknown) => fixture.mayRead && Array.isArray(data);
  canShow = this.maySelect;
  clearChoices = stop;
  originalRequestState = () => ({pending: false, busy: false, uncertain: false});
  captureOriginalRetry = stop;
  captureNewDraft = stop;
  confirmedReceipt = () => null;
}
export const fetchVitalCreateClientsWeb = noRefresh;
export const fetchVitalCreateChoicesWeb = noRefresh;
export const executeVitalCreateNativeWeb = () => { throw new Error('Synthetic fixture cannot write'); };

export const useAsyncQuery = (_load: unknown, _deps: unknown, options: {enabled: boolean; queryKey: string}) => {
  if (options.enabled) fixture.enabledQueryKeys.add(options.queryKey);
  const data = !options.enabled ? null
    : options.queryKey.endsWith(':vital-clients') ? fixture.createPeople
    : options.queryKey.endsWith(':vital-choices') ? choices : {};
  return {
    data, loading: false, refreshing: false, error: null, refreshError: null,
    previewData: false, tableMissing: false,
    cacheMeta: {fromCache: false, partialDetail: false, usedDemoFallback: false}, refresh: noRefresh,
  };
};
export const useMedicationSubmission = () => {
  const [error, setError] = useState<string | null>(null);
  return {busy: false, locked: false, uncertain: false, error, setError, confirmLeave: async () => true};
};
