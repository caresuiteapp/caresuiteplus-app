import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientLifecycleWorkspaceDefinitions, clientLifecycleWorkspaceReadRights } from '../../src/lib/clients/clientLifecycleWorkspaceDomain.web.ts';

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const sql = read('supabase/patches/ambulatory_client_lifecycle_workspace.sql');
const web = read('src/components/clients/ClientLifecycleWorkspace.web.tsx');
const screen = read('src/screens/pflege/ClientRecordWorkspace365.web.tsx');
const native = read('src/components/clients/ClientLifecycleWorkspace.tsx');

test('Klientenarbeitsplatz verlangt Leserecht und begrenzt jede Vorgangsart auf vorhandene Rechte', () => {
  assert.deepEqual(clientLifecycleWorkspaceReadRights, ['office.clients.view']);
  const allowed = new Set(['office.clients.view', 'office.clients.create', 'office.clients.edit', 'office.clients.status_change', 'office.clients.manage_contacts']);
  for (const definition of Object.values(clientLifecycleWorkspaceDefinitions)) {
    assert.ok(allowed.has(definition.right));
    for (const right of definition.extraRights ?? []) assert.ok(['office.clients.manage_consents', 'office.clients.view_sensitive'].includes(right));
  }
});

test('SQL schützt fallgebundene private Historie, Sitzung, Rechte, CAS und feste Quittung', () => {
  for (const token of ['enable row level security', 'revoke all on all tables', 'before update or delete', 'auth.sessions', 'profile_has',
    'office.clients.create', 'office.clients.status_change', 'office.clients.manage_contacts', 'client_id', 'client_addresses', 'client_contacts',
    'client_documents', 'client_tasks', 'care_assessments', 'for update', 'expectedHeadId', 'web_confirm_client_lifecycle_event']) assert.ok(sql.includes(token), token);
  assert.doesNotMatch(sql, /grant\s+(insert|update|delete)\s+on/i);
});

test('SQL und Domain trennen Anfrage, Identität, Dokument, Aufnahme, Unterbrechung, Rückkehr und Austritt', () => {
  for (const kind of ['inquiry_capture', 'inquiry_decision', 'identity_candidate', 'identity_resolution', 'document_ingest',
    'document_content_confirmation', 'admission_prerequisite_review', 'admission_release_decision', 'interruption_revision', 'return_plan_review', 'exit_revision']) assert.ok(sql.includes(kind), kind);
});

test('Web verbindet aktuelle Auswahl, Entwurf, Rechtewechsel, Neuladen, Fehler, Quittungswiederaufnahme und Berichtigung', () => {
  for (const token of ['saveClientLifecycleDraft', 'hasKindRights', 'assertClientLifecycleSelectionCurrent',
    'Aktuelle vollständige Klientenstammdatenoriginale neu laden', 'Gesicherten Vorgang ausschließlich prüfen',
    'Quittung mit Originalverlauf abgleichen', 'append-only berichtigen']) assert.ok(web.includes(token), token);
  assert.equal((screen.match(/<ClientLifecycleWorkspace clientId=\{detail\.id\} \/>/g) ?? []).length, 1);
});

test('Native bleibt unverändert und Web leitet keine Identität, Diagnose, Vertretung, Aufnahme oder Pflege ab', () => {
  assert.match(native, /return null/);
  assert.match(web, /legt keine Person still zusammen, bestätigt keine Diagnose oder Vertretungsmacht, nimmt niemanden automatisch auf, erbringt keine Pflege/);
});
