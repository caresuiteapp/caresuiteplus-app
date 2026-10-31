// Generated native presentation from src/lib/pflege/nutritionHistoryPresentation.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { NutritionEliminationEntry } from "./nutritionEliminationPacket.native.ts";
const shown = (value: string | null | undefined) => value === null || value === undefined || value === '' ? 'nicht dokumentiert' : value;
const quantity = (value: string | null, unit: string) => value === null ? 'nicht dokumentiert' : `${value} ${unit === 'none' ? 'Einheit nicht dokumentiert' : unit}`;
const decisions = { not_asked: 'nicht erhoben', consented: 'zugestimmt', refused: 'abgelehnt', withdrawn: 'widerrufen' };
const outcomes = { planned: 'geplant', offered: 'angeboten', performed: 'durchgeführt', partial: 'teilweise durchgeführt', refused: 'abgelehnt', not_performed: 'nicht durchgeführt' };
const assistance = { independent: 'selbstständig', prompting: 'Anleitung', partial_assist: 'Teilhilfe', full_assist: 'Vollhilfe' };
/** Retained original strings only: no inferred measurements, unit conversions or clinical result. */
export function nutritionHistoryFacts(entry: NutritionEliminationEntry): readonly (readonly [
    string,
    string
])[] {
    const facts: [
        string,
        string
    ][] = [['Plantermin', entry.plannedAt], ['Tatsächliches Ereignis', shown(entry.occurredAt)], ['Ergebnis', outcomes[entry.execution.outcome]], ['Personenentscheidung', decisions[entry.decision.state]], ['Entscheidungszeit', shown(entry.decision.recordedAt)], ['Entscheidungsgrund', shown(entry.decision.reason)], ['Beratung', shown(entry.decision.consultation)], ['Hilfeumfang', assistance[entry.assistance.level]], ['Helfer', shown(entry.assistance.helpers.join(', '))], ['Hilfsmittel', shown(entry.assistance.aids.join(', '))], ['Unterstützung', shown(entry.assistance.details)], ['Ausführende Personen', shown(entry.execution.performedBy.join(', '))], ['Tatsächliches Ergebnis', shown(entry.execution.result)], ['Abweichung', shown(entry.execution.deviation)], ['Planbindung', `${entry.planVersionId} · ${entry.measureId} · ${entry.visitId} · ${entry.assessmentId} · ${entry.planSnapshotSha256}`]];
    if (['meal_support', 'drink_protocol'].includes(entry.kind))
        facts.push(['Lebensmittel / Getränk', shown(entry.intake.item)], ['Kostform', shown(entry.intake.dietForm)], ['Angebotene Menge', quantity(entry.intake.offered, entry.intake.unit)], ['Tatsächliche Aufnahme', quantity(entry.intake.actual, entry.intake.unit)], ['Individuelles Ziel', quantity(entry.intake.target, entry.intake.targetUnit)]);
    if (entry.kind === 'swallowing_support')
        facts.push(['Freigegebene Kostform', shown(entry.swallowing.approvedDiet)], ['Anweisung', shown(entry.swallowing.instruction)], ['Schluckabweichung', shown(entry.swallowing.deviation)], ['Eskalation', shown(entry.swallowing.escalation)]);
    if (entry.kind === 'enteral_nutrition')
        facts.push(['Zugang', shown(entry.enteral.deviceId)], ['Ärztliche Grundlage', shown(entry.enteral.prescriptionId)], ['Produkt', shown(entry.enteral.product)], ['Enterale Menge', quantity(entry.enteral.amount, entry.enteral.unit)], ['Laufzeit in Minuten', shown(entry.enteral.durationMinutes)], ['Spülung in ml', shown(entry.enteral.flushMl)], ['Lageprüfung', shown(entry.enteral.positionCheck)], ['Sondenhaut', shown(entry.enteral.skin)], ['Verträglichkeit', shown(entry.enteral.tolerance)]);
    if (['fluid_balance', 'continence_support', 'stool_protocol'].includes(entry.kind))
        facts.push(['Einfuhr', quantity(entry.elimination.input, entry.elimination.unit)], ['Ausfuhr', quantity(entry.elimination.output, entry.elimination.unit)], ['Vollständigkeitsangabe', entry.elimination.complete ? 'als vollständig dokumentiert' : 'unvollständiger Ausschnitt'], ['Kontinenzprofil', shown(entry.elimination.profileId)], ['Toilettenhilfe', shown(entry.elimination.support)], ['Stuhlereignis', shown(entry.elimination.stool)], ['Beobachtung', shown(entry.elimination.observation)]);
    if (['catheter_care', 'stoma_care', 'tube_observation'].includes(entry.kind))
        facts.push(['Geräteidentität', shown(entry.device.deviceId)], ['Wechselgrundlage', shown(entry.device.changeBasisId)], ['Gerätetyp', entry.device.type], ['Materialwechsel', shown(entry.device.materialChange)], ['Hautbeobachtung', shown(entry.device.skin)], ['Gerätelage', shown(entry.device.positionCheck)], ['Ausscheidung', shown(entry.device.output)], ['Komplikation', shown(entry.device.complication)]);
    if (entry.kind === 'tube_observation')
        facts.push(['Sondenumgebung', shown(entry.enteral.skin)], ['Sondenverträglichkeit', shown(entry.enteral.tolerance)]);
    if (['nutrition_assessment', 'weight_followup'].includes(entry.kind))
        facts.push(['Gewicht', quantity(entry.weight.value, entry.weight.unit)], ['Originalmessung', shown(entry.weight.measurementId)], ['Instrumentenfassung', shown(entry.weight.instrumentVersion)], ['Messbedingungen', shown(entry.weight.conditions)], ['Fachliche Bewertung', shown(entry.weight.professionalAssessment)], ['Reaktion', shown(entry.weight.reaction)], ['Rückkontrolle', shown(entry.weight.reviewAt)]);
    facts.push(['Folgeauftrag', entry.followUp.required ? (entry.followUp.state === 'closed' ? 'historisch abgeschlossen' : 'offen') : 'nicht erforderlich'], ['Folgeanlass', shown(entry.followUp.reason)], ['Verantwortung', shown(entry.followUp.responsibleProfileId)], ['Frist', shown(entry.followUp.dueAt)], ['Auftragsoriginal', shown(entry.followUp.taskId)], ['Abschlussbeleg', shown(entry.followUp.closureEvidence)], ['Vorgangsstatus', entry.lifecycle === 'completed' ? 'historisch abgeschlossen' : 'offen']);
    return facts;
}
