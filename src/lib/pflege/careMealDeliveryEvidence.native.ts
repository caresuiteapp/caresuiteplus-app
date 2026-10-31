// Generated native presentation from src/lib/pflege/careMealDeliveryEvidence.web.ts. Update through scripts/port-native-workspaces.mjs.
export type CareMealDeliveryEvidence = Readonly<{
    marketplaceCategory: 'provided';
    partnerReferral: 'demo_only';
    ownMealOrder: 'not_provided';
    dietVersion: 'not_provided';
    plannedDelivery: 'not_provided';
    actualDeliveryEvent: 'not_provided';
    recipientOrHandover: 'not_provided';
    deliveryFailure: 'not_provided';
    mealIntakeMayStandForDelivery: false;
    referralMayStandForDelivery: false;
    missingEvidence: readonly string[];
}>;
const MISSING_EVIDENCE = Object.freeze([
    'eigener versionierter Mahlzeitenauftrag mit Pflegefall, Kostform und Gültigkeit',
    'geplanter Liefertermin mit unveränderlicher Auftrags- und Änderungsfassung',
    'tatsächliche Auslieferung mit Empfänger:in oder dokumentierter Übergabe',
    'begründeter Ausfall, Ersatzhandlung und Rückmeldung als eigener Verlauf',
]);
const EVIDENCE: CareMealDeliveryEvidence = Object.freeze({
    marketplaceCategory: 'provided',
    partnerReferral: 'demo_only',
    ownMealOrder: 'not_provided',
    dietVersion: 'not_provided',
    plannedDelivery: 'not_provided',
    actualDeliveryEvent: 'not_provided',
    recipientOrHandover: 'not_provided',
    deliveryFailure: 'not_provided',
    mealIntakeMayStandForDelivery: false,
    referralMayStandForDelivery: false,
    missingEvidence: MISSING_EVIDENCE,
});
/** Static Web/Desktop boundary between a meal-service inquiry and an actual delivery. */
export function getCareMealDeliveryEvidence(): CareMealDeliveryEvidence {
    return EVIDENCE;
}
