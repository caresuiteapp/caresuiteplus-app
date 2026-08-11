import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function read(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

describe('Klientenportal deutsche Statusanzeigen', () => {
  it('shows an explicit German state next to every portal switch', () => {
    const panel = read('src/components/office/ClientPortalCorePanel.tsx');

    expect(panel).toContain("settings.portalEnabled ? 'Aktiv' : 'Inaktiv'");
    expect(panel).toContain("settings[key] ? 'Sichtbar' : 'Ausgeblendet'");
    expect(panel).toContain('trackColor={SWITCH_TRACK_COLORS}');
    expect(panel).toContain('accessibilityState={{ checked: settings.portalEnabled');
  });

  it('translates technical portal sync values and document states', () => {
    const sync = read('src/components/office/PortalSyncChainPanel.tsx');
    const proofLabels = read('src/lib/assist/assistProofLabels.ts');

    expect(sync).toContain("pending: 'Ausstehend'");
    expect(sync).toContain('ASSIST_PROOF_PORTAL_RELEASE_LABELS');
    expect(sync).toContain("return PORTAL_SYNC_STATUS_LABELS[value] ?? 'Unbekannter Status'");
    expect(proofLabels).toContain("released: 'Im Klientenportal'");
    expect(proofLabels).toContain("pending_client_signature: 'Portal — Unterschrift ausstehend'");
    expect(sync).toContain("label={sync.pdfAvailable ? 'PDF vorhanden' : 'PDF fehlt'}");
    expect(sync).toContain("'Unterschrift vollständig' : 'Unterschrift fehlt'");
  });

  it('does not use the technical module assignment workflow as client care status', () => {
    const workspace = read('src/liquid-command/screens/AssistClientsWorkspace.tsx');

    expect(workspace).toContain('resolveClientCareStatus(context)');
    expect(workspace).toContain("return { label: 'Aktiv', tone: 'success' }");
    expect(workspace).toContain("label: 'Planung offen'");
    expect(workspace).toContain("label: 'Klärungsbedarf'");
    expect(workspace).not.toContain('label={normalizeStatus(assignment.status)}');
  });

  it('normalizes English assignment values instead of collapsing them to in progress', () => {
    const mapper = read('src/lib/officeCore/moduleAssignmentMapper.ts');

    expect(mapper).toContain("active: 'aktiv'");
    expect(mapper).toContain("completed: 'abgeschlossen'");
    expect(mapper).toContain("archived: 'archiviert'");
  });
});
