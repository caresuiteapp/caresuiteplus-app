import type { LiquidModule } from './types';

export const liquidModules: LiquidModule[] = [
  { id: 'office', label: 'Office', description: 'Unternehmen, Personal, Abrechnung und Dokumente', priority: '6 offene Freigaben' },
  { id: 'assist', label: 'Assist', description: 'Alltagsbegleitung, Einsätze und Live-Status', priority: '42 aktive Einsätze' },
  { id: 'pflege', label: 'Pflege', description: 'Versorgung, Medikation, SIS und BodyMap', priority: '12 Prüfungen' },
  { id: 'stationaer', label: 'Stationär', description: 'Wohnbereiche, Übergaben und Belegung', priority: '3 Übergaben' },
  { id: 'beratung', label: 'Beratung', description: 'Fälle, Assessments und Empfehlungen', priority: '8 Termine' },
  { id: 'akademie', label: 'Akademie', description: 'Lernpfade, Prüfungen und Zertifikate', priority: '4 Fälligkeiten' },
  { id: 'robotics', label: 'Robotics', description: 'Geräte, Aufgaben und Sicherheitszonen', priority: '1 Wartung' },
  { id: 'platform', label: 'Platform', description: 'Mandanten, Tarife, Releases und Audit', priority: 'System stabil' },
];

