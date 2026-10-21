import {useLocalSearchParams,useRouter} from 'expo-router';
import {ScreenShell} from '@/components/layout';
import {ErrorState,PremiumButton} from '@/components/ui';
import {treatmentWorkspaceView} from '@/lib/pflege/treatmentWorkspaceNavigation';
import {TreatmentExecutionListScreen} from './TreatmentExecutionListScreen.web';
import {DailyProtocolScreen} from './DailyProtocolScreen.web';
import {ClinicalControlScreen} from './ClinicalControlScreen.web';
import {InfusionCourseScreen} from './InfusionCourseScreen.web';
import {TreatmentCareWorkspaceScreen} from './TreatmentCareWorkspaceScreen.web';
export function TreatmentWorkspaceScreen(){
 const params=useLocalSearchParams(),router=useRouter();let view,error:string|null=null;
 try{view=treatmentWorkspaceView(params.view);}catch(e){error=e instanceof Error?e.message:'Pflegeansicht nicht verfügbar.';}
 if(error)return <ScreenShell title="Behandlungspflege"><ErrorState message={error}/><PremiumButton title="Behandlungspflege erneut öffnen" onPress={()=>router.replace('/pflege/behandlungspflege' as never)}/></ScreenShell>;
 if(view==='protocols')return <DailyProtocolScreen/>;
 if(view==='controls')return <ClinicalControlScreen/>;
 if(view==='infusions')return <InfusionCourseScreen/>;
 if(view==='care-packet')return <TreatmentCareWorkspaceScreen/>;
 return <TreatmentExecutionListScreen/>;
}
