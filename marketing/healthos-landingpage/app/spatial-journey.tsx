"use client";
import {useEffect,useRef,useState} from 'react';
import {Expand,Monitor,Smartphone,Users} from 'lucide-react';
import {captures} from './product-data';
import type {ProductCapture} from './product-explorer';
const worlds=[{name:'Verwaltung',title:'Den Überblick.\nIn deiner Hand.',line:'Planung. Teams. Organisation.',icon:Monitor,image:0},{name:'Mitarbeitende',title:'Dein Tag.\nDein Flow.',line:'Einsätze. Wege. Dokumentation.',icon:Smartphone,image:3},{name:'Klient:innen',title:'Nähe.\nDigital verbunden.',line:'Termine. Unterlagen. Austausch.',icon:Users,image:4}];
export function SpatialJourney({paused,onOpen}:{paused:boolean;onOpen:(image:ProductCapture)=>void}){
 const section=useRef<HTMLElement>(null),scene=useRef<HTMLDivElement>(null),phaseRef=useRef(0);
 const [phase,setPhase]=useState(0),[chosen,setChosen]=useState<number|null>(null);
 useEffect(()=>{let raf=0;const update=()=>{raf=0;const el=section.current;if(!el)return;const r=el.getBoundingClientRect(),travel=Math.max(1,r.height-innerHeight);const p=Math.max(0,Math.min(1,-r.top/travel));const q=chosen===null?p:chosen/2;scene.current?.style.setProperty('--journey',String(paused?.5:q));const next=chosen??Math.min(2,Math.floor(p*3));if(next!==phaseRef.current){phaseRef.current=next;setPhase(next)}};const schedule=()=>{if(!raf)raf=requestAnimationFrame(update)};update();window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);return()=>{cancelAnimationFrame(raf);window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule)}},[paused,chosen]);
 return <section id="dimension" className="spatial-journey section-anchor" ref={section} aria-label="Die drei HealthOS-Arbeitsbereiche"><div className="journey-sticky" ref={scene} data-phase={phase}>
 <div className="journey-halo" aria-hidden="true"/><div className="journey-lens" aria-hidden="true"><i/><i/><i/></div>
 <div className="journey-heading wrap"><span className="eyebrow">EIN HEALTHOS. DREI PERSPEKTIVEN.</span><h2 key={phase}>{worlds[phase].title.split('\n').map((line,i)=>i?<em key={line}>{line}</em>:<span key={line}>{line}</span>)}</h2><p>{worlds[phase].line}</p></div>
 <div className="journey-screens">{worlds.map((world,i)=><button key={world.name} className={'journey-screen journey-screen-'+i} aria-label={world.name+' – Originalansicht öffnen'} onClick={()=>onOpen(captures[world.image])}><div className="journey-screen-bar"><world.icon size={16}/><span>{world.name}</span><Expand size={15}/></div><img src={captures[world.image].src} alt={'CareSuite '+world.name+' – echte Demo-Ansicht'} width="1363" height="936" loading="lazy"/><span className="journey-glint" aria-hidden="true"/></button>)}</div>
 <div className="journey-selector wrap" role="group" aria-label="Arbeitsbereich ansehen">{worlds.map((world,i)=><button key={world.name} aria-pressed={phase===i} onClick={()=>{setChosen(i);setPhase(i);phaseRef.current=i}}><span>0{i+1}</span><world.icon size={18}/>{world.name}</button>)}{chosen!==null&&<button className="journey-resume" onClick={()=>setChosen(null)}>Scroll folgen</button>}</div>
 </div></section>
}
