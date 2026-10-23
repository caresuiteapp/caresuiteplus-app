import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { validateCatalogue, summarizeCatalogue } from './lib/gkv-approval-catalogue.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const folder = resolve(root, 'docs/gkv/approval');
const read = name => JSON.parse(readFileSync(resolve(folder, name), 'utf8'));
const lock = read('source-lock.json'), register = read('kim-register.json'), plan = read('workplan.json');
const errors = validateCatalogue(lock, register, plan, p => existsSync(resolve(root, p)));
if (errors.length) { for (const e of errors) console.error(e); process.exit(1); }
const summary = summarizeCatalogue(register, plan);
const esc = value => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
const lines = [
  '# Prüfvorbereitung GKV / KIM', '',
  `Stand ${plan.assessedAt}; Codebasis \`${plan.baselineCommit}\`.`, '',
  'Diese Matrix ist eine Arbeitsgrundlage. Sie ist keine Prüfbestätigung, keine Zulassung und keine Freigabe zum Versand. Ein erfolgreicher Katalogcheck bestätigt nur die Konsistenz dieser Dateien.', '',
  `Erfasst: **${summary.normativeReferences} KIM-Anforderungsverweise**, **${summary.profileScopedIds} Kennungen innerhalb ihrer jeweiligen Steckbriefe**, **${summary.itsgCases} ITSG-Prüffälle** und **${summary.workPackages} Arbeitspakete**. Mehrere Nachweisarten und gleiche IDs in verschiedenen Spezifikationen bleiben getrennt. Keine Fertigstellungsquote.`, '',
  '## Quellen und Abdeckung', '',
  '[Quellen mit Versionsstand und SHA-256](source-lock.json), [vollständiges KIM-Verweisregister](kim-register.json), [Arbeitsplan und ITSG-Fälle](workplan.json). Die Originaltexte bleiben bei den jeweiligen Herausgebern.', '',
  '| Steckbrief | Festgelegte Version | Verweise | Kennungen |', '| --- | --- | ---: | ---: |',
  ...register.profiles.map(p => { const s = lock.sources.find(s => s.id === p.sourceId); return `| ${p.sourceId} | [${s.version}](${s.url}) | ${p.requirements.length} | ${new Set(p.requirements.map(r => r.id)).size} |`; }), '',
  'Die drei Steckbriefe wurden am 22.10.2026 freigegeben. Sie verweisen unter anderem auf FD 1.25.0 und CM 1.24.0. Die 28 Teilbelege im älteren FD-Inventar beziehen sich auf FD 1.24.0. Sie sind nur Kandidaten für einen erneuten Abgleich und erhöhen keinen aktuellen Erfüllungsstatus.', '',
  ...plan.scopeGaps.map(g => `- ${g}`), '',
  'Die Anbieter-Konstellation muss vor Einreichung feststehen. Arbeitsannahme ist Eigenbetrieb mit eigener Kontovergabe. Zwei Tabellenverweise nennen GS-A_4088-01, obwohl diese Kennung in den primären Anforderungstabellen dieses Steckbriefs nicht vorkommt. Die Versionszuordnung bleibt offen; es erfolgt keine automatische Ersetzung oder Ausnahme.', '',
  '## Reihenfolge und Zuständigkeit', '',
  '| Priorität | Arbeitspaket | Stand | Nächster Schritt | Abschlussnachweis |', '| ---: | --- | --- | --- | --- |',
  ...plan.packages.map(p => `| ${p.priority} | **${esc(p.title)}** (${p.id}); ${esc(p.owner)} | ${p.implementation === 'partial' ? 'Bausteine vorhanden; Abnahme offen' : 'Offen'} | ${esc(p.nextStep)} | ${esc(p.acceptance)} |`), '',
  'Priorität 0 legt den Umfang fest. Priorität 1 schließt Fach- und Integrationslücken; Priorität 2 bearbeitet Betriebsfähigkeit und Bedienung. Priorität 3 liefert externe Tests, Priorität 4 die KIM-Zulassungsabschlüsse. Anmeldung und Abstimmung können früher beginnen. Die Abhängigkeiten im JSON beziehen sich auf den Abschluss des Arbeitspakets, nicht auf die erste Kontaktaufnahme.', '',
  '## ITSG-Vorführung', '',
  'Alle 14 Fälle sind einzeln erfasst; keiner ist als bestanden gekennzeichnet. Kandidatencode stammt aus den bestehenden Einsatz-, Portal- und Nachweisabläufen. Ein Test des Rechnungsimports ersetzt keinen ITSG-Prozessnachweis.', '',
  '| Fall | Prüfgegenstand | Arbeitspaket | Ausführung |', '| --- | --- | --- | --- |',
  ...plan.itsgCases.map(c => `| [${c.section}](${lock.sources.find(s => s.id === c.sourceId).url}) | ${c.title} | ${c.packageId} | Offen${c.applicability === 'requires_review' ? '; Anwendbarkeit prüfen' : ''} |`), '',
  'Für die Vorführung werden synthetische Personen und Mitarbeitende, ein Monat mit drei Leistungsarten, ein gemeinsamer Einsatz, Änderungen vor und nach Bestätigung sowie getrennte Rollen verwendet. Pro Fall werden Ausgangsstand, Schritte, Originale/Hashes, tatsächliches Ergebnis, geprüfte Version und Prüfer erfasst. Fehlende Protokolle bleiben offen. Der bestehende Testexport wird dabei nicht an eine Kasse versandt.', '',
  'ITSG prüft den Nachweisprozess. EDIFACT, Versand und die gesamte TI-Anbindung liegen außerhalb dieses Prüfumfangs. Die XML-Fachprüfung und Annahmestellentests bleiben eigenständige Aufgaben.', '',
  '## Nachweisregeln', '',
  '- Codepfade und Testdateien unter `packages[].code/tests` sind Fundstellen. Sie belegen keine Ausführung des amtlichen Prüffalls.',
  '- KIM-Anforderungen erben den Status `unassessed`. Die Zuordnung über `specPackages` bestimmt das Arbeitspaket, nicht die Erfüllung.',
  '- MUSS, SOLL, KANN und DARF NICHT bleiben erhalten. Auch optionale Anforderungen benötigen eine dokumentierte Umfangsentscheidung.',
  '- Lokale Softwaretests, echte Hardware/TI, externe Interoperabilität und Zulassung werden getrennt nachgewiesen.',
  '- Prüfbestätigungen, PROD-/MOD-ID, Sicherheitsgutachten und Bescheide werden erst nach tatsächlichem Eingang erfasst.', '',
  '## Reproduzieren', '',
  '```bash',
  'node scripts/check-gkv-approval-readiness.mjs --check',
  'node --test tests/gkv-exchange/approval-catalogue.test.mjs',
  'python scripts/import-gkv-approval-profiles.py --source-dir /pfad/zu/originalen',
  '```', '',
  'Der Python-Import verwendet ausschließlich die drei HTML-Dateien `icm.html`, `fd.html` und `provider.html`, deren Hashes in der Quellenliste stehen. Er lädt nichts herunter und ändert ohne `--write` keine Datei. Geänderte Bytes erfordern eine erneute Quellenprüfung. `--require-ready` beim Node-Check endet für diese Arbeitsgrundlage absichtlich mit Exitcode 3.', '',
];
const output = lines.join('\n');
const target = resolve(folder, 'README.md');
const args = process.argv.slice(2);
if (args.some(a => !['--write','--check','--require-ready'].includes(a)) || args.includes('--write') && args.includes('--check')) throw new Error('Use --check or --write, optionally --require-ready');
if (args.includes('--write')) writeFileSync(target, output);
else if (!existsSync(target) || readFileSync(target, 'utf8') !== output) { console.error('Generated approval README differs; run with --write'); process.exit(1); }
console.log(JSON.stringify(summary, null, 2));
if (args.includes('--require-ready')) { console.error('Not ready: normative assessment, scope and external evidence remain open.'); process.exitCode = 3; }
