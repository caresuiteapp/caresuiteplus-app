# Klient:innen- und Angehörigenportal: tatsächlicher Auditstand

Erfasst sind 18 ausgewählte Android-Seiten: 16 unter `/portal/client` und 2 Legacy-Owner-Einstiege. Dazu gehören 13 Funktionsgruppen mit Datensatz-/Mandanten-/Akteursgrenzen und bekannten Dialogen/Unteransichten.

**Keine Releasefreigabe.** Die neue Vollshell-/Pixelprüfung, echte Android-Navigation und produktive RLS-/Writer-/Readback-Abnahme sind offen. Ein ausgewählter Dateipfad ist kein Beleg für eine freigegebene Funktion.

## Bestätigte Korrekturen

- Capability-bound list/detail/live/chat/signature and home data reads
- Expiry-aware family capability checks and retained actor identity withdrawal
- Family own-account profile instead of broad client demographic/clinical reads
- Direct family budget route denied before transport
- Active assist proof page does not mount globally unreleased care-proof panel
- Proof action acknowledgement/locking/retry and stale response rejection
- Profile request reuses scoped mutation lock, catches failures and drops old completions
- Announcement detail state and read receipt bound to current origin

## Ausgeführt und begrenzt belegt

Acht gezielte Suiten mit 58 bestandenen Fällen prüfen tatsächliche Routen/Hooks/Provider/Services und Komponenten an kontrollierten Transport-/Hostgrenzen. Der zusätzliche 56-Fälle-Lauf enthält überlappende Tests und wird nicht hinzuaddiert. Die JSON-Datei nennt die exakten Dateien. Keine produktive Geschäftstransaktion wurde ausgeführt.

## Offene Releaseblocker

- Family scope RPC remains missing in production per parent read-only catalog evidence; no migration applied
- New full-shell renderer has not yet produced accepted per-page visual evidence
- No actual authenticated Android lifecycle/action/server-readback acceptance
- Family appointment-change write capability contract still unresolved
- Normal client native Academy direct-link release boundary still unresolved
- No periodic productive family capability revalidation proven; source scope/expiry checks are not a live RLS guarantee

## Alle ausgewählten Seiten

| Android-Route | Funktionsgruppen | Laufzeit/Gerät/Vollshell |
|---|---|---|
| `/liquid-command/portal/client` | academy-and-legacy | nicht abgenommen |
| `/liquid-command/portal/family` | academy-and-legacy | nicht abgenommen |
| `/portal/client` | entry-and-identity, home-and-modals | nicht abgenommen |
| `/portal/client/akademie` | academy-and-legacy | nicht abgenommen |
| `/portal/client/announcements` | entry-and-identity, announcements | nicht abgenommen |
| `/portal/client/appointments` | entry-and-identity, appointments | nicht abgenommen |
| `/portal/client/appointments/[id]` | entry-and-identity, appointments | nicht abgenommen |
| `/portal/client/budget` | entry-and-identity, budget | nicht abgenommen |
| `/portal/client/documents` | entry-and-identity, documents | nicht abgenommen |
| `/portal/client/documents/[id]` | entry-and-identity, documents, signatures | nicht abgenommen |
| `/portal/client/documents/signatures` | entry-and-identity, signatures | nicht abgenommen |
| `/portal/client/documents/signatures/[id]` | entry-and-identity, signatures | nicht abgenommen |
| `/portal/client/help` | entry-and-identity, help | nicht abgenommen |
| `/portal/client/live` | entry-and-identity, live | nicht abgenommen |
| `/portal/client/messages` | entry-and-identity, messaging | nicht abgenommen |
| `/portal/client/messages/[threadId]` | entry-and-identity, messaging | nicht abgenommen |
| `/portal/client/profile` | entry-and-identity, profile | nicht abgenommen |
| `/portal/client/proofs` | entry-and-identity, proofs | nicht abgenommen |

Die maschinenlesbare Matrix verknüpft jede tatsächliche Route mit Empfängerquellen, Funktionsgruppen, Tests, Quellhashes und Nachweisgrenzen. Die individuellen Freigaben sind eine App-Lesegrenze; frische serverseitige Autorisierung bleibt erforderlich.

## Nachfolgender enger Korrekturblock

59 Fälle in neun Suiten bestehen für den nächsten Quellstand (überlappend mit vorherigen Läufen):

- Family-Terminänderungen werden mangels eines passenden individuellen Writervertrags vor Transport verweigert. Lesefreigabe, Nachrichten- und Bestätigungsfähigkeit werden nicht umgedeutet.
- `source=proof` bindet das Nachweisdetail an ausschließlich freigegebene Proofquellen. Family-Dokumentdetails bleiben getrennt; eine `documents`-Freigabe aktiviert keinen `service_records`-Fallback und umgekehrt. Der Download prüft dieselbe Klasse erneut.
- Der normale native Client-Akademie-Direktlink erhält eine Browsergrenze. Die Web-Akademie bleibt unverändert. Die enge Generatoradaption und die tatsächliche Boundarykomponente sind getestet; koordinierte Regeneration und Geräte-/Vollshellprüfung bleiben erforderlich.

Die drei zuvor offenen Quellblocker sind damit im App-Quellstand korrigiert. Das ist keine Freigabe der fehlenden Family-Scope-RPC, produktiver RLS-/Storage-Regeln oder tatsächlicher Androidabläufe. Die neue native Empfängerdatei und die Routeninventur müssen vom Elternagenten nach Regeneration an diesen Stand gebunden werden.
