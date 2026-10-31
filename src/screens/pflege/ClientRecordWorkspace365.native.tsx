// Generated native presentation from src/screens/pflege/ClientRecordWorkspace365.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {useNativeWorkflowWindow} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {nativeWindow as window} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAiPageContext } from '@/ai/useAiPageContext';
import { DetailInfoRow } from '@/components/detail';
import { AuroraSegmentedControl } from '@/components/aurora';
import { ClientWorkspaceKpiCard } from '@/components/office/ClientWorkspacePrimitives';
import { ClientRecordHero } from "../../components/office/ClientRecordHero.native.tsx";
import { ClientMasterDataNativeEditModal } from "../../components/office/ClientMasterDataNativeEditModal.native.tsx";
import { attachClientIdentityEditWeb, detachClientIdentityEditWeb, openClientIdentityEditWeb, viewClientIdentityEditWeb, clientIdentityEditWorkBlockedWeb, type ClientIdentityEditAttachment, type ClientIdentityEditToken } from "../../lib/clients/clientRecordIdentityEditSession.native.ts";
import { useSectionEditModal } from "../../hooks/useSectionEditModal.native.ts";
import { OfficeRecordDeleteButton } from '@/components/office/OfficeRecordDeleteButton';
import { ClientRecordOverviewPanel } from "../../components/pflege/ClientRecordOverview365.native.tsx";
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumButton, SectionPanel, InfoBanner, } from '@/components/ui';
import type { useClientRecord } from '@/hooks/useClientRecord';
import type { useClientFullDetail } from '@/hooks/useClientFullDetail';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import type { ClientRecordView } from '@/lib/clients/clientRecordService';
import { fetchClientOriginalReadWeb } from "../../lib/clients/clientRecordOriginalRead.native.ts";
import type { ClientNativeOriginals } from "../../lib/clients/clientRecordNativeOriginal.native.ts";
import type { ClientFullDetail } from '@/types/modules/client';
import { subscribeToClientRecordChanges } from '@/lib/realtime';
import { clientParentReadScope, captureClientParentRecord, captureClientParentDetail, type ClientParentReadScope } from "../../lib/clients/clientRecordRead.native.ts";
import { ClientRecordActionGuard, sameClientRecordActionOriginal, CLIENT_RECORD_ACTION_DENIED, CLIENT_RECORD_WRITE_UNCERTAIN, type ClientRecordActionOriginal, type ClientRecordActionTicket, type ClientRecordActionAttempt } from "../../lib/clients/clientRecordActions.native.ts";
import { ClientRecordNativeWrites, type ClientNativeWriteLease, type ClientNativeWriteOutcome } from "../../lib/clients/clientRecordNativeWrites.native.ts";
import { getServiceMode } from '@/lib/services/mode';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import type { ServiceResult, RoleKey } from '@/types';
import { useCareRuntimePermissions as usePermissions } from "../../hooks/pflege/useCareRuntimePermissions.native.ts";
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { loadClientIntakeDraft } from '@/lib/clients/clientIntakeDraftStorage';
import { archiveClient } from '@/lib/office';
import { formatClientAddressLine } from '@/lib/clients/clientAddressResolver';
import { buildClientRecordOverview } from "../../lib/clients/clientRecordOverview365.native.ts";
import { formatCareLevel, formatSalutation } from '@/lib/formatters/unitFormatters';
import { getCatalogLabel } from '@/lib/catalogs/systemCatalogs';
import { CLIENT_RECORD_TAB_LABELS, getClientRecordTabsForClientContext, resolveClientRecordTabKey, type ClientCareContext, type ClientRecordTabKey, type IntakeSectionKey } from '@/lib/clients/clientIntakeFieldRules';
import { buildClientDetailKpis } from '@/lib/office/clientDetailStats';
import { ClientRecordTabContent } from "../business/office/ClientRecordTabPanels.native.tsx";
import { ClientRecordSignaturePanel } from "../business/office/ClientRecordSignaturePanel.native.tsx";
import { ClientRecordPhysicianCommunicationPanel } from "../business/office/ClientRecordPhysicianCommunicationPanel.native.tsx";
import { ClientRecordInfectionProtectionPanel } from "../business/office/ClientRecordInfectionProtectionPanel.native.tsx";
import { ClientRecordTimelinePanel, type ClientRecordTimelineAccess } from "../business/office/ClientRecordTimelinePanel.native.tsx";
import { ClientTimelineNoteControllerStore, type ClientTimelineReadCapture, type ClientTimelineNoteCapture } from "../../lib/clients/clientTimelineNoteAction.native.ts";
import { ClientRecordContactEvidencePanel } from "../business/office/ClientRecordContactEvidencePanel.native.tsx";
import { ClientLifecycleWorkspace } from "../../components/clients/ClientLifecycleWorkspace.native.tsx";
import { ClientRecordMedicalContactsPanel } from "../business/office/ClientRecordMedicalContactsPanel.native.tsx";
import { ClientRecordDiagnosisNotesPanel } from "../business/office/ClientRecordDiagnosisNotesPanel.native.tsx";
import { captureClientContactEvidence, type ClientContactEvidence } from "../../lib/clients/clientContactEvidence.native.ts";
import { captureClientAllergyOriginalEvidenceWeb, type ClientAllergyEvidenceFieldWeb } from "../../lib/clients/clientAllergyOriginalEvidence.native.ts";
import { captureClientCareLevelEvidenceWeb, type ClientCareLevelEvidenceFieldWeb } from "../../lib/clients/clientCareLevelEvidence.native.ts";
import { captureClientCareLevelChangeEvidenceWeb, type ClientCareLevelChangeFieldWeb } from "../../lib/clients/clientCareLevelChangeEvidence.native.ts";
import { captureClientTherapyPrescriptionEvidenceWeb, type ClientTherapyPrescriptionFieldWeb } from "../../lib/clients/clientTherapyPrescriptionEvidence.native.ts";
import { KontaktAdresseTab } from '@/screens/office/ClientFullDetailTabs';
import { careSpacing } from '@/design/tokens/spacing';
import { careSuiteAuroraTheme } from '@/theme/careSuiteAurora';
import { spacing } from '@/theme';
import { SurfaceContrastProvider } from '@/design/tokens/surfaceContrast';
type ParentReadEnvelope<T> = {
    scopeKey: string;
    ticket: number;
    original: T;
};
type ParentReadCan = ReturnType<typeof usePermissions>['can'];
type ParentReadOwner = {
    key: string;
    recordTicket: number;
    fullTicket: number;
    recordOriginal: ClientRecordView | null;
    fullOriginal: ClientFullDetail | null;
    recordNative: ClientNativeOriginals | null;
    fullNative: ClientNativeOriginals | null;
    recordCan: ParentReadCan | null;
    fullCan: ParentReadCan | null;
};
type ParentOriginalReceipt = Readonly<{
    scopeKey: string;
    owner: ParentReadOwner;
    recordTicket: number;
    fullTicket: number;
    record: ClientRecordView;
    full: ClientFullDetail;
    recordNative: ClientNativeOriginals;
    fullNative: ClientNativeOriginals;
    scope: ClientParentReadScope;
}>;
function useOwnClientParentRead(clientId: string | undefined) {
    const { profile, user, portalSession } = useAuth(), tenantId = useServiceTenantId(), permissions = usePermissions();
    const livePermissions = useRef(permissions), liveProfile = useRef(profile);
    livePermissions.current = permissions;
    liveProfile.current = profile;
    const scope = clientParentReadScope({ clientId, userId: user?.id, profileId: profile?.id, profileTenant: profile?.tenantId,
        profileRole: profile?.roleKey, serviceTenant: tenantId, runtimeTenant: permissions.tenantId, runtimeRole: permissions.roleKey,
        portalSession: !!portalSession, canRead: permissions.can('office.clients.view'), canSensitive: permissions.can('office.clients.view_sensitive'), canEdit: permissions.can('office.clients.edit') });
    const alive = useRef(true), latest = useRef(scope), owner = useRef<ParentReadOwner>({ key: scope.key, recordTicket: 0, fullTicket: 0, recordOriginal: null, fullOriginal: null, recordNative: null, fullNative: null, recordCan: null, fullCan: null });
    const [, invalidate] = useState(0);
    latest.current = scope;
    const changed = owner.current.key !== scope.key;
    if (changed)
        owner.current = { key: scope.key, recordTicket: 0, fullTicket: 0, recordOriginal: null, fullOriginal: null, recordNative: null, fullNative: null, recordCan: null, fullCan: null };
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    function currentRead(expected: ClientParentReadScope, generation = owner.current) {
        const currentPermissions = livePermissions.current;
        if (!alive.current || !currentPermissions.can('office.clients.view') || currentPermissions.can('office.clients.view_sensitive') !== expected.canSensitive
            || currentPermissions.tenantId !== expected.tenantId || currentPermissions.roleKey !== expected.role
            || !latest.current.canRead || latest.current.key !== expected.key || owner.current !== generation)
            throw Error('Die aktuelle eigene Klientenakte und ihr Leserecht müssen zuerst bestätigt werden.');
        return latest.current;
    }
    function readAuthorityCurrent(can: ParentReadCan | null, expected: ClientParentReadScope): boolean {
        return !!can && can('office.clients.view') && can('office.clients.view_sensitive') === expected.canSensitive;
    }
    const readRecord = useCallback(async () => {
        const generation = owner.current;
        try {
            const current = currentRead(scope, generation), ticket = ++generation.recordTicket, capturedCan = livePermissions.current.can;
            generation.recordOriginal = null;
            generation.recordNative = null;
            generation.recordCan = null;
            invalidate(value => value + 1);
            const assertCurrentRead = () => {
                currentRead(current, generation);
                if (ticket !== generation.recordTicket || !readAuthorityCurrent(capturedCan, current))
                    throw Error('Die aktuelle Aktenabfrage wurde ersetzt.');
            };
            const result = await fetchClientOriginalReadWeb(current.tenantId, current.clientId, { canViewSensitive: current.canSensitive, includeCareContexts: true, assertCurrentRead });
            assertCurrentRead();
            if (!result.ok)
                return result;
            const careContexts = result.data.careContexts;
            if (!Array.isArray(careContexts))
                throw Error('Die nativen Aktenbereiche fehlen im eigenen Originalbeleg.');
            const original = captureClientParentRecord({ detail: result.data.detail, careContexts, tabs: getClientRecordTabsForClientContext(careContexts) }, current);
            assertCurrentRead();
            generation.recordOriginal = original;
            generation.recordNative = result.data.originals;
            generation.recordCan = capturedCan;
            return { ...result, data: { scopeKey: current.key, ticket, original } satisfies ParentReadEnvelope<ClientRecordView> };
        }
        catch (cause) {
            return { ok: false as const, error: cause instanceof Error ? cause.message : 'Eigene Akte nicht bestätigt.' };
        }
    }, [scope.key]);
    const readFull = useCallback(async () => {
        const generation = owner.current;
        try {
            const current = currentRead(scope, generation), ticket = ++generation.fullTicket, capturedCan = livePermissions.current.can;
            generation.fullOriginal = null;
            generation.fullNative = null;
            generation.fullCan = null;
            invalidate(value => value + 1);
            const assertCurrentRead = () => {
                currentRead(current, generation);
                if (ticket !== generation.fullTicket || !readAuthorityCurrent(capturedCan, current))
                    throw Error('Die aktuelle Stammdatenabfrage wurde ersetzt.');
            };
            const result = await fetchClientOriginalReadWeb(current.tenantId, current.clientId, { canViewSensitive: current.canSensitive, assertCurrentRead });
            assertCurrentRead();
            if (!result.ok)
                return result;
            const original = captureClientParentDetail(result.data.detail, current);
            assertCurrentRead();
            generation.fullOriginal = original;
            generation.fullNative = result.data.originals;
            generation.fullCan = capturedCan;
            return { ...result, data: { scopeKey: current.key, ticket, original } satisfies ParentReadEnvelope<ClientFullDetail> };
        }
        catch (cause) {
            return { ok: false as const, error: cause instanceof Error ? cause.message : 'Eigene Stammdaten nicht bestätigt.' };
        }
    }, [scope.key]);
    const recordQuery = useAsyncQuery(readRecord, [scope.key], { enabled: scope.canRead, queryKey: `office-client-record:${scope.key}`,
        live: scope.canRead ? { tenantId: scope.tenantId, subscribe: (tid, handler) => subscribeToClientRecordChanges(tid, scope.clientId, handler) } : undefined });
    const fullQuery = useAsyncQuery(readFull, [scope.key], { enabled: scope.canRead, queryKey: `office-client-full:${scope.key}` });
    // A read starts before its query state is rendered. Compare the live tickets with
    // both delivered envelopes rather than treating the previous render as a receipt.
    const delivered = useRef({ owner: owner.current, changed, recordQuery, fullQuery });
    delivered.current = { owner: owner.current, changed, recordQuery, fullQuery };
    const liveOriginalReceipt = useCallback((): ParentOriginalReceipt | null => {
        const current = latest.current, generation = owner.current, receipt = delivered.current;
        try {
            currentRead(current, generation);
        }
        catch {
            return null;
        }
        if (!current.canRead || generation.key !== current.key || receipt.owner !== generation || receipt.changed
            || !generation.recordNative || !generation.fullNative || !readAuthorityCurrent(generation.recordCan, current) || !readAuthorityCurrent(generation.fullCan, current))
            return null;
        const readyNow = (query: typeof recordQuery | typeof fullQuery, ticket: number, original: ClientRecordView | ClientFullDetail | null) => !query.loading && !query.refreshing && !query.error && !query.refreshError && !query.previewData && !query.tableMissing
            && !query.cacheMeta.fromCache && !query.cacheMeta.partialDetail && query.data?.scopeKey === current.key && query.data.ticket === ticket
            && !!original && query.data.original === original;
        if (!readyNow(receipt.recordQuery, generation.recordTicket, generation.recordOriginal) || !readyNow(receipt.fullQuery, generation.fullTicket, generation.fullOriginal))
            return null;
        return Object.freeze({ scopeKey: current.key, owner: generation, recordTicket: generation.recordTicket, fullTicket: generation.fullTicket,
            record: receipt.recordQuery.data!.original, full: receipt.fullQuery.data!.original, recordNative: generation.recordNative, fullNative: generation.fullNative, scope: current });
    }, []);
    // Only an empty generation token crosses the panel boundary. Raw originals remain in private assertion closures.
    const timelineOwners = useRef(new WeakMap<ParentReadOwner, object>());
    function captureTimelineBase(sensitive: boolean): ClientTimelineReadCapture | null {
        const original = liveOriginalReceipt(), capturedCan = livePermissions.current.can;
        if (!original || sensitive && !original.scope.canSensitive || !capturedCan('office.clients.view')
            || capturedCan('office.clients.view_sensitive') !== original.scope.canSensitive)
            return null;
        let opaque = timelineOwners.current.get(original.owner);
        if (!opaque) {
            opaque = Object.freeze({});
            timelineOwners.current.set(original.owner, opaque);
        }
        const assertCurrentRead = () => {
            const current = liveOriginalReceipt();
            if (!current || current.owner !== original.owner || current.scopeKey !== original.scopeKey
                || current.recordTicket !== original.recordTicket || current.fullTicket !== original.fullTicket
                || current.record !== original.record || current.full !== original.full
                || current.recordNative !== original.recordNative || current.fullNative !== original.fullNative
                || !capturedCan('office.clients.view') || capturedCan('office.clients.view_sensitive') !== original.scope.canSensitive
                || sensitive && (!current.scope.canSensitive || !capturedCan('office.clients.view_sensitive'))) {
                throw Error('Der eigene aktuelle Originalbeleg für den Verlauf wurde ersetzt.');
            }
        };
        try {
            assertCurrentRead();
        }
        catch {
            return null;
        }
        return Object.freeze({ tenantId: original.scope.tenantId, clientId: original.scope.clientId, owner: opaque,
            key: JSON.stringify([original.scopeKey, original.recordTicket, original.fullTicket]), assertCurrentRead });
    }
    const captureTimelineRead = useCallback(() => captureTimelineBase(true), []);
    const captureTimelineInternalNotesRead = useCallback(() => captureTimelineBase(false), []);
    const captureTimelineNoteWrite = useCallback((): ClientTimelineNoteCapture | null => {
        const base = captureTimelineBase(false), capturedCan = livePermissions.current.can;
        if (!base || !capturedCan('office.clients.edit'))
            return null;
        const actor = liveProfile.current?.displayName;
        const assertCurrentWrite = () => {
            base.assertCurrentRead();
            if (!capturedCan('office.clients.edit') || !livePermissions.current.can('office.clients.edit')) {
                throw Error('Das aktuelle eigene Recht zum Anlegen einer Verlaufsnotiz ist nicht bestätigt.');
            }
        };
        try {
            assertCurrentWrite();
        }
        catch {
            return null;
        }
        return Object.freeze({ ...base, actorName: typeof actor === 'string' && actor.trim() ? actor : null, assertCurrentWrite });
    }, []);
    const ready = (query: typeof recordQuery | typeof fullQuery, ticket: number, original: ClientRecordView | ClientFullDetail | null) => alive.current && scope.canRead && !changed
        && !query.loading && !query.refreshing && !query.error && !query.refreshError && !query.previewData && !query.tableMissing
        && !query.cacheMeta.fromCache && !query.cacheMeta.partialDetail && query.data?.scopeKey === scope.key && query.data.ticket === ticket
        && !!original && query.data.original === original;
    const recordReady = !!owner.current.recordNative && readAuthorityCurrent(owner.current.recordCan, scope) && ready(recordQuery, owner.current.recordTicket, owner.current.recordOriginal), fullReady = !!owner.current.fullNative && readAuthorityCurrent(owner.current.fullCan, scope) && ready(fullQuery, owner.current.fullTicket, owner.current.fullOriginal);
    const ownRead = recordReady && fullReady;
    const record = ownRead ? recordQuery.data!.original : null, full = ownRead ? fullQuery.data!.original : null;
    const refreshOwner = owner.current;
    const refresh = useCallback(async () => {
        if (permissions.error) {
            permissions.refreshPermissions();
            return;
        }
        try {
            currentRead(scope, refreshOwner);
        }
        catch {
            return;
        }
        await Promise.all([recordQuery.refresh(), fullQuery.refresh()]);
    }, [scope.key, recordQuery.refresh, fullQuery.refresh, permissions.error, permissions.refreshPermissions]);
    const error = permissions.loading ? null : permissions.error ?? (!scope.canRead ? 'Die eigene Klientenakte und ihr aktuelles Leserecht sind nicht bestätigt.' : recordQuery.error ?? recordQuery.refreshError ?? fullQuery.error ?? fullQuery.refreshError
        ?? ((!recordReady && (recordQuery.previewData || recordQuery.tableMissing || recordQuery.cacheMeta.fromCache || recordQuery.cacheMeta.partialDetail)) || (!fullReady && (fullQuery.previewData || fullQuery.tableMissing || fullQuery.cacheMeta.fromCache || fullQuery.cacheMeta.partialDetail)) ? 'Die aktuelle Originalakte ist nicht als eigener vollständiger Lesestand bestätigt.' : null));
    return { scope, ownRead, liveOriginalReceipt, captureTimelineRead, captureTimelineInternalNotesRead, captureTimelineNoteWrite, detail: record?.detail ?? null, careContexts: record?.careContexts ?? [], tabs: record?.tabs ?? [],
        fullQuery: { ...fullQuery, data: full, canViewSensitive: scope.canSensitive }, recordQuery, refresh,
        loading: permissions.loading || (scope.canRead && !ownRead && !error), error };
}
function resolvePrimaryAddress(detail: NonNullable<ReturnType<typeof useClientRecord>['detail']>, fullClient: ReturnType<typeof useClientFullDetail>['data']): string {
    const primary = fullClient?.addresses.find((a) => a.isPrimary) ?? fullClient?.addresses[0];
    if (primary) {
        return formatClientAddressLine(primary.street, primary.zip, primary.city) || '—';
    }
    return formatClientAddressLine(detail.street, detail.zip, detail.city) || '—';
}
function StammdatenTab({ detail, fullClient, canViewSensitive, careContexts, onEditMasterData, }: {
    detail: NonNullable<ReturnType<typeof useClientRecord>['detail']>;
    fullClient: ReturnType<typeof useClientFullDetail>['data'];
    canViewSensitive: boolean;
    careContexts: ClientCareContext[];
    onEditMasterData?: () => void;
}) {
    const serviceTypes = careContexts.length > 0
        ? careContexts.map((ctx) => getCatalogLabel('leistungsart', ctx)).join(' · ')
        : '—';
    const phone = detail.phone ?? detail.primaryContactPhone ?? fullClient?.phone ?? '—';
    const email = detail.email ?? fullClient?.email ?? '—';
    return (<View style={styles.tabPanel}>
      <SectionPanel title="Stammdaten">
        <DetailInfoRow label="Name" value={`${detail.firstName} ${detail.lastName}`.trim()}/>
        <DetailInfoRow label="Geburtsdatum" value={detail.dateOfBirth
            ? new Date(detail.dateOfBirth).toLocaleDateString('de-DE')
            : fullClient?.core.dateOfBirth
                ? new Date(fullClient.core.dateOfBirth).toLocaleDateString('de-DE')
                : null}/>
        <DetailInfoRow label="Adresse" value={resolvePrimaryAddress(detail, fullClient)}/>
        <DetailInfoRow label="Telefon" value={phone}/>
        <DetailInfoRow label="E-Mail" value={email}/>
        <DetailInfoRow label="Pflegegrad" value={formatCareLevel(detail.careLevel) || '—'}/>
        <DetailInfoRow label="Leistungsart" value={serviceTypes}/>
      </SectionPanel>
      {fullClient ? (<SectionPanel title="Weitere Stammdaten">
          <DetailInfoRow label="Anrede" value={formatSalutation(fullClient.core.salutation) || '—'}/>
          <DetailInfoRow label="Geschlecht" value={fullClient.core.gender}/>
          <DetailInfoRow label="Status" value={detail.status}/>
          <DetailInfoRow label="Versichertennummer" value={fullClient.core.insuranceNumber
                ? canViewSensitive
                    ? fullClient.core.insuranceNumber
                    : '••• Geschützt'
                : null}/>
          <DetailInfoRow label="Schlüsseltresor" value={fullClient.core.keySafeCode
                ? canViewSensitive
                    ? fullClient.core.keySafeCode
                    : '••• Geschützt'
                : null}/>
        </SectionPanel>) : null}
      {onEditMasterData ? (<PremiumButton title="Klientenakte bearbeiten" variant="secondary" onPress={onEditMasterData}/>) : null}
    </View>);
}
export function ClientRecordScreen(props: {
    initialTabOverride?: ClientRecordTabKey;
    clientId?: string;
    embedded?: boolean;
    embeddedInModal?: boolean;
    onDeleted?: () => void;
    onEditMasterData?: () => void;
    initialMasterDataEditOpen?: boolean;
} = {}) {
    return (<SurfaceContrastProvider tone="light">
      <ClientRecordScreenContent {...props}/>
    </SurfaceContrastProvider>);
}
function ClientRecordScreenContent({ initialTabOverride, clientId: clientIdProp, embedded = false, onDeleted, onEditMasterData, initialMasterDataEditOpen = false, }: {
    initialTabOverride?: ClientRecordTabKey;
    clientId?: string;
    embedded?: boolean;
    embeddedInModal?: boolean;
    onDeleted?: () => void;
    onEditMasterData?: () => void;
    /** Opens the private area choice on first render (e.g. list deep link ?edit=1). */
    initialMasterDataEditOpen?: boolean;
} = {}) {
    const window = useNativeWorkflowWindow();
    const { id: routeId, tab: tabParam, edit: editParam } = useLocalSearchParams<{
        id: string;
        tab?: string;
        edit?: string;
    }>();
    const id = clientIdProp ?? routeId;
    const router = useRouter();
    const { profile, user } = useAuth();
    const tenantId = useServiceTenantId();
    const { can } = usePermissions();
    const parentRead = useOwnClientParentRead(id);
    const { detail, careContexts, tabs, loading, error, refresh, fullQuery } = parentRead;
    const currentParent = useRef(parentRead);
    currentParent.current = parentRead;
    const timelineControllersRef = useRef<ClientTimelineNoteControllerStore | null>(null);
    if (!timelineControllersRef.current)
        timelineControllersRef.current = new ClientTimelineNoteControllerStore();
    const actionGuardRef = useRef<ClientRecordActionGuard | null>(null);
    if (!actionGuardRef.current)
        actionGuardRef.current = new ClientRecordActionGuard();
    const actions = actionGuardRef.current;
    const nativeWritesRef = useRef<ClientRecordNativeWrites | null>(null);
    if (!nativeWritesRef.current)
        nativeWritesRef.current = new ClientRecordNativeWrites();
    const nativeWrites = nativeWritesRef.current;
    const liveIdentityAuth = useRef({ user, profile, tenantId, id });
    liveIdentityAuth.current = { user, profile, tenantId, id };
    const liveActionCan = useRef(can);
    liveActionCan.current = can;
    const panelTimelineOwners = useRef(new WeakMap<ParentReadOwner, {
        token: object;
        can: ParentReadCan;
    }>());
    function bindTimelineRead(base: ClientTimelineReadCapture): ClientTimelineReadCapture | null {
        const original = currentParent.current.liveOriginalReceipt();
        const capturedCan = liveActionCan.current, sensitive = currentParent.current.scope.canSensitive;
        if (!original)
            return null;
        const assertCurrentRead = () => {
            base.assertCurrentRead();
            if (!capturedCan('office.clients.view') || capturedCan('office.clients.view_sensitive') !== sensitive
                || !liveActionCan.current('office.clients.view') || liveActionCan.current('office.clients.view_sensitive') !== sensitive) {
                throw Error('Das aktuelle eigene Leserecht für diesen Verlaufsbeleg wurde ersetzt.');
            }
        };
        try {
            assertCurrentRead();
        }
        catch {
            return null;
        }
        // A refreshed native permission read permanently invalidates its old can closure.
        // Bind the opaque panel generation to that lifetime as well as the inner original receipt;
        // matching grants cannot revive cached timeline evidence without a fresh native source read.
        let generation = panelTimelineOwners.current.get(original.owner);
        if (!generation || !generation.can('office.clients.view') || generation.can('office.clients.view_sensitive') !== sensitive) {
            generation = { token: Object.freeze({}), can: capturedCan };
            panelTimelineOwners.current.set(original.owner, generation);
        }
        return Object.freeze({ ...base, owner: generation.token, assertCurrentRead });
    }
    function capturePanelTimelineRead(): ClientTimelineReadCapture | null {
        const base = currentParent.current.captureTimelineRead();
        return base ? bindTimelineRead(base) : null;
    }
    function capturePanelPhysicianCommunicationRead(): ClientTimelineReadCapture | null {
        const base = capturePanelTimelineRead(), capturedCan = liveActionCan.current;
        if (!base || !capturedCan('communication.view_center'))
            return null;
        const assertCurrentRead = () => {
            base.assertCurrentRead();
            if (!capturedCan('communication.view_center') || !liveActionCan.current('communication.view_center')) {
                throw Error('Das aktuelle eigene Recht auf sensible Kommunikationsoriginale wurde ersetzt.');
            }
        };
        try {
            assertCurrentRead();
        }
        catch {
            return null;
        }
        return Object.freeze({ ...base, assertCurrentRead });
    }
    function capturePanelInternalNotesRead(): ClientTimelineReadCapture | null {
        const base = currentParent.current.captureTimelineInternalNotesRead();
        return base ? bindTimelineRead(base) : null;
    }
    const contactEvidenceRef = useRef<{
        source: ClientNativeOriginals;
        evidence: ClientContactEvidence;
    } | null>(null);
    function capturePanelContactRead() {
        const base = capturePanelInternalNotesRead(), original = currentParent.current.liveOriginalReceipt();
        if (!base || !original)
            return null;
        try {
            base.assertCurrentRead();
            if (contactEvidenceRef.current?.source !== original.fullNative) {
                const evidence = captureClientContactEvidence(original.fullNative.parts.contacts, { tenantId: base.tenantId, clientId: base.clientId });
                base.assertCurrentRead();
                contactEvidenceRef.current = { source: original.fullNative, evidence };
            }
            const evidence = contactEvidenceRef.current;
            if (!evidence || evidence.source !== original.fullNative)
                return null;
            base.assertCurrentRead();
            return Object.freeze({ ...base, entries: evidence.evidence.entries });
        }
        catch {
            return null;
        }
    }
    // Reuse both native permission lifetimes and the exact delivered Fullroot; no new query or capability.
    function captureAllergyAtRender() {
        const read = capturePanelTimelineRead(), original = currentParent.current.liveOriginalReceipt();
        if (!read || !original || !original.scope.canSensitive)
            return null;
        const source = original.fullNative.parts.client;
        const current = () => {
            read.assertCurrentRead();
            const now = currentParent.current.liveOriginalReceipt();
            if (!now || !now.scope.canSensitive || !sameClientRecordActionOriginal(original, now)
                || now.owner !== original.owner || now.recordTicket !== original.recordTicket || now.fullTicket !== original.fullTicket
                || now.fullNative !== original.fullNative || now.fullNative.parts.client !== source)
                throw Error('Der eigene aktuelle Aktenhinweis ist nicht bestätigt.');
            read.assertCurrentRead();
        };
        try {
            current();
            const evidence = captureClientAllergyOriginalEvidenceWeb(source, { tenantId: original.scope.tenantId, clientId: original.scope.clientId });
            current();
            if (!evidence)
                return null;
            return Object.freeze({ evidence, current });
        }
        catch {
            return null;
        }
    }
    function consumeAllergyAtRender(captured: ReturnType<typeof captureAllergyAtRender>) {
        try {
            if (!captured)
                return null;
            captured.current();
            const evidence = captured.evidence;
            captured.current();
            return evidence;
        }
        catch {
            return null;
        }
    }
    // Whole delivered care-level pool, bound to the same two native permission lifetimes and Fullroot.
    function captureCareLevelEvidenceAtRender() {
        const read = capturePanelTimelineRead(), original = currentParent.current.liveOriginalReceipt();
        if (!read || !original || !original.scope.canSensitive)
            return null;
        const source = original.fullNative.parts.careLevels;
        const current = () => {
            read.assertCurrentRead();
            const now = currentParent.current.liveOriginalReceipt();
            if (!now || !now.scope.canSensitive || !sameClientRecordActionOriginal(original, now)
                || now.owner !== original.owner || now.recordTicket !== original.recordTicket || now.fullTicket !== original.fullTicket
                || now.fullNative !== original.fullNative || now.fullNative.parts.careLevels !== source) {
                throw Error('Der eigene aktuelle Pflegegrad-Originalauszug ist nicht bestätigt.');
            }
            read.assertCurrentRead();
        };
        try {
            current();
            const evidence = captureClientCareLevelEvidenceWeb(source, { tenantId: original.scope.tenantId, clientId: original.scope.clientId });
            current();
            if (!evidence)
                return null;
            return Object.freeze({ evidence, current });
        }
        catch {
            return null;
        }
    }
    function consumeCareLevelEvidenceAtRender(captured: ReturnType<typeof captureCareLevelEvidenceAtRender>) {
        try {
            if (!captured)
                return null;
            captured.current();
            const evidence = captured.evidence;
            captured.current();
            return evidence;
        }
        catch {
            return null;
        }
    }
    // Document successor events remain separate from care-level rows. Only native IDs are linked.
    function captureCareLevelChangeEvidenceAtRender() {
        const read = capturePanelTimelineRead(), original = currentParent.current.liveOriginalReceipt();
        if (!read || !original || !original.scope.canSensitive)
            return null;
        const sources = {
            careLevels: original.fullNative.parts.careLevels,
            intakeDocuments: original.fullNative.parts.intakeDocuments,
            documents: original.fullNative.parts.documents,
            documentEvents: original.fullNative.parts.documentEvents,
            tasks: original.fullNative.parts.tasks,
        };
        const current = () => {
            read.assertCurrentRead();
            const now = currentParent.current.liveOriginalReceipt();
            if (!now || !now.scope.canSensitive || !sameClientRecordActionOriginal(original, now)
                || now.owner !== original.owner || now.recordTicket !== original.recordTicket || now.fullTicket !== original.fullTicket
                || now.fullNative !== original.fullNative
                || now.fullNative.parts.careLevels !== sources.careLevels
                || now.fullNative.parts.intakeDocuments !== sources.intakeDocuments
                || now.fullNative.parts.documents !== sources.documents
                || now.fullNative.parts.documentEvents !== sources.documentEvents
                || now.fullNative.parts.tasks !== sources.tasks) {
                throw Error('Der eigene aktuelle Pflegegrad-Dokumentverlauf ist nicht bestätigt.');
            }
            read.assertCurrentRead();
        };
        try {
            current();
            const evidence = captureClientCareLevelChangeEvidenceWeb(sources, { tenantId: original.scope.tenantId, clientId: original.scope.clientId });
            current();
            if (!evidence)
                return null;
            return Object.freeze({ evidence, current });
        }
        catch {
            return null;
        }
    }
    function consumeCareLevelChangeEvidenceAtRender(captured: ReturnType<typeof captureCareLevelChangeEvidenceAtRender>) {
        try {
            if (!captured)
                return null;
            captured.current();
            const evidence = captured.evidence;
            captured.current();
            return evidence;
        }
        catch {
            return null;
        }
    }
    // Prescriptions have native client scope, but the current schema supplies no appointment/provider/task FK.
    function captureTherapyPrescriptionEvidenceAtRender() {
        const read = capturePanelTimelineRead(), original = currentParent.current.liveOriginalReceipt();
        if (!read || !original || !original.scope.canSensitive)
            return null;
        const source = original.fullNative.parts.prescriptions;
        const current = () => {
            read.assertCurrentRead();
            const now = currentParent.current.liveOriginalReceipt();
            if (!now || !now.scope.canSensitive || !sameClientRecordActionOriginal(original, now)
                || now.owner !== original.owner || now.recordTicket !== original.recordTicket || now.fullTicket !== original.fullTicket
                || now.fullNative !== original.fullNative || now.fullNative.parts.prescriptions !== source) {
                throw Error('Der eigene aktuelle Verordnungs-Originalauszug ist nicht bestätigt.');
            }
            read.assertCurrentRead();
        };
        try {
            current();
            const evidence = captureClientTherapyPrescriptionEvidenceWeb(source, { tenantId: original.scope.tenantId, clientId: original.scope.clientId });
            current();
            if (!evidence)
                return null;
            return Object.freeze({ evidence, current });
        }
        catch {
            return null;
        }
    }
    function consumeTherapyPrescriptionEvidenceAtRender(captured: ReturnType<typeof captureTherapyPrescriptionEvidenceAtRender>) {
        try {
            if (!captured)
                return null;
            captured.current();
            const evidence = captured.evidence;
            captured.current();
            return evidence;
        }
        catch {
            return null;
        }
    }
    function capturePanelTimelineNote(): ClientTimelineNoteCapture | null {
        const base = currentParent.current.captureTimelineNoteWrite(), capturedCan = liveActionCan.current;
        const read = base ? bindTimelineRead(base) : null;
        if (!base || !read || !capturedCan('office.clients.edit'))
            return null;
        const assertCurrentWrite = () => {
            read.assertCurrentRead();
            base.assertCurrentWrite();
            if (!capturedCan('office.clients.edit') || !liveActionCan.current('office.clients.edit')) {
                throw Error('Das aktuelle eigene Recht zum Anlegen einer Verlaufsnotiz wurde ersetzt.');
            }
        };
        try {
            assertCurrentWrite();
        }
        catch {
            return null;
        }
        return Object.freeze({ ...read, actorName: base.actorName, assertCurrentWrite });
    }
    const timelineAccess: ClientRecordTimelineAccess = {
        nativeOwnerKey: JSON.stringify([parentRead.scope.tenantId, parentRead.scope.clientId, parentRead.scope.actorId, parentRead.scope.role]),
        captureRead: capturePanelTimelineRead, captureInternalNotesRead: capturePanelInternalNotesRead, captureWrite: capturePanelTimelineNote,
        internalNotes: parentRead.ownRead ? fullQuery.data?.internalNotes ?? [] : [],
    };
    const [, renderActions] = useState(0);
    const originalAtRender = parentRead.liveOriginalReceipt();
    actions.update({ original: originalAtRender, liveOriginal: parentRead.liveOriginalReceipt,
        livePermission: action => can(action === 'delete' ? 'office.clients.delete' : action === 'archive' ? 'office.clients.archive' : 'office.clients.edit'),
        canEdit: parentRead.scope.canEdit, canArchive: can('office.clients.archive'), canDelete: can('office.clients.delete') });
    const callbacks = useRef({ onDeleted, onEditMasterData, router });
    callbacks.current = { onDeleted, onEditMasterData, router };
    useEffect(() => {
        actions.mount();
        nativeWrites.mount();
        renderActions(value => value + 1);
        return () => { actions.dispose(); nativeWrites.dispose(); };
    }, [actions, nativeWrites]);
    const [actionError, setActionError] = useState<{
        original: ClientRecordActionOriginal;
        error: string;
    } | null>(null);
    const actionStatus = actions.status();
    const archiving = actionStatus.pendingAction === 'archive';
    const archiveError = actionStatus.warning ?? (sameClientRecordActionOriginal(actionError?.original ?? null, originalAtRender) ? actionError!.error : null);
    const resolvedTabParam = resolveClientRecordTabKey(initialTabOverride ?? tabParam);
    const initialTab = resolvedTabParam && tabs.includes(resolvedTabParam)
        ? resolvedTabParam
        : 'uebersicht';
    const [activeTab, setActiveTab] = useState<ClientRecordTabKey>(initialTab);
    type EditorOwner = {
        serial: number;
        ticket: ClientRecordActionTicket;
        can: ParentReadCan;
        identityToken?: ClientIdentityEditToken;
    };
    const [editor, setEditor] = useState<EditorOwner | null>(null);
    const currentEditor = useRef<EditorOwner | null>(null), editorSerial = useRef(0), initialEditorPending = useRef(initialMasterDataEditOpen);
    currentEditor.current = editor && actions.current(editor.ticket) && (!editor.identityToken || viewClientIdentityEditWeb(editor.identityToken)) ? editor : null;
    const masterDataEditOpen = !!currentEditor.current;
    const deleteFollowup = useRef<{
        attempt: ClientRecordActionAttempt;
        used: boolean;
        lease: ClientNativeWriteLease | null;
        outcome: ClientNativeWriteOutcome | null;
    } | null>(null);
    const localSignedRecoveryAttemptedRef = useRef<{
        key: string;
    } | null>(null);
    const sectionEdit = useSectionEditModal<IntakeSectionKey>();
    const identityAttachment = useRef<ClientIdentityEditAttachment | null>(null);
    const identityOwnerKey = JSON.stringify([user?.id, profile?.id, profile?.tenantId, id, profile?.roleKey]);
    function currentIdentityEdit() {
        const auth = liveIdentityAuth.current, expected = currentEditor.current, original = currentParent.current.liveOriginalReceipt();
        if (!expected || !original || !auth.user || !auth.profile || auth.user.id !== auth.profile.id || auth.profile.id !== original.scope.actorId
            || auth.profile.tenantId !== original.scope.tenantId || auth.tenantId !== original.scope.tenantId || auth.id !== original.scope.clientId || auth.profile.roleKey !== original.scope.role
            || !sameClientRecordActionOriginal(expected.ticket.original, original) || !actions.current(expected.ticket))
            return null;
        const currentCan = () => expected.can('office.clients.view') && expected.can('office.clients.edit')
            && expected.can('office.clients.view_sensitive') === original.scope.canSensitive && liveActionCan.current('office.clients.view')
            && liveActionCan.current('office.clients.edit') && liveActionCan.current('office.clients.view_sensitive') === original.scope.canSensitive;
        if (!currentCan())
            return null;
        return { userId: auth.user.id, profileId: auth.profile.id, edit: { original, editor: expected, ticket: expected.ticket, actions,
                canRead: () => currentCan(), canEdit: () => currentCan(), canSensitive: () => expected.can('office.clients.view_sensitive') },
            canChangeStatus: () => currentCan() && expected.can('office.clients.status_change') && liveActionCan.current('office.clients.status_change') };
    }
    useEffect(() => {
        const attachment = attachClientIdentityEditWeb({ userId: user?.id ?? '', profileId: profile?.id ?? '', tenantId: profile?.tenantId ?? '', clientId: id ?? '', role: profile?.roleKey ?? '' }, currentIdentityEdit, {
            changed: () => renderActions(value => value + 1),
            closed: () => { const expected = currentEditor.current; if (expected)
                closeEditor(expected); },
            saved: () => { const expected = currentEditor.current; if (expected)
                savedEditor(expected); },
        });
        identityAttachment.current = attachment;
        return () => { if (attachment)
            detachClientIdentityEditWeb(attachment); if (identityAttachment.current === attachment)
            identityAttachment.current = null; };
    }, [identityOwnerKey]);
    const identityWorkBlocked = () => clientIdentityEditWorkBlockedWeb(identityAttachment.current);
    useEffect(() => {
        if (typeof window === 'undefined')
            return;
        const unload = (event: BeforeUnloadEvent) => {
            const auth = liveIdentityAuth.current;
            const liveKey = JSON.stringify([auth.user?.id, auth.profile?.id, auth.profile?.tenantId, auth.id, auth.profile?.roleKey]);
            // A generic browser warning never exposes this owner's private work or
            // grants an action. Reload still cannot persist an in-process journal.
            if (liveKey === identityOwnerKey && identityAttachment.current && identityWorkBlocked()) {
                event.preventDefault();
                event.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', unload);
        return () => window.removeEventListener('beforeunload', unload);
    }, [identityOwnerKey]);
    function captureNativeAction(ticket: ClientRecordActionTicket | null): ClientNativeWriteLease | null {
        if (!ticket || ticket.action !== 'delete' && ticket.action !== 'recovery')
            return null;
        const action = ticket.action;
        return nativeWrites.capture(() => {
            const original = currentParent.current.liveOriginalReceipt();
            if (identityWorkBlocked() || !sameClientRecordActionOriginal(ticket.original, original) || !actions.current(ticket)
                || !liveActionCan.current(action === 'delete' ? 'office.clients.delete' : 'office.clients.edit'))
                return null;
            return { original: original!, action, actionTicket: ticket, allowed: true };
        });
    }
    function nativeServiceResult(outcome: ClientNativeWriteOutcome): ServiceResult<void> {
        return outcome.status === 'acknowledged' ? { ok: true, data: undefined }
            : { ok: false, error: outcome.error ?? CLIENT_RECORD_WRITE_UNCERTAIN };
    }
    function finishNativeAction(attempt: ClientRecordActionAttempt, lease: ClientNativeWriteLease, outcome: ClientNativeWriteOutcome): boolean {
        if (actions.finishUnstarted(attempt, () => nativeWrites.isOwnUnstarted(lease, outcome)) === 'blocked')
            return true;
        actions.finish(attempt, nativeServiceResult(outcome));
        return false;
    }
    useEffect(() => {
        const userId = user?.id ?? null;
        const ticket = actions.capture('recovery'), expectedKey = parentRead.scope.key;
        let cancelled = false;
        const currentRecovery = () => !cancelled && actions.mayLaunch(ticket) && !currentEditor.current && !identityWorkBlocked();
        if (!ticket || !currentRecovery() || !userId || localSignedRecoveryAttemptedRef.current?.key === expectedKey)
            return;
        const reservation = { key: expectedKey };
        localSignedRecoveryAttemptedRef.current = reservation;
        let attempt: ClientRecordActionAttempt | null = null;
        void (async () => {
            try {
                const draft = await loadClientIntakeDraft(userId, ticket.original.scope.tenantId);
                if (!currentRecovery() || !draft || draft.clientId !== ticket.original.scope.clientId)
                    return;
                const containsSignedDocument = draft.form.intakeDocuments.some((document) => Object.values(document.signatures).some((signature) => Boolean(signature?.dataUrl)));
                if (!containsSignedDocument || !currentRecovery())
                    return;
                const lease = captureNativeAction(ticket);
                if (!lease)
                    return;
                attempt = actions.begin(ticket);
                if (!attempt)
                    return;
                renderActions(value => value + 1);
                const recovered = await nativeWrites.recover(lease, draft.form);
                const unstarted = finishNativeAction(attempt, lease, recovered);
                if (unstarted && actions.current(ticket))
                    setActionError({ original: ticket.original, error: recovered.error ?? CLIENT_RECORD_ACTION_DENIED });
                if (!cancelled && !identityWorkBlocked() && nativeWrites.mayFollowup(lease, recovered) && actions.mayFollowup(attempt))
                    await currentParent.current.refresh();
            }
            catch (cause) {
                const message = cause instanceof Error ? cause.message : 'Die Wiederherstellung konnte nicht bestätigt werden.';
                if (attempt)
                    actions.finish(attempt, { ok: false, error: message });
                else if (currentRecovery())
                    setActionError({ original: ticket.original, error: message });
            }
            finally {
                if (attempt && actions.mayNotify(attempt))
                    renderActions(value => value + 1);
                if (!attempt && !actions.current(ticket) && localSignedRecoveryAttemptedRef.current === reservation)
                    localSignedRecoveryAttemptedRef.current = null;
            }
        })();
        return () => {
            cancelled = true;
            if (!attempt && localSignedRecoveryAttemptedRef.current === reservation)
                localSignedRecoveryAttemptedRef.current = null;
        };
    }, [actions, nativeWrites, parentRead.ownRead, parentRead.scope.key, parentRead.scope.canEdit, parentRead.detail, user?.id]);
    useEffect(() => {
        const resolved = resolveClientRecordTabKey(resolvedTabParam);
        if (resolved && tabs.includes(resolved)) {
            setActiveTab(resolved);
        }
    }, [resolvedTabParam, tabs]);
    const editTicket = actions.capture('edit');
    function handleEditMasterData(): boolean {
        if (currentEditor.current || !actions.mayLaunch(editTicket) || !identityAttachment.current)
            return false;
        const nextEditor: EditorOwner = { serial: ++editorSerial.current, ticket: editTicket!, can: liveActionCan.current };
        currentEditor.current = nextEditor;
        const identityToken = openClientIdentityEditWeb(identityAttachment.current);
        if (!identityToken) {
            currentEditor.current = null;
            return false;
        }
        nextEditor.identityToken = identityToken;
        setEditor(nextEditor);
        return true;
    }
    function closeEditor(expected: EditorOwner | null): boolean {
        if (!expected || currentEditor.current !== expected || !actions.current(expected.ticket))
            return false;
        currentEditor.current = null;
        setEditor(null);
        sectionEdit.closeSection();
        return true;
    }
    function savedEditor(expected: EditorOwner | null): void {
        if (!closeEditor(expected) || !actions.current(expected!.ticket))
            return;
        void currentParent.current.refresh();
    }
    const hostsLocalEditModal = true;
    useEffect(() => {
        const fromRoute = !embedded && editParam === '1';
        if ((!initialEditorPending.current && !fromRoute) || !handleEditMasterData())
            return;
        initialEditorPending.current = false;
        if (fromRoute && actions.current(editTicket))
            callbacks.current.router.setParams({ edit: undefined } as never);
    }, [actions, editTicket, editParam, embedded, onEditMasterData]);
    const tabOptions = tabs.map((t) => ({ key: t, label: CLIENT_RECORD_TAB_LABELS[t] ?? t }));
    const allergyCapture = captureAllergyAtRender();
    const allergyEvidence = consumeAllergyAtRender(allergyCapture);
    const allergyFieldText = (field: ClientAllergyEvidenceFieldWeb) => field.state === 'value' ? field.text! : ({
        missing: 'Nicht geliefert · keine Abwesenheitsbestätigung', undefined: 'Ungeklärter eigener Feldwert',
        null: 'Keine Originalangabe hinterlegt', empty: 'Originalangabe ist leer', unresolved: 'Originalformat ungeklärt',
    } as const)[field.state as Exclude<ClientAllergyEvidenceFieldWeb['state'], 'value'>];
    const allergyRowLabels: Record<string, string> = { created_at: 'Aktenerstellung · allgemeine Metadaten', updated_at: 'Letzte Aktenänderung · allgemeine Metadaten', created_by: 'Gespeicherte Erstellungspersonkennung', updated_by: 'Gespeicherte Bearbeitungspersonkennung' };
    const careLevelCapture = activeTab === 'pflegegrad' ? captureCareLevelEvidenceAtRender() : null;
    const careLevelEvidence = consumeCareLevelEvidenceAtRender(careLevelCapture);
    const careLevelChangeCapture = activeTab === 'pflegegrad' ? captureCareLevelChangeEvidenceAtRender() : null;
    const careLevelChangeEvidence = consumeCareLevelChangeEvidenceAtRender(careLevelChangeCapture);
    const therapyPrescriptionCapture = activeTab === 'rezepte' ? captureTherapyPrescriptionEvidenceAtRender() : null;
    const therapyPrescriptionEvidence = consumeTherapyPrescriptionEvidenceAtRender(therapyPrescriptionCapture);
    const careLevelFieldText = (field: ClientCareLevelEvidenceFieldWeb) => field.state === 'value' ? field.text! : ({
        missing: 'Nicht geliefert', undefined: 'Ungeklärter eigener Feldwert', null: 'Keine Originalangabe hinterlegt',
        empty: 'Originalangabe ist leer', unresolved: 'Originalformat ungeklärt',
    } as const)[field.state as Exclude<ClientCareLevelEvidenceFieldWeb['state'], 'value'>];
    const careLevelLabels: Record<string, string> = {
        id: 'Native Zeilenkennung', grade: 'Hinterlegter Grad', valid_from: 'Hinterlegt gültig ab',
        valid_until: 'Hinterlegt gültig bis', care_fund_name: 'Hinterlegte Pflegekasse',
        care_fund_member_id: 'Hinterlegte Mitgliedskennung', md_assessment_date: 'Hinterlegtes MD-Datum',
        notes: 'Hinterlegte Hinweise', created_at: 'Allgemeine Zeilenerstellung', updated_at: 'Allgemeine Zeilenänderung',
    };
    const careLevelChangeFieldText = (field: ClientCareLevelChangeFieldWeb) => field.state === 'value' ? field.text! : ({
        missing: 'Keine native Verknüpfung geliefert', undefined: 'Ungeklärter eigener Feldwert', null: 'Native Angabe ist NULL',
        empty: 'Native Angabe ist leer', invalid: 'Native Angabe ist nicht eindeutig prüfbar',
    } as const)[field.state as Exclude<ClientCareLevelChangeFieldWeb['state'], 'value'>];
    const prescriptionFieldText = (field: ClientTherapyPrescriptionFieldWeb) => field.state === 'value' ? field.text! : ({
        missing: 'Nicht geliefert', undefined: 'Ungeklärter eigener Feldwert', null: 'Keine Originalangabe hinterlegt',
        empty: 'Originalangabe ist leer', unresolved: 'Originalformat ungeklärt',
    } as const)[field.state as Exclude<ClientTherapyPrescriptionFieldWeb['state'], 'value'>];
    const prescriptionLabels: Record<string, string> = {
        prescription_type: 'Gespeicherte Verordnungsart', title: 'Gespeicherter Titel', issued_at: 'Ausstellungsdatum',
        valid_until: 'Hinterlegt gültig bis', doctor: 'Gespeicherte verordnende Angabe',
        document_id: 'Gespeicherte Dokumentreferenz', status: 'Gespeicherter Status', note: 'Gespeicherter Hinweis',
        created_at: 'Allgemeine Zeilenerstellung', updated_at: 'Allgemeine Zeilenänderung',
    };
    const overview = useMemo(() => (detail ? buildClientRecordOverview(detail, careContexts, tabs) : null), [detail, careContexts, tabs]);
    const kpis = useMemo(() => (detail ? buildClientDetailKpis(detail, 'light') : []), [detail]);
    useAiPageContext({
        pageTitle: 'Klient:innenakte',
        entityType: 'client',
        entityId: detail?.id,
        entityLabel: detail ? `${detail.firstName} ${detail.lastName}`.trim() : undefined,
        activeTab,
        summary: overview?.fullName,
        metadata: {
            careContexts,
            status: detail?.status,
            careLevel: detail?.careLevel,
        },
    });
    if (loading) {
        return embedded ? (<LoadingState message="Akte wird geladen…"/>) : (<ScreenShell title="Klient:innenakte" subtitle="Wird geladen…">
        <LoadingState message="Akte wird geladen…"/>
      </ScreenShell>);
    }
    if (error) {
        return embedded ? (<ErrorState message={error} onRetry={refresh}/>) : (<ScreenShell title="Klient:innenakte" subtitle="Fehler">
        <ErrorState message={error} onRetry={refresh}/>
      </ScreenShell>);
    }
    if (!detail || !overview) {
        return embedded ? (<EmptyState title="Nicht gefunden" message="Klient:in nicht gefunden."/>) : (<ScreenShell title="Klient:innenakte" subtitle="Nicht gefunden">
        <EmptyState title="Nicht gefunden" message="Klient:in nicht gefunden."/>
      </ScreenShell>);
    }
    const canEdit = !!editTicket;
    const archiveTicket = actions.capture('archive'), deleteTicket = actions.capture('delete');
    const canArchive = !!archiveTicket && detail.status !== 'archiviert';
    const canDelete = !!deleteTicket;
    async function handleRecordRefresh() {
        if (!sameClientRecordActionOriginal(originalAtRender, parentRead.liveOriginalReceipt()))
            return;
        await currentParent.current.refresh();
    }
    async function handleArchive() {
        if (!archiveTicket || !canArchive || currentEditor.current || identityWorkBlocked())
            return;
        const attempt = actions.begin(archiveTicket);
        if (!attempt)
            return;
        const liveArchive = getServiceMode() === 'supabase' && archiveTicket.original.scope.tenantId !== DEMO_TENANT_ID;
        setActionError(null);
        renderActions(value => value + 1);
        try {
            const result = await archiveClient(archiveTicket.original.scope.clientId, archiveTicket.original.scope.tenantId, archiveTicket.original.scope.role as RoleKey, archiveTicket.original.scope.actorId, profile?.displayName);
            const outcome = actions.finish(attempt, result, liveArchive);
            if (outcome === 'blocked' && actions.current(archiveTicket))
                setActionError({ original: archiveTicket.original, error: actions.error(attempt)! });
            if (!identityWorkBlocked() && actions.mayFollowup(attempt))
                await currentParent.current.refresh();
        }
        catch (cause) {
            actions.finish(attempt, { ok: false, error: cause instanceof Error ? cause.message : 'Archivierung nicht bestätigt.' });
        }
        finally {
            if (actions.mayNotify(attempt))
                renderActions(value => value + 1);
        }
    }
    async function handleDelete(): Promise<ServiceResult<void>> {
        if (!deleteTicket || currentEditor.current || identityWorkBlocked())
            return { ok: false, error: CLIENT_RECORD_ACTION_DENIED };
        const lease = captureNativeAction(deleteTicket);
        if (!lease)
            return { ok: false, error: CLIENT_RECORD_ACTION_DENIED };
        const attempt = actions.begin(deleteTicket);
        if (!attempt)
            return { ok: false, error: actions.status().warning ?? CLIENT_RECORD_ACTION_DENIED };
        const followup = { attempt, used: false, lease: null as ClientNativeWriteLease | null, outcome: null as ClientNativeWriteOutcome | null };
        deleteFollowup.current = followup;
        renderActions(value => value + 1);
        try {
            followup.lease = lease;
            const outcome = await nativeWrites.delete(lease, profile?.displayName);
            followup.outcome = outcome;
            const unstarted = finishNativeAction(attempt, lease, outcome);
            if (nativeWrites.mayFollowup(lease, outcome) && actions.mayFollowup(attempt))
                return { ok: true, data: undefined };
            if (unstarted)
                return { ok: false, error: outcome.error ?? CLIENT_RECORD_ACTION_DENIED };
            return { ok: false, error: actions.acknowledged(attempt)
                    ? 'Die Löschung wurde bestätigt. Der aktuelle Aktenbezug hat sich geändert; es erfolgt kein Seitenwechsel.'
                    : actions.error(attempt) ?? CLIENT_RECORD_WRITE_UNCERTAIN };
        }
        catch (cause) {
            actions.finish(attempt, { ok: false, error: cause instanceof Error ? cause.message : 'Löschung nicht bestätigt.' });
            return { ok: false, error: actions.error(attempt) ?? CLIENT_RECORD_WRITE_UNCERTAIN };
        }
        finally {
            if (actions.mayNotify(attempt))
                renderActions(value => value + 1);
        }
    }
    function handleDeleted(): void {
        const followup = deleteFollowup.current;
        if (!followup || followup.used || followup.attempt.ticket !== deleteTicket || !followup.lease || !followup.outcome
            || !nativeWrites.mayFollowup(followup.lease, followup.outcome) || !actions.mayFollowup(followup.attempt))
            return;
        followup.used = true;
        if (callbacks.current.onDeleted)
            callbacks.current.onDeleted();
        else
            callbacks.current.router.replace('/office/clients' as never);
    }
    const headerActions = canArchive || canEdit ? (<View style={styles.headerActions}>
        {canArchive ? (<PremiumButton title="Archivieren" size="sm" variant="ghost" loading={archiving} disabled={actionStatus.blocked} onPress={handleArchive}/>) : null}
        {canEdit ? (<PremiumButton title="Klientenakte bearbeiten" size="sm" variant="secondary" onPress={handleEditMasterData} disabled={actionStatus.blocked}/>) : null}
      </View>) : null;
    const recordBody = (<>
      <ClientRecordHero clientId={detail.id} firstName={detail.firstName} lastName={detail.lastName} careLevel={detail.careLevel} city={detail.city ?? null} status={detail.status} careContexts={careContexts} archiveError={archiveError} showEdit={canEdit && !actionStatus.blocked} onEdit={handleEditMasterData}/>

      <View style={styles.kpiGrid}>
        {kpis.map((kpi) => (<ClientWorkspaceKpiCard key={kpi.id} icon={kpi.icon ?? '📊'} label={kpi.label} value={kpi.value} hint={kpi.subValue} accentColor={kpi.accentColor ?? careSuiteAuroraTheme.accent.cyan} compact style={styles.kpiCard}/>))}
      </View>

      <AuroraSegmentedControl options={tabOptions} value={activeTab} onChange={(key) => setActiveTab(key as ClientRecordTabKey)}/>

      <View style={styles.tabPanel}>
        {activeTab === 'uebersicht' && overview ? (<View style={styles.tabStack}>
            <ClientRecordOverviewPanel overview={overview} onNavigateTab={setActiveTab}/>
            <ClientRecordDiagnosisNotesPanel diagnoses={fullQuery.data && fullQuery.canViewSensitive ? fullQuery.data.core.diagnoses : null} clientId={detail.id} canViewStructured={fullQuery.canViewSensitive && can('pflege.diagnoses.view')}/>
            <SectionPanel title="Gespeicherter Allergie-/Unverträglichkeitshinweis">
              {allergyEvidence && consumeAllergyAtRender(allergyCapture) === allergyEvidence ? <>
                <Text selectable style={styles.allergyText}>{allergyFieldText(allergyEvidence.note)}</Text>
                <Text style={styles.allergyNote}>Originaltext aus der eigenen Akte. Fehlende, ungeklärte oder leere Angaben bestätigen keine Allergiefreiheit; der Hinweis bestätigt keine Diagnose oder medizinische Freigabe.</Text>
                {allergyEvidence.rowMetadata.map(field => <View key={field.key} style={styles.allergyMetadata}><Text style={styles.allergyNote}>{allergyRowLabels[field.key]}</Text><Text selectable style={styles.allergyText}>{allergyFieldText(field)}</Text></View>)}
                <Text style={styles.allergyNote}>Diese allgemeinen Aktenangaben sind keine Erhebungszeit, Feldautorschaft oder vollständige Allergiehistorie. Originale und andere Belege bleiben getrennt.</Text>
              </> : <InfoBanner variant="info" message="Der aktuelle eigene Originalhinweis und die erforderlichen Zugriffsrechte sind nicht bestätigt."/>}
            </SectionPanel>
            <ClientRecordInfectionProtectionPanel captureRead={capturePanelTimelineRead}/>
          </View>) : null}
        {activeTab === 'stammdaten' && (<View style={styles.tabStack}>
            <StammdatenTab detail={detail} fullClient={fullQuery.data} canViewSensitive={fullQuery.canViewSensitive} careContexts={careContexts} onEditMasterData={canEdit && !actionStatus.blocked ? handleEditMasterData : undefined}/>
            <ClientLifecycleWorkspace clientId={detail.id}/>
          </View>)}
        {activeTab === 'kontakt' && fullQuery.data ? (<View style={styles.tabStack}>
            <KontaktAdresseTab client={fullQuery.data}/>
            <ClientRecordContactEvidencePanel captureRead={capturePanelContactRead}/>
          </View>) : activeTab === 'kontakt' ? (<SectionPanel title="Kontakt & Adresse">
            <DetailInfoRow label="Adresse" value={formatClientAddressLine(detail.street, detail.zip, detail.city) || '—'}/>
            <DetailInfoRow label="Telefon" value={detail.phone ?? '—'}/>
            <DetailInfoRow label="E-Mail" value={detail.email ?? '—'}/>
          </SectionPanel>) : null}
        {activeTab === 'leistungsbereiche' ? (<ClientRecordTabContent tab="leistungsbereiche" clientId={detail.id} fullClient={fullQuery.data} canViewSensitive={fullQuery.canViewSensitive} onRecordRefresh={handleRecordRefresh}/>) : null}
        {activeTab === 'verlauf' ? (<ClientRecordTimelinePanel access={timelineAccess} controllers={timelineControllersRef.current} onRecordRefresh={handleRecordRefresh}/>) : null}
        {activeTab === 'angehoerige' ? <View style={styles.tabStack}>
          {fullQuery.data ? <ClientRecordMedicalContactsPanel client={fullQuery.data} onRefresh={handleRecordRefresh}/> : null}
          <ClientRecordContactEvidencePanel captureRead={capturePanelContactRead}/>
        </View> : null}
        {activeTab === 'pflegegrad' ? (<View style={styles.tabStack}>
            <ClientRecordTabContent tab="pflegegrad" clientId={detail.id} fullClient={fullQuery.data} canViewSensitive={fullQuery.canViewSensitive} onRecordRefresh={handleRecordRefresh}/>
            <SectionPanel title="Hinterlegte Pflegegradangaben">
              {careLevelEvidence && consumeCareLevelEvidenceAtRender(careLevelCapture) === careLevelEvidence ? (careLevelEvidence.entries.length ? careLevelEvidence.entries.map(entry => (<View key={entry.nativeId} style={styles.careLevelEvidenceEntry}>
                    {entry.fields.map(field => (<View key={field.key} style={styles.allergyMetadata}>
                        <Text style={styles.allergyNote}>{careLevelLabels[field.key]}</Text>
                        <Text selectable style={styles.allergyText}>{careLevelFieldText(field)}</Text>
                      </View>))}
                    <Text style={styles.allergyNote}>Die Datumsspanne ist eine hinterlegte Originalangabe. Sie bestätigt weder heutigen Anspruch noch Bewilligung, Durchführung, Abrechnung oder rückwirkende Wirkung.</Text>
                  </View>)) : <Text style={styles.allergyNote}>Der gelieferte Auszug enthält keine Pflegegradzeile. Dies bestätigt keinen fehlenden Anspruch.</Text>) : <InfoBanner variant="info" message="Der aktuelle eigene Pflegegrad-Originalauszug und die erforderlichen Zugriffsrechte sind nicht bestätigt."/>}
              <Text style={styles.allergyNote}>UUID-Reihenfolge ist nur technische Lesereihenfolge. Originale, Bescheide, Beratung, Folgeaufträge und tatsächliche Ereignisse bleiben getrennt.</Text>
            </SectionPanel>
            <SectionPanel title="Pflegegradbezogene Dokumentereignisse">
              {careLevelChangeEvidence && consumeCareLevelChangeEvidenceAtRender(careLevelChangeCapture) === careLevelChangeEvidence ? (careLevelChangeEvidence.entries.length ? careLevelChangeEvidence.entries.map(entry => (<View key={entry.nativeEventId} style={styles.careLevelEvidenceEntry}>
                    <View style={styles.allergyMetadata}><Text style={styles.allergyNote}>Native Ereigniskennung</Text><Text selectable style={styles.allergyText}>{entry.nativeEventId}</Text></View>
                    <View style={styles.allergyMetadata}><Text style={styles.allergyNote}>Vorherige hinterlegte Pflegegradangabe</Text><Text selectable style={styles.allergyText}>{careLevelChangeFieldText(entry.previousCareLevel)}</Text></View>
                    <View style={styles.allergyMetadata}><Text style={styles.allergyNote}>Neue hinterlegte Pflegegradangabe</Text><Text selectable style={styles.allergyText}>{careLevelChangeFieldText(entry.nextCareLevel)}</Text></View>
                    <View style={styles.allergyMetadata}><Text style={styles.allergyNote}>Native Nachfolger-Dokumentkennung</Text><Text selectable style={styles.allergyText}>{careLevelChangeFieldText(entry.successorDocumentId)}</Text></View>
                    <View style={styles.allergyMetadata}><Text style={styles.allergyNote}>Native ersetzte Dokumentkennung</Text><Text selectable style={styles.allergyText}>{careLevelChangeFieldText(entry.replacedDocumentId)}</Text></View>
                    <View style={styles.allergyMetadata}><Text style={styles.allergyNote}>Kanonische Akten-Dokumentkennung</Text><Text selectable style={styles.allergyText}>{careLevelChangeFieldText(entry.canonicalDocumentId)}</Text></View>
                    <View style={styles.allergyMetadata}><Text style={styles.allergyNote}>Gespeicherte Akteurkennung</Text><Text selectable style={styles.allergyText}>{careLevelChangeFieldText(entry.actorProfileId)}</Text></View>
                    <View style={styles.allergyMetadata}><Text style={styles.allergyNote}>Gespeicherte Ereigniszeit</Text><Text selectable style={styles.allergyText}>{careLevelChangeFieldText(entry.createdAt)}</Text></View>
                    <View style={styles.allergyMetadata}><Text style={styles.allergyNote}>Nachfolger-Version</Text><Text selectable style={styles.allergyText}>{careLevelChangeFieldText(entry.successorVersion)}</Text></View>
                    <View style={styles.allergyMetadata}><Text style={styles.allergyNote}>Nachfolger-Status</Text><Text selectable style={styles.allergyText}>{careLevelChangeFieldText(entry.successorStatus)}</Text></View>
                    <View style={styles.allergyMetadata}><Text style={styles.allergyNote}>Native Dokumentkette</Text><Text selectable style={styles.allergyText}>{({ complete_native_chain: 'Vollständig über native Kennungen verbunden', partial_native_chain: 'Teilweise über native Kennungen verbunden', unresolved_native_chain: 'Native Kennungskette nicht auflösbar' } as const)[entry.relationState]}</Text></View>
                    <Text style={styles.allergyNote}>Diese Kette beruht nur auf nativen Dokumentkennungen. Sie ist keiner Pflegegradzeile zugeordnet und bestätigt weder Bescheidwirkung noch Beratung, Folgeauftrag, Durchführung oder Abrechnung.</Text>
                  </View>)) : <Text style={styles.allergyNote}>Der gelieferte Dokumentverlauf enthält kein Pflegegrad-Nachfolgerereignis. Dies bestätigt weder das Fehlen eines Bescheids noch das Fehlen einer Änderung.</Text>) : <InfoBanner variant="info" message="Der aktuelle eigene Pflegegrad-Dokumentverlauf und die erforderlichen Zugriffsrechte sind nicht bestätigt."/>}
              <Text style={styles.allergyNote}>Gleichlautende Grade, Titel, Texte, Zeitpunkte oder Reihenfolgen werden nicht verknüpft. Beratung und vorhandene Aufgaben bleiben ohne ausdrückliche native Kennung getrennt.</Text>
            </SectionPanel>
          </View>) : null}
        {activeTab === 'rezepte' ? (<View style={styles.tabPanel}>
            <SectionPanel title="Rezepte und Verordnungsoriginale">
              {therapyPrescriptionEvidence && consumeTherapyPrescriptionEvidenceAtRender(therapyPrescriptionCapture) === therapyPrescriptionEvidence ? (therapyPrescriptionEvidence.entries.length ? therapyPrescriptionEvidence.entries.map(entry => (<View key={entry.nativeId} style={styles.careLevelEvidenceEntry}>
                    <View style={styles.allergyMetadata}><Text style={styles.allergyNote}>Native Verordnungskennung</Text><Text selectable style={styles.allergyText}>{entry.nativeId}</Text></View>
                    {entry.fields.map(item => <View key={item.key} style={styles.allergyMetadata}><Text style={styles.allergyNote}>{prescriptionLabels[item.key] ?? item.key}</Text><Text selectable style={styles.allergyText}>{prescriptionFieldText(item)}</Text></View>)}
                    <Text style={styles.allergyNote}>Termin, Therapeut:in und Folgeaufgabe sind im gelieferten Schema nicht über native Kennungen verbunden. Diese Anzeige bestätigt weder Gültigkeit noch Durchführung, Therapieentscheidung, Kontaktaufnahme oder Abschluss.</Text>
                  </View>)) : <Text style={styles.allergyNote}>Der gelieferte Verordnungsauszug ist leer. Dies bestätigt nicht, dass keine Verordnung oder Therapie besteht.</Text>) : <InfoBanner variant="info" message="Der aktuelle eigene Verordnungs-Originalauszug und die erforderlichen Zugriffsrechte sind nicht bestätigt."/>}
              <Text style={styles.allergyNote}>Namen, Titel, Freitexte, Daten und Reihenfolgen werden nicht mit Terminen, Leistungserbringern oder Aufgaben verknüpft.</Text>
            </SectionPanel>
            <ClientRecordPhysicianCommunicationPanel captureRead={capturePanelPhysicianCommunicationRead}/>
          </View>) : null}
        {!['uebersicht', 'stammdaten', 'kontakt', 'angehoerige', 'leistungsbereiche', 'verlauf', 'pflegegrad', 'rezepte'].includes(activeTab) ? (<ClientRecordTabContent tab={activeTab} clientId={detail.id} fullClient={fullQuery.data} canViewSensitive={fullQuery.canViewSensitive} onRecordRefresh={handleRecordRefresh}/>) : null}
        {activeTab === 'dokumente' ? (<ClientRecordSignaturePanel captureRead={capturePanelTimelineRead}/>) : null}
      </View>

      {canDelete ? (<SectionPanel title="Gefahrenzone" subtitle="Irreversible Aktionen">
          <OfficeRecordDeleteButton key={`${deleteTicket!.original.scopeKey}:${deleteTicket!.original.recordTicket}:${deleteTicket!.original.fullTicket}`} recordLabel="Klient:in" displayName={`${detail.firstName} ${detail.lastName}`} confirmTitle="Klient:in wirklich löschen?" buttonTitle="Klient:in löschen" disabled={actionStatus.blocked} onDelete={handleDelete} onDeleted={handleDeleted}/>
        </SectionPanel>) : null}
    </>);
    if (embedded) {
        return (<>
        <View style={styles.embeddedRoot}>{recordBody}</View>
        {hostsLocalEditModal && masterDataEditOpen && editor?.identityToken ? (<ClientMasterDataNativeEditModal key={`identity-${editor.serial}`} token={editor.identityToken}/>) : null}
      </>);
    }
    return (<>
      <ScreenShell title="Klient:innenakte" subtitle={`${detail.firstName} ${detail.lastName}`} rightSlot={headerActions}>
        {recordBody}
      </ScreenShell>
      {hostsLocalEditModal && masterDataEditOpen && editor?.identityToken ? (<ClientMasterDataNativeEditModal key={`identity-${editor.serial}`} token={editor.identityToken}/>) : null}
    </>);
}
const styles = StyleSheet.create({
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: careSpacing.sm,
    },
    allergyText: { color: careSuiteAuroraTheme.text.primary, fontSize: 14, lineHeight: 21, flexShrink: 1, maxWidth: '100%' },
    allergyNote: { color: careSuiteAuroraTheme.text.muted, fontSize: 12, lineHeight: 18, flexShrink: 1, maxWidth: '100%' },
    allergyMetadata: { minWidth: 0, gap: careSpacing.xs, marginTop: careSpacing.sm },
    careLevelEvidenceEntry: { minWidth: 0, gap: careSpacing.xs, paddingBottom: careSpacing.md },
    tabStack: {
        gap: careSpacing.md,
    },
    tabPanel: {
        gap: careSpacing.md,
        paddingBottom: spacing.xxl,
    },
    embeddedRoot: {
        gap: careSpacing.md,
        padding: careSpacing.md,
        paddingBottom: spacing.xxl,
    },
    kpiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: careSpacing.sm,
    },
    kpiCard: {
        flex: 1,
        minWidth: 142,
    },
});
