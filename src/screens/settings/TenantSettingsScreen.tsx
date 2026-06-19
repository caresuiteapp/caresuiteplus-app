import { useMemo, useState } from 'react';

import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { LockedActionBanner } from '@/components/permissions';

import { CareLightPageShell } from '@/components/layout';

import { SettingsScreenFrame } from '@/components/settings/settingsscreenframe';

import { TenantCenterSectionCard } from '@/components/tenant/TenantCenterSectionCard';

import { TenantCenterSectionModals } from '@/components/tenant/TenantCenterSectionModals';

import { TenantCustomFieldWizardModal } from '@/components/tenant/TenantCustomFieldWizardModal';

import { TenantServiceCatalogModal } from '@/components/tenant/TenantServiceCatalogModal';

import { ErrorState, LoadingState, SuccessState } from '@/components/ui';

import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';

import { careSpacing } from '@/design/tokens/spacing';

import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';

import { usePermissions } from '@/hooks/usePermissions';

import { useServiceTenantId } from '@/hooks/useTenantId';

import { useAuth } from '@/lib/auth/context';

import { ensureTenantCatalogSeeded } from '@/lib/tenant/tenantCenterService';

import { TENANT_SETTINGS_PERMISSION } from '@/lib/tenant/tenantSettingsRoute';

import type { TenantCenterSectionKey } from '@/types/tenant/tenantCenter';



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



  const columns = width >= 1200 ? 3 : width >= 760 ? 2 : 1;



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



  const handleEdit = (key: TenantCenterSectionKey) => {

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

    <CareLightPageShell

      title="Mandanten-Center"

      subtitle={`${snapshot.company.name || 'Organisation'} · ${roleLabel ?? ''}`}

      showBack

    >

      <ScrollView contentContainerStyle={styles.scroll}>

        <Text style={[styles.lead, { color: text.secondary }]}>

          Zentrale Verwaltung Ihrer Mandanten-Stammdaten, Leistungskatalog und individuellen Felder — alles mandantenspezifisch aus Ihrem Konto.

        </Text>



        {saved ? <SuccessState message="Mandantendaten gespeichert." /> : null}



        <View style={[styles.grid, { gap: careSpacing.md }]}>

          {primarySections.map((section) => (

            <View key={section.key} style={[styles.gridItem, { width: `${100 / columns}%`, maxWidth: `${100 / columns}%` }]}>

              <TenantCenterSectionCard section={section} onEdit={() => handleEdit(section.key)} />

            </View>

          ))}

        </View>



        {stubSections.length ? (

          <>

            <Text style={[styles.sectionHeading, { color: text.muted }]}>Weitere Bereiche</Text>

            <View style={[styles.grid, { gap: careSpacing.md }]}>

              {stubSections.map((section) => (

                <View key={section.key} style={[styles.gridItem, { width: `${100 / columns}%`, maxWidth: `${100 / columns}%` }]}>

                  <TenantCenterSectionCard section={section} onEdit={() => handleEdit(section.key)} />

                </View>

              ))}

            </View>

          </>

        ) : null}

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

    </CareLightPageShell>

  );

}



const styles = StyleSheet.create({

  scroll: {

    padding: careSpacing.md,

    gap: careSpacing.md,

    alignItems: 'center',

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

    alignSelf: 'center',

    width: '100%',

  },

  gridItem: {

    paddingHorizontal: 4,

    marginBottom: careSpacing.sm,

  },

});


