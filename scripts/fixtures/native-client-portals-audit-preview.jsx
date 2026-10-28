// Actual Android route modules, not copies of their card markup.
// The shared runner supplies the real client ancestor shell and inert identity/transport.
import React from 'react';
import Home from '../../app/portal/client/(tabs)/index';
import Appointments from '../../app/portal/client/(tabs)/appointments';
import Documents from '../../app/portal/client/(tabs)/documents';
import Profile from '../../app/portal/client/(tabs)/profile';
import AppointmentDetail from '../../app/portal/client/appointments/[id]/index';
import DocumentDetail from '../../app/portal/client/documents/[id]/index.native';
import Signatures from '../../app/portal/client/documents/signatures/index.native';
import SignatureDetail from '../../app/portal/client/documents/signatures/[id].native';
import Proofs from '../../app/portal/client/proofs/index';
import Budget from '../../app/portal/client/budget/index.native';
import Live from '../../app/portal/client/live';
import Announcements from '../../app/portal/client/announcements/index';
import Help from '../../app/portal/client/help/index';
import Messages from '../../app/portal/client/messages/index';
import Thread from '../../app/portal/client/messages/[threadId]';

export const clientPortalAuditRoutes = {
  'client-audit-home': ['/portal/client', Home],
  'client-audit-request': ['/portal/client?action=zusatztermin', Home],
  'client-audit-upload': ['/portal/client?action=upload', Home],
  'client-audit-requests': ['/portal/client?modal=anfragen', Home],
  'client-audit-activities': ['/portal/client?modal=aktivitaeten', Home],
  'client-audit-care-team': ['/portal/client?module=assist&section=betreuung', Home],
  'client-audit-companionship': ['/portal/client?module=assist&section=begleitungen', Home],
  'client-audit-appointments': ['/portal/client/appointments', Appointments],
  'client-audit-appointment-detail': ['/portal/client/appointments/visual-visit', AppointmentDetail],
  'client-audit-documents': ['/portal/client/documents', Documents],
  'client-audit-document-detail': ['/portal/client/documents/visual-document', DocumentDetail],
  'client-audit-signatures': ['/portal/client/documents/signatures', Signatures],
  'client-audit-signature-detail': ['/portal/client/documents/signatures/visual-signature', SignatureDetail],
  'client-audit-profile': ['/portal/client/profile', Profile],
  'client-audit-proofs': ['/portal/client/proofs', Proofs],
  'client-audit-budget': ['/portal/client/budget', Budget],
  'client-audit-live': ['/portal/client/live', Live],
  'client-audit-announcements': ['/portal/client/announcements', Announcements],
  'client-audit-help': ['/portal/client/help', Help],
  'client-audit-messages': ['/portal/client/messages', Messages],
  'client-audit-compose': ['/portal/client/messages?compose=1', Messages],
  'client-audit-thread': ['/portal/client/messages/visual-thread', Thread],
};

export function ClientPortalAuditPreview({ screen }) {
  const Route = clientPortalAuditRoutes[screen]?.[1];
  if (!Route) throw new Error(`Unknown client portal audit case: ${screen}`);
  return <Route />;
}
