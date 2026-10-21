import {buildEvaluationArchive} from './planEvaluationExport.ts';
import type {EvaluationRecord} from './planEvaluationDomain.ts';
export function exportEvaluationHistory(records:EvaluationRecord[],tenant:string,assessment:string,client:string,mode:'print'|'html'|'json'):void{
 if(!['print','html','json'].includes(mode))throw Error('Unbekanntes Auszugsformat.');
 if(typeof window==='undefined'||typeof document==='undefined')throw Error('Der Evaluationsauszug benötigt die Webansicht.');
 const file=buildEvaluationArchive(records,tenant,assessment,client,new Date().toISOString());
 if(mode==='print'){
  const page=window.open('','_blank');if(!page)throw Error('Druckfenster wurde blockiert. Fenster erlauben oder den HTML-Auszug herunterladen.');
  try{page.opener=null;page.document.open();page.document.write(file.html);page.document.close();page.focus();page.print();}catch(e){page.close();throw e;}return;
 }
 const json=mode==='json',url=URL.createObjectURL(new Blob([json?file.json:file.html],{type:json?'application/json;charset=utf-8':'text/html;charset=utf-8'})),link=document.createElement('a');
 let started=false;
 try{link.href=url;link.download=file.filename+(json?'.json':'.html');document.body.appendChild(link);link.click();started=true;}finally{link.remove();if(started)setTimeout(()=>URL.revokeObjectURL(url),1000);else URL.revokeObjectURL(url);}
}
