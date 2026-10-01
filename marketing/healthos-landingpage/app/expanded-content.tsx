"use client";

import {useState} from 'react';
import {BookOpen,CalendarDays,Check,ChevronDown,Compass,Expand,FileCheck2,Layers3,MessageCircle,Monitor,Route,Search,ShieldCheck,Smartphone,Users,Wallet} from 'lucide-react';
import roleChapters from './content/role.json';
import processChapters from './content/process.json';
import guide from './content/guide.json';
import {captures} from './product-data';
import type {ProductCapture} from './product-explorer';

type OpenCapture = {onOpen:(capture:ProductCapture)=>void};
const readingChapters=[
  ['vision','Die Idee','Ein Arbeitsplatz, der zusammenführt.'],
  ['produkt','Originalansichten','Die Software im Detail entdecken.'],
  ['arbeitsbereiche','Drei Perspektiven','Verwaltung, Team und Klient:innen.'],
  ['funktionen','Der Alltag im Detail','Planung, Wege, Dokumentation und Austausch.'],
  ['einfuehrung','Euer Einstieg','Von der ersten Orientierung zur täglichen Arbeit.'],
  ['wissen','Fragen & Antworten','Zusammenhänge verständlich erklärt.'],
];
export function ReadingGuide({active}:{active:string}){
  return <>
    <section id="entdecken" className="reading-guide wrap section-anchor">
      <div className="reading-guide-intro"><span className="eyebrow">DIE HEALTHOS PRODUKTREISE</span><h2>Geht ins Detail.<br/><em>Es gibt viel zu entdecken.</em></h2><p>Lernt die Arbeitsumgebung aus eurer Perspektive kennen. Folgt der ganzen Geschichte oder steigt direkt in das Thema ein, das euch beschäftigt.</p></div>
      <nav className="reading-grid" aria-label="Inhaltsverzeichnis">{readingChapters.map(([id,title,text],i)=><a href={'#'+id} key={id}><span>0{i+1}</span><div><strong>{title}</strong><p>{text}</p></div><Compass size={20}/></a>)}</nav>
    </section>
    <nav className="reading-nav" aria-label="Schnellzugriff auf Kapitel"><div>{readingChapters.map(([id,title])=><a key={id} href={'#'+id} aria-current={active===id?'location':undefined}>{title}</a>)}<a href="#start" className="reading-entry">Zugang öffnen</a></div></nav>
  </>;
}

