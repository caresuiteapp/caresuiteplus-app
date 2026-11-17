import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ErrorState, FilterChipGroup, LoadingState, PremiumButton, PremiumInput } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useCareRuntimePermissions as usePermissions } from '@/hooks/pflege/useCareRuntimePermissions.web';
import { CarePermissionStatus, type CarePermissionStatusState } from './CarePermissionStatus.web';
import { useWoundRead, type WoundReadProps } from '@/hooks/pflege/useWoundRead.web';
import { WoundStatisticsPanel } from '@/components/pflege/wounds/WoundStatisticsPanel';
import { WoundCatalogEditor } from '@/components/pflege/wounds/WoundCatalogPanel';
import { useWoundEntryStyles } from '@/components/pflege/wounds/woundEntryStyles';
import { WoundPage, WoundSection, WoundTabs } from '@/components/pflege/wounds/WoundWorkspaceLayout';
import { WoundBodyMapFrame } from '@/components/clinicalMedia/WoundBodyMapFrame';
import { CareWorkspaceHeader } from '@/components/pflege/CareWorkspaceLayout';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { fetchAmbulatoryWoundList } from '@/lib/pflege/ambulatoryWoundService';
import { captureWoundListOriginal, filterWoundList, woundListText, woundStatusLabels } from '@/lib/pflege/woundReadOriginal.web';
import { woundUuid } from '@/lib/pflege/woundCareDomain';
import { WOUND_RECORD_TABS, woundCaseRoute, type WoundRecordTab } from '@/components/pflege/wounds/woundAreas';

const VIEWS = [
  { key: 'cases', label: 'Übersicht', icon: 'grid' },
  { key: 'statistics', label: 'Wundstatistik', icon: 'bar-chart-2' },
  { key: 'catalog', label: 'Material und Textbausteine', icon: 'layers' },
] as const;

export function WoundDocumentationListScreen() {
  const { clientId } = useLocalSearchParams<{ clientId?: string }>();
  const caseId = woundUuid(clientId) ? clientId : undefined;
  const serviceTenant = useServiceTenantId(), { profile } = useAuth(), permissions = usePermissions();
  const owner = profile && woundUuid(profile.tenantId) && woundUuid(profile.id) && profile.roleKey
    ? { tenantId: profile.tenantId!, profileId: profile.id, role: profile.roleKey } : null;
  return <WoundListWorkspace key={JSON.stringify([owner, caseId])} owner={owner} serviceTenant={serviceTenant} caseId={caseId}
    runtimeTenant={permissions.tenantId} runtimeRole={permissions.roleKey}
    canView={permissions.can('pflege.wounds.view')} canManage={permissions.can('pflege.wounds.manage')} permissionStatus={permissions} />;
}

