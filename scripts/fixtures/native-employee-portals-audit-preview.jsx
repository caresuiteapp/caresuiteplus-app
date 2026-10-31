// Actual Android route modules. The runner supplies the real ancestor shell;
// transport/identity fixtures are separate and never prove live persistence.
import React from 'react';
import Home from '../../app/portal/employee/(tabs)/index';
import Assignments from '../../app/portal/employee/(tabs)/assignments';
import Calendar from '../../app/portal/employee/(tabs)/calendar';
import Documents from '../../app/portal/employee/(tabs)/documents';
import Profile from '../../app/portal/employee/(tabs)/profile';
import AssignmentDetail from '../../app/portal/employee/assignments/[id]/index';
import AssignmentExecute from '../../app/portal/employee/assignments/[id]/execute.native';
import OpenAssignments from '../../app/portal/employee/offene-einsaetze';
import Clients from '../../app/portal/employee/clients/index';
import ClientDetail from '../../app/portal/employee/clients/[id]';
import DocumentDetail from '../../app/portal/employee/documents/[id]/index';
import Signatures from '../../app/portal/employee/documents/signatures/index';
import SignatureRequest from '../../app/portal/employee/documents/signatures/[id].native';
import PersonalSignature from '../../app/portal/employee/signatures/[id]/index';
import TimeClock from '../../app/portal/employee/arbeitszeit/index';
import Times from '../../app/portal/employee/times/index';
import Leave from '../../app/portal/employee/arbeitszeit/urlaub/index';
import Absence from '../../app/portal/employee/arbeitszeit/abwesenheiten/index';
import Logbook from '../../app/portal/employee/fahrtenbuch/index';
import Payroll from '../../app/portal/employee/payroll/index';
import Uploads from '../../app/portal/employee/uploads/index.native';
import Messages from '../../app/portal/employee/messages/index';
import Thread from '../../app/portal/employee/messages/[threadId]';
import Announcements from '../../app/portal/employee/announcements/index';
import Mobility from '../../app/portal/employee/mobilitaet/index';
import Help from '../../app/portal/employee/help/index';
import Tasks from '../../app/portal/employee/tasks/index.native';
import Academy from '../../app/portal/employee/akademie/index.native';
import Consultation from '../../app/portal/employee/beratung/index.native';
import ConsultationDetail from '../../app/portal/employee/beratung/[id].native';
import ExecutionHub from '../../app/portal/employee/execution/index';
import ScheduleAlias from '../../app/portal/employee/(tabs)/schedule';
import SignaturesAlias from '../../app/portal/employee/signatures/index';

export const employeePortalAuditRoutes = {
  'employee-audit-home': ['/portal/employee', Home],
  'employee-audit-assignments': ['/portal/employee/assignments', Assignments],
  'employee-audit-assignment-detail': ['/portal/employee/assignments/visual-visit', AssignmentDetail],
  'employee-audit-assignment-execute': ['/portal/employee/assignments/visual-visit/execute', AssignmentExecute],
  'employee-audit-open-assignments': ['/portal/employee/offene-einsaetze', OpenAssignments],
  'employee-audit-calendar': ['/portal/employee/calendar', Calendar],
  'employee-audit-clients': ['/portal/employee/clients', Clients],
  'employee-audit-client-detail': ['/portal/employee/clients/visual-client', ClientDetail],
  'employee-audit-documents': ['/portal/employee/documents', Documents],
  'employee-audit-document-detail': ['/portal/employee/documents/visual-document', DocumentDetail],
  'employee-audit-signatures': ['/portal/employee/documents/signatures', Signatures],
  'employee-audit-signature-request': ['/portal/employee/documents/signatures/visual-request', SignatureRequest],
  'employee-audit-personal-signature': ['/portal/employee/signatures/visual-personal-document', PersonalSignature],
  'employee-audit-profile': ['/portal/employee/profile', Profile],
  'employee-audit-time-clock': ['/portal/employee/arbeitszeit', TimeClock],
  'employee-audit-times': ['/portal/employee/times', Times],
  'employee-audit-leave': ['/portal/employee/arbeitszeit/urlaub', Leave],
  'employee-audit-absence': ['/portal/employee/arbeitszeit/abwesenheiten', Absence],
  'employee-audit-logbook': ['/portal/employee/fahrtenbuch', Logbook],
  'employee-audit-payroll': ['/portal/employee/payroll', Payroll],
  'employee-audit-uploads': ['/portal/employee/uploads', Uploads],
  'employee-audit-messages': ['/portal/employee/messages', Messages],
  'employee-audit-compose': ['/portal/employee/messages?compose=1', Messages],
  'employee-audit-thread': ['/portal/employee/messages/visual-thread', Thread],
  'employee-audit-announcements': ['/portal/employee/announcements', Announcements],
  'employee-audit-mobility': ['/portal/employee/mobilitaet', Mobility],
  'employee-audit-help': ['/portal/employee/help', Help],
  'employee-audit-tasks': ['/portal/employee/tasks', Tasks],
  'employee-audit-academy': ['/portal/employee/akademie', Academy],
  'employee-audit-consultation': ['/portal/employee/beratung', Consultation],
  'employee-audit-consultation-detail': ['/portal/employee/beratung/visual-case', ConsultationDetail],
  'employee-audit-execution-hub': ['/portal/employee/execution', ExecutionHub],
  'employee-audit-schedule-alias': ['/portal/employee/schedule', ScheduleAlias],
  'employee-audit-signatures-alias': ['/portal/employee/signatures', SignaturesAlias],
};

export const employeePortalAuditInteractions = {
  'employee-audit-logbook': { tabs: ['Übersicht', 'Aufzeichnen', 'Meine Fahrten', 'Belege', 'Führerschein'], nativeBoundaries: ['location permission', 'foreground/background GPS', 'document picker', 'native signature', 'map URL'] },
  'employee-audit-profile': { tabs: ['Übersicht', 'Stammdaten', 'Kontakt', 'Anstellung', 'Vergütung & Bank', 'Steuer & SV', 'Mehrfachbeschäftigung', 'Rollen & Rechte', 'Qualifikationen', 'Dokumente', 'Portal', 'Einsatzfähigkeit', 'Arbeitsmaterial', 'Verlauf'], nativeBoundaries: ['biometry', 'push/device permission'] },
  'employee-audit-uploads': { contexts: ['mitarbeiter', 'klient'], nativeBoundaries: ['camera', 'photo/video library', 'document picker', 'exact bytes', 'settings handoff'] },
  'employee-audit-assignment-execute': { nativeBoundaries: ['travel/arrival/start/pause/end', 'task receipts', 'documentation', 'signature', 'proof PDF', 'photo/voice', 'return trip', 'offline/unsaved navigation'] },
  'employee-audit-payroll': { nativeBoundaries: ['month selection', 'statement PDF', 'confirm/reject', 'receipt/mileage expense', 'picker rejection', 'persisted receipt vs failed reread'] },
};

export function EmployeePortalAuditPreview({ caseId, screen }) {
  const selected = caseId ?? screen;
  const Route = employeePortalAuditRoutes[selected]?.[1];
  if (!Route) throw new Error(`Unknown employee portal audit case: ${selected}`);
  return <Route />;
}
