import { ScreenShell } from '@/components/layout/ScreenShell.web';
import { useFlowRouter } from '@/hooks/useFlowRouter';
import { useModuleAssignmentWorkspace } from '@/hooks/useModuleAssignmentWorkspace.web';
import { ROLE_LABELS } from '@/data/constants';
import type { ModuleAssignmentSection } from '@/lib/officeCore/types';
import { moduleAssignmentSectionDefinition } from '@/lib/officeModules/moduleAssignmentWorkspaceModel.web';
import { ModuleAssignmentsWorkspace } from './ModuleAssignmentsWorkspace.web';

const STATE_CSS = `
.cs-module-assignment-state{box-sizing:border-box;color-scheme:light;max-width:680px;width:100%;margin:24px auto;padding:clamp(20px,4vw,32px);border:1px solid #d7e4ef;border-radius:22px;background:#fff;color:#19344f;box-shadow:0 10px 32px #214b7910;font:inherit;font-size:calc(15px * var(--app-font-scale,1));line-height:1.6;overflow-wrap:anywhere}
.cs-module-assignment-state h1{font-size:1.6em;line-height:1.25;letter-spacing:-.025em;margin:0 0 12px}.cs-module-assignment-state p{margin:0;color:#526a80}.cs-module-assignment-state-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:20px}.cs-module-assignment-state button{font:inherit;font-weight:650;min-height:44px;padding:10px 16px;border:1px solid #c3d9ed;border-radius:12px;color:#155e9b;background:#edf5ff;cursor:pointer}.cs-module-assignment-state button:focus-visible{outline:3px solid #1376cd;outline-offset:3px}
`;

export function OfficeModuleAssignmentsScreen({ section }: { section?: ModuleAssignmentSection }) {
  const router = useFlowRouter();
  const { data, loading, error, roleKey, identityKey, refresh } = useModuleAssignmentWorkspace(section);
  const title = section ? moduleAssignmentSectionDefinition(section).label : 'Modulzuordnungen';
  return <ScreenShell title={title} showBack={false} contentOwnsHeader>
    {data ? <ModuleAssignmentsWorkspace key={identityKey} data={data} loading={loading} error={error}
      roleLabel={roleKey ? ROLE_LABELS[roleKey] : null} onRefresh={refresh}
      onOpen={route => router.push(route as never)} /> :
      <section className="cs-module-assignment-state" aria-busy={loading}>
        <style>{STATE_CSS}</style><h1>{title}</h1>
        {loading ? <p role="status">Ihre Zuordnungen und Zugriffsrechte werden geladen…</p> : <>
          <p role="alert">{error || 'Die Zuordnungen konnten nicht geladen werden.'}</p>
          <div className="cs-module-assignment-state-actions">
            <button type="button" onClick={refresh}>Erneut versuchen</button>
            <button type="button" onClick={() => router.push((section ? '/business/office/modules' : '/office') as never)}>{section ? 'Zur Zuordnungsübersicht' : 'Zu Office'}</button>
          </div>
        </>}
      </section>}
  </ScreenShell>;
}

export function OfficeModulesHubScreen() {
  return <OfficeModuleAssignmentsScreen />;
}
