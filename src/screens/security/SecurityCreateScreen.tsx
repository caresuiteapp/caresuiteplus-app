import { DomainCreateScreen } from '@/screens/shared/DomainCreateScreen';
import { createSecurityItem } from '@/lib/security';
import { SECURITY_DEMO_TENANT } from '@/data/demo/domains/securityDemo';
import { useAuth } from '@/lib/auth/context';
import type { SecurityCategory } from '@/types/security';

/** WP546 — Create Security Finding */
export function SecurityCreateScreen() {
  const { profile } = useAuth();
  return (
    <DomainCreateScreen
      wpNumber={546}
      title="Finding anlegen"
      entityLabel="Finding"
      fields={[
        { key: 'title', label: 'Titel', required: true },
        { key: 'category', label: 'Kategorie (dsgvo/access/performance/audit)', required: true },
      ]}
      onSubmit={async (values) => {
        const category = (values.category as SecurityCategory) || 'dsgvo';
        const result = await createSecurityItem(SECURITY_DEMO_TENANT, values.title, category, profile?.roleKey);
        if (!result.ok) return result;
        return { ok: true as const, id: result.data.id };
      }}
      successRoute={(id) => `/business/security/${id}`}
    />
  );
}
