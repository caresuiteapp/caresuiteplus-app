import fs from 'node:fs/promises';
const path=new URL('../../docs/audit/ambulant-az-katalog-2026-10-08.json',import.meta.url);
const catalog=JSON.parse(await fs.readFile(path,'utf8'));
if(catalog.version!==309)throw Error(`Ausgangskatalog ist nicht CP309: ${catalog.version}`);
const evidence='CP11/30/310: Der aktive ambulante Web-Assessmentweg verbindet Personenperspektive, sechs Themenfelder, Risikoeinschätzungen, individuelle Maßnahmen, ein ausdrücklich CareSuite-eigenes Dokumentationsmodell sowie aktuell gelesene Instrumentenoriginale in derselben versions- und anfragengebundenen Entwurfstransaktion. Nur aktive eigene oder nachgewiesen lizenzierte Fassungen mit passendem dokumentiertem Risikobezug sind auswählbar; externe/unverifizierte Referenzen bleiben sichtbar gesperrt. Vollständige Originale, native Auswahlrevision, Katalogstand, Benutzer, Mandant, Pflegefall und Assessment werden vor Versand gebunden. Unklare Antworten bleiben ohne Ersatzwrite gesperrt. 47 zusätzliche Instrumenten-/Verbundfälle sowie 10747/10747 vollständige lokale Node-Fälle bestanden. Der SQL-Vertrag ist nur vorbereitet und nicht ausgeführt; echte PostgreSQL-/PostgREST-/RLS-/Grant-/Lock-/Rollback-/SDK-/Browser- sowie Pflege-, Design-, Datenschutz- und Rechtsabnahmen fehlen.';
const next='Den vorbereiteten Assessment-/Instrumentenvertrag in einer zulässigen vorhandenen Supabase-/PostgreSQL-Testumgebung mit echter Sitzung, API-Exposition, Profil/Mandant/Pflegefallrechten, Transaktionssperre, Parallelität, Rollback und vollständiger SDK-Serialisierung ausführen. Instrumentenfachlichkeit, Lizenz-/Nutzungsrechte, konkrete EinSTEP-/SIS-Abgrenzung, Berechnungsregeln, historische Fassungen, Korrektur/Widerruf und breite/schmale Browser-, Tastatur- und Screenreaderbedienung qualifiziert prüfen. Personenperspektive, Themenfelder, Risiken und Maßnahmen mit den ursprünglichen Einzelabnahmen belegen; keine externe Standardkonformität aus dem CareSuite-Modell ableiten.';
for(const id of ['C-01','C-02','C-03','C-04','C-05','C-06','C-07','C-08','C-09']){
 const task=catalog.tasks.find(entry=>entry.id===id);if(!task)throw Error(`${id} fehlt`);
 Object.assign(task,{implementation:'Teilweise umgesetzt',function:'Teilprüfung',care:'Offen',design:'Offen',legal:'Offen',evidence,next});
}
for(const id of ['C-P01','C-P02','C-P03']){
 const packet=catalog.packets.find(entry=>entry[0]===id);if(!packet)throw Error(`${id} fehlt`);
 packet[5]='Teilweise umgesetzt';packet[6]=evidence;
}
catalog.version=310;
catalog.checkpointSummary='CP310: Größerer C-01–C-09-Produktabschnitt verbindet den tatsächlichen ambulanten Web-Assessmententwurf, Modell-/Instrumentenverwaltung, aktuelle Rechte, vollständige native Originale, risikogebundene Auswahl, atomare Speicherung, kontrollierte Wiederaufnahme und Prüfweitergabe. Externe/unverifizierte Instrumente bleiben gesperrt; keine SIS-/EinSTEP-Konformität wird behauptet. 47 zusätzliche und 10747/10747 vollständige lokale Node-Fälle bestanden. SQL wurde nicht ausgeführt; reale SDK-/PostgreSQL-/Browser-/Fachabnahmen bleiben offen. Nur A-09 vollständig abgenommen, 200 Aufgaben begonnen; 50%-Ziel offen.';
catalog.checkpointNodeLog='docs/audit/checks/ambulant-node-checkpoint310-2026-10-15-large-assessment.log';
await fs.writeFile(path,JSON.stringify(catalog,null,2)+'\n');
