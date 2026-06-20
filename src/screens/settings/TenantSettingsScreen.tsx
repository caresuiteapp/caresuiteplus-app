import { useMemo, useState } from 'react';

import { useRouter } from 'expo-router';

import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type DimensionValue,
} from 'react-native';

import { LockedActionBanner } from '@/components/permissions';

import { ScreenShell } from '@/components/layout';

import { SettingsScreenFrame } from '@/components/settings/settingsscreenframe';

import { TenantCenterSectionCard } from '@/components/tenant/TenantCenterSectionCard';

import { TenantCenterSectionModals } from '@/components/tenant/TenantCenterSectionModals';

import { TenantCustomFieldWizardModal } from '@/components/tenant/TenantCustomFieldWizardModal';

import { TenantServiceCatalogModal } from '@/components/tenant/TenantServiceCatalogModal';

import { ErrorState, LoadingState, SuccessState } from '@/components/ui';

import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';

import { breakpoints } from '@/design/tokens/breakpoints';
import { careSpacing } from '@/design/tokens/spacing';

import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';

import { usePermissions } from '@/hooks/usePermissions';

import { useServiceTenantId } from '@/hooks/useTenantId';

import { useAuth } from '@/lib/auth/context';

import { ensureTenantCatalogSeeded } from '@/lib/tenant/tenantCenterService';

import { TENANT_SETTINGS_PERMISSION } from '@/lib/tenant/tenantSettingsRoute';

import type { TenantCenterSectionKey } from '@/types/tenant/tenantCenter';

/** Shared centered column — intro, headings and card grids align with page title. */
const TENANT_CENTER_CONTENT_MAX_WIDTH = 1280;

function tenantCenterColumnCount(width: number): number {
  if (width >= 1200) return 4;
  if (width >= breakpoints.tablet) return 2;
  return 1;
}

function tenantCenterItemWidth(columns: number): DimensionValue {
  if (columns <= 1) return '100%';
  return `${Math.floor(100 / columns) - 1}%`;
}

