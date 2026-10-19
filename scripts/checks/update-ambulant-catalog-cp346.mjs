import fs from 'node:fs/promises';

const root=process.argv[2];
if(!root)throw Error('usage: root');
const path=`${root}/docs/audit/ambulant-az-katalog-2026-10-08.json`;
const catalog=JSON.parse(await fs.readFile(path,'utf8'));
if(catalog.version!==345||catalog.tasks.length!==262||catalog.packets.length!==97)throw Error('Unerwarteter CP345-Katalogstand');
const taskIds=Array.from({length:16},(_,index)=>`H-${String(index+1).padStart(2,'0')}`);
const packetIds=Array.from({length:6},(_,index)=>`H-P${String(index+1).padStart(2,'0')}`);
const archive={checkpoint:346,sourceVersion:345,tasks:{},packets:{}};
const evidence='CP315 bleibt vollständig erhalten. CP346 ergänzt für H-01 bis H-16 einen getrennten append-only Fachprüfverlauf mit Anfrage, begründeter Rückgabe und qualifizierter Annahme je unveränderter Kopf-ID/SHA. Aktuelles Prüfungsrecht, Beschäftigung, Qualifikation, Dokument, expliziter Prüfbereich und getrennte Person werden verlangt; spätere Medikationsfassungen erben keine Annahme. Festes Journal, Browser-Lock, CAS, bestätigter SQL-Abbruch, unbekannter Transportausgang und rein lesende Quittungswiederaufnahme sind getrennt. 28 neue, 498 verbundene und 12157 vollständige lokale Node-Fälle bestanden. Drei reine TS-Dateien syntaktisch geprüft; TSX-Parser/React/tsc fehlen, Typecheck Exit 127. SQL nur vorbereitet. Echte PostgreSQL-/PostgREST-/RLS-/Grant-/Trigger-/Quellsperren-/Zwei-Sitzungs-/Parallelitäts-/Rollback-/SDK-/Altwriter-/Native-/Browser- und qualifizierte Fachabnahmen fehlen.';
for(const id of taskIds){const task=catalog.tasks.find(entry=>entry.id===id);if(!task||task.implementation!=='Teilweise umgesetzt'||task.function!=='Teilprüfung'||task.care!=='Offen'||task.design!=='Offen'||task.legal!=='Offen')throw Error(`Unerwarteter Status ${id}`);archive.tasks[id]={evidence:task.evidence,next:task.next};task.evidence=evidence;}
const packetEvidence='CP315 bleibt erhalten. CP346 ergänzt den gebundenen H-Fachprüfweg: Anfrage, Rückgabe oder Annahme je unveränderter Kopf-ID/SHA, aktuelle Qualifikations-/Prüfbereichsoriginale, Vier-Augen-Trennung und feste Quittungswiederaufnahme. 28 neue, 498 verbundene und 12157 vollständige lokale Fälle bestanden. SQL/SDK/Browser und qualifizierte Fachabnahmen bleiben offen.';
for(const id of packetIds){const packet=catalog.packets.find(entry=>entry[0]===id);if(!packet||packet[5]!=='Teilweise umgesetzt')throw Error(`Unerwarteter Paketstatus ${id}`);archive.packets[id]={evidence:packet[6],next:packet[7]};packet[6]=packetEvidence;}
catalog.version=346;
catalog.date='2026-10-17';
catalog.checkpointSummary='CP346: H-01 bis H-16 mit eigenem an Kopf-ID/SHA gebundenem Fachprüfverlauf, aktueller Qualifikations-/Prüfbereichsbindung, Vier-Augen-Trennung und robuster Quittungswiederaufnahme vertieft. 28 neue, 498 verbundene und 12157 vollständige lokale Node-Fälle bestanden. SQL nicht ausgeführt; TSX/tsc, echte Datenbank-/SDK-/Browser- und qualifizierte Abnahmen fehlen. 262 Aufgaben begonnen, nur A-09 vollständig abgenommen; 50 Prozent je Bereich nicht erreicht.';
catalog.checkpointNodeLog='docs/audit/checks/ambulant-node-checkpoint346-2026-10-17.log';
await fs.writeFile(`${root}/docs/audit/checks/ambulant-medication-original-evidence346-2026-10-17.json`,JSON.stringify(archive,null,2)+'\n');
await fs.writeFile(path,JSON.stringify(catalog,null,2)+'\n');
console.log(JSON.stringify({version:catalog.version,tasks:taskIds.length,packets:packetIds.length,accepted:catalog.milestone.acceptedTasks}));
