import {View} from 'react-native';
import {FilterChipGroup} from '@/components/ui';
import {AssessmentPathWorkspace} from './AssessmentPathWorkspace.web';
import {CarePlanPathWorkspace} from './CarePlanPathWorkspace.web';
import {useAssessmentPathSelection} from '@/lib/careAssessment/useAssessmentPathSelection.web';
import type {AssessmentPathIntegration} from '@/lib/careAssessment/useAssessmentPathOwnership.web';
import {spacing} from '@/theme';
export function AssessmentPlanPaths({assessmentId,pendingAssessment=false,pendingPlan=false,...integration}:{assessmentId:string;pendingAssessment?:boolean;pendingPlan?:boolean}&AssessmentPathIntegration){
 const selection=useAssessmentPathSelection({...integration,identity:assessmentId,initial:pendingPlan&&!pendingAssessment?'plan':'assessment'}),shared={assessmentId,blocked:integration.blocked||(selection.selected==='assessment'?pendingPlan:pendingAssessment),isCurrent:selection.current,isLeaving:selection.isLeaving,registerLeave:selection.registerChild,onPhase:selection.onPhase};
 return<View style={{minWidth:0,gap:spacing.md}}><FilterChipGroup wrap options={[{key:'assessment',label:'Assessmentpfad'},{key:'plan',label:'Pflegeplanung'}]} value={selection.selected} onChange={value=>void selection.change(value as 'assessment'|'plan')}/>{selection.selected==='assessment'?<AssessmentPathWorkspace {...shared}/>:<CarePlanPathWorkspace {...shared}/>}</View>;
}
