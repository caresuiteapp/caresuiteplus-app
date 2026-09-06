import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('Mitarbeitendenportal Einsatz-Tagesworkflow R14', () => {
  it('macht Aufgaben optional und hält Doku sowie Unterschrift verpflichtend', () => {
    const finalize = read('src/features/assistWorkflow/finalizeVisit.ts');
    const deferred = read('src/features/assistWorkflow/finalizeVisitWithDeferredClientSignature.ts');
    const completion = read('src/components/portal/EmployeePortalVisitCompletionPanel.tsx');

    expect(finalize).not.toContain('Pflichtaufgabe(n) noch offen');
    expect(deferred).not.toContain('Pflichtaufgabe(n) noch offen');
    expect(finalize).toContain('isRequired: false');
    expect(completion).toContain('Aufgaben optional');
    expect(completion).toContain('Dokumentation gespeichert');
    expect(completion).toContain('Unterschrift erfasst');
  });

  it('sendet eine nicht vor Ort mögliche Signatur direkt ins Klient:innenportal', () => {
    const source = read('src/features/assistWorkflow/finalizeVisitWithDeferredClientSignature.ts');
    expect(source).toContain('releaseDeferredClientSignatureRequest');
    expect(source).toContain("signatureStatus: 'deferred_to_client_portal'");
    expect(source).toContain('signatureDeferredToClientPortal: true');
    expect(source).toContain("transitionAssistExecutionStatus(ctx, 'abgeschlossen'");
    expect(source).toContain('sentDirectlyToClientPortal: true');
    expect(source).not.toContain('requestDeferredSignatureAdministrativeApproval');
  });

  it('fordert vor der Anfahrt eine eindeutige Mobilitätsauswahl an', () => {
    const screen = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    const picker = read('src/components/portal/EmployeePortalMobilityPicker.tsx');
    expect(screen).toContain("if (!mobilityMode)");
    expect(screen).toContain('<EmployeePortalMobilityPicker');
    for (const mode of ['car', 'transit', 'bicycle', 'escooter', 'walking']) {
      expect(picker).toContain(`${mode}:`);
    }
  });

  it('aktiviert das Fahrtenbuch ausschließlich für die aktuelle PKW-Auswahl', () => {
    const screen = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    const automation = read('src/lib/employeeLogbook/employeeLogbookAutomation.ts');
    const selection = read('src/lib/portal/employeePortalMobilitySelection.ts');
    const eligibilityContract = automation.slice(
      automation.indexOf('export type EmployeeLogbookEligibility'),
      automation.indexOf('export type AutomaticLogbookResult'),
    );
    const automaticResultContract = automation.slice(
      automation.indexOf('export type AutomaticLogbookResult'),
      automation.indexOf('export type EmployeeGpsWatchHandle'),
    );
    expect(screen).toContain("mobilityMode === 'car'");
    expect(automation).toContain("input.transportMode !== 'car'");
    expect(selection).toContain("return mode === 'car'");
    expect(eligibilityContract).not.toContain('non_car_selected');
    expect(automaticResultContract).toContain("| 'non_car_selected'");
    expect(automaticResultContract).toContain('hasCarMode: boolean');
    expect(automaticResultContract).toContain('vehicleId: string | null');
    expect(automation).toMatch(/selectedTransportMode\s*\? selectedTransportMode === 'car'/);
  });

  it('berechnet Dokumentations- und Signaturstatus vor dem Rückfahrt-Effekt', () => {
    const screen = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    expect(screen.indexOf('const documentationSubmitted =')).toBeLessThan(
      screen.indexOf('const travelClosureReady ='),
    );
    expect(screen.indexOf('const signatureDeferred =')).toBeLessThan(
      screen.indexOf('const travelClosureReady ='),
    );
  });

  it('unterstützt mehrere Ziele und Folgefahrten im Einsatzfahrtenbuch', () => {
    const logbook = read('src/components/portal/EmployeePortalVisitLogbookCard.tsx');
    expect(logbook).toContain("setKind('with_client')");
    expect(logbook).toContain("setKind('client_errand')");
    expect(logbook).toContain('Jede Fahrt einzeln beenden');
    expect(logbook).toContain('Kilometer bestätigen');
    expect(read('src/components/portal/EmployeePortalVisitSummaryPanel.tsx')).toContain('Nächsten Einsatz auswählen');
    expect(read('src/components/portal/EmployeePortalVisitSummaryPanel.tsx')).toContain('Einsatztag beenden · Heim-/Bürofahrt');
  });

  it('zeigt den GPS-Tagesstatus einmal und einen kompakten Hilfeknopf', () => {
    const header = read('src/components/portal/EmployeePortalVisitStickyHeader.tsx');
    expect(header).toContain('GPS · TAG AKTIV');
    expect(header).toContain('employee-visit-guide-toggle');
    expect(header).toContain('visible={helpOpen}');
  });

  it('bietet Medien jederzeit prominent im Einsatzkopf an', () => {
    const header = read('src/components/portal/EmployeePortalVisitStickyHeader.tsx');
    const screen = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    expect(header).toContain('employee-visit-media-always-available');
    expect(screen).toContain('onOpenMedia={() => setPhotoModalOpen(true)}');
  });

  it('behält Web-Medien nach Uploadfehlern für einen echten Wiederholungsversuch', () => {
    const picker = read('src/lib/portal/employeePortalMediaPicker.ts');
    const modal = read('src/components/portal/EmployeePortalVisitPhotoModal.tsx');
    const readFunction = picker.slice(
      picker.indexOf('export async function readEmployeePortalMediaBytes'),
      picker.indexOf('export function releaseEmployeePortalMediaUri'),
    );
    expect(readFunction).not.toContain('revokeObjectURL');
    expect(modal).toContain('includeMediaFallback: true');
    expect(modal).toContain('Speichern erneut versuchen');
  });
});
