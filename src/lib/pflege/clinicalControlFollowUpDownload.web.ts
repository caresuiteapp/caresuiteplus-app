import {buildClinicalControlFollowUpArchive} from './clinicalControlFollowUpExport.ts';
import type {ControlRecord} from './clinicalControlGateway.ts';
import type {ControlSource} from './clinicalControlDomain.ts';

export function exportClinicalControlFollowUp(records:ControlRecord[],tenant:string,client:string,taskId:string,mode:'print'|'html'|'json',sources:ControlSource[]|null=null):void{
 if(!['print','html','json'].includes(mode))throw Error('Unbekanntes Auszugsformat.');
 if(typeof window==='undefined'||typeof document==='undefined')throw Error('Der Kontrolloriginal-Auszug benötigt die Webansicht.');
 const now=Date.now();
 const file=buildClinicalControlFollowUpArchive(records,tenant,client,taskId,new Date(now).toISOString(),now,sources);
 if(mode==='print'){
  const page=window.open('','_blank');if(!page)throw Error('Druckfenster wurde blockiert. Fenster erlauben oder den HTML-Auszug herunterladen.');
  try{page.opener=null;page.document.open();page.document.write(file.html);page.document.close();page.focus();page.print();}catch(e){page.close();throw e;}return;
 }
 const json=mode==='json',link=document.createElement('a'),url=URL.createObjectURL(new Blob([json?file.json:file.html],{type:json?'application/json;charset=utf-8':'text/html;charset=utf-8'}));
 let started=false;
 try{link.href=url;link.download=file.filename+(json?'.json':'.html');document.body.appendChild(link);link.click();started=true;}finally{link.remove();if(started)setTimeout(()=>URL.revokeObjectURL(url),1000);else URL.revokeObjectURL(url);}
}
