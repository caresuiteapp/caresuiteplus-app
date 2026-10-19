export type TreatmentWorkspaceView='treatments'|'protocols'|'controls'|'infusions'|'care-packet';
/** Existing general route owns Web-only views; clinical source data never comes from URL fields. */
export function treatmentWorkspaceView(value:unknown):TreatmentWorkspaceView{
 if(value===undefined)return 'treatments';
 if(typeof value!=='string'||!['treatments','protocols','controls','infusions','care-packet'].includes(value))throw Error('Pflegeansicht unvollständig oder ungültig. Die Behandlungspflege erneut öffnen.');
 return value as TreatmentWorkspaceView;
}
export const treatmentWorkspaceTarget=(view:TreatmentWorkspaceView)=>({pathname:'/pflege/behandlungspflege',params:{view:treatmentWorkspaceView(view)}});
