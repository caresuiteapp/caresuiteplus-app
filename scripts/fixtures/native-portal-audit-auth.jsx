// Real guard implementations and the real context. Only the surrounding
// session value/transport is injected by the audit entry point.
export {AuthContext,useAuth} from '../../src/lib/auth/context.ts';
export {RequireAuth} from '../../src/lib/auth/RequireAuth.tsx';
export {RequireRole} from '../../src/lib/auth/RequireRole.tsx';
export {RequireEmployeePasswordSetup} from '../../src/lib/auth/RequireEmployeePasswordSetup.tsx';
export {RequireDevOrAdmin} from '../../src/lib/auth/RequireDevOrAdmin.tsx';
export {canAccessDeveloperTools} from '../../src/lib/auth/devAccess.ts';
export {resolveEmployeeFirstLoginHref} from '../../src/lib/auth/loginRouter.ts';
export {resolveLoginDashboardRoute,BUSINESS_DASHBOARD_ROUTE,resolveBusinessDashboardRoute} from '../../src/lib/auth/authNavigation.ts';
export const AuthProvider=({children})=>children;
