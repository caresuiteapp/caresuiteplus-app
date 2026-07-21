import { useEffect, useMemo, useState } from 'react';

import {

  Modal,

  Platform,

  Pressable,

  ScrollView,

  StyleSheet,

  Text,

  View,

  useWindowDimensions,

} from 'react-native';

import { useRouter } from 'expo-router';

import { GradientModalHeader } from '@/components/layout/platform';

import { PremiumButton } from '@/components/ui';

import { GlassSurface } from '@/components/ui/effects';

import { CalendarEventCreateModal } from '@/components/calendar/CalendarEventCreateModal';

import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { careSuiteModalScrimStrong } from '@/design/tokens/lightTheme';

import { careRadius } from '@/design/tokens/radius';

import { moduleColor } from '@/design/tokens/modules';

import { CALENDAR_EVENT_TYPE_LABELS } from '@/types/modules/calendarEvent';

import type { CalendarEvent } from '@/types/modules/calendarEvent';

import { spacing } from '@/theme';



type CalendarEventDrawerProps = {

  visible: boolean;

  event: CalendarEvent | null;

  onClose: () => void;

  onUpdated?: () => void;

};



function DrawerSection({ label, value, styles }: { label: string; value: string; styles: Record<string, import('react-native').TextStyle> }) {

  if (!value) return null;

  return (

    <>

      <Text style={styles.label as import('react-native').TextStyle}>{label}</Text>

      <Text style={styles.value as import('react-native').TextStyle}>{value}</Text>

    </>

  );

}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function formatCalendarEventPeriod(event: CalendarEvent): string {
  const start = new Date(event.start);
  const end = new Date(event.end);
  if (event.allDay) {
    const dateOptions = { timeZone: 'UTC' as const, day: '2-digit' as const, month: '2-digit' as const, year: 'numeric' as const };
    const startDate = start.toLocaleDateString('de-DE', dateOptions);
    const endDate = end.toLocaleDateString('de-DE', dateOptions);
    return startDate === endDate ? `${startDate} · ganztägig` : `${startDate} – ${endDate} · ganztägig`;
  }

  const startDate = start.toLocaleDateString('de-DE');
  const endDate = end.toLocaleDateString('de-DE');
  const startTime = start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const endTime = end.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return startDate === endDate
    ? `${startDate}, ${startTime} – ${endTime} Uhr`
    : `${startDate}, ${startTime} – ${endDate}, ${endTime} Uhr`;
}

function formatCalendarStatus(status: string): string {
  const labels: Record<string, string> = {
    active: 'Aktiv',
    aktiv: 'Aktiv',
    approved: 'Genehmigt',
    pending: 'Zur Prüfung',
    requested: 'Beantragt',
    rejected: 'Abgelehnt',
    cancelled: 'Storniert',
  };
  return labels[status] ?? status;
}

function participantName(name: string | undefined, id: string | null | undefined): string {
  const resolved = name?.trim();
  if (resolved) return resolved;
  const fallback = id?.trim();
  return fallback && !UUID_PATTERN.test(fallback) ? fallback : '';
}



