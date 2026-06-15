#!/usr/bin/env node
/**
 * Module completion report for WP 001–600.
 * Run: node scripts/module-completion-report.mjs [--write]
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { M_WP_CATALOG } from './wp-m-catalog.mjs';
import { classifyDeliverable, gradeLabelFromScore, gradeWp } from './wp-substance.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const writeDoc = process.argv.includes('--write');

const MODULES = [
  { name: 'Fundament', from: 1, to: 20 },
  { name: 'Designsystem', from: 21, to: 40 },
  { name: 'UI-Komponenten', from: 41, to: 60 },
  { name: 'Navigation', from: 61, to: 80 },
  { name: 'Supabase/Auth', from: 81, to: 100 },
  { name: 'Onboarding', from: 101, to: 120 },
  { name: 'Business', from: 121, to: 140 },
  { name: 'Office Core', from: 141, to: 160 },
  { name: 'Office Klienten', from: 161, to: 180 },
  { name: 'Office Mitarbeitende', from: 181, to: 200 },
  { name: 'Office Docs/Kommunikation', from: 201, to: 220 },
  { name: 'Office Abrechnung', from: 221, to: 240 },
  { name: 'Assist Einsatzplanung', from: 241, to: 260 },
  { name: 'Assist Durchführung', from: 261, to: 280 },
  { name: 'Assist Nachweise/PDF', from: 281, to: 300 },
  { name: 'Fahrtenbuch', from: 301, to: 320 },
  { name: 'Mitarbeiterportal', from: 321, to: 340 },
  { name: 'Klientenportal', from: 341, to: 360 },
  { name: 'Pflege Ambulant', from: 361, to: 380 },
  { name: 'Stationär', from: 381, to: 400 },
  { name: 'Beratung', from: 401, to: 420 },
  { name: 'Akademie', from: 421, to: 440 },
  { name: 'Kataloge/Workflow', from: 441, to: 460 },
  { name: 'AI/OCR/Telemedizin', from: 461, to: 480 },
  { name: 'Integrationen/API', from: 481, to: 500 },
  { name: 'Reporting/PDL', from: 501, to: 520 },
  { name: 'Release', from: 521, to: 540 },
  { name: 'Security/DSGVO', from: 541, to: 560 },
  { name: 'QA/Pilot', from: 561, to: 580 },
  { name: 'Roadmap/Abschluss', from: 581, to: 600 },
];

const deliverableCounts = {};
for (const e of M_WP_CATALOG) {
  deliverableCounts[e.deliverable] = (deliverableCounts[e.deliverable] ?? 0) + 1;
}

const wpGrades = M_WP_CATALOG.map((e) => gradeWp(root, e, deliverableCounts));

function rangeLabel(from, to) {
  return `${String(from).padStart(3, '0')}-${String(to).padStart(3, '0')}`;
}

const rows = MODULES.map((mod) => {
  const grades = wpGrades.filter((g) => g.wp >= mod.from && g.wp <= mod.to);
  const pct = grades.reduce((s, g) => s + g.score, 0) / grades.length;
  const dFull = grades.filter((g) => g.grade === 'D-FULL').length;
  const pLite = grades.filter((g) => g.grade === 'P/LITE').length;
  const mCount = grades.filter((g) => g.grade === 'M').length;
  const partial = grades.filter((g) => g.score < 100);
  const notes =
    partial.length === 0
      ? 'Vollständig'
      : partial
          .slice(0, 2)
          .map((g) => `WP${String(g.wp).padStart(3, '0')} ${g.score}%`)
          .join(', ');
  return {
    modul: mod.name,
    range: rangeLabel(mod.from, mod.to),
    pct: Math.round(pct),
    dFull,
    pLite: pLite + mCount > 0 ? `${pLite + mCount}` : '0',
    notes,
  };
});

const overallPct = Math.round(wpGrades.reduce((s, g) => s + g.score, 0) / wpGrades.length);
const overallDFull = wpGrades.filter((g) => g.grade === 'D-FULL').length;

function mdTable() {
  const lines = [
    '# CareSuite+ — Modul-Vollständigkeitsbericht',
    '',
    `Generiert: ${new Date().toISOString().slice(0, 10)}`,
    '',
    '**Gesamtprojekt: ' + overallPct + '%** (' + overallDFull + '/600 WPs D-FULL)',
    '',
    '| Modul | WP-Range | % | D-FULL | P/LITE | Notes |',
    '|-------|----------|---|--------|--------|-------|',
  ];
  for (const r of rows) {
    lines.push(
      '| ' +
        r.modul +
        ' | ' +
        r.range +
        ' | ' +
        r.pct +
        '% | ' +
        r.dFull +
        '/20 | ' +
        r.pLite +
        ' | ' +
        r.notes +
        ' |',
    );
  }
  lines.push(
    '| **GESAMT** | 001-600 | **' + overallPct + '%** | ' + overallDFull + '/600 | ' + (600 - overallDFull) + ' | |',
  );
  lines.push('');
  lines.push('## Bewertungslogik');
  lines.push('');
  lines.push('- **100% / D-FULL**: echte Implementierung (Service, Screen, Repo, Test mit Substanz) — kein Stub, keine geteilte Deliverable-Datei');
  lines.push('- **50–99% / P/LITE**: teilweise (generisch, geteilte Docs, Test-Stubs)');
  lines.push('- **0–49% / M**: fehlend oder nur Stub');
  lines.push('');
  lines.push('## Quality Gates');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run typecheck');
  lines.push('npm run smoke');
  lines.push('npm run test');
  lines.push('node scripts/wp-m-verify.mjs');
  lines.push('node scripts/wp-500-audit.mjs');
  lines.push('node scripts/wp-600-audit.mjs');
  lines.push('```');
  return lines.join('\n');
}

console.log('=== CareSuite+ Modul-Vollständigkeit ===\n');
console.log(`Gesamt: ${overallPct}% (${overallDFull}/600 D-FULL)\n`);
console.log('| Modul | WP-Range | % | D-FULL | P/LITE | Notes |');
console.log('|-------|----------|---|--------|--------|-------|');
for (const r of rows) {
  console.log(
    `| ${r.modul} | ${r.range} | ${r.pct}% | ${r.dFull}/20 | ${r.pLite} | ${r.notes} |`,
  );
}
console.log(`| **GESAMT** | 001-600 | **${overallPct}%** | ${overallDFull}/600 | ${600 - overallDFull} | |`);

if (writeDoc) {
  const out = join(root, 'docs/architecture/module-completion-report.md');
  writeFileSync(out, mdTable(), 'utf8');
  console.log(`\nWritten: ${out}`);
}

process.exit(overallPct < 100 ? 1 : 0);
