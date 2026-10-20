import {buildPlanReviewControlsArchive} from './planReviewControlsExport.ts';
import type {EvaluationPlan,EvaluationRecord} from './planEvaluationDomain.ts';
import type {ControlSource} from '../pflege/clinicalControlDomain.ts';
import type {ControlRecord} from '../pflege/clinicalControlGateway.ts';

export function exportPlanReviewControls(plan:EvaluationPlan,evaluations:EvaluationRecord[],controls:ControlRecord[],tenant:string,assessment:string,client:string,mode:'print'|'html'|'json',sources:ControlSource[]|null=null):void{
 if(!['print','html','json'].includes(mode))throw Error('Unbekanntes Auszugsformat.');
 if(typeof window==='undefined'||typeof document==='undefined')throw Error('Die Prüfübersicht mit Kontrollaufträgen benötigt die Webansicht.');
 const now=Date.now();
 const file=buildPlanReviewControlsArchive(plan,evaluations,controls,tenant,assessment,client,new Date(now).toISOString(),now,sources);
 if(mode==='print'){
  const page=window.open('','_blank');if(!page)throw Error('Druckfenster wurde blockiert. Fenster erlauben oder den HTML-Auszug herunterladen.');
  try{page.opener=null;page.document.open();page.document.write(file.html);page.document.close();page.focus();page.print();}catch(e){page.close();throw e;}return;
 }
 const json=mode==='json',link=document.createElement('a'),url=URL.createObjectURL(new Blob([json?file.json:file.html],{type:json?'application/json;charset=utf-8':'text/html;charset=utf-8'}));
 let started=false;
 try{link.href=url;link.download=file.filename+(json?'.json':'.html');document.body.appendChild(link);link.click();started=true;}finally{link.remove();if(started)setTimeout(()=>URL.revokeObjectURL(url),1000);else URL.revokeObjectURL(url);}
}
