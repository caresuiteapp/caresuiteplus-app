import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
export const accepted=t=>t.implementation==='Umgesetzt'&&t.function==='Bestanden'&&['Bestanden','Entfällt geprüft'].includes(t.care)&&['Bestanden','Entfällt geprüft'].includes(t.design)&&['Bestanden','Entfällt geprüft'].includes(t.legal)&&typeof t.evidence==='string'&&!!t.evidence.trim();
export function calculateMilestone(catalog) {
const groups=Map.groupBy(catalog.tasks,t=>t.id.split('-')[0]);
const areas=Array.from(groups,([letter,tasks])=>({letter,area:tasks[0].area,total:tasks.length,requiredForHalf:Math.ceil(tasks.length/2),accepted:tasks.filter(accepted).length,locallyStarted:tasks.filter(t=>t.implementation==='Teilweise umgesetzt'||t.implementation==='Umgesetzt').length}));
const required=areas.reduce((sum,a)=>sum+a.requiredForHalf,0),count=catalog.tasks.filter(accepted).length;
if(catalog.tasks.length!==262||new Set(catalog.tasks.map(t=>t.id)).size!==262||areas.length!==26)throw Error('A–Z-Aufgabenbestand geändert oder uneindeutig.');
const result={target:'Mindestens 50% vollständig abgenommen in jedem der 26 Bereiche',total:262,required,accepted:count,acceptancePercent:count/262*100,reached:areas.every(a=>a.accepted>=a.requiredForHalf),areas};
return result;
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 const path=process.argv[2]??new URL('../../docs/audit/ambulant-az-katalog-2026-10-08.json',import.meta.url);
 const output=JSON.stringify(calculateMilestone(JSON.parse(await fs.readFile(path,'utf8'))),null,2)+'\n';
 if(process.argv[3])await fs.writeFile(process.argv[3],output);else process.stdout.write(output);
}