export function CalendarEventDrawer({ visible, event, onClose, onUpdated }: CalendarEventDrawerProps) {

  const router = useRouter();

  const { width, height } = useWindowDimensions();

  const { c } = useCareLightPalette();

  const accent = moduleColor((event?.moduleKey as never) ?? 'office');

  const [editOpen, setEditOpen] = useState(false);



  useEffect(() => {

    if (Platform.OS !== 'web' || !visible) return;

    const prev = document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    return () => {

      document.body.style.overflow = prev;

    };

  }, [visible]);



  const styles = useMemo(

    () =>

      StyleSheet.create({

        backdrop: {

          flex: 1,

          backgroundColor: careSuiteModalScrimStrong,

          justifyContent: 'flex-end',

          alignItems: 'center',

        },

        sheetHost: {

          width: Math.min(width, 720),

          maxHeight: height * 0.88,

          marginBottom: spacing.md,

        },

        sheetInner: { flex: 1, minHeight: 0 },

        body: { padding: spacing.lg, gap: spacing.md },

        sectionTitle: {

          color: c.muted,

          fontSize: 11,

          fontWeight: '800',

          textTransform: 'uppercase',

          letterSpacing: 0.6,

          marginTop: spacing.sm,

        },

        label: { color: c.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },

        value: { color: c.text, fontSize: 15 },

        actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, padding: spacing.lg },

      }),

    [c.muted, c.text, height, width],

  );



  if (!event) return null;



  const typeLabel = CALENDAR_EVENT_TYPE_LABELS[event.type] ?? event.type;

  const record = event.record;

  const sourceType = event.sourceType ?? record?.sourceType;



  const showOpenAction = !!event.href;
  const canEdit = sourceType === 'custom_event';
  const employeeDisplayName = participantName(event.employeeName, record?.relatedEmployeeId);
  const clientDisplayName = participantName(event.clientName, record?.relatedClientId);
  const openActionLabel = ['absence', 'vacation', 'sick_leave'].includes(sourceType ?? '')
    ? 'Mitarbeiterakte öffnen'
    : 'Datensatz öffnen';



  return (

    <>

    <Modal visible={visible && !editOpen} transparent animationType="slide" onRequestClose={onClose}>

      <View style={styles.backdrop}>

        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.sheetHost}>

          <GlassSurface radius={careRadius.lg} glowColor={accent} elevated style={styles.sheetInner}>

            <GradientModalHeader title={event.title} onClose={onClose} />

            <ScrollView contentContainerStyle={styles.body}>

              <Text style={styles.sectionTitle}>Übersicht</Text>

              <DrawerSection label="Modul" value={event.moduleKey ?? 'office'} styles={styles} />

              <DrawerSection label="Typ" value={typeLabel} styles={styles} />

              {event.status ? (

                <DrawerSection label="Status" value={formatCalendarStatus(event.status)} styles={styles} />

              ) : null}



              <Text style={styles.sectionTitle}>Zeit</Text>

              <DrawerSection label="Zeitraum" value={formatCalendarEventPeriod(event)} styles={styles} />



              {(clientDisplayName || employeeDisplayName || record?.relatedWardId) ? (

                <>

                  <Text style={styles.sectionTitle}>Beteiligte</Text>

                  {clientDisplayName ? (

                    <DrawerSection label="Klient:in" value={clientDisplayName} styles={styles} />

                  ) : null}

                  {employeeDisplayName ? (

                    <DrawerSection label="Mitarbeitende Person" value={employeeDisplayName} styles={styles} />

                  ) : null}

                  {record?.relatedWardId ? (

                    <DrawerSection label="Wohnbereich" value={record.relatedWardId} styles={styles} />

                  ) : null}

                </>

              ) : null}



              <Text style={styles.sectionTitle}>Sichtbarkeit</Text>

              {record ? (

                <>

                  <DrawerSection

                    label="Office"

                    value={record.isOfficeVisible ? 'Sichtbar' : 'Ausgeblendet'}

                    styles={styles}

                  />

                  <DrawerSection

                    label="Modul"

                    value={record.isModuleVisible ? 'Sichtbar' : 'Ausgeblendet'}

                    styles={styles}

                  />

                </>

              ) : null}



              {record?.locationName || record?.room ? (

                <>

                  <Text style={styles.sectionTitle}>Ort</Text>

                  <DrawerSection label="Ort" value={record.locationName ?? ''} styles={styles} />

                  <DrawerSection label="Raum" value={record.room ?? ''} styles={styles} />

                </>

              ) : null}



              {record?.description || record?.publicNote ? (

                <>

                  <Text style={styles.sectionTitle}>Notizen</Text>

                  <DrawerSection label="Beschreibung" value={record.description ?? ''} styles={styles} />

                  <DrawerSection label="Öffentliche Notiz" value={record.publicNote ?? ''} styles={styles} />

                </>

              ) : null}

            </ScrollView>

            <View style={styles.actions}>

              {canEdit ? (

                <PremiumButton title="Bearbeiten" onPress={() => setEditOpen(true)} />

              ) : null}

              {showOpenAction ? (

                <PremiumButton

                  title={openActionLabel}

                  onPress={() => {

                    onClose();

                    router.push(event.href as never);

                  }}

                />

              ) : null}

              <PremiumButton title="Schließen" variant="secondary" onPress={onClose} />

            </View>

          </GlassSurface>

        </View>

      </View>

    </Modal>

    <CalendarEventCreateModal

      visible={editOpen}

      sourceContext="calendar"

      calendarScope="module"

      moduleKey={(event?.moduleKey as never) ?? 'office'}

      accentColor={accent}

      editEvent={event}

      onClose={() => setEditOpen(false)}

      onCreated={() => {

        setEditOpen(false);

        onUpdated?.();

        onClose();

      }}

    />

    </>

  );

}
