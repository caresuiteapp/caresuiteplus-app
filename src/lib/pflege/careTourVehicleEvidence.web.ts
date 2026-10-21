export type CareTourVehicleEvidence = Readonly<{
  plannedVehicleLabel: 'provided';
  assignedEmployeeIdentity: 'provided';
  nativeVehicleReference: 'schema_only_unbound';
  driverQualification: 'not_provided';
  vehicleSuitabilityAndAvailability: 'not_provided';
  odometerStartAndEnd: 'not_provided';
  tripPurpose: 'not_provided';
  custodyAndHandover: 'not_provided';
  immutableTripHistory: 'not_provided';
  plannedLabelMayStandForCompletedTrip: false;
  employeeAssignmentMayStandForDriverQualification: false;
  missingEvidence: readonly string[];
}>;

const MISSING_EVIDENCE = Object.freeze([
  'native Fahrzeugidentität mit Eignung, Verfügbarkeit und atomarer Zuordnung',
  'berechtigte Fahreridentität getrennt von der Pflegekraftzuordnung',
  'Kilometerbeginn, Kilometerende und Fahrtzweck mit Widerspruchsprüfung',
  'Übergabe, Rückgabe und unveränderliche Fahrt- und Ereignishistorie',
]);

const EVIDENCE: CareTourVehicleEvidence = Object.freeze({
  plannedVehicleLabel: 'provided',
  assignedEmployeeIdentity: 'provided',
  nativeVehicleReference: 'schema_only_unbound',
  driverQualification: 'not_provided',
  vehicleSuitabilityAndAvailability: 'not_provided',
  odometerStartAndEnd: 'not_provided',
  tripPurpose: 'not_provided',
  custodyAndHandover: 'not_provided',
  immutableTripHistory: 'not_provided',
  plannedLabelMayStandForCompletedTrip: false,
  employeeAssignmentMayStandForDriverQualification: false,
  missingEvidence: MISSING_EVIDENCE,
});

/** Static Web/Desktop boundary between a planning label and actual trip evidence. */
export function getCareTourVehicleEvidence(): CareTourVehicleEvidence {
  return EVIDENCE;
}
