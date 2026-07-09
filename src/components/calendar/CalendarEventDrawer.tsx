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



export function CalendarEventDrawer({ visible, event, onClose, onUpdated }: CalendarEventDrawerProps) {

  const router = useRouter();

  const { width, height } = useWindowDimensions();

  const { isDark, c } = useCareLightPalette();

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

    [c.muted, c.text, height, isDark, width],

  );



  if (!event) return null;



  const typeLabel = CALENDAR_EVENT_TYPE_LABELS[event.type] ?? event.type;

  const startLabel = new Date(event.start).toLocaleString('de-DE');

  const endLabel = new Date(event.end).toLocaleString('de-DE');

  const record = event.record;

  const sourceType = event.sourceType ?? record?.sourceType;



  const showOpenAction = !!event.href;

  const showArchiveHint = sourceType === 'custom_event' || sourceType === 'task_deadline';

  const canEdit = sourceType !== 'assist_visit';



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

                <DrawerSection label="Status" value={event.status} styles={styles} />

              ) : null}



              <Text style={styles.sectionTitle}>Zeit</Text>

              <DrawerSection label="Zeitraum" value={`${startLabel} – ${endLabel}`} styles={styles} />

              {event.allDay ? (

                <DrawerSection label="Ganztägig" value="Ja" styles={styles} />

              ) : null}



              {(record?.relatedClientId || record?.relatedEmployeeId || record?.relatedWardId) ? (

                <>

                  <Text style={styles.sectionTitle}>Beteiligte</Text>

                  {record?.relatedClientId ? (

                    <DrawerSection label="Klient" value={record.relatedClientId} styles={styles} />

                  ) : null}

                  {record?.relatedEmployeeId ? (

                    <DrawerSection label="Mitarbeiter" value={record.relatedEmployeeId} styles={styles} />

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

                  title="Öffnen"

                  onPress={() => {

                    onClose();

                    router.push(event.href as never);

                  }}

                />

              ) : null}

              {showArchiveHint ? (

                <PremiumButton title="Quelldatensatz" variant="secondary" disabled />

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

