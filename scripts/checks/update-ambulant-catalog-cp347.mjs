import fs from 'node:fs/promises';

const root=process.argv[2];
if(!root)throw Error('usage: root');
const path=`${root}/docs/audit/ambulant-az-katalog-2026-10-08.json`;
const catalog=JSON.parse(await fs.readFile(path,'utf8'));
if(catalog.version!==346||catalog.tasks.length!==262||catalog.packets.length!==97)throw Error('Unerwarteter CP346-Katalogstand');
const taskIds=Array.from({length:12},(_,index)=>`I-${String(index+1).padStart(2,'0')}`);
const packetIds=Array.from({length:4},(_,index)=>`I-P${String(index+1).padStart(2,'0')}`);
const archive={checkpoint:347,sourceVersion:346,tasks:{},packets:{}};
const evidence='CP316 bleibt vollständig erhalten. CP347 ergänzt für I-01 bis I-12 eine ausdrückliche, an das vollständige Original gebundene Materialentscheidung sowie einen getrennten append-only Fachprüfverlauf mit Anfrage, begründeter Rückgabe und qualifizierter Annahme je unveränderter Kopf-ID/SHA und Vorgangsart. Aktuelles Prüfungsrecht, Beschäftigung, Qualifikation, Dokument, expliziter Behandlungspflege-Prüfbereich und getrennte Person werden verlangt; spätere Fassungen erben keine Annahme. Historische Originale ohne Materialfeld bleiben exakt lesbar, sind aber nicht nachträglich annehmbar. Festes Journal, Browser-Lock, CAS, bestätigter SQL-Abbruch, unbekannter Transportausgang und rein lesende Quittungswiederaufnahme sind getrennt. 99 fokussierte und 12190 vollständige lokale Node-Fälle bestanden. Vier reine TS-Dateien syntaktisch geprüft; TSX-Parser/React/tsc fehlen, Typecheck Exit 127. SQL nur vorbereitet. Echte PostgreSQL-/PostgREST-/RLS-/Grant-/Trigger-/Quellsperren-/Zwei-Sitzungs-/Parallelitäts-/Rollback-/SDK-/Altwriter-/Native-/Browser- und qualifizierte Fachabnahmen fehlen.';
for(const id of taskIds){const task=catalog.tasks.find(entry=>entry.id===id);if(!task||task.implementation!=='Teilweise umgesetzt'||task.function!=='Teilprüfung'||task.care!=='Offen'||task.design!=='Offen'||task.legal!=='Offen')throw Error(`Unerwarteter Status ${id}`);archive.tasks[id]={evidence:task.evidence,next:task.next};task.evidence=evidence;}
const packetEvidence='CP316 bleibt erhalten. CP347 ergänzt den gebundenen I-Fachprüfweg und die getrennte Materialentscheidung: Anfrage, Rückgabe oder Annahme je unveränderter Kopf-ID/SHA/Vorgangsart, aktuelle Qualifikations-/Prüfbereichsoriginale, Vier-Augen-Trennung und feste Quittungswiederaufnahme. 99 fokussierte und 12190 vollständige lokale Fälle bestanden. SQL/SDK/Browser und qualifizierte Fachabnahmen bleiben offen.';
for(const id of packetIds){const packet=catalog.packets.find(entry=>entry[0]===id);if(!packet||packet[5]!=='Teilweise umgesetzt')throw Error(`Unerwarteter Paketstatus ${id}`);archive.packets[id]={evidence:packet[6],next:packet[7]};packet[6]=packetEvidence;}
catalog.version=347;
catalog.date='2026-10-17';
catalog.checkpointSummary='CP347: I-01 bis I-12 mit gebundener Materialentscheidung und eigenem an Kopf-ID/SHA/Vorgangsart gebundenem Fachprüfverlauf, aktueller Qualifikations-/Prüfbereichsbindung, Vier-Augen-Trennung und robuster Quittungswiederaufnahme vertieft. 99 fokussierte und 12190 vollständige lokale Node-Fälle bestanden. SQL nicht ausgeführt; TSX/tsc, echte Datenbank-/SDK-/Browser- und qualifizierte Abnahmen fehlen. 262 Aufgaben begonnen, nur A-09 vollständig abgenommen; 50 Prozent je Bereich nicht erreicht.';
catalog.checkpointNodeLog='docs/audit/checks/ambulant-node-checkpoint347-2026-10-17.log';
await fs.writeFile(`${root}/docs/audit/checks/ambulant-treatment-care-original-evidence347-2026-10-17.json`,JSON.stringify(archive,null,2)+'\n');
await fs.writeFile(path,JSON.stringify(catalog,null,2)+'\n');
console.log(JSON.stringify({version:catalog.version,tasks:taskIds.length,packets:packetIds.length,accepted:catalog.milestone.acceptedTasks}));
