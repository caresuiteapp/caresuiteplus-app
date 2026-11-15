import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { ErrorState, InfoBanner, LoadingState, PremiumInput } from '@/components/ui';
import {
  currentMedicationEventTime, medicationEventInstant, type MedicationEventTime,
} from '@/components/pflege/MedicationEventTimeInput.web';
import { VitalCaptureFields, VitalCaptureTime } from '@/components/pflege/VitalCaptureFields.web';
import { VitalMeasurementArtwork } from '@/components/pflege/VitalMeasurementArtwork';
import {
  VitalAction, VitalCasePicker, VitalPills, VitalWorkspaceHero, useVitalStyles,
} from '@/components/pflege/VitalWorkspaceUi';
import { useAuth } from '@/lib/auth/context';
import { useCareRuntimePermissions as usePermissions } from '@/hooks/pflege/useCareRuntimePermissions.web';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useMedicationSubmission } from '@/hooks/useMedicationSubmission.web';
import { formatVitalValues, getVitalDefinition, VITAL_SIGN_CATALOG } from '@/lib/pflege/vitalCatalog';
import { vitalCatalogFilters, vitalCatalogSelection, vitalCatalogUnit, type VitalCatalogFilter } from '@/lib/pflege/vitalCaptureOptions';
import { deriveVitalValues, parseVitalNumber, validateVitalMeasurement, type VitalMeasurementPayload } from '@/lib/pflege/vitalMeasurementDomain';
import { VitalCreateRuntimeWeb } from '@/lib/pflege/vitalCreateRuntime.web';
import { fetchVitalCreateClientsWeb, fetchVitalCreateChoicesWeb } from '@/lib/pflege/vitalCreateOriginalRead.web';
import { executeVitalCreateNativeWeb } from '@/lib/pflege/vitalCreateNativeWrite.web';
import { carePermissionOwner } from '@/lib/permissions/carePermissionOwner.web';
import { confirmAction } from '@/lib/platform/confirmAction';
import type { VitalClient } from '@/lib/pflege/vitalDocumentationService';
import { isDemoMode } from '@/lib/supabase/config';
import { CarePermissionStatus } from './CarePermissionStatus.web';

type Draft = { values: Record<string, string>; context: Record<string, string>; note: string };
type Continuation = { clientId: string; previousLabel: string };
const emptyDraft = (): Draft => ({ values: {}, context: {}, note: '' });

function queryFlags<T>(query: ReturnType<typeof useAsyncQuery<T>>) {
  return {
    loading: query.loading, refreshing: query.refreshing, error: !!query.error, refreshError: !!query.refreshError,
    previewData: query.previewData, tableMissing: query.tableMissing, fromCache: query.cacheMeta.fromCache,
    partialDetail: !!query.cacheMeta.partialDetail, usedDemoFallback: false,
  };
}

