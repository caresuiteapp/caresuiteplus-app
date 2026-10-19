export type CareEmergencyCallServiceEvidence = Readonly<{
  marketplaceCategory: 'provided';
  partnerReferral: 'demo_only';
  ownServiceOrder: 'not_provided';
  clientContractVersion: 'not_provided';
  deviceAssignment: 'not_provided';
  contactChain: 'not_provided';
  alarmEventLedger: 'not_provided';
  alarmAcceptance: 'not_provided';
  escalationAndFeedback: 'not_provided';
  referralMayStandForActiveContract: false;
  partnerCategoryMayStandForHandledAlarm: false;
  missingEvidence: readonly string[];
}>;

const MISSING_EVIDENCE = Object.freeze([
  'eigener versionierter Auftrag oder Vertrag je Klient:in und Zusatzleistung',
  'native Geräteidentität, Installation, Zuordnung, Funktionsprüfung und Rückgabe',
  'versionierte Kontakt- und Eskalationskette mit erreichbaren Verantwortlichen',
  'unveränderlicher Alarmverlauf mit Eingang, Annahme, Eskalation und Rückmeldung',
]);

const EVIDENCE: CareEmergencyCallServiceEvidence = Object.freeze({
  marketplaceCategory: 'provided',
  partnerReferral: 'demo_only',
  ownServiceOrder: 'not_provided',
  clientContractVersion: 'not_provided',
  deviceAssignment: 'not_provided',
  contactChain: 'not_provided',
  alarmEventLedger: 'not_provided',
  alarmAcceptance: 'not_provided',
  escalationAndFeedback: 'not_provided',
  referralMayStandForActiveContract: false,
  partnerCategoryMayStandForHandledAlarm: false,
  missingEvidence: MISSING_EVIDENCE,
});

/** Static Web/Desktop boundary between a partner inquiry and an active emergency-call service. */
export function getCareEmergencyCallServiceEvidence(): CareEmergencyCallServiceEvidence {
  return EVIDENCE;
}
