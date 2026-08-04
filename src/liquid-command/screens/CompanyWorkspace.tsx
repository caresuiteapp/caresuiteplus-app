import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { TenantCenterSectionModals } from '@/components/tenant/TenantCenterSectionModals';
import { TenantCustomFieldWizardModal } from '@/components/tenant/TenantCustomFieldWizardModal';
import { TenantServiceCatalogModal } from '@/components/tenant/TenantServiceCatalogModal';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { fetchTenantCenter } from '@/lib/tenant/tenantCenterService';
import type { RoleKey } from '@/types';
import type {
  SectionCompleteness,
  TenantCenterSectionKey,
  TenantCenterSectionMeta,
} from '@/types/tenant/tenantCenter';
import {
  LiquidButton,
  LiquidGlyph,
  LiquidMetric,
  LiquidState,
  LiquidStatus,
  LiquidSurface,
  LiquidText,
} from '../components/LiquidPrimitives';
import { liquidColors, liquidRadius, liquidSpace } from '../foundation/tokens';

const DIRECT_ROUTES: Partial<Record<TenantCenterSectionKey, string>> = {
  dataManagement: '/business/office/settings/csv-import-export',
  clientServiceTypes: '/settings/tenant/client-service-types',
  clientBudgetDefaults: '/settings/tenant/client-budget',
};

const GROUPS: { title: string; keys: TenantCenterSectionKey[] }[] = [
  {
    title: 'Identität & Erreichbarkeit',
    keys: ['company', 'contact', 'representatives', 'branding'],
  },
  {
    title: 'Recht, Steuer & Zulassung',
    keys: ['legal', 'tax', 'register', 'supervisory', 'ikNumbers'],
  },
  {
    title: 'Finanzen & Abrechnung',
    keys: ['bank', 'payment', 'catalog', 'travelSurcharges'],
  },
  {
    title: 'Organisation & System',
    keys: ['modules', 'locations', 'customFields', 'dataManagement', 'audit'],
  },
];

function statusTone(completeness: SectionCompleteness): 'success' | 'warning' | 'neutral' {
  if (completeness === 'complete') return 'success';
  if (completeness === 'partial') return 'warning';
  return 'neutral';
}

function statusLabel(completeness: SectionCompleteness): string {
  if (completeness === 'complete') return 'Vollständig';
  if (completeness === 'partial') return 'Prüfen';
  return 'Nicht gepflegt';
}

function CompanySectionCard({
  section,
  compact,
  onPress,
}: {
  section: TenantCenterSectionMeta;
  compact: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${section.title}. ${section.summary}. ${statusLabel(section.completeness)}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.sectionCard,
        compact && styles.sectionCardCompact,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.sectionCardTop}>
        <View style={styles.sectionIcon}>
          <LiquidGlyph glyph={section.stub ? '◌' : '▣'} size={18} />
        </View>
        <LiquidStatus label={statusLabel(section.completeness)} tone={statusTone(section.completeness)} />
      </View>
      <View style={styles.sectionCopy}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <Text style={styles.sectionSummary}>{section.summary}</Text>
        <Text style={styles.sectionDescription}>{section.description}</Text>
      </View>
      <View style={styles.sectionAction}>
        <Text style={styles.sectionActionLabel}>{section.editable ? 'Öffnen und bearbeiten' : 'Details öffnen'}</Text>
        <LiquidGlyph glyph="›" size={18} />
      </View>
    </Pressable>
  );
}