export function VitalReadingCreateScreen() {
  const auth = useAuth();
  const permissions = usePermissions();
  const tenantId = useServiceTenantId();
  const owner = carePermissionOwner(auth, tenantId, isDemoMode());
  const current = useRef({ auth, permissions, tenantId });
  current.current = { auth, permissions, tenantId };
  const live = useRef(() => {
    const { auth: latestAuth, permissions: latestPermissions, tenantId: latestTenant } = current.current;
    if (latestPermissions.tenantId !== latestTenant || latestPermissions.roleKey !== latestAuth.profile?.roleKey ||
      !Object.isFrozen(latestPermissions.permissions)) throw Error('Aktueller eigener nativer Rechteursprung fehlt.');
    const descriptor = Object.getOwnPropertyDescriptor(latestPermissions, 'can');
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || typeof descriptor.value !== 'function') {
      throw Error('Aktueller nativer Rechtebezug fehlt.');
    }
    return { owner: carePermissionOwner(latestAuth, latestTenant, isDemoMode()), can: descriptor.value };
  });

  const scope = owner ? JSON.stringify([owner.tenantId, owner.profileId, owner.roleKey]) : null;
  const held = useRef<{ scope: string; runtime: VitalCreateRuntimeWeb } | null>(null);
  if (held.current?.scope !== scope) {
    held.current?.runtime.dispose();
    held.current = null;
    if (scope && owner) {
      try { held.current = { scope, runtime: new VitalCreateRuntimeWeb(owner, live.current) }; }
      catch { held.current = null; }
    }
  }

  const runtime = held.current?.runtime ?? null;
  const continuation = useRef<{ runtime: VitalCreateRuntimeWeb; epoch: number; next: Continuation } | null>(null);
  const [, revise] = useState(0);
  useEffect(() => {
    if (!runtime) return;
    runtime.mount();
    const unsubscribe = runtime.subscribeOriginal(() => revise(value => value + 1));
    return () => { unsubscribe(); runtime.dispose(); };
  }, [runtime]);

  const canView = runtime?.canRead() ?? false;
  const canManage = runtime?.canManage() ?? false;
  if (!runtime || !canView || !canManage) return <ScreenShell title="Vitalwerte erfassen" compactHeader>
    <CarePermissionStatus state={permissions} deniedMessage={canView
      ? 'Für das Erfassen von Vitalwerten fehlt die Schreibberechtigung.'
      : 'Der eigene Lesezugriff für Vitalwerte konnte nicht bestätigt werden.'} />
  </ScreenShell>;

  const epoch = runtime.originalDraftVersion;
  const next = continuation.current?.runtime === runtime && continuation.current.epoch === epoch ? continuation.current.next : undefined;
  function newDraft(token: unknown, carry?: Continuation) {
    if (!runtime) return;
    continuation.current = carry ? { runtime, epoch: runtime.originalDraftVersion + 1, next: carry } : null;
    if (!runtime.startNewDraft(token)) continuation.current = null;
  }
  return <VitalCreateWorkspace key={`${scope}:${epoch}`} runtime={runtime} continuation={next} onNew={newDraft} />;
}

