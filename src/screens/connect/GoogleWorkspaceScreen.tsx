import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { InfoBanner, LoadingState, PremiumButton, PremiumCard } from '@/components/ui';
import { useGoogleWorkspace } from '@/hooks/useGoogleWorkspace';
import { usePermissions } from '@/hooks/usePermissions';
import { colors, spacing, typography } from '@/theme';
import type { GoogleWorkspaceCapability } from '@/lib/googleWorkspace/googleWorkspaceService';

const SERVICES: { key: GoogleWorkspaceCapability; title: string; description: string }[] = [
  { key: 'gmail', title: 'Gmail', description: 'Postfach, Suche, Anhänge, Entwürfe, Versand, Antworten und Labels' },
  { key: 'calendar', title: 'Kalender', description: 'Termine, Serien, Teilnehmende, Erinnerungen und Synchronisation' },
  { key: 'meet', title: 'Google Meet', description: 'Videokonferenzen direkt aus CareSuite-Terminen' },
  { key: 'drive', title: 'Google Drive', description: 'Mandantenordner, Akten, Nachweise, Verträge und Rechnungen' },
  { key: 'docs', title: 'Google Docs', description: 'Dokumente aus CareSuite-Vorlagen erstellen und verknüpfen' },
  { key: 'sheets', title: 'Google Sheets', description: 'Auswertungen und strukturierte Exporte erzeugen' },
  { key: 'slides', title: 'Google Slides', description: 'Schulungen und Präsentationen aus Akademie-Inhalten' },
  { key: 'contacts', title: 'Kontakte', description: 'Kontakte mit Vorschau und Duplikatkontrolle austauschen' },
  { key: 'tasks', title: 'Google Tasks', description: 'Aufgaben lesen, anlegen und synchronisieren' },
  { key: 'chat', title: 'Google Chat', description: 'Spaces lesen und bestätigte Nachrichten senden' },
];

export function GoogleWorkspaceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ google?: string; reason?: string }>();
  const { can, check, roleLabel } = usePermissions();
  const { connection, loading, actionLoading, error, refresh, connect, disconnect } = useGoogleWorkspace();

  if (!can('connect.view')) {
    return (
      <ScreenShell title="Google Workspace" subtitle={roleLabel ?? 'Betrieb'}>
        <LockedActionBanner message={check('connect.view').reason ?? 'Keine Berechtigung.'} roleLabel={roleLabel} />
      </ScreenShell>
    );
  }

  const connected = connection?.status === 'connected';
  const statusText = connected
    ? `Verbunden${connection.email ? ` · ${connection.email}` : ''}`
    : connection?.status === 'degraded'
      ? 'Verbunden · Prüfung erforderlich'
      : 'Nicht verbunden';

  return (
    <ScreenShell
      title="Google Workspace"
      subtitle="Office · zentrale Zusammenarbeit"
      rightSlot={<PremiumButton title="Zurück" size="sm" variant="ghost" onPress={() => router.back()} />}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        {params.google === 'connected' ? (
          <InfoBanner variant="success" title="Google Workspace verbunden" message="Die Berechtigungen werden geprüft und die verfügbaren Dienste aktiviert." />
        ) : null}
        {params.google === 'error' ? (
          <InfoBanner variant="danger" title="Verbindung nicht abgeschlossen" message="Google hat die Anmeldung abgebrochen oder die Freigabe konnte nicht gespeichert werden." />
        ) : null}
        {error ? <InfoBanner variant="danger" title="Google Workspace" message={error} /> : null}

        {loading ? <LoadingState message="Google-Workspace-Status wird geprüft…" /> : (
          <>
            <PremiumCard accentColor={connected ? colors.success : colors.cyanSoft} variant="elevated">
              <View style={styles.heroRow}>
                <View style={styles.heroCopy}>
                  <Text style={styles.eyebrow}>GOOGLE WORKSPACE</Text>
                  <Text style={styles.title}>{statusText}</Text>
                  <Text style={styles.description}>
                    Ein sicherer, mandantenbezogener Arbeitsbereich für Kommunikation, Termine,
                    Dokumente, Aufgaben und Zusammenarbeit in CareSuite HealthOS.
                  </Text>
                </View>
                <View style={[styles.statusDot, connected && styles.statusDotConnected]} />
              </View>
              {connection?.domain ? <Text style={styles.meta}>Workspace-Domain: {connection.domain}</Text> : null}
              <View style={styles.actions}>
                {connected ? (
                  <>
                    <PremiumButton title="Verbindung prüfen" variant="secondary" loading={actionLoading} onPress={() => void refresh()} />
                    {can('connect.configure') ? (
                      <PremiumButton title="Verbindung trennen" variant="ghost" loading={actionLoading} onPress={() => void disconnect()} />
                    ) : null}
                  </>
                ) : can('connect.configure') ? (
                  <PremiumButton title="Google-Workspace-Konto auswählen" loading={actionLoading} onPress={() => void connect()} />
                ) : null}
              </View>
            </PremiumCard>

            <InfoBanner
              title="Google-Konto frei wählbar"
              message="Die E-Mail-Adresse des Google-Workspace-Kontos darf von der CareSuite-Anmeldung abweichen. CareSuite verwendet die bestehende Anmeldung ausschließlich zur sicheren Zuordnung des Mandanten. Im Google-Fenster wählen Sie anschließend das tatsächlich verwendete Workspace-Konto aus."
            />

            <InfoBanner
              title="Sicherheit und Datenschutz"
              message="Die Anmeldung erfolgt ausschließlich über Google OAuth 2.0 mit PKCE. Passwörter werden nie abgefragt. Zugriffs- und Refresh-Tokens bleiben verschlüsselt auf dem Server. Schreibende Aktionen erfordern eine ausdrückliche Bestätigung und werden revisionssicher protokolliert."
            />

            <View style={styles.grid}>
              {SERVICES.map((service) => {
                const active = connected && connection?.capabilities?.[service.key] === true;
                return (
                  <PremiumCard key={service.key} accentColor={active ? colors.cyanSoft : colors.borderSoft}>
                    <View style={styles.serviceHeader}>
                      <Text style={styles.serviceTitle}>{service.title}</Text>
                      <Text style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}>
                        {active ? 'Aktiv' : connected ? 'Freigabe fehlt' : 'Nicht verbunden'}
                      </Text>
                    </View>
                    <Text style={styles.serviceDescription}>{service.description}</Text>
                  </PremiumCard>
                );
              })}
            </View>

            <InfoBanner
              title="Systemweite Nutzung"
              message="Nach der Verbindung stehen die freigegebenen Dienste zentral für Office, Assist, Pflege, Stationär, Beratung, Akademie sowie die Mitarbeitenden- und Klient:innen-Portale bereit. Portale erhalten nur die jeweils fachlich freigegebenen Funktionen."
            />
          </>
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  heroCopy: { flex: 1, gap: spacing.xs },
  eyebrow: { ...typography.caption, color: colors.cyanSoft, fontWeight: '800', letterSpacing: 1.5 },
  title: { ...typography.h2, color: colors.textPrimary },
  description: { ...typography.body, color: colors.textSecondary, maxWidth: 760 },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: spacing.md },
  statusDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.textMuted },
  statusDotConnected: { backgroundColor: colors.success },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  serviceHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  serviceTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  serviceDescription: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
  chip: { ...typography.caption, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  chipActive: { color: colors.success, backgroundColor: 'rgba(57,217,138,0.12)' },
  chipInactive: { color: colors.textMuted, backgroundColor: 'rgba(255,255,255,0.06)' },
});
