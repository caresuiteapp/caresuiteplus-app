import { View, StyleSheet } from 'react-native';
import { withAlpha } from '@/design/tokens/motion';

import {
  AddClientGlyph,
  AssignmentRouteGlyph,
  AuditTrailGlyph,
  BellGlyph,
  BudgetWarnGlyph,
  ClientsRosterGlyph,
  ConnectPlugGlyph,
  DataRightsGlyph,
  DocsReviewGlyph,
  EmployeeBadgeGlyph,
  HelpOrbGlyph,
  HomeOrbitGlyph,
  InfoBeaconGlyph,
  InsightScopeGlyph,
  KpiChartGlyph,
  LockShieldGlyph,
  MandantGlyph,
  LivePulseGlyph,
  MessageWaveGlyph,
  ModulesActiveGlyph,
  OpsConsoleGlyph,
  PersonSingleGlyph,
  PluginCrystalGlyph,
  PortalGlobeGlyph,
  PortalInboxGlyph,
  QmShieldGlyph,
  RadarPingGlyph,
  ServiceRecordGlyph,
  SparkleNewGlyph,
  SubscriptionCardGlyph,
  TaskCheckGlyph,
  TaskTickGlyph,
  TeamGroupGlyph,
  TeamRolesGlyph,
  TrendChartGlyph,
  UploadFolderGlyph,
  WeekPlannerGlyph,
} from './spaceGlyphsExtra';
import {
  isSpaceModuleKpiGlyphKind,
  SpaceModuleKpiGlyph,
  type SpaceModuleKpiGlyphKind,
} from './spaceModuleKpiGlyphs';

export type SpaceGlyphKind =
  | 'orbit'
  | 'office'
  | 'care'
  | 'medical'
  | 'ward'
  | 'holoWave'
  | 'scholar'
  | 'gear'
  | 'addClient'
  | 'invoice'
  | 'calendar'
  | 'uploadFolder'
  | 'teamGroup'
  | 'teamRoles'
  | 'personSingle'
  | 'kpiChart'
  | 'trendChart'
  | 'taskCheck'
  | 'qmShield'
  | 'pluginCrystal'
  | 'connectPlug'
  | 'subscriptionCard'
  | 'auditTrail'
  | 'radarPing'
  | 'insightScope'
  | 'bell'
  | 'mandant'
  | 'helpOrb'
  | 'lockShield'
  | 'dataRights'
  | 'infoBeacon'
  | 'employeeBadge'
  | 'assignmentRoute'
  | 'taskTick'
  | 'modulesActive'
  | 'portalGlobe'
  | 'docsReview'
  | 'portalInbox'
  | 'serviceRecord'
  | 'budgetWarn'
  | 'weekPlanner'
  | 'sparkleNew'
  | 'clientsRoster'
  | 'messageWave'
  | 'homeOrbit'
  | 'livePulse'
  | 'opsConsole'
  | SpaceModuleKpiGlyphKind;

export function OrbitRing({ accent, size }: { accent: string; size: number }) {
  return (
    <>
      <View
        style={[
          glyphStyles.orbit,
          {
            width: size * 0.82,
            height: size * 0.28,
            borderColor: withAlpha(accent, 0.85),
          },
        ]}
      />
      <View
        style={[
          glyphStyles.orbit,
          {
            width: size * 0.62,
            height: size * 0.22,
            transform: [{ rotate: '58deg' }],
            borderColor: withAlpha(accent, 0.65),
          },
        ]}
      />
      <View style={[glyphStyles.coreDot, { backgroundColor: accent }]} />
    </>
  );
}

export function OfficeTower({ accent }: { accent: string }) {
  return (
    <View style={glyphStyles.towerWrap}>
      <View style={[glyphStyles.towerBlock, { borderColor: withAlpha(accent, 0.85) }]}>
        <View style={glyphStyles.towerWinRow}>
          <View style={[glyphStyles.towerWin, { backgroundColor: accent }]} />
          <View style={[glyphStyles.towerWin, { backgroundColor: withAlpha(accent, 0.55) }]} />
        </View>
        <View style={glyphStyles.towerWinRow}>
          <View style={[glyphStyles.towerWin, { backgroundColor: withAlpha(accent, 0.75) }]} />
          <View style={[glyphStyles.towerWin, { backgroundColor: accent }]} />
        </View>
        <View style={[glyphStyles.towerDoor, { backgroundColor: withAlpha(accent, 0.9) }]} />
      </View>
      <View style={[glyphStyles.towerBase, { backgroundColor: withAlpha(accent, 0.45) }]} />
    </View>
  );
}