function VitalCreateWorkspace({ runtime, continuation, onNew }: {
  runtime: VitalCreateRuntimeWeb;
  continuation?: Continuation;
  onNew(token: unknown, carry?: Continuation): void;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(continuation?.clientId ?? '');
  const [type, setType] = useState('');
  const [draft, setDraft] = useState(emptyDraft);
  const [time, setTime] = useState(currentMedicationEventTime);
  const [timeEdited, setTimeEdited] = useState(false);
  const readScope = runtime.captureReadScope();
  const scopeVersion = runtime.readScopeVersion;
  const clientsQuery = useAsyncQuery(() => fetchVitalCreateClientsWeb(runtime, readScope), [runtime, readScope], {
    enabled: !!readScope, queryKey: `${runtime.tenantId}:${scopeVersion}:vital-clients`,
  });
  runtime.setView('clients', clientsQuery.data, queryFlags(clientsQuery));
  const clients = runtime.visible('clients', clientsQuery.data);
  const client = clients?.find(person => person.id === clientId);
  const choiceSubject = client?.id ?? '';
  const choicesQuery = useAsyncQuery(() => fetchVitalCreateChoicesWeb(runtime, choiceSubject, readScope), [runtime, readScope, choiceSubject], {
    enabled: !!choiceSubject && !!readScope, queryKey: `${runtime.tenantId}:${scopeVersion}:${choiceSubject}:vital-choices`,
  });
  runtime.setView('choices', choicesQuery.data, queryFlags(choicesQuery));
  const choices = runtime.visible('choices', choicesQuery.data);
  const choice = choices?.find(item => item.key === type);
  const definition = getVitalDefinition(type);
  const revision = useRef(0);
  const renderRevision = revision.current;
  const dirty = Object.values(draft.values).some(value => value.trim()) ||
    Object.values(draft.context).some(value => value.trim()) || !!draft.note.trim() || timeEdited;
  const displayedReceipt = runtime.confirmedReceipt();
  const [submitted, setSubmitted] = useState<{ id: string; payload: VitalMeasurementPayload } | null>(null);
  const write = useMedicationSubmission<VitalMeasurementPayload>(
    (!displayedReceipt && dirty) || runtime.originalRequestState().pending,
    async (id, payload, replay) => {
      const result = await executeVitalCreateNativeWeb(runtime, id, payload, replay);
      if (result.ok) setSubmitted({ id: result.data.id, payload });
      return result;
    },
    () => {},
    () => {
      const token = runtime.captureClose();
      return token ? () => renderRevision === revision.current && runtime.mayCloseCaptured(token) : null;
    },
  );
  const originalRequest = runtime.originalRequestState();
  const originalRetry = runtime.captureOriginalRetry();
  const busy = write.busy || originalRequest.busy;
  const locked = write.locked || originalRequest.pending;
  const uncertain = write.uncertain || originalRequest.uncertain;
  const canChange = () => renderRevision === revision.current && !runtime.originalRequestState().pending &&
    !write.locked && !runtime.confirmedReceipt() && runtime.canManage();
  const canEditTime = () => canChange() && !!client && runtime.maySelect('clients', clientsQuery.data);
  const canEditValue = () => canEditTime() && !!choice?.enabled && runtime.maySelect('choices', choicesQuery.data);
  const mutate = () => { revision.current++; write.setError(null); };

  async function changeClient(nextId: string) {
    if (nextId === clientId || !canChange() || !runtime.maySelect('clients', clientsQuery.data)) return;
    if (dirty && !await confirmAction({
      title: 'Pflegefall wechseln', message: 'Die Eingaben für die aktuelle Person werden verworfen.',
      confirmLabel: 'Pflegefall wechseln', cancelLabel: 'Weiter bearbeiten',
    })) return;
    if (!canChange() || !runtime.maySelect('clients', clientsQuery.data) || clients?.filter(person => person.id === nextId).length !== 1) return;
    mutate();
    runtime.clearChoices();
    setClientId(nextId);
    setDraft(emptyDraft());
    setTime(currentMedicationEventTime());
    setTimeEdited(false);
  }

  async function changeType(nextType: string) {
    if (!canChange() || !getVitalDefinition(nextType)) return false;
    if (nextType === type) return true;
    if ((Object.values(draft.values).some(Boolean) || Object.values(draft.context).some(Boolean) || draft.note) && !await confirmAction({
      title: 'Messart wechseln', message: 'Die Eingaben für die aktuelle Messart werden verworfen.',
      confirmLabel: 'Messart wechseln', cancelLabel: 'Weiter bearbeiten',
    })) return false;
    if (!canChange()) return false;
    mutate();
    setType(nextType);
    setDraft(emptyDraft());
    return true;
  }

  function editFields(fields: Draft) {
    if (!canEditValue()) return;
    mutate();
    setDraft(fields);
  }

  function editTime(next: MedicationEventTime) {
    if (!canEditTime()) return;
    mutate();
    setTime(next);
    setTimeEdited(true);
  }

  async function close() {
    if (!canChange()) return;
    const originalClose = runtime.captureClose();
    if (!originalClose) return;
    if (await write.confirmLeave() && renderRevision === revision.current && runtime.mayCloseCaptured(originalClose)) router.back();
  }

  async function save() {
    if (!runtime.canManage() || runtime.confirmedReceipt() || runtime.originalRequestState().busy) return;
    if (originalRequest.pending) {
      if (write.uncertain) { await write.retry(); return; }
      const result = await runtime.retryOriginal(originalRetry);
      if (!result.ok) write.setError(result.error);
      return;
    }
    if (write.uncertain) { await write.retry(); return; }
    if (!definition || !choice?.enabled || !client || !canEditValue()) {
      write.setError('Bitte Pflegefall und freigegebene Messart prüfen.');
      return;
    }
    const numbers: Record<string, number> = {};
    for (const component of definition.components) {
      const raw = draft.values[component.key]?.trim();
      if (!raw) continue;
      const value = parseVitalNumber(raw);
      if (value === null) {
        write.setError(`${component.label}: Bitte eine gültige Zahl ohne Tausendertrennzeichen eingeben.`);
        return;
      }
      numbers[component.key] = value;
    }
    const context = Object.fromEntries(Object.entries(draft.context)
      .map(([key, value]) => [key, value.trim()]).filter(([, value]) => value));
    if (context.completeness === 'complete') delete context.incompleteReason;
    const payload = {
      clientId, type, occurredAt: medicationEventInstant(time),
      valuesJson: JSON.stringify(deriveVitalValues(type, numbers)), contextJson: JSON.stringify(context),
      note: draft.note, catalogVersion: choice.catalogVersion, configurationVersion: choice.configurationVersion,
    };
    const error = validateVitalMeasurement(payload, definition);
    if (error) { write.setError(error); return; }
    if (!runtime.prepare(payload, clientsQuery.data, choicesQuery.data)) {
      write.setError('Die aktuelle Messdefinition oder Pflegefallzuordnung konnte nicht bestätigt werden.');
      return;
    }
    await write.submit(payload);
  }

  const newDraftToken = runtime.captureNewDraft();
  const openConfirmed = (toDetail: boolean) => {
    if (!displayedReceipt || !runtime.mayConfirm(displayedReceipt)) return;
    router.replace((toDetail ? `/pflege/vitalwerte/${displayedReceipt}` : '/pflege/vitalwerte') as never);
  };
  if (displayedReceipt) {
    const payload = submitted?.id === displayedReceipt ? submitted.payload : null;
    const savedType = payload ? getVitalDefinition(payload.type) : undefined;
    const savedClient = client?.id === payload?.clientId ? client : undefined;
    const numbers = payload ? JSON.parse(payload.valuesJson) as Record<string, number> : {};
    const previousLabel = savedType
      ? `${savedType.shortLabel} · ${formatVitalValues(savedType.key, numbers)} ${savedType.components[0].unit || ''}`.trim()
      : 'Letzte Messung';
    return <ScreenShell title="Vitalwerte" compactHeader>
      <VitalCaptureSuccess clientName={savedClient?.name} previousLabel={previousLabel} busy={busy}
        onSameCase={savedClient ? () => onNew(newDraftToken, { clientId: savedClient.id, previousLabel }) : undefined}
        onNew={() => onNew(newDraftToken)} onDetail={() => openConfirmed(true)} onOverview={() => openConfirmed(false)} />
    </ScreenShell>;
  }

  const clientError = clientsQuery.error ?? clientsQuery.refreshError;
  const choicesError = choicesQuery.error ?? choicesQuery.refreshError;
  return <ScreenShell title="Vitalwerte" scroll={false} compactHeader showBack={false}>
    <VitalCapturePage
      client={client} people={clients} clientLoading={!clients && !clientError} clientError={clientError}
      choices={choices} choicesError={choicesError} refreshingChoices={!!client && !choices && !choicesError}
      contextEditable={canEditTime()} valueEditable={canEditValue()} locked={locked} busy={busy}
      saveable={canEditValue() || uncertain} uncertain={uncertain} error={write.error}
      draft={draft} type={type} time={time} previousLabel={client && clientId === continuation?.clientId ? continuation.previousLabel : ''}
      onClient={changeClient} onType={changeType} onFields={editFields} onTime={editTime} onClose={close} onSave={save}
      reloadPeople={clientsQuery.refresh} reloadChoices={choicesQuery.refresh} />
  </ScreenShell>;
}

type CapturePageProps = {
  client: VitalClient | undefined;
  people: readonly VitalClient[] | null;
  clientLoading: boolean;
  clientError: string | null;
  choices: readonly { key: string; enabled: boolean }[] | null;
  choicesError: string | null;
  refreshingChoices: boolean;
  contextEditable: boolean;
  valueEditable: boolean;
  locked: boolean;
  busy: boolean;
  saveable: boolean;
  uncertain: boolean;
  error: string | null;
  draft: Draft;
  type: string;
  time: MedicationEventTime;
  previousLabel: string;
  onClient(id: string): Promise<void>;
  onType(key: string): Promise<boolean>;
  onFields(draft: Draft): void;
  onTime(time: MedicationEventTime): void;
  onClose(): Promise<void>;
  onSave(): Promise<void>;
  reloadPeople(): unknown;
  reloadChoices(): unknown;
};

function VitalCapturePage(props: CapturePageProps) {
  const styles = useVitalStyles();
  const dimensions = useWindowDimensions();
  const [width, setWidth] = useState(Math.min(1560, dimensions.width - 24));
  const wide = width >= 980 * Math.max(1, Math.min(1.35, dimensions.fontScale));
  const [filter, setFilter] = useState<VitalCatalogFilter>('quick');
  const [search, setSearch] = useState('');
  const [gridWidth, setGridWidth] = useState(0);
  const scrollView = useRef<ScrollView>(null);
  const editorTop = useRef(0);
  const catalogTop = useRef(0);
  const definition = getVitalDefinition(props.type);
  const enabled = useMemo(() => new Set(props.choices?.filter(choice => choice.enabled).map(choice => choice.key)), [props.choices]);
  const activeFilter = filter === 'enabled' && !props.client ? 'quick' : filter;
  const items = vitalCatalogSelection(activeFilter, search, enabled);
  const availableWidth = gridWidth || Math.max(130, width * (wide ? 0.6 : 1) - 36);
  const cellMin = 133 * Math.max(1, Math.min(1.4, dimensions.fontScale));
  const columnCount = Math.max(1, Math.min(wide ? 5 : 4, Math.floor((availableWidth + 10) / (cellMin + 10))));
  const cellWidth = Math.floor((availableWidth - (columnCount - 1) * 10) / columnCount);
  const jumpTo = (top: number) => scrollView.current?.scrollTo({ y: Math.max(0, top - 8), animated: true });

  const editor = <VitalCaptureFields key={props.type} definition={definition} draft={props.draft}
    caseState={!props.client ? 'no-case' : props.choicesError ? 'unavailable' : !props.choices ? 'checking'
      : enabled.has(props.type) ? 'enabled' : 'disabled'}
    locked={!props.valueEditable} onChange={props.onFields} autoFocus={wide}
    onChoose={!wide && !props.locked ? () => jumpTo(catalogTop.current) : undefined} />;
  const catalog = <View style={styles.panel}>
    <View style={styles.titleRow}>
      <Text accessibilityRole="header" style={styles.heading}>Messart auswählen</Text>
      <Text style={styles.muted}>{search.trim() ? `${items.length} Treffer` : `${VITAL_SIGN_CATALOG.length} Messarten`}</Text>
    </View>
    <PremiumInput accessibilityLabel="Messart suchen" placeholder="Messart oder Abkürzung suchen"
      value={search} onChangeText={setSearch} autoCorrect={false} editable={!props.locked} />
    <VitalPills label="Messkatalog" compact value={activeFilter} disabled={props.locked} options={[
      { key: 'quick', label: 'Schnellwahl' }, { key: 'all', label: 'Alle' },
      ...(props.choices ? [{ key: 'enabled', label: `Freigegeben (${enabled.size})` }] : []), ...vitalCatalogFilters,
    ]} onChange={key => { setSearch(''); setFilter(key as VitalCatalogFilter); }} />
    {items.length ? <View style={styles.grid} onLayout={event => setGridWidth(event.nativeEvent.layout.width)}>
      {items.map(item => {
        const selected = props.type === item.key;
        const unavailable = !!props.choices && !enabled.has(item.key);
        return <Pressable key={item.key} accessibilityRole="button" disabled={props.locked}
          accessibilityState={{ selected, disabled: props.locked }}
          accessibilityLabel={unavailable ? `${item.label}. Für diesen Pflegefall nicht freigegeben.` : item.label}
          onPress={async () => {
            const changed = await props.onType(item.key);
            if (changed && !wide) jumpTo(editorTop.current);
          }}
          style={({ pressed }) => [
            styles.tile, { width: cellWidth }, selected && styles.tileSelected,
            pressed && styles.pressed,
          ]}>
          <View style={styles.tileArt}><VitalMeasurementArtwork kind={item.key} size={72} /></View>
          <Text style={styles.tileLabel}>{item.label}</Text>
          <Text style={styles.tileUnit}>{vitalCatalogUnit(item)}</Text>
          {selected || unavailable ? <View style={styles.tileMarker}>
            <MaterialCommunityIcons name={selected ? 'check-circle' : 'lock-outline'} size={16} color="#166782" />
          </View> : null}
        </Pressable>;
      })}
    </View> : <Text accessibilityLiveRegion="polite" style={styles.muted}>{activeFilter === 'enabled' && !search.trim()
      ? 'Für diesen Pflegefall sind keine Messarten freigegeben.'
      : 'Keine Messart gefunden. Suchbegriff oder Filter ändern.'}</Text>}
  </View>;

  return <View style={styles.root} onLayout={event => setWidth(Math.min(1560, event.nativeEvent.layout.width))}>
    <ScrollView ref={scrollView} style={styles.scroll} contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <VitalWorkspaceHero title="Vitalwerte erfassen" description="Pflegefall wählen, Messart antippen, Messwert eintragen." />
      <View style={[styles.panel, styles.transaction, styles.transactionPanel]}>
        <View style={styles.sectionItem}>
          <Text style={styles.label}>Klient:in *</Text>
          {props.clientError ? <ErrorState presentation="inline" message={props.clientError} onRetry={props.reloadPeople} />
            : props.clientLoading ? <LoadingState presentation="inline" message="Aktive Pflegefälle werden geladen…" />
            : props.people?.length ? <VitalCasePicker people={props.people} selectedId={props.client?.id ?? ''}
              onSelect={props.onClient} disabled={props.locked} />
            : <View style={styles.stack}>
              <Text style={styles.body}>Keine aktiven Pflegefälle verfügbar.</Text>
              <VitalAction title="Pflegefälle neu laden" variant="secondary" icon="refresh" onPress={props.reloadPeople} disabled={props.locked} />
            </View>}
          {props.previousLabel ? <Text accessibilityLiveRegion="polite" style={styles.muted}>{props.previousLabel} gespeichert</Text> : null}
        </View>
        <View style={styles.sectionItem}><VitalCaptureTime value={props.time} onChange={props.onTime} disabled={!props.contextEditable} /></View>
      </View>
      {props.choicesError ? <ErrorState presentation="inline" message={props.choicesError} onRetry={props.reloadChoices} /> : null}
      {props.refreshingChoices ? <LoadingState presentation="inline" message="Messfreigaben für diesen Pflegefall werden geladen…" /> : null}
      {props.uncertain ? <InfoBanner variant="warning" title="Speicherbestätigung steht aus"
        message="Über „Speicherung prüfen“ wird dieselbe Messung erneut abgefragt. Bis zur Bestätigung bleiben die Eingaben gesperrt." /> : null}
      {wide ? <View style={styles.columns}>
        <View style={styles.catalogColumn}>{catalog}</View>
        <View style={styles.editorColumn}>{editor}</View>
      </View> : <>
        <View onLayout={event => { editorTop.current = event.nativeEvent.layout.y; }}>{definition ? editor : null}</View>
        <View onLayout={event => { catalogTop.current = event.nativeEvent.layout.y; }}>{catalog}</View>
      </>}
    </ScrollView>
    <View style={styles.footer}>
      {props.error ? <View style={{ width: '100%' }}><ErrorState presentation="inline" message={props.error} /></View> : null}
      {wide ? <View style={styles.flex}>
        <Text numberOfLines={2} style={styles.label}>{props.client ? props.client.name : 'Pflegefall auswählen'}</Text>
        <Text numberOfLines={2} style={styles.muted}>{definition?.label ?? 'Messart auswählen'}</Text>
      </View> : null}
      <View style={[styles.footerActions, !wide && styles.flex]}>
        <VitalAction variant="secondary" title="Schließen" disabled={props.locked} onPress={props.onClose} />
        <VitalAction icon={props.uncertain ? 'refresh' : 'check'} disabled={!props.saveable || props.busy}
          style={!wide ? { flexGrow: 1 } : undefined}
          title={props.busy ? 'Speichert…' : props.uncertain ? 'Speicherung prüfen' : 'Messung speichern'} onPress={props.onSave} />
      </View>
    </View>
  </View>;
}

function VitalCaptureSuccess({ clientName, previousLabel, busy, onSameCase, onNew, onDetail, onOverview }: {
  clientName?: string;
  previousLabel: string;
  busy: boolean;
  onSameCase?: () => void;
  onNew(): void;
  onDetail(): void;
  onOverview(): void;
}) {
  const styles = useVitalStyles();
  return <View style={styles.page}>
    <VitalWorkspaceHero title="Messung gespeichert" description={clientName ? `${clientName} · ${previousLabel}` : 'Speicherung durch die Datenbank bestätigt.'} />
    <View style={[styles.panel, styles.row]}>
      {onSameCase ? <VitalAction title="Weitere Messung für diese Person" icon="plus" disabled={busy} onPress={onSameCase} /> : null}
      <VitalAction title={onSameCase ? 'Andere Person wählen' : 'Neue Messung erfassen'} variant={onSameCase ? 'secondary' : 'primary'} disabled={busy} onPress={onNew} />
      <VitalAction title="Messung öffnen" icon="clipboard-pulse-outline" variant="secondary" disabled={busy} onPress={onDetail} />
      <VitalAction title="Zum Verlauf" variant="secondary" disabled={busy} onPress={onOverview} />
    </View>
  </View>;
}
