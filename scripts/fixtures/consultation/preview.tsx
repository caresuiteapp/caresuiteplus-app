import {createRoot} from 'react-dom/client';
import {ConsultationWorkspaceScreen} from '../../../src/features/beratung/ConsultationWorkspaceScreen.web';
const employee=new URLSearchParams(window.location.search).get('actor')==='portal';
createRoot(document.getElementById('root')!).render(<ConsultationWorkspaceScreen employeeView={employee}/>);
