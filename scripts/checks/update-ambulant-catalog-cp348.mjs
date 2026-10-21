import fs from 'node:fs/promises';

const root=process.argv[2];
if(!root)throw Error('usage: root');
const path=`${root}/docs/audit/ambulant-az-katalog-2026-10-08.json`;
const catalog=JSON.parse(await fs.readFile(path,'utf8'));
if(catalog.version!==347||catalog.tasks.length!==262||catalog.packets.length!==97)throw Error('Unerwarteter CP347-Katalogstand');
const taskIds=Array.from({length:8},(_,index)=>`J-${String(index+1).padStart(2,'0')}`);
const packetIds=Array.from({length:3},(_,index)=>`J-P${String(index+1).padStart(2,'0')}`);
const archive={checkpoint:348,sourceVersion:347,tasks:{},packets:{}};
const evidence='CP317 bleibt vollständig erhalten. CP348 ergänzt J-01 bis J-08 um einen getrennten append-only Wundfachprüfverlauf für eine vollständig abgeschlossene unveränderte Wundfassung: Prüfanfrage, begründete Rückgabe und qualifizierte Annahme binden Wurzel, Kopf-ID, Vorgangsart, SHA-256 und vollständige aktuelle Wund-/Befund-/Bild-/Einwilligungs-/Plan-/Versorgungsoriginale. Aktuelles Prüfungsrecht, Beschäftigung, Qualifikation, Dokument, ausdrücklich freigegebener Wundprüfbereich und getrennte Person werden verlangt; spätere Fassungen erben keine Annahme. Planung, Bild, tatsächliche Versorgung/Nichtversorgung, Kontakt, Rückmeldung, Abschluss, Prüfung und Freigabe bleiben getrennt. Festes Journal, Browser-Lock, CAS, bestätigter SQL-Abbruch, unbekannter Transportausgang und rein lesende Quittungswiederaufnahme sind getrennt. 20/20 neue, 53/53 verbundene und 12210/12210 vollständige lokale Node-Fälle bestanden. Drei reine TS-Dateien syntaktisch geprüft; TSX-Parser/React/tsc fehlen, Typecheck Exit 127. SQL nur vorbereitet. Echte PostgreSQL-/PostgREST-/RLS-/Grant-/Trigger-/Quellsperren-/Zwei-Sitzungs-/Parallelitäts-/Rollback-/SDK-/Altwriter-/Native-/Browser- und qualifizierte Fachabnahmen fehlen.';
for(const id of taskIds){const task=catalog.tasks.find(entry=>entry.id===id);if(!task||task.implementation!=='Teilweise umgesetzt'||task.function!=='Teilprüfung'||task.care!=='Offen'||task.design!=='Offen'||task.legal!=='Offen')throw Error(`Unerwarteter Status ${id}`);archive.tasks[id]={evidence:task.evidence,next:task.next};task.evidence=evidence;}
const packetEvidence='CP317 bleibt erhalten. CP348 ergänzt den gebundenen J-Fachprüfweg: Anfrage, Rückgabe oder Annahme je unveränderter Wundwurzel/Kopf-ID/SHA/Vorgangsart, vollständige Quellen, aktuelle Qualifikations-/Prüfbereichsoriginale, Vier-Augen-Trennung und feste Quittungswiederaufnahme. 20 neue, 53 verbundene und 12210 vollständige lokale Fälle bestanden. SQL/SDK/Browser und qualifizierte Fachabnahmen bleiben offen.';
for(const id of packetIds){const packet=catalog.packets.find(entry=>entry[0]===id);if(!packet||packet[5]!=='Teilweise umgesetzt')throw Error(`Unerwarteter Paketstatus ${id}`);archive.packets[id]={evidence:packet[6],next:packet[7]};packet[6]=packetEvidence;}
catalog.version=348;
catalog.date='2026-10-17';
catalog.checkpointSummary='CP348: J-01 bis J-08 mit eigenem an Wundwurzel, Kopf-ID, SHA und Vorgangsart gebundenem Fachprüfverlauf, vollständiger Quellenbindung, aktueller Qualifikations-/Prüfbereichsprüfung, Vier-Augen-Trennung und robuster Quittungswiederaufnahme vertieft. 20 fokussierte, 53 verbundene und 12210 vollständige lokale Node-Fälle bestanden. SQL nicht ausgeführt; TSX/tsc, echte Datenbank-/SDK-/Browser- und qualifizierte Abnahmen fehlen. 262 Aufgaben begonnen, nur A-09 vollständig abgenommen; 50 Prozent je Bereich nicht erreicht.';
catalog.checkpointNodeLog='docs/audit/checks/ambulant-node-checkpoint348-2026-10-17.log';
await fs.writeFile(`${root}/docs/audit/checks/ambulant-wound-path-original-evidence348-2026-10-17.json`,JSON.stringify(archive,null,2)+'\n');
await fs.writeFile(path,JSON.stringify(catalog,null,2)+'\n');
console.log(JSON.stringify({version:catalog.version,tasks:taskIds.length,packets:packetIds.length,accepted:catalog.milestone.acceptedTasks}));
