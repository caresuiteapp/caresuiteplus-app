// Generated native presentation from src/screens/pflege/WoundDocumentationListScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, FilterChipGroup, LoadingState, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useCareRuntimePermissions as usePermissions } from "../../hooks/pflege/useCareRuntimePermissions.native.ts";
import { CarePermissionStatus, type CarePermissionStatusState } from "./CarePermissionStatus.native.tsx";
import { useWoundRead, type WoundReadProps } from "../../hooks/pflege/useWoundRead.native.ts";
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { spacing, typography } from '@/theme';
import { fetchAmbulatoryWoundList } from "../../lib/pflege/ambulatoryWoundService.native.ts";
import { captureWoundListOriginal, filterWoundList, woundListText, woundStatusLabels } from "../../lib/pflege/woundReadOriginal.native.ts";
import { woundUuid } from '@/lib/pflege/woundCareDomain';
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
    const styles = useMemo(() => StyleSheet.create({
        content: { gap: spacing.md, paddingBottom: spacing.xxl, minWidth: 0 },
        body: { ...typography.body, color: c.text, flexShrink: 1, maxWidth: '100%' },
    }), [c]);
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
        router.push(`/pflege/wunden/${id}` as never);
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
    if (!q.canRead)
        return <ScreenShell title="Wundfälle"><CarePermissionStatus state={props.permissionStatus}/></ScreenShell>;
    if (!q.ready)
        return <ScreenShell title="Wundfälle">{q.loading
                ? <LoadingState message="Aktuelle Wundfälle werden geladen…"/> : <ErrorState message={q.error} onRetry={q.refresh}/>}</ScreenShell>;
    return <ScreenShell title="Wundfälle"><ScrollView contentContainerStyle={styles.content}>
    {props.canManage ? <PremiumButton title="Neuen Wundfall anlegen" onPress={create}/> : null}
    <PremiumInput label="Nach Klient:in, Lokalisation oder Wund-ID suchen" value={search} onChangeText={changeSearch}/>
    <FilterChipGroup wrap options={[{ key: 'all', label: 'Alle Status' }, ...Object.entries(woundStatusLabels).map(([key, label]) => ({ key, label }))]} value={filter} onChange={changeFilter}/>
    <Text style={styles.body}>{filtered.length} passende Wundfälle im geladenen Bestand · {Math.min(visible, filtered.length)} angezeigt.</Text>
    {!filtered.length ? <EmptyState title={items.length ? 'Keine passenden Wundfälle' : 'Keine Wundfälle im geladenen Bestand'} message={items.length ? 'Suchbegriff oder Statusfilter anpassen.' : 'Für die aktuell zugänglichen aktiven Pflegefälle wurden keine Wundfälle geliefert.'}/> : null}
    {filtered.slice(0, visible).map(({ row, clientName }) => <SectionPanel key={String(row.id)} title={clientName}>
      <Text style={styles.body}>Wund-ID: {String(row.id)}</Text>
      <Text style={styles.body}>{woundListText(row.body_location)} · {woundListText(row.wound_type)}</Text>
      <Text style={styles.body}>Status: {woundStatusLabels[String(row.status)]}</Text>
      <PremiumButton title="Wundfall und Assessmentverlauf öffnen" variant="secondary" onPress={() => open(String(row.id))}/>
    </SectionPanel>)}
    {visible < filtered.length ? <PremiumButton title="Weitere 50 Wundfälle anzeigen" variant="secondary" onPress={showMore}/> : null}
    <PremiumButton title="Wundfälle aktualisieren" variant="secondary" onPress={q.refresh}/>
  </ScrollView></ScreenShell>;
}