export function CarePulse({ accent, minimal = false }: { accent: string; minimal?: boolean }) {
  return (
    <View style={glyphStyles.pulseWrap}>
      {!minimal ? (
        <View style={[glyphStyles.pulseRing, { borderColor: withAlpha(accent, 0.7) }]} />
      ) : null}
      <View style={[glyphStyles.heartLeft, { backgroundColor: accent }]} />
      <View style={[glyphStyles.heartRight, { backgroundColor: accent }]} />
    </View>
  );
}

export function MedicalCross({ accent, minimal = false }: { accent: string; minimal?: boolean }) {
  return (
    <View style={glyphStyles.crossWrap}>
      {!minimal ? (
        <View style={[glyphStyles.crossGlow, { backgroundColor: withAlpha(accent, 0.25) }]} />
      ) : null}
      <View style={[glyphStyles.crossV, { backgroundColor: accent }]} />
      <View style={[glyphStyles.crossH, { backgroundColor: withAlpha(accent, 0.85) }]} />
    </View>
  );
}

export function WardBed({ accent }: { accent: string }) {
  return (
    <View style={glyphStyles.bedWrap}>
      <View style={[glyphStyles.bedBase, { backgroundColor: withAlpha(accent, 0.5) }]} />
      <View style={[glyphStyles.bedMattress, { backgroundColor: withAlpha(accent, 0.85) }]} />
      <View style={[glyphStyles.bedPillow, { backgroundColor: withAlpha('#FFFFFF', 0.9) }]} />
    </View>
  );
}

export function HoloWave({ accent }: { accent: string }) {
  return (
    <View style={glyphStyles.waveWrap}>
      <View style={[glyphStyles.wave, { borderColor: withAlpha(accent, 0.8) }]} />
      <View style={[glyphStyles.wave, glyphStyles.waveMid, { borderColor: withAlpha(accent, 0.55) }]} />
      <View style={[glyphStyles.waveDot, { backgroundColor: accent }]} />
    </View>
  );
}

export function ScholarCap({ accent }: { accent: string }) {
  return (
    <View style={glyphStyles.capWrap}>
      <View style={[glyphStyles.capTop, { backgroundColor: withAlpha(accent, 0.9) }]} />
      <View style={[glyphStyles.capBase, { backgroundColor: withAlpha(accent, 0.65) }]} />
      <View style={[glyphStyles.capTassel, { backgroundColor: '#FDE68A' }]} />
    </View>
  );
}

export function CoreGear({ accent }: { accent: string }) {
  return (
    <View style={[glyphStyles.gearOuter, { borderColor: withAlpha(accent, 0.85) }]}>
      <View style={[glyphStyles.gearInner, { borderColor: withAlpha(accent, 0.55) }]} />
      <View style={[glyphStyles.gearSpoke, glyphStyles.gearSpokeH, { backgroundColor: accent }]} />
      <View style={[glyphStyles.gearSpoke, glyphStyles.gearSpokeV, { backgroundColor: accent }]} />
    </View>
  );
}

export function PeopleCluster({ accent }: { accent: string }) {
  return (
    <View style={glyphStyles.peopleWrap}>
      <View style={[glyphStyles.personHead, { backgroundColor: accent, left: 4 }]} />
      <View style={[glyphStyles.personHead, { backgroundColor: withAlpha(accent, 0.75), right: 4 }]} />
      <View style={[glyphStyles.personBody, { backgroundColor: withAlpha(accent, 0.55) }]} />
    </View>
  );
}

export function InvoiceStack({ accent }: { accent: string }) {
  return (
    <View style={glyphStyles.docWrap}>
      <View style={[glyphStyles.docBack, { borderColor: withAlpha(accent, 0.45) }]} />
      <View style={[glyphStyles.docFront, { backgroundColor: withAlpha(accent, 0.85) }]} />
      <View style={[glyphStyles.docLine, { backgroundColor: withAlpha('#FFFFFF', 0.75) }]} />
    </View>
  );
}

export function CalendarOrb({ accent }: { accent: string }) {
  return (
    <View style={[glyphStyles.calShell, { borderColor: withAlpha(accent, 0.8) }]}>
      <View style={[glyphStyles.calHeader, { backgroundColor: accent }]} />
      <View style={[glyphStyles.calDot, { backgroundColor: withAlpha('#FFFFFF', 0.9) }]} />
    </View>
  );
}

export function DocumentBeam({ accent }: { accent: string }) {
  return (
    <View style={glyphStyles.beamWrap}>
      <View style={[glyphStyles.beamPage, { backgroundColor: withAlpha(accent, 0.75) }]} />
      <View style={[glyphStyles.beamRay, { backgroundColor: withAlpha(accent, 0.35) }]} />
    </View>
  );
}

export function ModuleCrystal({ accent }: { accent: string }) {
  return (
    <View style={glyphStyles.crystalWrap}>
      <View style={[glyphStyles.crystalTop, { borderBottomColor: withAlpha(accent, 0.9) }]} />
      <View style={[glyphStyles.crystalBase, { backgroundColor: withAlpha(accent, 0.55) }]} />
    </View>
  );
}

