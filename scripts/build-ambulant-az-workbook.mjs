import fs from 'node:fs/promises';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';
process.on('uncaughtException',error=>{console.error(error.message);console.error(error.stack?.split('\n').slice(1,5).join('\n'));process.exitCode=1;});
const root=process.env.CARESUITE_SOURCE_ROOT ?? process.cwd();
const output=process.env.CARESUITE_AZ_OUTPUT ?? root+'/outputs/ambulant-az-20261008';
await fs.mkdir(output,{recursive:true});
const raw=await fs.readFile(root+'/docs/audit/ambulant-az-katalog-2026-10-08.txt','utf8');
const previous=JSON.parse(await fs.readFile(root+'/docs/audit/ambulant-az-katalog-2026-10-08.json','utf8').catch(()=>'{"tasks":[],"packets":[]}'));
const preserved=new Map(previous.tasks.map(t=>[t.id,t]));
const areas=new Map(); let letter;
for(const line of raw.split('\n')){
 if(line.startsWith('[')){letter=line[1];if(!areas.has(letter))areas.set(letter,{name:line.slice(4),items:[]});}
 else if(line.includes('|')) { const [title,data,criterion]=line.split('|');areas.get(letter).items.push({title,data,criterion}); }
}
const gates=[
 ['G01','Funktion','Realer Datenpfad','Anzeigen, Schreiben, erneutes Laden und Export verwenden die tatsächlichen Daten. Keine Demo-Fallbacks im produktiven Ablauf.'],
 ['G02','Funktion','Pflichtangaben und Grenzen','Erforderliche Felder, Format, Einheiten, Extremwerte, leere Eingabe und zulässige Nullwerte prüfen.'],
 ['G03','Funktion','Mandanten und Personen','Fremder Mandant, falscher Klient, inaktives Profil und fehlendes Recht können weder lesen noch schreiben.'],
 ['G04','Funktion','Ereignis und Erfassungszeit','Tatsächlicher Zeitpunkt, Serverzeit, Zeitzone und Sommerzeitwechsel getrennt prüfen. Historische Unklarheit bleibt sichtbar.'],
 ['G05','Funktion','Unveränderbare Historie','Original, Nachtrag, Korrekturgrund, bestätigte Fassung und Signaturbezug erhalten. Keine stillen rückwirkenden Änderungen.'],
 ['G06','Funktion','Verlorene Antwort und Wiederholung','Gleiche Anfrage mit identischen Daten erzeugt genau ein Ergebnis. Geänderte Wiederholung wird verweigert.'],
 ['G07','Funktion','Parallelbearbeitung','Zwei Bearbeitende mit verschiedenen Versionsständen erzeugen keinen unbemerkten Verlust fachlicher Änderungen.'],
 ['G08','Funktion','Listen und Datenmengen','Mehrere Abfrageseiten, Filter, Sortierung, Suche, historische Einträge und lange Akten vollständig prüfen.'],
 ['G09','Funktion','Fehler und Navigation','Lade-, Leer-, Fehler- und Erfolgszustand, sofortiger Doppelklick, Abbruch, Wiederaufnahme und ungespeicherte Änderungen prüfen.'],
 ['G10','Pflege','Individuelle Fachlichkeit','Konkrete Ressourcen, Bedürfnisse, Risiken, ärztliche Grundlage und individuelle Vereinbarung prüfen. Keine schematische Ersatzentscheidung.'],
 ['G11','Pflege','Nichtdurchführung','Teilweise Durchführung, Ablehnung, Nichtgabe, fehlender Zugang und Rückmeldung sind fachlich eigene Ergebnisse.'],
 ['G12','Pflege','Reaktion und Kontrolle','Auffälligkeit führt zu zuständiger Reaktion, Rückmeldung, Kontrolle und nachvollziehbarem Abschluss.'],
 ['G13','Pflege','Qualifikation und Delegation','Tätigkeit, freigegebene Kompetenz, notwendige zweite Person und Grenzen der Delegation prüfen.'],
 ['G14','Pflege','Fachliche Praxisszenarien','Geeignete Pflegefachpersonen prüfen repräsentative normale, abweichende und kritische Abläufe mit dokumentiertem Ergebnis.'],
 ['G15','Design','Breite und schmale Ansicht','Echter Browser: Navigation offen, schmale Fläche, lange Inhalte, geänderte Fenstergröße und erreichbare Aktionen prüfen.'],
 ['G16','Design','Lesbarkeit und Eingaben','Kontrast, eindeutige Beschriftung, Einheit, Fehlerplatzierung, Fokus, Tastatur und Schriftvergrößerung prüfen.'],
 ['G17','Design','Zusammenhängender Arbeitsablauf','Klientenkontext, Verordnungsstand, wichtige Risiken und nächste Handlung bleiben über den gesamten Ablauf eindeutig.'],
 ['G18','Recht','Aktuelle Grundlage','Rechts-, Vertrags-, Landes-, Fach- und Formatgrundlage mit konkreter Fassung prüfen. Keine universelle Konformitätsbehauptung.'],
 ['G19','Recht','Modell und Rechte an Vorlagen','SIS, Assessmentinstrumente, Herstellerunterlagen und Abbildungen auf aktuelle Nutzungsbedingungen prüfen. Eigene Spezifikation statt Kopie.'],
 ['G20','Recht','Datenschutz und Vertretung','Zweck, Rechtsgrundlage, Datenminimierung, Vollmacht, Widerruf, Aufbewahrung und betroffene Dokumentart prüfen.'],
 ['G21','Recht','Nachweis und Bestätigung','Authentifizierte Person, bestätigter Inhalt, Zeitpunkt und Berechtigungsumfang nachweisen. Namensauswahl ist keine zweite Signatur.'],
 ['G22','Betrieb','Android und Altschnittstellen','Vorhandene App und direkte Schreibwege gegen jeden geänderten API- oder Datenbankvertrag prüfen. Keine Freigabe bei offenem Bruch.'],
 ['G23','Betrieb','Isolierte Prüfung','SQL nur in isolierter Testdatenbank prüfen. Keine Testschreibvorgänge, Patches oder Migrationen auf produktiven Daten.'],
 ['G24','Betrieb','Wiederherstellung','Gesicherte Arbeitspakete, Quelldateien und Prüfnachweise lassen sich ohne Push wiederherstellen. Regelmäßig Wiederherstellung probeweise prüfen.'],
 ['G25','Betrieb','Schnittstellenende','Absender, Transport, empfangene Daten, Zuordnung und Fehlerbehandlung tatsächlich nachweisen. Dateierzeugung allein reicht nicht.'],
 ['G26','Betrieb','Prüfbericht pro Paket','Geänderte Dateien, tatsächliche Tests, Einschränkungen, offene Abnahmen und nächster Schritt werden vor Abschluss gesichert.'],
 ['G27','Innovation','Nachvollziehbare Assistenz','Vorschlag, Quelle, Freigabe und Autor sind getrennt. Keine erfundene Pflegehandlung, Diagnose, Dosis oder automatische Fachfreigabe.'],
 ['G28','Release','Vollständige Freigabe','Alle vereinbarten Fachaufgaben und einschlägigen Prüfungen erfüllt, tatsächlicher Betrieb geprüft und Restmängel dokumentiert abgeschlossen. Erst dann Push/Deploy.'],
];
const sources=[
 ['Q00','Projektanforderungen','A–Z-Spezifikation','Nutzerauftrag und eigene fachliche Arbeitsspezifikation','Keine externe Vollständigkeitszertifizierung. Neue Erkenntnisse ergänzen den Katalog.',''],
 ['Q01','G-BA','Häusliche Krankenpflege-Richtlinie','Offizielle aktuelle Richtlinienseite am 08.10.2026 abgerufen','Einzelmaßnahmen, Fassung und Fachanforderungen pro Umsetzung vertieft prüfen.','https://www.g-ba.de/richtlinien/11/'],
 ['Q02','EinSTEP','Strukturmodell und Softwareanforderungen','Offizielle Downloadseite und Hinweis auf Schulungsfassung 3.1 geprüft','Softwareanforderungen 3.0/3.1 und Nutzungsbedingungen vor SIS-Abnahme vollständig prüfen.','https://www.ein-step.de/downloads'],
 ['Q03','MD Bund','QPR ambulante Pflege Teil 1a','Offizielle aktuelle Grundlage ab 30.07.2026 recherchiert','304-seitige PDF nicht vollständig einzeln auf Softwareanforderungen abgenommen.','https://md-bund.de/fileadmin/dokumente/Publikationen/SPV/PV_Qualitaetspruefung/QPR_Teil1a_ambulante_Pflegedienste_2026_07_30.pdf'],
 ['Q04','MEDIFOX DAN','Pflege- und Betreuungsdokumentation','Öffentliche siebenseitige Produkt-PDF abgerufen','Funktionsthemen als Vergleichsanstoß. Produktbroschüre belegt keine tatsächliche Konkurrenzabnahme.','https://www.medifoxdan.de/downloads/md-ambulant/MD_Ambulant_Modul_Pflege-Betreuungsdokumentation.pdf'],
 ['Q05','MEDIFOX DAN','MD Ambulant Gesamtumfang','Aktuelle öffentliche Produktseite recherchiert','Modularen Funktionsumfang und Downloads je Teilablauf weiter abgleichen.','https://www.medifoxdan.de/software-ambulante-pflege'],
 ['Q06','myneva','Ambulante Versorgung','Öffentliche Broschürenadresse aus vorigem Recherchestand','Broschüre erneut vollständig auswerten und jede Vergleichsaussage belegen.','https://www.myneva.eu/hubfs/DE_myneva.swing-Ambulant_brochure.pdf'],
 ['Q07','euregon','snap ambulant','Offizielle Produktseite und öffentliche Leistungsbeschreibung gefunden','PDF im nächsten Quellenpaket auswerten. Keine einzelne Funktion als getestet markieren.','https://www.euregon.de/info/Leistungsbeschreibung-snap-ambulant_euregonAG.pdf'],
 ['Q08','CGM','VIYU ambulant','Offizielle Produktseite recherchiert','Ambulante Funktionen, Downloads und Schnittstellen tiefer prüfen.','https://www.cgm.com/deu_de/loesungen/pflegedienst.html'],
 ['Q09','HyCARE','HyCARE ambulant','Offizielle ambulante Produktseite recherchiert','Pflegemanagement, Spezialprofile und Nachweise systematisch abgleichen.','https://www.hycare.de/produkte/hycare-ambulant/'],
 ['Q10','CareSocial','Pflegesoftware','Offizielle Produktseite und öffentliche PDF gefunden','Produktinformationen auf die Aufgaben-IDs abbilden und Unterschiede festhalten.','https://www.caresocial.de/download/bestellen/CareSocial-INFO.pdf'],
 ['Q11','Weitere Anbieter','Weiterer Marktabgleich','Rechercheauftrag offen','opta data, Curasoft und weitere Anbieter mit belegten öffentlichen Quellen ergänzen.',''],
 ['Q12','Supabase','Datenbankfunktionen und Sicherheit','Offizielle Funktionen-Dokumentation geprüft','SQL-Sicherheit mit isolierten Tests prüfen. Technische Dokumentation ersetzt keine Pflege- oder Rechtsabnahme.','https://supabase.com/docs/guides/database/functions'],
 ['Q13','Gematik und Datenaustausch','TI, KIM, ePA, DTA','Detailrecherche offen','Aktuelle offizielle Spezifikationen, Voraussetzungen und zulässige Prüfwege pro Schnittstelle feststellen.',''],
 ['Q14','Recht und Fachstandards','Gesetze, Landesverträge, Expertenstandards','Konkrete Detailzuordnung offen','Je Aufgabe aktuelle einschlägige Grundlage und qualifizierte Prüfer festlegen. Keine Fristen oder Therapiegrenzen erfinden.',''],
];
const wb=Workbook.create();
const main=wb.worksheets.add('Aufgaben'); const packets=wb.worksheets.add('Pakete'); const acceptance=wb.worksheets.add('Abnahme');const source=wb.worksheets.add('Quellen');
const styles=(s,end,last)=>{s.showGridLines=false;s.getRange(`A1:${last}${end}`).format.font={name:'Arial',size:11,color:'#172B3A'};s.getRange(`A1:${last}${end}`).format.verticalAlignment='top';s.getRange(`A1:${last}${end}`).format.wrapText=true;s.getRange(`A1:${last}${end}`).format.rowHeight=44;};
const header=(s,address)=>{s.getRange(address).format={fill:'#183B50',font:{name:'Arial',size:11,bold:true,color:'#FFFFFF'},horizontalAlignment:'center',verticalAlignment:'center',wrapText:true,rowHeight:34};};
const baseDeps={A:'Keine fachliche Voraufgabe',B:'A-03, A-04',C:'B-02, B-06',D:'C-02 bis C-08',E:'B-02, A-03',F:'C-08, D-02',G:'C-08, D-02',H:'B-06, E-01',I:'B-06, E-01',J:'I-01, E-01',K:'B-02, E-01',L:'I-01, Q-02',M:'C-02, D-02',N:'B-04, D-02',O:'B-04, W-02',P:'A-05, Q-04',Q:'A-03, A-04',R:'B-07, Q-02',S:'R-03, E-01',T:'B-07, A-05',U:'S-05, T-04',V:'E-01, D-07',W:'A-03, B-04',X:'A-03, B-04',Y:'A-03, A-04',Z:'Jeweils zugehöriger bestätigter Fachablauf'};
const taskRows=[],packetRows=[],json=[];
for(const [key,area] of areas){
 area.items.forEach((item,i)=>{
  const id=`${key}-${String(i+1).padStart(2,'0')}`,packet=`${key}-P${String(Math.floor(i/3)+1).padStart(2,'0')}`;
  const medication=['H-04','H-05','H-06','H-08'].includes(id);
  const evidence=medication?'8 Domänentests + 7 isolierte Datenbanktests bestanden. SQL-Patch nur lokal. Webformular/Integration, Fach- und Rechtsabnahme offen.':'';
  const depends=key==='H'&&i>1?'H-01, H-02; '+baseDeps[key]:baseDeps[key];
  const next=medication?'Geprüften SQL- und Validierungsstand an Webformular, Verlauf und Wiederholung anbinden. Android-Kompatibilität vor Anwendung prüfen.':`Bestehenden Ablauf für „${item.title}“ prüfen. Fehlende Datenfelder und Einzelfälle ergänzen, anschließend den genannten Abnahmefall nachweisen.`;
  const row=[id,`${key} ${area.name}`,item.title,item.data,item.criterion,packet,depends,medication?'Teilweise umgesetzt':'Bestand zu prüfen',medication?'Teilprüfung':'Offen','Offen','Offen','Offen',evidence,null,next];
  const stored=preserved.get(id);if(stored){row[7]=stored.implementation;row[8]=stored.function;row[9]=stored.care;row[10]=stored.design;row[11]=stored.legal;row[12]=stored.evidence;row[14]=stored.next;}
  taskRows.push(row);json.push({id,area:area.name,...item,packet,depends,implementation:row[7],function:row[8],care:row[9],design:row[10],legal:row[11],evidence:row[12],next:row[14]});
 });
 for(let i=0;i<area.items.length;i+=3){
  const ids=area.items.slice(i,i+3).map((_,n)=>`${key}-${String(i+n+1).padStart(2,'0')}`).join(', ');
  packetRows.push([`${key}-P${String(Math.floor(i/3)+1).padStart(2,'0')}`,area.name,ids,area.items.slice(i,i+3).map(x=>x.title).join('\n'),baseDeps[key],key==='H'&&i===3?'Begonnen mit Teilprüfung':'Offen','Vorhandenen Daten- und UI-Pfad feststellen. Konkrete Restarbeit für jede ID festhalten.','Die zugeordneten Einzelaufgaben und einschlägigen G01–G28-Prüfungen nachgewiesen; offene Punkte gesichert.']);
 }
}
for(const row of packetRows){const old=previous.packets.find(p=>p[0]===row[0]);if(old){row[5]=old[5];row[6]=old[6];}}
const n=taskRows.length,last=n+8;
styles(main,last,'O');
main.getRange('A2').values=[['Pflegedienst ambulant – A–Z-Arbeitsliste']];main.getRange('A2').format.font={size:16,bold:true,color:'#183B50'};
main.getRange('A3').values=[['Stand 08.10.2026']];main.getRange('D3').values=[[`${n} Fachaufgaben, ${gates.length} gemeinsame Prüfpunkte`]];main.getRange('H3').values=[['Push und Deployment gesperrt']];
main.getRange('A4:B4').values=[['Abnahme',null]];main.getRange('B4').formulas=[[`=COUNTIFS(N9:N${last},"Abgenommen")`]];
main.getRange('D4:E4').values=[['Offene Fachaufgaben',null]];main.getRange('E4').formulas=[[`=COUNTIFS(N9:N${last},"Offen")`]];
main.getRange('A5').values=[['Abgenommen: umgesetzt, Funktion/Pflege/Design/Recht geprüft und konkreter Nachweis vorhanden. Einzeltests allein reichen nicht.']];
main.getRange('A6').values=[['Neue Erkenntnisse erweitern den Katalog. Bei jedem Paket Originaldateien, Prüfnachweise und nächsten offenen Schritt sichern.']];
main.getRange('A8:O8').values=[['ID','Bereich','Aufgabe','Daten und fachlicher Inhalt','Konkreter Abnahmefall','Paket','Voraussetzungen','Umsetzung','Funktion','Pflege','Design','Recht','Nachweis und offene Lücken','Abnahme','Nächster Schritt']];
main.getRange(`A9:O${last}`).values=taskRows;
main.getRange(`N9:N${last}`).formulas=taskRows.map((_,i)=>{const r=i+9;return [`=IF(AND(H${r}="Umgesetzt",I${r}="Bestanden",OR(J${r}="Bestanden",J${r}="Entfällt geprüft"),OR(K${r}="Bestanden",K${r}="Entfällt geprüft"),OR(L${r}="Bestanden",L${r}="Entfällt geprüft"),M${r}<>""),"Abgenommen","Offen")`];});
const mainWidths=[11,31,35,47,63,13,31,23,18,18,18,18,58,18,62];
mainWidths.forEach((v,i)=>main.getRangeByIndexes(0,i,last,1).format.columnWidth=v);
main.getRange('A1:O6').format.rowHeight=24;main.getRange('A2:O2').format.rowHeight=30;
main.getRange(`H9:M${last}`).format.fill='#FFF8E6';
main.getRange(`H9:H${last}`).dataValidation={rule:{type:'list',values:['Bestand zu prüfen','Teilweise umgesetzt','Umgesetzt']}};
main.getRange(`I9:L${last}`).dataValidation={rule:{type:'list',values:['Offen','Teilprüfung','Bestanden','Entfällt geprüft']}};
main.getRange(`N9:N${last}`).conditionalFormats.add('containsText',{text:'Abgenommen',format:{fill:'#DCEFE4',font:{color:'#174A2B',bold:true}}});
main.tables.add(`A8:O${last}`,true,'Fachaufgaben');header(main,'A8:O8');main.freezePanes.freezeRows(8);main.freezePanes.freezeColumns(3);
const pLast=packetRows.length+7;styles(packets,pLast,'H');
packets.getRange('A2').values=[['Kleine Arbeitspakete']];packets.getRange('A2').format.font={size:16,bold:true};
packets.getRange('A3').values=[['Je Paket höchstens drei Fachaufgaben. Komplexe Abläufe vor Umsetzung weiter zerlegen.']];
packets.getRange('A4').values=[['Nächste Reihenfolge: A-P03 und A-P04 → H-P01 bis H-P06 → I-P01 und I-P02. Voraussetzungen der einzelnen Aufgaben vorher prüfen.']];
packets.getRange('A5').values=[['Vor Medikamenten-Webintegration: wiederhergestellten Bestand und aktuelle Verordnungsgrundlage prüfen. Status „Begonnen“ ist keine Abnahme.']];
packets.getRange('A7:H7').values=[['Paket','Bereich','Aufgaben-IDs','Arbeitsumfang','Voraussetzungen','Status','Nächste Tätigkeit','Abschlussbedingung']];packets.getRange(`A8:H${pLast}`).values=packetRows;
[15,35,29,57,31,28,67,75].forEach((v,i)=>packets.getRangeByIndexes(0,i,pLast,1).format.columnWidth=v);
packets.getRange('A1:H5').format.rowHeight=24;packets.getRange('A2:H2').format.rowHeight=30;
packets.getRange(`F8:F${pLast}`).dataValidation={rule:{type:'list',values:['Offen','Begonnen mit Teilprüfung','In Bearbeitung','Paket fachlich geprüft','Abgeschlossen']}};
packets.tables.add(`A7:H${pLast}`,true,'Arbeitspakete');header(packets,'A7:H7');packets.freezePanes.freezeRows(7);packets.freezePanes.freezeColumns(1);
styles(acceptance,gates.length+7,'F');acceptance.getRange('A2').values=[['Gemeinsame Abnahmebedingungen']];acceptance.getRange('A2').format.font={size:16,bold:true};
acceptance.getRange('A3').values=[['G01–G21 pro einschlägiger Fachaufgabe prüfen. G22–G28 zusätzlich als gemeinsame Betriebs- und Freigabebedingungen nachweisen.']];
acceptance.getRange('A4').values=[['Entfällt nur mit konkreter begründeter Prüfung im Nachweis. Ein Prüfergebnis ohne Beleg ergibt keine Abnahme.']];
acceptance.getRange('A6:F6').values=[['ID','Prüfbereich','Prüfpunkt','Erforderlicher Nachweis','Status','Ergebnis und Beleg']];
acceptance.getRange(`A7:F${gates.length+6}`).values=gates.map(g=>[...g,'Offen','']);
[12,21,39,98,21,78].forEach((v,i)=>acceptance.getRangeByIndexes(0,i,gates.length+7,1).format.columnWidth=v);
acceptance.getRange('A1:F4').format.rowHeight=24;acceptance.getRange('A2:F2').format.rowHeight=30;
acceptance.getRange(`E7:E${gates.length+6}`).dataValidation={rule:{type:'list',values:['Offen','Teilprüfung','Bestanden','Entfällt geprüft']}};
acceptance.tables.add(`A6:F${gates.length+6}`,true,'GemeinsameAbnahme');header(acceptance,'A6:F6');acceptance.freezePanes.freezeRows(6);
styles(source,sources.length+6,'F');source.getRange('A2').values=[['Quellen und weiterer Marktabgleich']];source.getRange('A2').format.font={size:16,bold:true};
source.getRange('A3').values=[['Öffentliche Anbieterunterlagen dienen dem Funktionsvergleich. Werbung belegt keine getestete Funktion und keine rechtliche Freigabe.']];
source.getRange('A5:F5').values=[['ID','Herausgeber','Unterlage','Tatsächlicher Recherchestand','Nächste Prüfung und Grenzen','URL']];source.getRange(`A6:F${sources.length+5}`).values=sources;
[12,25,48,69,83,95].forEach((v,i)=>source.getRangeByIndexes(0,i,sources.length+6,1).format.columnWidth=v);
source.getRange('A1:F3').format.rowHeight=24;source.getRange('A2:F2').format.rowHeight=30;source.tables.add(`A5:F${sources.length+5}`,true,'Quellenregister');header(source,'A5:F5');source.freezePanes.freezeRows(5);
for(const [s,range] of [[main,'A1:O6'],[packets,'A1:H5'],[acceptance,'A1:F4'],[source,'A1:F3']])s.getRange(range).format.wrapText=false;
// Verify that a single remaining review prevents completion, and restore inputs.
const baseline=main.getRange('H9:M9').values;
main.getRange('H9:M9').values=[['Umgesetzt','Bestanden','Bestanden','Bestanden','Offen','Probe: Nachweis vorhanden']];
wb.recalculate();if(main.getRange('N9').values[0][0]!=='Offen')throw new Error('Unvollständige Abnahme als vollständig markiert');
main.getRange('L9').values=[['Bestanden']];wb.recalculate();if(main.getRange('N9').values[0][0]!=='Abgenommen')throw new Error('Abnahme reagiert nicht');
main.getRange('M9').values=[['']];wb.recalculate();if(main.getRange('N9').values[0][0]!=='Offen')throw new Error('Abnahme ohne Nachweis');
main.getRange('H9:M9').values=baseline;wb.recalculate();
console.log((await wb.inspect({kind:'table',range:'Aufgaben!A3:E4',include:'values,formulas',tableMaxRows:2,tableMaxCols:5,maxChars:1500})).ndjson);
console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!',options:{useRegex:true,maxResults:10},maxChars:1500})).ndjson);
for(const [name,range] of [['Aufgaben','A8:E12'],['Pakete','A7:D11'],['Abnahme','A6:D10'],['Quellen','A5:E8'],['Aufgaben','H1:O6']]){
 const blob=await wb.render({sheetName:name,range,scale:1,format:'png'});await fs.writeFile(output+'/'+name+'.png',new Uint8Array(await blob.arrayBuffer()));
}
const file=await SpreadsheetFile.exportXlsx(wb);await file.save(output+'/CareSuite_Ambulant_A-Z_Arbeitsliste_2026-10-08.xlsx');
await fs.writeFile(root+'/docs/audit/ambulant-az-katalog-2026-10-08.json',JSON.stringify({version:previous.version??1,date:'2026-10-08',scope:'Web/Desktop; Android-Kompatibilität erhalten',release:'Kein Push und kein Deployment',tasks:json,gates,sources,packets:packetRows},null,2));
console.log(JSON.stringify({tasks:n,gates:gates.length,packets:packetRows.length,output}));
