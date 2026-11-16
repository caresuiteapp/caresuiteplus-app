// Generated native presentation from src/screens/pflege/WoundDocumentationListScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { ErrorState, FilterChipGroup, LoadingState, PremiumButton, PremiumInput } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useCareRuntimePermissions as usePermissions } from "../../hooks/pflege/useCareRuntimePermissions.native.ts";
import { CarePermissionStatus, type CarePermissionStatusState } from "./CarePermissionStatus.native.tsx";
import { useWoundRead, type WoundReadProps } from "../../hooks/pflege/useWoundRead.native.ts";
import { WoundStatisticsPanel } from '@/components/pflege/wounds/WoundStatisticsPanel';
import { WoundCatalogEditor } from '@/components/pflege/wounds/WoundCatalogPanel';
import { useWoundEntryStyles } from '@/components/pflege/wounds/woundEntryStyles';
import { WoundPage, WoundSection, WoundTabs } from '@/components/pflege/wounds/WoundWorkspaceLayout';
import { WoundBodyMapFrame } from '@/components/clinicalMedia/WoundBodyMapFrame';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { fetchAmbulatoryWoundList } from "../../lib/pflege/ambulatoryWoundService.native.ts";
import { captureWoundListOriginal, filterWoundList, woundListText, woundStatusLabels } from "../../lib/pflege/woundReadOriginal.native.ts";
import { woundUuid } from '@/lib/pflege/woundCareDomain';
import { WOUND_RECORD_TABS, woundCaseRoute, type WoundRecordTab } from '@/components/pflege/wounds/woundAreas';
const VIEWS = [
    { key: 'cases', label: 'Übersicht', icon: 'grid' },
    { key: 'statistics', label: 'Wundstatistik', icon: 'bar-chart-2' },
    { key: 'catalog', label: 'Material und Textbausteine', icon: 'layers' },
] as const;
export function WoundDocumentationListScreen() {
    const serviceTenant = useServiceTenantId(), { profile } = useAuth(), permissions = usePermissions();
    const owner = profile && woundUuid(profile.tenantId) && woundUuid(profile.id) && profile.roleKey
        ? { tenantId: profile.tenantId!, profileId: profile.id, role: profile.roleKey } : null;
    return <WoundListWorkspace key={JSON.stringify(owner)} owner={owner} serviceTenant={serviceTenant} runtimeTenant={permissions.tenantId} runtimeRole={permissions.roleKey} canView={permissions.can('pflege.wounds.view')} canManage={permissions.can('pflege.wounds.manage')} permissionStatus={permissions}/>;
}
function WoundListWorkspace(props: WoundReadProps & {
    permissionStatus: CarePermissionStatusState;
}) {
    const router = useRouter(), { c } = useCareLightPalette();
    const styles = useWoundEntryStyles();
    const [view, setView] = useState<typeof VIEWS[number]['key']>('cases');
    const [area, setArea] = useState<WoundRecordTab>('overview');
    const [search, setSearch] = useState(''), [filter, setFilter] = useState('all'), [visible, setVisible] = useState(50);
    const selection = useRef({ search, filter, visible });
    selection.current = { search, filter, visible };
    const q = useWoundRead(props, 'list', owner => fetchAmbulatoryWoundList(owner.tenantId, owner.role), captureWoundListOriginal);
    const items = q.data ?? [], filtered = filterWoundList(items, search, filter);
    function ownSelection() {
        const now = selection.current;
        return q.current() && now.search === search && now.filter === filter && now.visible === visible;
    }
    function open(id: string) {
        const pool = q.current();
        if (!pool || !ownSelection() || !woundUuid(id)
            || !filterWoundList(pool, search, filter).slice(0, visible).some(item => item.row.id === id))
            return;
        router.push(woundCaseRoute(id, area) as never);
    }
    function create() { if (q.mayManage())
        router.push('/pflege/wunden/new' as never); }
    function changeSearch(value: string) {
        if (!ownSelection())
            return;
        selection.current = { ...selection.current, search: value, visible: 50 };
        setSearch(value);
        setVisible(50);
    }
    function changeFilter(value: string) {
        if (!ownSelection() || value !== 'all' && !Object.hasOwn(woundStatusLabels, value))
            return;
        selection.current = { ...selection.current, filter: value, visible: 50 };
        setFilter(value);
        setVisible(50);
    }
    function showMore() {
        if (!ownSelection())
            return;
        selection.current.visible += 50;
        setVisible(selection.current.visible);
    }
    if (!q.canRead || !props.owner)
        return <WoundPage title="Wunddokumentation">
    <CarePermissionStatus state={props.permissionStatus}/>
  </WoundPage>;
    const scope = { tenantId: props.owner.tenantId, actorId: props.owner.profileId, role: props.owner.role };
    return <WoundPage title="Wunddokumentation">
      <View style={styles.toolbar}>
        <WoundTabs tabs={VIEWS} value={view} onChange={setView} label="Wunddokumentation"/>
        {props.canManage && <PremiumButton title="Wundfall anlegen" size="sm" onPress={create} disabled={!q.ready} leadingIcon={<Feather name="plus" size={17} color="#fff" accessible={false}/>}/>}
      </View>
      {view === 'statistics' && <WoundStatisticsPanel scope={scope}/>}
      {view === 'catalog' && <WoundCatalogEditor scope={scope} edit={props.canManage}/>}
      {view === 'cases' && <>
      <WoundSection title="Bereiche der Wunddokumentation">
        <WoundTabs tabs={WOUND_RECORD_TABS} value={area} onChange={setArea} label="Bereich für Wundfall auswählen"/>
      </WoundSection>
      <View style={styles.columns}>
        <WoundSection title="Wundfälle" style={styles.mainColumn} subtitle={area === 'overview' ? undefined : `Wähle einen Wundfall für „${WOUND_RECORD_TABS.find(tab => tab.key === area)?.label}“.`} actions={<PremiumButton title="Aktualisieren" size="sm" variant="ghost" accessibilityLabel="Wundfälle aktualisieren" onPress={q.refresh} disabled={q.loading}/>}>
          {!q.ready ? (q.loading
                ? <LoadingState message="Wundfälle werden geladen …"/>
                : <ErrorState message={q.error}/>) : <>
            {items.length > 0 && <>
              <PremiumInput label="Klient:in, Lokalisation oder Wund-ID" placeholder="Wundfälle suchen" value={search} onChangeText={changeSearch}/>
              <FilterChipGroup wrap options={[{ key: 'all', label: 'Alle Status' }, ...Object.entries(woundStatusLabels).map(([key, label]) => ({ key, label }))]} value={filter} onChange={changeFilter}/>
            </>}
            {!filtered.length ? <View style={styles.empty}>
              <Feather name="clipboard" size={20} color={c.muted} accessible={false}/>
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
                        return <Pressable key={id} accessibilityRole="button" accessibilityLabel={[clientName, location, type, status].filter(Boolean).join(', ')} onPress={() => open(id)} style={({ pressed }) => [
                                styles.record, index > 0 && styles.divider, pressed && styles.recordActive,
                            ]}>
                    <View style={styles.identity}>
                      <Text style={styles.body}>{clientName}</Text>
                      <Text style={styles.muted}>{[location, type].filter(Boolean).join(' · ')}</Text>
                    </View>
                    <View style={styles.badge}><Text style={styles.muted}>{status}</Text></View>
                    <Feather name="chevron-right" size={18} color={c.muted} accessible={false}/>
                  </Pressable>;
                    })}
              </View>
            </>}
            {visible < filtered.length && <PremiumButton title="Weitere 50 anzeigen" size="sm" variant="secondary" onPress={showMore}/>}
          </>}
        </WoundSection>
        <WoundSection title="3D-Körperkarte" style={styles.mapColumn}>
          <WoundBodyMapFrame view="preview" figure="adult-man"/>
        </WoundSection>
      </View></>}
  </WoundPage>;
}
