import type { ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';
import { withAlpha } from '@/design/tokens/motion';
import {
  AddClientGlyph,
  AssignmentRouteGlyph,
  BudgetWarnGlyph,
  ClientsRosterGlyph,
  DocsReviewGlyph,
  EmployeeBadgeGlyph,
  MessageWaveGlyph,
  ModulesActiveGlyph,
  PortalGlobeGlyph,
  PortalInboxGlyph,
  ServiceRecordGlyph,
  SparkleNewGlyph,
  TaskCheckGlyph,
  TeamGroupGlyph,
  WeekPlannerGlyph,
} from './spaceGlyphsExtra';
import { CalendarOrb, InvoiceStack } from './spaceGlyphs';

export type SpaceModuleKpiGlyphKind =
  | 'mkpiOfficeClients'
  | 'mkpiOfficeInvoice'
  | 'mkpiOfficeStaff'
  | 'mkpiOfficeCalendar'
  | 'mkpiOfficeNewClient'
  | 'mkpiAssistAssignments'
  | 'mkpiAssistProof'
  | 'mkpiAssistTasks'
  | 'mkpiAssistMessages'
  | 'mkpiAssistDocuments'
  | 'mkpiPflegeClients'
  | 'mkpiPflegeBudget'
  | 'mkpiPflegeTasks'
  | 'mkpiPflegePortal'
  | 'mkpiPflegeNewClient'
  | 'mkpiStationRoster'
  | 'mkpiStationClients'
  | 'mkpiStationCalendar'
  | 'mkpiStationPortal'
  | 'mkpiStationStaff'
  | 'mkpiBeratungClients'
  | 'mkpiBeratungCalendar'
  | 'mkpiBeratungMessages'
  | 'mkpiBeratungTasks'
  | 'mkpiBeratungNewClient'
  | 'mkpiAkademieCourses'
  | 'mkpiAkademiePortal'
  | 'mkpiAkademieParticipants'
  | 'mkpiAkademieMedia'
  | 'mkpiAkademieMandatory';

export const SPACE_MODULE_KPI_GLYPH_KINDS = [
  'mkpiOfficeClients',
  'mkpiOfficeInvoice',
  'mkpiOfficeStaff',
  'mkpiOfficeCalendar',
  'mkpiOfficeNewClient',
  'mkpiAssistAssignments',
  'mkpiAssistProof',
  'mkpiAssistTasks',
  'mkpiAssistMessages',
  'mkpiAssistDocuments',
  'mkpiPflegeClients',
  'mkpiPflegeBudget',
  'mkpiPflegeTasks',
  'mkpiPflegePortal',
  'mkpiPflegeNewClient',
  'mkpiStationRoster',
  'mkpiStationClients',
  'mkpiStationCalendar',
  'mkpiStationPortal',
  'mkpiStationStaff',
  'mkpiBeratungClients',
  'mkpiBeratungCalendar',
  'mkpiBeratungMessages',
  'mkpiBeratungTasks',
  'mkpiBeratungNewClient',
  'mkpiAkademieCourses',
  'mkpiAkademiePortal',
  'mkpiAkademieParticipants',
  'mkpiAkademieMedia',
  'mkpiAkademieMandatory',
] as const satisfies readonly SpaceModuleKpiGlyphKind[];

function GlyphSlot({ children }: { children: React.ReactNode }) {
  return <View style={styles.slot}>{children}</View>;
}

/** Office — Klient:innen: Gebäude + Personen im Fenster */
function MkpiOfficeClientsGlyph({ accent }: { accent: string }) {
  return (
    <GlyphSlot>
      <View style={styles.officeTower}>
        <View style={[styles.officeWinRow, { top: 4 }]}>
          <View style={[styles.officeWin, { backgroundColor: accent }]} />
          <View style={[styles.officeWin, { backgroundColor: withAlpha(accent, 0.55) }]} />
        </View>
        <View style={[styles.officeWinRow, { top: 12 }]}>
          <View style={[styles.officeWin, { backgroundColor: withAlpha(accent, 0.75) }]} />
          <View style={[styles.officeWin, { backgroundColor: accent }]} />
        </View>
        <View style={[styles.officeBase, { backgroundColor: withAlpha(accent, 0.45) }]} />
      </View>
      <View style={[styles.officeHead, { backgroundColor: accent, left: 22, top: 6 }]} />
      <View style={[styles.officeHead, { backgroundColor: withAlpha(accent, 0.7), right: 2, top: 10 }]} />
    </GlyphSlot>
  );
}

/** Pflege — Klient:in mit Pflegekreuz-Hintergrund */
function MkpiPflegeClientsGlyph({ accent }: { accent: string }) {
  return (
    <GlyphSlot>
      <View style={[styles.pflegeCrossV, { backgroundColor: withAlpha(accent, 0.35) }]} />
      <View style={[styles.pflegeCrossH, { backgroundColor: withAlpha(accent, 0.35) }]} />
      <View style={[styles.pflegeHead, { backgroundColor: accent }]} />
      <View style={[styles.pflegeBody, { backgroundColor: withAlpha(accent, 0.75) }]} />
    </GlyphSlot>
  );
}

/** Assist — Einsätze: Route mit Puls-Ring */
function MkpiAssistAssignmentsGlyph({ accent }: { accent: string }) {
  return (
    <GlyphSlot>
      <View style={[styles.assistPulse, { borderColor: withAlpha(accent, 0.45) }]} />
      <AssignmentRouteGlyph accent={accent} />
    </GlyphSlot>
  );
}

/** Assist — Leistungsnachweis: Unterschrift betont */
function MkpiAssistProofGlyph({ accent }: { accent: string }) {
  return (
    <GlyphSlot>
      <ServiceRecordGlyph accent={accent} />
      <View style={[styles.proofSignLine, { backgroundColor: accent }]} />
    </GlyphSlot>
  );
}

/** Pflege — Aufgaben: Checkliste mit Kreuz */
function MkpiPflegeTasksGlyph({ accent }: { accent: string }) {
  return (
    <GlyphSlot>
      <View style={[styles.pflegeClip, { borderColor: withAlpha(accent, 0.75) }]}>
        <View style={[styles.clipLine, { backgroundColor: withAlpha(accent, 0.85) }]} />
        <View style={[styles.clipLine, { backgroundColor: withAlpha(accent, 0.55), width: 10 }]} />
        <View style={[styles.clipCheck, { borderColor: accent }]} />
      </View>
      <View style={[styles.pflegeCrossMiniV, { backgroundColor: accent }]} />
      <View style={[styles.pflegeCrossMiniH, { backgroundColor: accent }]} />
    </GlyphSlot>
  );
}

/** Pflege — Portal-Anfragen: Posteingang + Herz */
function MkpiPflegePortalGlyph({ accent }: { accent: string }) {
  return (
    <GlyphSlot>
      <PortalInboxGlyph accent={accent} />
      <View style={[styles.pflegeHeart, { backgroundColor: accent }]} />
    </GlyphSlot>
  );
}

/** Pflege — Neue Klient:innen: Plus im Kreuz */
function MkpiPflegeNewClientGlyph({ accent }: { accent: string }) {
  return (
    <GlyphSlot>
      <View style={[styles.plusRing, { borderColor: accent }]}>
        <View style={[styles.plusBarH, { backgroundColor: accent }]} />
        <View style={[styles.plusBarV, { backgroundColor: accent }]} />
      </View>
      <View style={[styles.pflegeCrossMiniV, { backgroundColor: withAlpha(accent, 0.55), height: 14, top: 4 }]} />
      <View style={[styles.pflegeCrossMiniH, { backgroundColor: withAlpha(accent, 0.55), width: 14, left: 11, top: 11 }]} />
    </GlyphSlot>
  );
}

/** Stationär — Belegung: Liste am Bett */
function MkpiStationRosterGlyph({ accent }: { accent: string }) {
  return (
    <GlyphSlot>
      <View style={[styles.bedRail, { backgroundColor: withAlpha(accent, 0.55) }]} />
      <View style={[styles.bedMattress, { backgroundColor: withAlpha(accent, 0.75) }]} />
      <ClientsRosterGlyph accent={accent} />
    </GlyphSlot>
  );
}

/** Stationär — Aktive Klient:innen: Person auf Bett */
function MkpiStationClientsGlyph({ accent }: { accent: string }) {
  return (
    <GlyphSlot>
      <View style={[styles.bedMattressWide, { backgroundColor: withAlpha(accent, 0.65) }]} />
      <View style={[styles.bedPillow, { backgroundColor: withAlpha(accent, 0.85) }]} />
      <View style={[styles.bedHead, { backgroundColor: accent }]} />
      <View style={[styles.bedBase, { backgroundColor: withAlpha(accent, 0.45) }]} />
    </GlyphSlot>
  );
}

/** Stationär — Termine: Kalender über Bett */
function MkpiStationCalendarGlyph({ accent }: { accent: string }) {
  return (
    <GlyphSlot>
      <View style={[styles.bedBase, { backgroundColor: withAlpha(accent, 0.35), bottom: 2 }]} />
      <WeekPlannerGlyph accent={accent} />
    </GlyphSlot>
  );
}

/** Stationär — Portal-Nutzer: Globus über Station */
function MkpiStationPortalGlyph({ accent }: { accent: string }) {
  return (
    <GlyphSlot>
      <View style={[styles.bedRail, { backgroundColor: withAlpha(accent, 0.45), bottom: 4 }]} />
      <PortalGlobeGlyph accent={accent} />
    </GlyphSlot>
  );
}

/** Stationär — Mitarbeitende: Badge mit Kappe */
function MkpiStationStaffGlyph({ accent }: { accent: string }) {
  return (
    <GlyphSlot>
      <EmployeeBadgeGlyph accent={accent} />
      <View style={[styles.nurseCap, { backgroundColor: accent }]} />
    </GlyphSlot>
  );
}

/** Beratung — Klient:innen: Person mit Beratungswellen */
function MkpiBeratungClientsGlyph({ accent }: { accent: string }) {
  return (
    <GlyphSlot>
      <View style={[styles.consultWave, { borderColor: withAlpha(accent, 0.55) }]} />
      <View style={[styles.consultWave, styles.consultWaveInner, { borderColor: withAlpha(accent, 0.75) }]} />
      <View style={[styles.pflegeHead, { backgroundColor: accent }]} />
      <View style={[styles.pflegeBody, { backgroundColor: withAlpha(accent, 0.7) }]} />
    </GlyphSlot>
  );
}

/** Beratung — Termine: Kalender + Sprechblase */
function MkpiBeratungCalendarGlyph({ accent }: { accent: string }) {
  return (
    <GlyphSlot>
      <WeekPlannerGlyph accent={accent} />
      <View style={[styles.chatBubbleSmall, { backgroundColor: accent }]} />
    </GlyphSlot>
  );
}

/** Beratung — Nachrichten: Doppel-Bubble */
function MkpiBeratungMessagesGlyph({ accent }: { accent: string }) {
  return (
    <GlyphSlot>
      <View style={[styles.chatBubbleBack, { backgroundColor: withAlpha(accent, 0.55) }]} />
      <View style={[styles.chatBubbleFront, { backgroundColor: accent }]} />
      <View style={[styles.chatDots, { backgroundColor: withAlpha('#FFFFFF', 0.85) }]} />
    </GlyphSlot>
  );
}

/** Beratung — Aufgaben: Haken mit Gesprächswelle */
function MkpiBeratungTasksGlyph({ accent }: { accent: string }) {
  return (
    <GlyphSlot>
      <TaskCheckGlyph accent={accent} />
      <View style={[styles.taskWave, { backgroundColor: withAlpha(accent, 0.55) }]} />
    </GlyphSlot>
  );
}

/** Beratung — Neue Klient:innen: Plus mit Welle */
function MkpiBeratungNewClientGlyph({ accent }: { accent: string }) {
  return (
    <GlyphSlot>
      <SparkleNewGlyph accent={accent} />
      <View style={[styles.consultWaveMini, { borderColor: withAlpha(accent, 0.65) }]} />
    </GlyphSlot>
  );
}

/** Akademie — Kurse: gestapelte Lernmodule */
function MkpiAkademieCoursesGlyph({ accent }: { accent: string }) {
  return (
    <GlyphSlot>
      <ModulesActiveGlyph accent={accent} />
      <View style={[styles.courseSpine, { backgroundColor: withAlpha(accent, 0.55) }]} />
    </GlyphSlot>
  );
}

/** Akademie — Portal: Globus mit Doktorhut */
function MkpiAkademiePortalGlyph({ accent }: { accent: string }) {
  return (
    <GlyphSlot>
      <PortalGlobeGlyph accent={accent} />
      <View style={[styles.capBrim, { backgroundColor: accent }]} />
    </GlyphSlot>
  );
}

/** Akademie — Teilnehmende: Gruppe mit Kappe */
function MkpiAkademieParticipantsGlyph({ accent }: { accent: string }) {
  return (
    <GlyphSlot>
      <TeamGroupGlyph accent={accent} />
      <View style={[styles.capBrimSmall, { backgroundColor: accent }]} />
    </GlyphSlot>
  );
}

/** Akademie — Mediathek: Dokument mit Play */
function MkpiAkademieMediaGlyph({ accent }: { accent: string }) {
  return (
    <GlyphSlot>
      <View style={[styles.mediaDoc, { backgroundColor: withAlpha(accent, 0.75) }]}>
        <View style={[styles.mediaLine, { backgroundColor: withAlpha('#FFFFFF', 0.7) }]} />
      </View>
      <View style={[styles.mediaPlayTri, { borderLeftColor: accent }]} />
    </GlyphSlot>
  );
}

/** Akademie — Pflichtschulungen: Fortschrittsbalken + Haken */
function MkpiAkademieMandatoryGlyph({ accent }: { accent: string }) {
  return (
    <GlyphSlot>
      <View style={styles.mandatoryBars}>
        <View style={[styles.mandatoryBar, { height: 8, backgroundColor: withAlpha(accent, 0.45) }]} />
        <View style={[styles.mandatoryBar, { height: 14, backgroundColor: withAlpha(accent, 0.75) }]} />
        <View style={[styles.mandatoryBar, { height: 18, backgroundColor: accent }]} />
      </View>
      <View style={[styles.mandatoryCheck, { borderColor: accent }]} />
    </GlyphSlot>
  );
}

const GLYPH_BY_KIND: Record<SpaceModuleKpiGlyphKind, ComponentType<{ accent: string }>> = {
  mkpiOfficeClients: MkpiOfficeClientsGlyph,
  mkpiOfficeInvoice: ({ accent }) => (
    <GlyphSlot>
      <InvoiceStack accent={accent} />
    </GlyphSlot>
  ),
  mkpiOfficeStaff: ({ accent }) => (
    <GlyphSlot>
      <EmployeeBadgeGlyph accent={accent} />
    </GlyphSlot>
  ),
  mkpiOfficeCalendar: ({ accent }) => (
    <GlyphSlot>
      <CalendarOrb accent={accent} />
    </GlyphSlot>
  ),
  mkpiOfficeNewClient: ({ accent }) => (
    <GlyphSlot>
      <AddClientGlyph accent={accent} />
    </GlyphSlot>
  ),
  mkpiAssistAssignments: MkpiAssistAssignmentsGlyph,
  mkpiAssistProof: MkpiAssistProofGlyph,
  mkpiAssistTasks: ({ accent }) => (
    <GlyphSlot>
      <TaskCheckGlyph accent={accent} />
    </GlyphSlot>
  ),
  mkpiAssistMessages: ({ accent }) => (
    <GlyphSlot>
      <MessageWaveGlyph accent={accent} />
    </GlyphSlot>
  ),
  mkpiAssistDocuments: ({ accent }) => (
    <GlyphSlot>
      <DocsReviewGlyph accent={accent} />
    </GlyphSlot>
  ),
  mkpiPflegeClients: MkpiPflegeClientsGlyph,
  mkpiPflegeBudget: ({ accent }) => (
    <GlyphSlot>
      <BudgetWarnGlyph accent={accent} />
    </GlyphSlot>
  ),
  mkpiPflegeTasks: MkpiPflegeTasksGlyph,
  mkpiPflegePortal: MkpiPflegePortalGlyph,
  mkpiPflegeNewClient: MkpiPflegeNewClientGlyph,
  mkpiStationRoster: MkpiStationRosterGlyph,
  mkpiStationClients: MkpiStationClientsGlyph,
  mkpiStationCalendar: MkpiStationCalendarGlyph,
  mkpiStationPortal: MkpiStationPortalGlyph,
  mkpiStationStaff: MkpiStationStaffGlyph,
  mkpiBeratungClients: MkpiBeratungClientsGlyph,
  mkpiBeratungCalendar: MkpiBeratungCalendarGlyph,
  mkpiBeratungMessages: MkpiBeratungMessagesGlyph,
  mkpiBeratungTasks: MkpiBeratungTasksGlyph,
  mkpiBeratungNewClient: MkpiBeratungNewClientGlyph,
  mkpiAkademieCourses: MkpiAkademieCoursesGlyph,
  mkpiAkademiePortal: MkpiAkademiePortalGlyph,
  mkpiAkademieParticipants: MkpiAkademieParticipantsGlyph,
  mkpiAkademieMedia: MkpiAkademieMediaGlyph,
  mkpiAkademieMandatory: MkpiAkademieMandatoryGlyph,
};

export function isSpaceModuleKpiGlyphKind(value: string): value is SpaceModuleKpiGlyphKind {
  return value in GLYPH_BY_KIND;
}

export function SpaceModuleKpiGlyph({ kind, accent }: { kind: SpaceModuleKpiGlyphKind; accent: string }) {
  const Renderer = GLYPH_BY_KIND[kind];
  return <Renderer accent={accent} />;
}

const styles = StyleSheet.create({
  slot: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  officeTower: {
    width: 20,
    height: 24,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  officeWinRow: {
    position: 'absolute',
    flexDirection: 'row',
    gap: 3,
  },
  officeWin: {
    width: 5,
    height: 5,
    borderRadius: 1,
  },
  officeBase: {
    position: 'absolute',
    bottom: 0,
    width: 24,
    height: 4,
    borderRadius: 1,
  },
  officeHead: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  pflegeCrossV: {
    position: 'absolute',
    width: 5,
    height: 26,
    borderRadius: 3,
  },
  pflegeCrossH: {
    position: 'absolute',
    width: 26,
    height: 5,
    borderRadius: 3,
  },
  pflegeHead: {
    width: 11,
    height: 11,
    borderRadius: 6,
    marginBottom: 2,
  },
  pflegeBody: {
    width: 16,
    height: 10,
    borderRadius: 5,
  },
  pflegeCrossMiniV: {
    position: 'absolute',
    width: 3,
    height: 10,
    borderRadius: 2,
    top: 8,
    left: 16,
  },
  pflegeCrossMiniH: {
    position: 'absolute',
    height: 3,
    width: 10,
    borderRadius: 2,
    top: 12,
    left: 12,
  },
  pflegeClip: {
    width: 16,
    height: 20,
    borderRadius: 2,
    borderWidth: 1,
    padding: 3,
    gap: 3,
  },
  clipLine: {
    width: 12,
    height: 2,
    borderRadius: 1,
  },
  clipCheck: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
  },
  pflegeHeart: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    transform: [{ rotate: '45deg' }],
  },
  plusRing: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusBarH: {
    position: 'absolute',
    width: 10,
    height: 2,
    borderRadius: 1,
  },
  plusBarV: {
    position: 'absolute',
    width: 2,
    height: 10,
    borderRadius: 1,
  },
  assistPulse: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
  },
  proofSignLine: {
    position: 'absolute',
    bottom: 6,
    width: 12,
    height: 2,
    borderRadius: 1,
    transform: [{ rotate: '-18deg' }],
  },
  bedRail: {
    position: 'absolute',
    bottom: 6,
    width: 26,
    height: 3,
    borderRadius: 1,
  },
  bedMattress: {
    position: 'absolute',
    bottom: 8,
    width: 22,
    height: 8,
    borderRadius: 3,
  },
  bedMattressWide: {
    position: 'absolute',
    bottom: 10,
    width: 26,
    height: 10,
    borderRadius: 3,
  },
  bedPillow: {
    position: 'absolute',
    bottom: 16,
    left: 8,
    width: 10,
    height: 5,
    borderRadius: 2,
  },
  bedHead: {
    position: 'absolute',
    bottom: 18,
    left: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bedBase: {
    position: 'absolute',
    bottom: 6,
    width: 28,
    height: 4,
    borderRadius: 2,
  },
  nurseCap: {
    position: 'absolute',
    top: 2,
    width: 12,
    height: 4,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  consultWave: {
    position: 'absolute',
    width: 28,
    height: 14,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderWidth: 2,
    borderBottomWidth: 0,
  },
  consultWaveInner: {
    transform: [{ scale: 0.72 }],
    marginTop: 4,
  },
  consultWaveMini: {
    position: 'absolute',
    bottom: 2,
    width: 18,
    height: 8,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  chatBubbleSmall: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 10,
    height: 8,
    borderRadius: 4,
  },
  chatBubbleBack: {
    position: 'absolute',
    left: 4,
    top: 8,
    width: 14,
    height: 11,
    borderRadius: 6,
  },
  chatBubbleFront: {
    position: 'absolute',
    right: 4,
    top: 4,
    width: 16,
    height: 12,
    borderRadius: 6,
  },
  chatDots: {
    position: 'absolute',
    right: 8,
    top: 9,
    width: 8,
    height: 2,
    borderRadius: 1,
  },
  taskWave: {
    position: 'absolute',
    bottom: 4,
    width: 18,
    height: 3,
    borderRadius: 2,
  },
  courseSpine: {
    position: 'absolute',
    left: 6,
    width: 3,
    height: 18,
    borderRadius: 1,
  },
  capBrim: {
    position: 'absolute',
    top: 2,
    width: 14,
    height: 4,
    borderRadius: 2,
  },
  capBrimSmall: {
    position: 'absolute',
    top: 4,
    width: 10,
    height: 3,
    borderRadius: 2,
  },
  mediaDoc: {
    width: 14,
    height: 18,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaLine: {
    width: 8,
    height: 2,
    borderRadius: 1,
  },
  mediaPlayTri: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 9,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: 2,
  },
  mandatoryBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 20,
  },
  mandatoryBar: {
    width: 5,
    borderRadius: 2,
  },
  mandatoryCheck: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
});