export function VisionChapter(){
  return <section className="vision-section section-anchor" id="vision"><div className="wrap">
    <div className="chapter-label reveal"><span>01</span> DIE IDEE HINTER HEALTHOS</div>
    <div className="vision-heading reveal"><h2>Viele Aufgaben.<br/>Ein Zusammenhang.<br/><em>Euer HealthOS.</em></h2><div className="vision-copy">{guide.introduction.paragraphs.slice(0,2).map(p=><p key={p.slice(0,30)}>{p}</p>)}</div></div>
    <div className="system-relation" aria-label="Zusammenspiel der drei Arbeitsbereiche"><div className="system-label"><Layers3 size={28}/><strong>CareSuite HealthOS</strong><span>DER GEMEINSAME ARBEITSRAUM</span></div><div className="system-roles">{[{icon:Monitor,title:'Verwaltung',text:'Planung · Organisation · Nachbearbeitung'},{icon:Users,title:'Mitarbeitende',text:'Einsätze · Wege · Dokumentation'},{icon:MessageCircle,title:'Klient:innen',text:'Termine · Unterlagen · Austausch'}].map(item=><div key={item.title}><item.icon size={26} strokeWidth={1.3}/><h3>{item.title}</h3><p>{item.text}</p></div>)}</div></div>
    <div className="vision-principles">{[{title:'Orientierung zuerst.',text:'Ein persönlicher Desktop macht häufig benötigte Themen erreichbar. Widgets bringen Informationen an den Einstieg; Suche und Navigation führen zu den einzelnen Aufgaben. So beginnt der nächste Schritt mit einem Überblick über das, was gerade wichtig ist.'},{title:'Den Vorgang weiterdenken.',text:'Eine Planung wirkt in die Durchführung hinein. Dokumentation und Bestätigung führen zum Nachweis. Informationen bekommen ihren Wert durch den Bezug zur Person, zum Einsatz und zum nächsten Arbeitsschritt. HealthOS stellt diese Zusammenhänge in den Mittelpunkt.'},{title:'Menschen bleiben beteiligt.',text:'Im Büro, unterwegs und im eigenen Portal entstehen unterschiedliche Fragen. Die drei Arbeitsbereiche geben diesen Perspektiven Raum. Wer organisiert, wer begleitet und wer Unterstützung erhält, findet einen Zugang für die eigene Beteiligung.'}].map((item,i)=><article key={item.title}><span>0{i+1}</span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
  </div></section>;
}
const roleIcons=[Monitor,Users,MessageCircle];
const roleNames=['Verwaltung','Mitarbeitende','Klient:innen'];
const roleCaptureIndexes=[0,3,4];
export function RoleChapters({onOpen}:OpenCapture){
  return <section id="arbeitsbereiche" className="role-worlds section-anchor"><div className="wrap">
    <div className="chapter-label reveal"><span>03</span> DREI ARBEITSBEREICHE</div><div className="heading-row reveal"><h2>Eine Software.<br/><em>Drei eigene Welten.</em></h2><p>Organisation, persönliche Arbeit und eigene Versorgung stellen unterschiedliche Anforderungen. Hier findet ihr die Details zu eurem Arbeitsbereich.</p></div>
    <nav className="role-jump-links" aria-label="Zu einem Arbeitsbereich springen">{roleChapters.map((role,i)=><a href={'#rolle-'+role.id} key={role.id}><span>0{i+1}</span>{roleNames[i]}</a>)}</nav>
    {roleChapters.map((role,i)=>{const Icon=roleIcons[i];return <article className={'role-story role-story-'+i} key={role.id} id={'rolle-'+role.id}>
      <aside className="role-story-intro"><div className="role-emblem"><Icon size={38} strokeWidth={1}/><span>0{i+1}</span></div><span className="eyebrow">{role.kicker}</span><h3>{role.title}</h3><p>{role.intro}</p><button className="quiet-link" onClick={()=>onOpen(captures[roleCaptureIndexes[i]])}><Expand size={17}/> Originalansicht öffnen</button><a className="text-link" href="#start">Zum passenden Zugang</a></aside>
      <div className="role-story-content">{role.sections.map((section,n)=><section className="role-topic" key={section.title}><div className="topic-heading"><span>0{n+1}</span><h4>{section.title}</h4></div>{section.paragraphs.map(p=><p key={p.slice(0,40)}>{p}</p>)}<div className="topic-takeaway"><Check size={18}/><p>{section.takeaway}</p></div></section>)}<div className="real-scenario"><span className="eyebrow">EIN BEISPIEL AUS DEM ARBEITSALLTAG</span><h4>{role.scenario.title}</h4><p>{role.scenario.text}</p></div></div>
    </article>})}
  </div></section>;
}
const processIcons=[CalendarDays,Route,FileCheck2,MessageCircle];
const processShort=['Planung','Mobilität','Nachweise','Verbindung'];
const processCaptures=[2,3,10,11];
export function ProcessChapters({onOpen}:OpenCapture){
  return <section id="funktionen" className="process-world section-anchor"><div className="wrap">
    <div className="chapter-label reveal"><span>05</span> DIE FUNKTIONEN IM DETAIL</div><div className="heading-row reveal"><h2>Was dazwischen liegt,<br/><em>macht den Unterschied.</em></h2><p>Ein genauer Blick auf die Abläufe hinter der Oberfläche. Von der ersten Planungsfrage bis zum späteren Wiederfinden eines Nachweises.</p></div>
    <nav className="process-index" aria-label="Funktionskapitel">{processChapters.map((part,i)=>{const Icon=processIcons[i];return <a key={part.id} href={'#'+part.id}><Icon size={22}/><span>{processShort[i]}</span><small>0{i+1}</small></a>})}</nav>
    {processChapters.map((part,i)=>{const Icon=processIcons[i];return <article className="process-dossier" id={part.id} key={part.id}><div className="dossier-heading"><div className="dossier-number">0{i+1}<Icon size={32} strokeWidth={1}/></div><div><span className="eyebrow">{part.kicker}</span><h3>{part.title}</h3><p className="dossier-lead">{part.intro}</p></div></div><div className="dossier-prose">{part.paragraphs.map(p=><p key={p.slice(0,35)}>{p}</p>)}</div><div className="dossier-facets">{part.facets.map((facet,n)=><section key={facet.title}><span>{String(n+1).padStart(2,'0')}</span><h4>{facet.title}</h4><p>{facet.text}</p></section>)}</div><div className="dossier-example"><BookOpen size={26} strokeWidth={1}/><div><span className="eyebrow">SO KANN ES IM ALLTAG AUSSEHEN</span><h4>{part.example.title}</h4><p>{part.example.text}</p></div></div><footer className="dossier-closing"><p>{part.closing}</p><button className="quiet-link" onClick={()=>onOpen(captures[processCaptures[i]])}><Expand size={17}/> {i===1?'Mitarbeiterportal ansehen':'Passende Softwareansicht'}</button></footer></article>})}
  </div></section>;
}
export function DeviceChapter(){
  return <section className="device-chapter wrap section-anchor" id="web-android"><div className="device-banner"><span className="eyebrow">WEB & ANDROID</span><div><Monitor size={48} strokeWidth={1}/><span>+</span><Smartphone size={43} strokeWidth={1}/></div><h2>Der Arbeitsplatz<br/><em>geht mit euch.</em></h2></div><div className="device-editorial"><p className="editorial-lead">Am Schreibtisch wird geplant. Unterwegs wird begleitet. Im Portal werden Informationen nachgelesen. Gute Software muss zu diesen unterschiedlichen Situationen passen.</p><p>CareSuite HealthOS bietet Webzugänge und einen Android-Zugang. Entscheidend ist die Aufgabe, die ihr gerade vor euch habt: einen größeren Zeitraum überblicken, einen einzelnen Einsatz bearbeiten oder die eigene Versorgung nachvollziehen. Die Rolle und die zugewiesenen Rechte bestimmen, welche Bereiche dafür bereitstehen. Der digitale Arbeitsplatz erhält so einen konkreten Bezug zu der Person, die ihn nutzt.</p><div className="device-contexts"><article><h3>Im Büro</h3><p>Ein großer Bildschirm bietet Raum für Kalender, Übersichten und ausführliche Bearbeitung. Apps, Widgets und die Navigation verbinden die regelmäßig benötigten Themen mit dem persönlichen Einstieg.</p></article><article><h3>Im Einsatz</h3><p>Der nächste Schritt im Tagesablauf steht im Vordergrund. Eigene Einsätze, Wege, Dokumentation und Bestätigungen werden im jeweiligen Arbeitsbereich bearbeitet. Die Rückschau auf Zeiten und Fahrten ergänzt diese tägliche Nutzung.</p></article><article><h3>Im eigenen Portal</h3><p>Klient:innen finden ihre Termine, freigegebenen Unterlagen und Kontaktmöglichkeiten. Sie können Informationen in Ruhe ansehen und Rückfragen mit dem passenden Bezug anstoßen.</p></article></div><p>Für euren Einstieg lohnt sich der Blick auf die Geräte, die euer Team tatsächlich verwendet. Öffnet einen typischen Vorgang dort, wo er später bearbeitet werden soll. So lernt ihr die Verbindung zwischen Oberfläche, Arbeitsbereich und Alltag aus erster Hand kennen.</p></div></section>;
}
export function AdoptionChapter(){
  return <section id="einfuehrung" className="adoption-section section-anchor"><div className="wrap"><div className="chapter-label reveal"><span>08</span> DER EINSTIEG IN EUREN BETRIEB</div><div className="heading-row reveal"><h2>Ein guter Anfang<br/><em>hat einen klaren Ablauf.</em></h2><p>Die erste Begegnung mit HealthOS kann direkt an eurem Alltag beginnen. Vier Schritte helfen, aus dem ersten Eindruck praktische Erfahrung zu machen.</p></div><div className="adoption-path">{guide.onboarding.map((step,i)=><article key={step.title}><div className="adoption-marker">0{i+1}</div><div><h3>{step.title}</h3><p>{step.text}</p><ul>{step.checklist.map(point=><li key={point}><Check size={16}/><span>{point}</span></li>)}</ul></div></article>)}</div><div className="decision-notes">{guide.decisions.map((decision,i)=><article key={decision.title}><span>0{i+1}</span><h3>{decision.title}</h3><p>{decision.text}</p></article>)}</div></div></section>;
}
export function KnowledgeChapter(){
  const [query,setQuery]=useState(''),[expanded,setExpanded]=useState<string[]>([]);
  const normalized=query.trim().toLocaleLowerCase('de');
  const results=guide.faq.filter(item=>(item.question+' '+item.answer).toLocaleLowerCase('de').includes(normalized));
  const toggle=(question:string,open:boolean)=>setExpanded(previous=>open?[...new Set([...previous,question])]:previous.filter(q=>q!==question));
  return <section id="wissen" className="knowledge-section wrap section-anchor"><div className="chapter-label reveal"><span>09</span> WISSENSWERTES ZU HEALTHOS</div><div className="heading-row reveal"><h2>Gute Fragen.<br/><em>Ausführliche Antworten.</em></h2><p>Hier findet ihr mehr zu den Zusammenhängen, zur Nutzung und zum ersten Kennenlernen der Software.</p></div><div className="knowledge-controls"><label><Search size={20}/><span className="sr-only">Fragen durchsuchen</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Zum Beispiel: Unterschrift, Budget oder Neo"/></label><button onClick={()=>setExpanded(results.every(q=>expanded.includes(q.question))?[]:results.map(q=>q.question))}>{results.length>0&&results.every(q=>expanded.includes(q.question))?'Antworten einklappen':'Alle Antworten öffnen'}<ChevronDown size={17}/></button></div><p className="knowledge-count" aria-live="polite">{results.length} {results.length===1?'passende Frage':'Fragen'}{query?' zu eurer Suche':''}</p><div className="knowledge-list">{results.map(item=><details key={item.question} open={expanded.includes(item.question)} onToggle={e=>{const open=e.currentTarget.open;if(open!==expanded.includes(item.question))toggle(item.question,open)}}><summary><span>{item.question}</span><ChevronDown size={19}/></summary><p>{item.answer}</p>{'link' in item&&item.link&&<a className="knowledge-related" href={item.link.href}>{item.link.label}</a>}</details>)}</div>{results.length===0&&<div className="knowledge-empty"><p>Zu diesem Begriff gibt es noch keine passende Frage. Versucht einen anderen Begriff oder zeigt alle Fragen an.</p><button className="quiet-link" onClick={()=>setQuery('')}>Alle Fragen anzeigen</button></div>}</section>;
}