export function TenantSettingsScreen({ embeddedInModal = false }: { embeddedInModal?: boolean } = {}) {

  const { profile } = useAuth();

  const tenantId = useServiceTenantId();

  const { can, check, roleLabel } = usePermissions();

  const text = useAuroraAdaptiveText();

  const { width } = useWindowDimensions();

  const [activeSection, setActiveSection] = useState<TenantCenterSectionKey | null>(null);

  const [catalogOpen, setCatalogOpen] = useState(false);

  const [customFieldOpen, setCustomFieldOpen] = useState(false);

  const [saved, setSaved] = useState(false);



  const columns = tenantCenterColumnCount(width);
  const gridGap = columns >= 4 ? careSpacing.lg : careSpacing.md;
  const itemWidth = tenantCenterItemWidth(columns);



  const query = useAsyncQuery(

    () => {

      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });

      return ensureTenantCatalogSeeded(tenantId, profile?.roleKey);

    },

    [tenantId, profile?.roleKey],

    { enabled: !!tenantId },

  );



  const snapshot = query.data;



  const primarySections = useMemo(

    () => snapshot?.sections.filter((section) => !section.stub) ?? [],

    [snapshot?.sections],

  );

  const stubSections = useMemo(

    () => snapshot?.sections.filter((section) => section.stub) ?? [],

    [snapshot?.sections],

  );



  const router = useRouter();

  const handleEdit = (key: TenantCenterSectionKey) => {

    if (key === 'dataManagement') {
      router.push('/business/office/settings/csv-import-export' as never);
      return;
    }

    if (key === 'clientServiceTypes') {
      router.push('/settings/tenant/client-service-types' as never);
      return;
    }

    if (key === 'clientBudgetDefaults') {
      router.push('/settings/tenant/client-budget' as never);
      return;
    }

    if (key === 'catalog') {

      setCatalogOpen(true);

      return;

    }

    if (key === 'customFields') {

      setCustomFieldOpen(true);

      return;

    }

    setActiveSection(key);

  };



  const handleSaved = async () => {

    setSaved(true);

    await query.refresh();

  };



  if (!can(TENANT_SETTINGS_PERMISSION)) {

    return (

      <SettingsScreenFrame title="Mandant" subtitle="Organisation" embeddedInModal={embeddedInModal}>

        <LockedActionBanner

          message={check(TENANT_SETTINGS_PERMISSION).reason ?? 'Keine Berechtigung für Mandanten-Stammdaten.'}

          roleLabel={roleLabel}

        />

      </SettingsScreenFrame>

    );

  }



  if (query.loading && !snapshot) {

    return (

      <SettingsScreenFrame title="Mandant" subtitle="Wird geladen…" embeddedInModal={embeddedInModal}>

        <LoadingState message="Mandantendaten werden geladen…" />

      </SettingsScreenFrame>

    );

  }



  if (query.error && !snapshot) {

    return (

      <SettingsScreenFrame title="Mandant" subtitle="Fehler" embeddedInModal={embeddedInModal}>

        <ErrorState message={query.error} onRetry={query.refresh} />

      </SettingsScreenFrame>

    );

  }



  if (!snapshot || !tenantId) {

    return (

      <SettingsScreenFrame title="Mandant" subtitle="Wird geladen…" embeddedInModal={embeddedInModal}>

        <LoadingState message="Mandanten-Center wird vorbereitet…" />

      </SettingsScreenFrame>

    );

  }



  return (

    <ScreenShell
      title="Mandanten-Center"
      subtitle={`${snapshot.company.name || 'Organisation'} · ${roleLabel ?? ''}`}
      showBack
      scroll={false}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.contentColumn, { maxWidth: TENANT_CENTER_CONTENT_MAX_WIDTH }]}>
          <Text style={[styles.lead, { color: text.secondary }]}>
            Zentrale Verwaltung Ihrer Mandanten-Stammdaten, Leistungskatalog und individuellen Felder — alles mandantenspezifisch aus Ihrem Konto.
          </Text>

          {saved ? <SuccessState message="Mandantendaten gespeichert." /> : null}

          <View style={[styles.grid, { gap: gridGap }]}>
            {primarySections.map((section) => (
              <View
                key={section.key}
                style={[
                  styles.gridItem,
                  {
                    width: itemWidth,
                    maxWidth: itemWidth,
                    minWidth: columns >= 4 ? 240 : columns === 2 ? 240 : undefined,
                  },
                ]}
              >
                <TenantCenterSectionCard section={section} onEdit={() => handleEdit(section.key)} />
              </View>
            ))}
          </View>

          {stubSections.length ? (
            <>
              <Text style={[styles.sectionHeading, { color: text.muted }]}>Weitere Bereiche</Text>
              <View style={[styles.grid, { gap: gridGap }]}>
                {stubSections.map((section) => (
                  <View
                    key={section.key}
                    style={[
                      styles.gridItem,
                      {
                        width: itemWidth,
                        maxWidth: itemWidth,
                        minWidth: columns >= 4 ? 240 : columns === 2 ? 240 : undefined,
                      },
                    ]}
                  >
                    <TenantCenterSectionCard section={section} onEdit={() => handleEdit(section.key)} />
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>



      <TenantCenterSectionModals

        activeSection={activeSection}

        snapshot={snapshot}

        tenantId={tenantId}

        onClose={() => setActiveSection(null)}

        onSaved={handleSaved}

      />



      <TenantServiceCatalogModal

        visible={catalogOpen}

        tenantId={tenantId}

        onClose={() => setCatalogOpen(false)}

        onSaved={handleSaved}

      />



      <TenantCustomFieldWizardModal

        visible={customFieldOpen}

        tenantId={tenantId}

        onClose={() => setCustomFieldOpen(false)}

        onSaved={handleSaved}

      />

    </ScreenShell>

  );

}



const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    width: '100%',
  },

  scroll: {
    flexGrow: 1,
    width: '100%',
    alignItems: 'center',
    paddingBottom: careSpacing.xxl,
  },

  contentColumn: {
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
    gap: careSpacing.md,
    paddingHorizontal: careSpacing.md,
  },

  lead: {
    marginBottom: careSpacing.xs,
    textAlign: 'center',
    width: '100%',
  },

  sectionHeading: {
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: careSpacing.sm,
    textAlign: 'center',
    width: '100%',
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    justifyContent: 'center',
  },

  gridItem: {
    flexGrow: 1,
    minWidth: 0,
    paddingHorizontal: careSpacing.xs,
    marginBottom: careSpacing.sm,
  },
});


