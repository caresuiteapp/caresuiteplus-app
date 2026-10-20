import fs from 'node:fs';

const path = 'docs/audit/ambulant-az-katalog-2026-10-08.json';
const catalog = JSON.parse(fs.readFileSync(path, 'utf8'));
if (catalog.version !== 281) throw new Error(`Unerwartete Katalogversion ${catalog.version}`);
const task = catalog.tasks.find((entry) => entry.id === 'Z-06');
const packet = catalog.packets.find((entry) => entry[0] === 'Z-P02');
if (!task || !packet || task.implementation !== 'Bestand zu prüfen' || task.function !== 'Offen'
  || [task.care, task.design, task.legal].some((status) => status !== 'Offen') || packet[5] !== 'Teilweise umgesetzt') {
  throw new Error('Unerwarteter Z-06- oder Z-P02-Ausgangsstatus');
}
catalog.version = 282;
task.implementation = 'Teilweise umgesetzt';
task.function = 'Teilprüfung';
task.evidence = 'CP282: Eine neue fail-closed Web/Desktop-Verlaufsprojektion bindet Mandant, Pflegefall, Releasekandidat, Build und vollständigen Anforderungssnapshot. Bestätigte Einzelwerte bewahren native Quelle, Fassung, Summe, Wert, Einheit, Beobachtungs- und Bestätigungszeit sowie Berechtigungsbeleg. Jede Aussage verlinkt konkrete Datenpunkte, Quellen und Einheiten vollständig; jeder nicht belegte erwartete Datenpunkt muss mit Feld, Einheit, Grund und Feststellungszeit genau einmal als fehlend markiert sein. Fachprüfung bleibt ein eigener berechtigter Schritt. Klinischer Trend, Pflegehandlung und Aufgabenabschluss werden nie abgeleitet. Acht neue Risikofälle und 10080/10080 vorhandene Node-Fälle bestanden; Android unverändert. Gesamt-Typecheck nicht ausführbar (tsc fehlt). Keine reale Datenbank-/RLS-/Browserintegration und keine Pflege-, Design-, Datenschutz- oder Rechtsabnahme.';
task.next = 'Die Projektion an reale bestätigte Fachabläufe und deren vollständige Quellenregister anbinden. Mehrere zeitlich geordnete Werte, unterschiedliche Einheiten ohne stillschweigende Konversion, Korrekturen, widerrufene Bestätigungen, nachträgliche Quellenänderungen, konkurrierende Aktualisierung und Rechteentzug prüfen. SQL/RLS, breite und schmale Bedienung, Tastatur/Screenreader sowie Pflege-, Design-, Datenschutz- und Rechtsprüfung nachweisen. Eine Zusammenfassung bleibt fachprüfungspflichtig und belegt weder Trend noch Pflegehandlung. Nächster unabhängiger Punkt: Z-07 Frühwarnsysteme.';
packet[6] = 'CP280/CP281/CP282: Z-04 bewahrt vollständige Aufgabenbündel; Z-05 trennt erklärbaren Tourenvorschlag, bewusste Fachprüfung und Übernahme; Z-06 bindet jede Aussage an bestätigte Daten, Einheiten, Zeitbezug und Quellen und markiert jede Datenlücke. Acht neue Fälle, 10080/10080 gesamt. Reale Datenbank-/RLS-/Browserintegration, Z-07 und alle vier Abnahmen offen.';
catalog.checkpointSummary = 'CP282: Z-06 verlinkt jede Verlaufszusammenfassung vollständig mit bestätigten Datenpunkten, nativen Quellen, Einheiten und Zeitbezug und markiert jede unbelegte Anforderung ausdrücklich. Fachprüfung bleibt getrennt; kein klinischer Trend oder Pflegeabschluss wird abgeleitet. Android unverändert. Acht neue Fälle, 10080/10080 gesamt; 187 begonnen, weiterhin nur eine vollständig abgenommen, 50%-Ziel offen.';
fs.writeFileSync(path, `${JSON.stringify(catalog, null, 2)}\n`);
