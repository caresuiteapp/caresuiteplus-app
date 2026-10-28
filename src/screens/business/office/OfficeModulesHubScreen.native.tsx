// Generated native presentation from src/screens/business/office/OfficeModulesHubScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSection,NativeStyle,NativeH1,NativeP,NativeDiv,NativeButton,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { ScreenShell } from "../../../components/layout/ScreenShell.tsx";
import { useFlowRouter } from "../../../hooks/useFlowRouter.ts";
import { useModuleAssignmentWorkspace } from "../../../hooks/useModuleAssignmentWorkspace.native.ts";
import { ROLE_LABELS } from '@/data/constants';
import type { ModuleAssignmentSection } from '@/lib/officeCore/types';
import { moduleAssignmentSectionDefinition } from "../../../lib/officeModules/moduleAssignmentWorkspaceModel.native.ts";
import { ModuleAssignmentsWorkspace } from "./ModuleAssignmentsWorkspace.native.tsx";
const STATE_CSS = `
.cs-module-assignment-state{box-sizing:border-box;color-scheme:light;max-width:680px;width:100%;margin:24px auto;padding:clamp(20px,4vw,32px);border:1px solid #d7e4ef;border-radius:22px;background:#fff;color:#19344f;box-shadow:0 10px 32px #214b7910;font:inherit;font-size:calc(15px * var(--app-font-scale,1));line-height:1.6;overflow-wrap:anywhere}
.cs-module-assignment-state h1{font-size:1.6em;line-height:1.25;letter-spacing:-.025em;margin:0 0 12px}.cs-module-assignment-state p{margin:0;color:#526a80}.cs-module-assignment-state-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:20px}.cs-module-assignment-state button{font:inherit;font-weight:650;min-height:44px;padding:10px 16px;border:1px solid #c3d9ed;border-radius:12px;color:#155e9b;background:#edf5ff;cursor:pointer}.cs-module-assignment-state button:focus-visible{outline:3px solid #1376cd;outline-offset:3px}
`;
export function OfficeModuleAssignmentsScreen({ section }: {
    section?: ModuleAssignmentSection;
}) {
    const router = useFlowRouter();
    const { data, loading, error, roleKey, identityKey, refresh } = useModuleAssignmentWorkspace(section);
    const title = section ? moduleAssignmentSectionDefinition(section).label : 'Modulzuordnungen';
    return <NativeWorkspaceStyleScope css={[STATE_CSS, STATE_CSS]}>{<ScreenShell title={title} showBack={false} contentOwnsHeader>
    {data ? <ModuleAssignmentsWorkspace key={identityKey} data={data} loading={loading} error={error} roleLabel={roleKey ? ROLE_LABELS[roleKey] : null} onRefresh={refresh} onOpen={route => router.push(route as never)}/> :
            <NativeSection className="cs-module-assignment-state" aria-busy={loading}>
        <NativeStyle>{STATE_CSS}</NativeStyle><NativeH1>{title}</NativeH1>
        {loading ? <NativeP role="status">Ihre Zuordnungen und Zugriffsrechte werden geladen…</NativeP> : <>
          <NativeP role="alert">{error || 'Die Zuordnungen konnten nicht geladen werden.'}</NativeP>
          <NativeDiv className="cs-module-assignment-state-actions">
            <NativeButton type="button" onClick={refresh}>Erneut versuchen</NativeButton>
            <NativeButton type="button" onClick={() => router.push((section ? '/business/office/modules' : '/office') as never)}>{section ? 'Zur Zuordnungsübersicht' : 'Zu Office'}</NativeButton>
          </NativeDiv>
        </>}
      </NativeSection>}
  </ScreenShell>}</NativeWorkspaceStyleScope>;
}
export function OfficeModulesHubScreen() {
    return <NativeWorkspaceStyleScope css={[STATE_CSS]}>{<OfficeModuleAssignmentsScreen />}</NativeWorkspaceStyleScope>;
}