export function ChecklistPulse({ accent }: { accent: string }) {
  return (
    <View style={glyphStyles.listWrap}>
      <View style={[glyphStyles.listLine, { backgroundColor: withAlpha(accent, 0.65) }]} />
      <View style={[glyphStyles.listLine, { backgroundColor: withAlpha(accent, 0.45), width: 14 }]} />
      <View style={[glyphStyles.listCheck, { borderColor: accent }]} />
    </View>
  );
}

export function SpaceGlyph({
  kind,
  accent,
  size,
  minimal = false,
}: {
  kind: SpaceGlyphKind;
  accent: string;
  size: number;
  /** Rail: kein Nebula/Ring-Dekor — nur Icon auf Hintergrund. */
  minimal?: boolean;
}) {
  switch (kind) {
    case 'orbit':
      return <OrbitRing accent={accent} size={size} />;
    case 'office':
      return <OfficeTower accent={accent} />;
    case 'care':
      return <CarePulse accent={accent} minimal={minimal} />;
    case 'medical':
      return <MedicalCross accent={accent} minimal={minimal} />;
    case 'ward':
      return <WardBed accent={accent} />;
    case 'holoWave':
      return <HoloWave accent={accent} />;
    case 'scholar':
      return <ScholarCap accent={accent} />;
    case 'addClient':
      return <AddClientGlyph accent={accent} />;
    case 'invoice':
      return <InvoiceStack accent={accent} />;
    case 'calendar':
      return <CalendarOrb accent={accent} />;
    case 'uploadFolder':
      return <UploadFolderGlyph accent={accent} />;
    case 'teamGroup':
      return <TeamGroupGlyph accent={accent} />;
    case 'teamRoles':
      return <TeamRolesGlyph accent={accent} />;
    case 'personSingle':
      return <PersonSingleGlyph accent={accent} />;
    case 'kpiChart':
      return <KpiChartGlyph accent={accent} />;
    case 'trendChart':
      return <TrendChartGlyph accent={accent} />;
    case 'taskCheck':
      return <TaskCheckGlyph accent={accent} />;
    case 'qmShield':
      return <QmShieldGlyph accent={accent} />;
    case 'pluginCrystal':
      return <PluginCrystalGlyph accent={accent} />;
    case 'connectPlug':
      return <ConnectPlugGlyph accent={accent} />;
    case 'subscriptionCard':
      return <SubscriptionCardGlyph accent={accent} />;
    case 'auditTrail':
      return <AuditTrailGlyph accent={accent} />;
    case 'radarPing':
      return <RadarPingGlyph accent={accent} />;
    case 'insightScope':
      return <InsightScopeGlyph accent={accent} />;
    case 'bell':
      return <BellGlyph accent={accent} />;
    case 'mandant':
      return <MandantGlyph accent={accent} />;
    case 'helpOrb':
      return <HelpOrbGlyph accent={accent} />;
    case 'lockShield':
      return <LockShieldGlyph accent={accent} />;
    case 'dataRights':
      return <DataRightsGlyph accent={accent} />;
    case 'infoBeacon':
      return <InfoBeaconGlyph accent={accent} />;
    case 'employeeBadge':
      return <EmployeeBadgeGlyph accent={accent} />;
    case 'assignmentRoute':
      return <AssignmentRouteGlyph accent={accent} />;
    case 'taskTick':
      return <TaskTickGlyph accent={accent} />;
    case 'modulesActive':
      return <ModulesActiveGlyph accent={accent} />;
    case 'portalGlobe':
      return <PortalGlobeGlyph accent={accent} />;
    case 'docsReview':
      return <DocsReviewGlyph accent={accent} />;
    case 'portalInbox':
      return <PortalInboxGlyph accent={accent} />;
    case 'serviceRecord':
      return <ServiceRecordGlyph accent={accent} />;
    case 'budgetWarn':
      return <BudgetWarnGlyph accent={accent} />;
    case 'weekPlanner':
      return <WeekPlannerGlyph accent={accent} />;
    case 'sparkleNew':
      return <SparkleNewGlyph accent={accent} />;
    case 'clientsRoster':
      return <ClientsRosterGlyph accent={accent} />;
    case 'messageWave':
      return <MessageWaveGlyph accent={accent} />;
    case 'homeOrbit':
      return <HomeOrbitGlyph accent={accent} size={size} />;
    case 'livePulse':
      return <LivePulseGlyph accent={accent} />;
    case 'opsConsole':
      return <OpsConsoleGlyph accent={accent} />;
    case 'gear':
      return <CoreGear accent={accent} />;
    default:
      if (isSpaceModuleKpiGlyphKind(kind)) {
        return <SpaceModuleKpiGlyph kind={kind} accent={accent} />;
      }
      return <CoreGear accent={accent} />;
  }
}

