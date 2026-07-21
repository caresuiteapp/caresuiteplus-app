import { StyleSheet, View } from 'react-native';

import { useRouter } from 'expo-router';

import { AccessManagementDashboardHero } from '@/components/access/AccessManagementDashboardHero';

import { ScreenShell } from '@/components/layout';

import { EmptyState, ErrorState, LoadingState, ModuleTile, PremiumButton, SectionPanel } from '@/components/ui';

import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';

import { useServiceTenantId } from '@/hooks/useTenantId';

import { useAuth } from '@/lib/auth/context';

import { fetchAccessDashboardStats } from '@/lib/auth/accessManagementService';

import { colors, spacing } from '@/theme';



const QUICK_ACTIONS = [

  { title: 'Interne:n Benutzer:in anlegen', route: '/business/office/access/internal-users/new' },

  { title: 'Mitarbeiterzugang erstellen', route: '/business/office/access/employee-portal' },

  { title: 'Klient:innen-Code generieren', route: '/business/office/access/client-portal' },

  { title: 'Angehörigen-Code generieren', route: '/business/office/access/relative-portal' },

  { title: 'Rollen & Rechte prüfen', route: '/business/office/access/roles' },

  { title: 'Login-Protokoll anzeigen', route: '/business/office/access/login-audit' },

] as const;



export function AccessManagementDashboardScreen() {

  const router = useRouter();

  const { profile } = useAuth();

  const tenantId = useServiceTenantId();



  const query = useAsyncQuery(

    () => {

      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });

      return fetchAccessDashboardStats(tenantId, profile?.roleKey);

    },

    [tenantId, profile?.roleKey],

    { enabled: !!tenantId },

  );



  if (query.loading && !query.data) {

    return (

      <ScreenShell title="Zugänge & Benutzer" subtitle="Wird geladen…" scroll>

        <LoadingState message="Zugangs-KPIs werden geladen…" />

      </ScreenShell>

    );

  }



  if (query.error && !query.data) {

    return (

      <ScreenShell title="Zugänge & Benutzer" subtitle="Fehler" scroll>

        <ErrorState message={query.error} onRetry={query.refresh} />

      </ScreenShell>

    );

  }



  const stats = query.data;

  const hasAnyAccess =

    !!stats &&

    stats.internalUsers + stats.employeeAccounts + stats.activePortalCodes + stats.recentLogins > 0;



  return (

    <ScreenShell title="Zugänge & Benutzer" subtitle="Office / Verwaltung" scroll>

      {stats ? <AccessManagementDashboardHero stats={stats} /> : null}



      {!hasAnyAccess ? (

        <EmptyState

          title="Noch keine Zugänge"

          message="Legen Sie interne Benutzer oder Portalzugänge an."

          actionLabel="Interne Benutzer"

          onAction={() => router.push('/business/office/access/internal-users/new' as never)}

        />

      ) : null}



      <SectionPanel title="Bereiche">

        <View style={styles.grid}>

          {[

            ['Interne Benutzer', '/business/office/access/internal-users'],

            ['Mitarbeitendenportal', '/business/office/access/employee-portal'],

            ['Klient:innenportal', '/business/office/access/client-portal'],

            ['Angehörigenportal', '/business/office/access/relative-portal'],

          ].map(([title, route]) => (

            <ModuleTile

              key={route}

              icon="🔐"

              title={title}

              description="Zugänge verwalten"

              accentColor={colors.orange}

              onPress={() => router.push(route as never)}

            />

          ))}

        </View>

      </SectionPanel>



      <SectionPanel title="Schnellaktionen">

        <View style={styles.actions}>

          {QUICK_ACTIONS.map((action) => (

            <PremiumButton

              key={action.route}

              title={action.title}

              variant="secondary"

              fullWidth

              onPress={() => router.push(action.route as never)}

            />

          ))}

        </View>

      </SectionPanel>

    </ScreenShell>

  );

}



const styles = StyleSheet.create({

  grid: { gap: spacing.sm },

  actions: { gap: spacing.sm },

});