export function CompanyWorkspace({
  tenantId,
  roleKey,
}: {
  tenantId: string;
  roleKey: RoleKey | null;
}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 980;
  const [activeSection, setActiveSection] = useState<TenantCenterSectionKey | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [customFieldOpen, setCustomFieldOpen] = useState(false);

  const query = useAsyncQuery(
    () => fetchTenantCenter(tenantId, roleKey),
    [tenantId, roleKey],
    { enabled: !!tenantId },
  );
  const snapshot = query.data;

  const sectionsByKey = useMemo(
    () => new Map(snapshot?.sections.map((section) => [section.key, section]) ?? []),
    [snapshot?.sections],
  );

  if (query.loading && !snapshot) {
    return <LiquidState kind="loading" title="Unternehmensdaten werden geladen" message="Stammdaten, Recht, Steuer, Abrechnung und Organisation werden zusammengeführt." />;
  }
  if (query.error && !snapshot) {
    return <LiquidState kind="error" title="Unternehmensdaten nicht verfügbar" message={query.error} actionLabel="Erneut laden" onAction={() => void query.refresh()} />;
  }
  if (!snapshot) {
    return <LiquidState kind="empty" title="Unternehmen nicht gefunden" message="Für den aktiven Mandanten konnten keine Unternehmensstammdaten geladen werden." />;
  }

  const realSections = snapshot.sections.filter((section) => !section.stub);
  const completed = realSections.filter((section) => section.completeness === 'complete').length;
  const attention = realSections.filter((section) => section.completeness !== 'complete').length;
  const activeModules = Object.values(snapshot.modules).filter(Boolean).length;
  const companyName = snapshot.company.legalName || snapshot.company.name || 'Unternehmen';
  const address = [
    [snapshot.company.street, snapshot.company.houseNumber].filter(Boolean).join(' '),
    [snapshot.company.zip, snapshot.company.city].filter(Boolean).join(' '),
    snapshot.company.country,
  ].filter(Boolean).join(' · ');

  const openSection = (key: TenantCenterSectionKey) => {
    const directRoute = DIRECT_ROUTES[key];
    if (directRoute) {
      router.push(directRoute as never);
      return;
    }
    if (key === 'catalog' || key === 'travelSurcharges') {
      setCatalogOpen(true);
      return;
    }
    if (key === 'customFields') {
      setCustomFieldOpen(true);
      return;
    }
    setActiveSection(key);
  };

  return (
    <View style={styles.page} testID="office-company-workspace">
      <LiquidSurface active contentStyle={styles.hero}>
        <View style={styles.heroCopy}>
          <LiquidText variant="kicker">IHR UNTERNEHMEN</LiquidText>
          <LiquidText variant="title" accessibilityRole="header">{companyName}</LiquidText>
          <LiquidText variant="body">{address || 'Unternehmensanschrift noch nicht vollständig gepflegt'}</LiquidText>
          <View style={styles.heroContact}>
            {snapshot.company.email ? <LiquidStatus label={snapshot.company.email} tone="live" /> : null}
            {snapshot.company.phone ? <LiquidStatus label={snapshot.company.phone} tone="neutral" /> : null}
            {snapshot.register.ikNumber ? <LiquidStatus label={`IK ${snapshot.register.ikNumber}`} tone="success" /> : null}
          </View>
        </View>
        <LiquidButton label="Stammdaten bearbeiten" icon="✎" onPress={() => setActiveSection('company')} />
      </LiquidSurface>

      <View style={[styles.metrics, compact && styles.metricsCompact]}>
        <LiquidMetric label="Stammdaten" value={`${completed}/${realSections.length}`} detail="Bereiche vollständig" glyph="✓" tone={attention ? 'warning' : 'success'} />
        <LiquidMetric label="Prüfbedarf" value={attention} detail={attention ? 'Angaben ergänzen' : 'Alles vollständig'} glyph="!" tone={attention ? 'warning' : 'success'} />
        <LiquidMetric label="Leistungsbereiche" value={activeModules} detail="Module aktiv" glyph="▦" tone="live" />
      </View>

      {GROUPS.map((group) => {
        const sections = group.keys
          .map((key) => sectionsByKey.get(key))
          .filter((section): section is TenantCenterSectionMeta => Boolean(section));
        if (!sections.length) return null;
        return (
          <View key={group.title} style={styles.group}>
            <View style={styles.groupHeading}>
              <Text style={styles.groupTitle}>{group.title}</Text>
              <Text style={styles.groupCount}>{sections.length} Bereiche</Text>
            </View>
            <View style={[styles.sectionGrid, compact && styles.sectionGridCompact]}>
              {sections.map((section) => (
                <CompanySectionCard
                  key={section.key}
                  section={section}
                  compact={compact}
                  onPress={() => openSection(section.key)}
                />
              ))}
            </View>
          </View>
        );
      })}

      <TenantCenterSectionModals
        activeSection={activeSection}
        snapshot={snapshot}
        tenantId={tenantId}
        onClose={() => setActiveSection(null)}
        onSaved={() => void query.refresh()}
      />
      <TenantServiceCatalogModal
        visible={catalogOpen}
        tenantId={tenantId}
        onClose={() => setCatalogOpen(false)}
        onSaved={() => void query.refresh()}
      />
      <TenantCustomFieldWizardModal
        visible={customFieldOpen}
        tenantId={tenantId}
        onClose={() => setCustomFieldOpen(false)}
        onSaved={() => void query.refresh()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: liquidSpace.xl, paddingBottom: liquidSpace.xxl },
  hero: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: liquidSpace.xl, padding: liquidSpace.xl },
  heroCopy: { flex: 1, minWidth: 260, gap: liquidSpace.sm },
  heroContact: { flexDirection: 'row', flexWrap: 'wrap', gap: liquidSpace.sm, marginTop: liquidSpace.sm },
  metrics: { flexDirection: 'row', gap: liquidSpace.md },
  metricsCompact: { flexDirection: 'column' },
  group: { gap: liquidSpace.md },
  groupHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: liquidSpace.md },
  groupTitle: { color: liquidColors.white, fontSize: 19, lineHeight: 24, fontWeight: '800' },
  groupCount: { color: liquidColors.white56, fontSize: 12, fontWeight: '700' },
  sectionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: liquidSpace.md },
  sectionGridCompact: { flexDirection: 'column' },
  sectionCard: { width: '48.8%', minHeight: 210, borderWidth: 1, borderColor: liquidColors.white12, borderRadius: liquidRadius.panel, backgroundColor: liquidColors.navy800, padding: liquidSpace.lg, gap: liquidSpace.md },
  sectionCardCompact: { width: '100%' },
  sectionCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: liquidSpace.md },
  sectionIcon: { width: 38, height: 38, borderRadius: liquidRadius.small, alignItems: 'center', justifyContent: 'center', backgroundColor: liquidColors.blue500Alpha16, borderWidth: 1, borderColor: liquidColors.blue300Alpha32 },
  sectionCopy: { flex: 1, gap: liquidSpace.xs },
  sectionTitle: { color: liquidColors.white, fontSize: 16, lineHeight: 21, fontWeight: '800' },
  sectionSummary: { color: liquidColors.blue200, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  sectionDescription: { color: liquidColors.white64, fontSize: 12, lineHeight: 18 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: liquidColors.white08, paddingTop: liquidSpace.md },
  sectionActionLabel: { color: liquidColors.white72, fontSize: 12, fontWeight: '700' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.995 }] },
});
