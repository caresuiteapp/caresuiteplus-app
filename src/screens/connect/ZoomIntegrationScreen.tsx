import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { LockedActionBanner } from '@/components/permissions';
import {
  InfoBanner,
  LoadingState,
  PremiumButton,
  PremiumCard,
  PremiumInput,
} from '@/components/ui';
import { ZoomMeetingRoom } from '@/components/zoom';
import { usePermissions } from '@/hooks/usePermissions';
import { useZoom } from '@/hooks/useZoom';
import {
  cancelZoomMeeting,
  getZoomJoinContext,
  type ZoomJoinContext,
  type ZoomMeeting,
} from '@/lib/zoom/zoomService';
import { colors, spacing, typography } from '@/theme';

function localDateTime(date = new Date(Date.now() + 60 * 60_000)): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatMeetingDate(value: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function ZoomIntegrationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ zoom?: string; reason?: string }>();
  const { can, check, roleLabel } = usePermissions();
  const {
    connection,
    meetings,
    loading,
    actionLoading,
    error,
    refresh,
    connect,
    health,
    disconnect,
    createMeeting,
  } = useZoom();
  const [topic, setTopic] = useState('');
  const [startTime, setStartTime] = useState(localDateTime);
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [externalReference, setExternalReference] = useState('');
  const [activeMeeting, setActiveMeeting] = useState<ZoomJoinContext | null>(null);
  const [meetingActionId, setMeetingActionId] = useState<string | null>(null);
  const connected = connection?.status === 'connected';
  const upcoming = useMemo(
    () => meetings.filter((meeting) => meeting.status === 'scheduled' || meeting.status === 'started'),
    [meetings],
  );

  if (!can('connect.view')) {
    return (
      <ScreenShell title="Zoom" subtitle={roleLabel ?? 'Betrieb'}>
        <LockedActionBanner message={check('connect.view').reason ?? 'Keine Berechtigung.'} roleLabel={roleLabel} />
      </ScreenShell>
    );
  }

  async function openMeeting(meeting: ZoomMeeting, host: boolean) {
    setMeetingActionId(meeting.id);
    try {
      setActiveMeeting(await getZoomJoinContext(meeting.id, {
        host,
        userName: connection?.displayName ?? roleLabel ?? 'CareSuite',
        userEmail: connection?.email ?? undefined,
      }));
    } finally {
      setMeetingActionId(null);
    }
  }

  function requestCancellation(meeting: ZoomMeeting) {
    Alert.alert(
      'Zoom-Termin absagen?',
      `„${meeting.topic}“ wird bei Zoom gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Verbindlich absagen',
          style: 'destructive',
          onPress: () => {
            setMeetingActionId(meeting.id);
            void cancelZoomMeeting(meeting.id)
              .then(refresh)
              .finally(() => setMeetingActionId(null));
          },
        },
      ],
    );
  }

  if (activeMeeting) {
    return (
      <ScreenShell title="Zoom-Videotermin" subtitle="CareSuite HealthOS">
        <ZoomMeetingRoom context={activeMeeting} onLeave={() => setActiveMeeting(null)} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Zoom"
      subtitle="Videotermine direkt über CareSuite"
      rightSlot={<PremiumButton title="Zurück" size="sm" variant="ghost" onPress={() => router.back()} />}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        {params.zoom === 'connected' ? (
          <InfoBanner
            variant="success"
            title="Zoom erfolgreich verbunden"
            message="CareSuite prüft die freigegebenen Zoom-Funktionen und aktiviert die Meeting-Verwaltung."
          />
        ) : null}
        {params.zoom === 'error' ? (
          <InfoBanner
            variant="danger"
            title="Zoom-Verbindung nicht abgeschlossen"
            message="Zoom hat die Freigabe abgebrochen oder CareSuite konnte sie nicht sicher speichern."
          />
        ) : null}
        {error ? <InfoBanner variant="danger" title="Zoom" message={error} /> : null}

        {loading ? <LoadingState message="Zoom-Integration wird geprüft…" /> : (
          <>
            <PremiumCard accentColor={connected ? colors.success : colors.cyanSoft} variant="elevated">
              <View style={styles.heroRow}>
                <View style={styles.heroCopy}>
                  <Text style={styles.eyebrow}>ZOOM × CARESUITE</Text>
                  <Text style={styles.title}>
                    {connected
                      ? `Verbunden${connection?.email ? ` · ${connection.email}` : ''}`
                      : 'Noch nicht verbunden'}
                  </Text>
                  <Text style={styles.description}>
                    Meetings planen, in CareSuite starten, sicher beitreten und den Terminstatus
                    automatisch über Zoom-Webhooks synchronisieren.
                  </Text>
                </View>
                <View style={[styles.statusDot, connected && styles.statusDotConnected]} />
              </View>
              <View style={styles.actions}>
                {connected ? (
                  <>
                    <PremiumButton title="Verbindung prüfen" variant="secondary" loading={actionLoading} onPress={() => void health()} />
                    <PremiumButton title="Daten aktualisieren" variant="ghost" loading={actionLoading} onPress={() => void refresh()} />
                    {can('connect.configure') ? (
                      <PremiumButton title="Verbindung trennen" variant="ghost" loading={actionLoading} onPress={() => void disconnect()} />
                    ) : null}
                  </>
                ) : can('connect.configure') ? (
                  <PremiumButton title="Zoom-Konto auswählen" loading={actionLoading} onPress={() => void connect()} />
                ) : null}
              </View>
            </PremiumCard>

            <InfoBanner
              title="Zoom-Konto frei wählbar"
              message="Das Zoom-Konto darf eine andere E-Mail-Adresse als die CareSuite-Anmeldung verwenden. CareSuite ordnet die OAuth-Verbindung über Mandant und Benutzerprofil zu; Zoom-Passwörter werden niemals gespeichert."
            />

            <View style={styles.capabilityGrid}>
              {[
                ['Meetings', connection?.capabilities.meetings],
                ['Einbettung', connection?.capabilities.embeddedMeeting],
                ['Webhooks', connection?.capabilities.webhooks],
                ['Aufzeichnungen', connection?.capabilities.recordings],
              ].map(([label, active]) => (
                <PremiumCard key={String(label)} accentColor={active ? colors.success : colors.borderSoft}>
                  <Text style={styles.serviceTitle}>{String(label)}</Text>
                  <Text style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}>
                    {active ? 'Aktiv' : 'Nicht freigegeben'}
                  </Text>
                </PremiumCard>
              ))}
            </View>

            {connected && can('connect.configure') ? (
              <PremiumCard accentColor={colors.cyanSoft}>
                <Text style={styles.sectionTitle}>Neuen Videotermin anlegen</Text>
                <Text style={styles.sectionCopy}>
                  Der fachliche Titel bleibt in CareSuite. An Zoom wird ausschließlich der neutrale
                  Titel „CareSuite Videotermin“ übertragen.
                </Text>
                <View style={styles.formGrid}>
                  <View style={styles.formWide}>
                    <PremiumInput
                      label="Interner Terminname"
                      value={topic}
                      onChangeText={setTopic}
                      placeholder="z. B. Pflegeberatung – Folgetermin"
                    />
                  </View>
                  <View style={styles.formColumn}>
                    <PremiumInput
                      label="Beginn"
                      value={startTime}
                      onChangeText={setStartTime}
                      placeholder="2026-07-24T18:00"
                    />
                  </View>
                  <View style={styles.formColumn}>
                    <PremiumInput
                      label="Dauer in Minuten"
                      value={durationMinutes}
                      onChangeText={setDurationMinutes}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.formWide}>
                    <PremiumInput
                      label="Interne Referenz (optional)"
                      value={externalReference}
                      onChangeText={setExternalReference}
                      placeholder="Fall, Einsatz, Beratung oder Kalenderreferenz"
                    />
                  </View>
                </View>
                <View style={styles.actions}>
                  <PremiumButton
                    title="Zoom-Termin verbindlich erstellen"
                    loading={actionLoading}
                    disabled={!topic.trim() || !startTime}
                    onPress={() => {
                      const date = new Date(startTime);
                      if (!Number.isFinite(date.getTime())) return;
                      void createMeeting({
                        topic: topic.trim(),
                        startTime: date.toISOString(),
                        durationMinutes: Number(durationMinutes),
                        timezone: 'Europe/Berlin',
                        externalReference: externalReference.trim() || undefined,
                        waitingRoom: true,
                        joinBeforeHost: false,
                        muteUponEntry: true,
                        recordingAllowed: false,
                        recordingMode: 'none',
                        consentRequired: true,
                      }).then((created) => {
                        if (!created) return;
                        setTopic('');
                        setExternalReference('');
                        setStartTime(localDateTime());
                      });
                    }}
                  />
                </View>
              </PremiumCard>
            ) : null}

            {connected ? (
              <View style={styles.meetingsSection}>
                <Text style={styles.sectionTitle}>Bevorstehende Zoom-Termine</Text>
                {upcoming.length === 0 ? (
                  <InfoBanner title="Keine Termine" message="Aktuell sind keine offenen Zoom-Termine vorhanden." />
                ) : upcoming.map((meeting) => (
                  <PremiumCard
                    key={meeting.id}
                    accentColor={meeting.status === 'started' ? colors.success : colors.cyanSoft}
                  >
                    <View style={styles.meetingRow}>
                      <View style={styles.meetingCopy}>
                        <Text style={styles.meetingTitle}>{meeting.topic}</Text>
                        <Text style={styles.meetingMeta}>
                          {formatMeetingDate(meeting.startTime)} · {meeting.durationMinutes} Minuten
                        </Text>
                        <Text style={styles.meetingMeta}>
                          {meeting.status === 'started' ? 'Läuft jetzt' : 'Geplant'}
                          {meeting.externalReference ? ` · ${meeting.externalReference}` : ''}
                        </Text>
                      </View>
                      <View style={styles.actions}>
                        <PremiumButton
                          title="Beitreten"
                          size="sm"
                          variant="secondary"
                          loading={meetingActionId === meeting.id}
                          onPress={() => void openMeeting(meeting, false)}
                        />
                        {can('connect.configure') ? (
                          <>
                            <PremiumButton
                              title="Als Host starten"
                              size="sm"
                              loading={meetingActionId === meeting.id}
                              onPress={() => void openMeeting(meeting, true)}
                            />
                            <PremiumButton
                              title="Absagen"
                              size="sm"
                              variant="ghost"
                              onPress={() => requestCancellation(meeting)}
                            />
                          </>
                        ) : null}
                      </View>
                    </View>
                  </PremiumCard>
                ))}
              </View>
            ) : null}

            <InfoBanner
              title="Datenschutzstandard"
              message="Aufzeichnungen sind standardmäßig deaktiviert. Meetingtitel werden gegenüber Zoom neutralisiert. OAuth-Tokens, Start- und Beitrittsadressen sowie Kenncodes bleiben AES-GCM-verschlüsselt auf dem Server; alle Aktionen werden mandantenbezogen protokolliert."
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
  description: { ...typography.body, color: colors.textSecondary, maxWidth: 820 },
  statusDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.textMuted },
  statusDotConnected: { backgroundColor: colors.success },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  capabilityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  serviceTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  chip: { ...typography.caption, alignSelf: 'flex-start', marginTop: spacing.sm, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, overflow: 'hidden' },
  chipActive: { color: colors.success, backgroundColor: 'rgba(57,217,138,0.12)' },
  chipInactive: { color: colors.textMuted, backgroundColor: 'rgba(255,255,255,0.06)' },
  sectionTitle: { ...typography.h3, color: colors.textPrimary },
  sectionCopy: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs, maxWidth: 820 },
  formGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.lg },
  formWide: { width: '100%' },
  formColumn: { flexGrow: 1, flexBasis: 260 },
  meetingsSection: { gap: spacing.md },
  meetingRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.md },
  meetingCopy: { flexGrow: 1, flexBasis: 280, gap: spacing.xs },
  meetingTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  meetingMeta: { ...typography.caption, color: colors.textSecondary },
});