function WoundListWorkspace(props: WoundReadProps & { permissionStatus: CarePermissionStatusState; caseId?: string }) {
  const router = useRouter(), { c } = useCareLightPalette();
  const styles = useWoundEntryStyles();
  const [view, setView] = useState<typeof VIEWS[number]['key']>('cases');
  const [area, setArea] = useState<WoundRecordTab>('overview');
  const [preview, setPreview] = useState(false);
  const [caseId, setCaseId] = useState(props.caseId);
  const [search, setSearch] = useState(''), [filter, setFilter] = useState('all'), [visible, setVisible] = useState(50);
  const selection = useRef({ caseId, search, filter, visible }); selection.current = { caseId, search, filter, visible };
  const q = useWoundRead(props, 'list', owner => fetchAmbulatoryWoundList(owner.tenantId, owner.role), captureWoundListOriginal);
  const caseItems = (pool: NonNullable<typeof q.data>) => caseId ? pool.filter(item => item.row.client_id === caseId) : pool;
  const items = caseItems(q.data ?? []), filtered = filterWoundList(items, search, filter);
  function ownSelection() {
    const now = selection.current;
    return q.current() && now.caseId === caseId && now.search === search && now.filter === filter && now.visible === visible;
  }
  function open(id: string, target = area) {
    const pool = q.current();
    if (!pool || !ownSelection() || !woundUuid(id)
      || !filterWoundList(caseItems(pool), search, filter).slice(0, visible).some(item => item.row.id === id)) return;
    router.push(woundCaseRoute(id, target) as never);
  }
  function create() { if (q.mayManage()) router.push('/pflege/wunden/new' as never); }
  function changeSearch(value: string) {
    if (!ownSelection()) return;
    selection.current = { ...selection.current, search: value, visible: 50 }; setSearch(value); setVisible(50);
  }
  function changeFilter(value: string) {
    if (!ownSelection() || value !== 'all' && !Object.hasOwn(woundStatusLabels, value)) return;
    selection.current = { ...selection.current, filter: value, visible: 50 }; setFilter(value); setVisible(50);
  }
  function clearCaseFilter() {
    if (!ownSelection()) return;
    selection.current = { ...selection.current, caseId: undefined, visible: 50 };
    setCaseId(undefined); setVisible(50);
  }
  function showMore() {
    if (!ownSelection()) return;
    selection.current.visible += 50; setVisible(selection.current.visible);
  }
  if (!q.canRead || !props.owner) return <WoundPage title="Wunddokumentation">
    <CarePermissionStatus state={props.permissionStatus} />
  </WoundPage>;
  const scope = { tenantId: props.owner.tenantId, actorId: props.owner.profileId, role: props.owner.role };
  return <WoundPage title="Wunddokumentation">
      <CareWorkspaceHeader icon="crosshair" title="Wundfälle und Verlauf"
        subtitle={caseId ? items[0]?.clientName ?? 'Gewählte Pflegeakte' : 'Ambulante Pflege'} />
      <View style={styles.toolbar}>
        <WoundTabs tabs={VIEWS} value={view} onChange={setView} label="Wunddokumentation" />
        {props.canManage && <PremiumButton title="Wundfall anlegen" size="sm" onPress={create} disabled={!q.ready}
          leadingIcon={<Feather name="plus" size={17} color="#fff" accessible={false} />} />}
      </View>
      {view === 'statistics' && <WoundStatisticsPanel scope={scope} initialClientId={caseId} />}
      {view === 'catalog' && <WoundCatalogEditor scope={scope} edit={props.canManage} />}
      {view === 'cases' && <>
      <View style={styles.columns}>
        <WoundSection title="Wundfälle" style={styles.mainColumn}
          subtitle={area === 'overview' ? undefined : `Wähle einen Wundfall für „${WOUND_RECORD_TABS.find(tab => tab.key === area)?.label}“.`}
          actions={<PremiumButton title="Aktualisieren"
          size="sm" variant="ghost" accessibilityLabel="Wundfälle aktualisieren" onPress={q.refresh} disabled={q.loading} />}>
          {!q.ready ? (q.loading
            ? <LoadingState message="Wundfälle werden geladen …" />
            : <ErrorState message={q.error} />) : <>
            {items.length > 0 && <>
              <PremiumInput label="Klient:in, Lokalisation oder Wund-ID" placeholder="Wundfälle suchen"
                value={search} onChangeText={changeSearch} />
              <FilterChipGroup wrap options={[{ key: 'all', label: 'Alle Status' }, ...Object.entries(woundStatusLabels).map(([key, label]) => ({ key, label }))]}
                value={filter} onChange={changeFilter} />
            </>}
            {caseId && <PremiumButton title="Alle zugänglichen Pflegeakten anzeigen" variant="ghost" size="sm" onPress={clearCaseFilter} />}
            {!filtered.length ? <View style={styles.empty}>
              <Feather name="clipboard" size={20} color={c.muted} accessible={false} />
              <Text style={styles.body}>{items.length ? 'Keine Wundfälle für diese Suche' : 'Noch keine Wundfälle vorhanden'}</Text>
              <Text style={styles.muted}>{items.length ? 'Suchbegriff oder Statusfilter anpassen.'
                : props.canManage ? 'Beim Anlegen wählst du zuerst die Pflegeakte und die Körperstelle.'
                : 'Für die zugänglichen Pflegeakten sind derzeit keine Wundfälle erfasst.'}</Text>
            </View> : <>
              <Text style={styles.muted} accessibilityLiveRegion="polite">
                {visible < filtered.length ? `${visible} von ${filtered.length}` : filtered.length} {filtered.length === 1 ? 'Wundfall' : 'Wundfälle'}
              </Text>
              <View style={styles.list}>
                {filtered.slice(0, visible).map(({ row, clientName }, index) => {
                  const id = String(row.id), location = woundListText(row.body_location), type = woundListText(row.wound_type);
                  const status = woundStatusLabels[String(row.status)];
                  return <View key={id} style={[styles.record, index > 0 && styles.divider]}>
                    <Pressable style={styles.identity} accessibilityRole="button"
                      accessibilityLabel={[clientName, location, type, status].filter(Boolean).join(', ')} onPress={() => open(id)}>
                      <Text style={styles.body}>{clientName}</Text>
                      <Text style={styles.muted}>{[location, type].filter(Boolean).join(' · ')}</Text>
                      <Text style={styles.muted}>{status}</Text>
                    </Pressable>
                    <View style={styles.actions}>
                      <PremiumButton size="sm" variant="ghost" title="Fotos" accessibilityLabel={`Wundfotos ${clientName} ${location}`}
                        onPress={() => open(id, 'measurement')} />
                      <PremiumButton size="sm" variant="ghost" title="Karte" accessibilityLabel={`Körperkarte ${clientName} ${location}`}
                        onPress={() => open(id, 'bodymap')} />
                    </View>
                  </View>;
                })}
              </View>
            </>}
            {visible < filtered.length && <PremiumButton title="Weitere 50 anzeigen" size="sm" variant="secondary" onPress={showMore} />}
          </>}
        </WoundSection>
        <WoundSection title="Wundfall öffnen" style={styles.mapColumn}>
          <WoundTabs tabs={WOUND_RECORD_TABS} value={area} onChange={setArea} label="Bereich für Wundfall auswählen" />
          <PremiumButton title={preview ? '3D-Vorschau schließen' : '3D-Körperkarte ansehen'} size="sm" variant="secondary" onPress={() => setPreview(value => !value)} />
          {preview ? <WoundBodyMapFrame view="preview" figure="adult-man" /> : null}
        </WoundSection>
      </View></>}
  </WoundPage>;
}