const glyphStyles = StyleSheet.create({
  orbit: { position: 'absolute', borderWidth: 2, borderRadius: 999 },
  coreDot: { width: 8, height: 8, borderRadius: 4 },
  towerWrap: { alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  towerBlock: {
    width: 22,
    height: 26,
    borderWidth: 2,
    borderRadius: 3,
    alignItems: 'center',
    paddingTop: 3,
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  towerWinRow: { flexDirection: 'row', gap: 4 },
  towerWin: { width: 5, height: 5, borderRadius: 1 },
  towerDoor: { width: 7, height: 5, borderTopLeftRadius: 2, borderTopRightRadius: 2, marginTop: 1 },
  towerTop: { width: 14, height: 8, borderRadius: 2, marginBottom: 1 },
  towerMid: { width: 18, height: 9, borderRadius: 2, marginBottom: 1 },
  towerBase: { width: 26, height: 3, borderRadius: 1, marginTop: 2 },
  pulseWrap: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 34, height: 34, borderRadius: 17, borderWidth: 1 },
  heartLeft: {
    position: 'absolute',
    width: 10,
    height: 14,
    borderRadius: 6,
    transform: [{ rotate: '-32deg' }],
    left: 9,
    top: 10,
  },
  heartRight: {
    position: 'absolute',
    width: 10,
    height: 14,
    borderRadius: 6,
    transform: [{ rotate: '32deg' }],
    right: 9,
    top: 10,
  },
  crossWrap: { alignItems: 'center', justifyContent: 'center' },
  crossV: { width: 6, height: 22, borderRadius: 3 },
  crossH: { position: 'absolute', width: 22, height: 6, borderRadius: 3 },
  crossGlow: { position: 'absolute', width: 28, height: 28, borderRadius: 14 },
  bedWrap: { alignItems: 'center', justifyContent: 'center' },
  bedBase: { width: 28, height: 6, borderRadius: 2, marginTop: 14 },
  bedMattress: { position: 'absolute', width: 24, height: 10, borderRadius: 3, top: 10 },
  bedPillow: { position: 'absolute', width: 8, height: 5, borderRadius: 2, top: 8, left: 6 },
  waveWrap: { alignItems: 'center', justifyContent: 'center' },
  wave: {
    width: 22,
    height: 12,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 2,
    borderBottomWidth: 0,
  },
  waveMid: { marginTop: -6, opacity: 0.75, transform: [{ scale: 0.82 }] },
  waveDot: { position: 'absolute', bottom: 8, right: 8, width: 5, height: 5, borderRadius: 3 },
  capWrap: { alignItems: 'center' },
  capTop: { width: 26, height: 8, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  capBase: { width: 30, height: 10, borderRadius: 3, marginTop: 1 },
  capTassel: { position: 'absolute', top: 16, right: 7, width: 3, height: 10, borderRadius: 2 },
  gearOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearInner: { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  gearSpoke: { position: 'absolute', width: 2, height: 12, borderRadius: 1 },
  gearSpokeH: { transform: [{ rotate: '0deg' }] },
  gearSpokeV: { transform: [{ rotate: '90deg' }] },
  peopleWrap: { width: 30, height: 26, alignItems: 'center', justifyContent: 'flex-end' },
  personHead: { position: 'absolute', top: 2, width: 10, height: 10, borderRadius: 5 },
  personBody: { width: 22, height: 10, borderRadius: 5, marginTop: 14 },
  docWrap: { alignItems: 'center', justifyContent: 'center' },
  docBack: {
    position: 'absolute',
    width: 18,
    height: 22,
    borderRadius: 3,
    borderWidth: 1,
    transform: [{ rotate: '-8deg' }],
    top: 6,
    left: 8,
  },
  docFront: { width: 18, height: 22, borderRadius: 3 },
  docLine: { position: 'absolute', width: 10, height: 2, borderRadius: 1, top: 16 },
  calShell: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, overflow: 'hidden' },
  calHeader: { height: 7, width: '100%' },
  calDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5, alignSelf: 'center' },
  beamWrap: { alignItems: 'center', justifyContent: 'center' },
  beamPage: { width: 16, height: 22, borderRadius: 3 },
  beamRay: { position: 'absolute', width: 10, height: 18, borderRadius: 8, right: 4, top: 8 },
  crystalWrap: { alignItems: 'center' },
  crystalTop: {
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderBottomWidth: 16,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  crystalBase: { width: 18, height: 6, borderRadius: 2, marginTop: -1 },
  listWrap: { gap: 4, alignItems: 'flex-start', paddingLeft: 4 },
  listLine: { width: 18, height: 3, borderRadius: 2 },
  listCheck: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
});
