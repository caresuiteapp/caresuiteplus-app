import { StyleSheet, Text, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { InfoBanner, PremiumButton, PremiumInput } from '@/components/ui';
import type { PermissionKey, RoleKey } from '@/types';
import type { RoleTemplate } from '@/types/permissions/rbac';
import {
  createTenantRoleTemplate,
  deleteTenantRoleTemplate,
  duplicateRoleTemplate,
  fetchRoleTemplatePermissions,
  listRoleTemplates,
  saveRoleTemplatePermissions,
  updateTenantRoleTemplate,
} from '@/lib/permissions/roleTemplateService';
import { useAdaptiveContentStyles } from '@/design/tokens/carelightadaptive';
import { spacing } from '@/theme';

type RbacTenantRolesPanelProps = {
  tenantId: string;
  canManage: boolean;
  actorRoleKey?: RoleKey | null;
  actorProfileId?: string | null;
};

export function RbacTenantRolesPanel({
  tenantId,
  canManage,
  actorRoleKey,
  actorProfileId,
}: RbacTenantRolesPanelProps) {
  const content = useAdaptiveContentStyles();
  const [templates, setTemplates] = useState<RoleTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [description, setDescription] = useState('');
  const [permissionCount, setPermissionCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        block: { gap: spacing.sm, marginBottom: spacing.md },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.sm,
          paddingVertical: spacing.xs,
        },
        label: { ...content.body, flex: 1, color: content.primary.color },
      }),
    [content],
  );

  async function refreshTemplates() {
    const result = await listRoleTemplates(tenantId);
    if (result.ok) setTemplates(result.data);
  }

  useEffect(() => {
    void refreshTemplates();
  }, [tenantId]);

  const customTemplates = templates.filter((template) => template.tenantId === tenantId);
  const selected = templates.find((template) => template.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) {
      setPermissionCount(0);
      return;
    }
    void fetchRoleTemplatePermissions(selected.id, selected.roleKey as RoleKey).then((result) => {
      if (result.ok) setPermissionCount(result.data.length);
    });
  }, [selected]);

  async function handleDuplicate(source: RoleTemplate) {
    if (!canManage) return;
    setLoading(true);
    const result = await duplicateRoleTemplate(
      tenantId,
      source.id,
      `${source.name} (Kopie)`,
      actorProfileId,
      actorRoleKey,
    );
    setLoading(false);
    if (result.ok) {
      setMessage('Rollenvorlage dupliziert.');
      await refreshTemplates();
      setSelectedId(result.data.id);
    } else {
      setMessage(result.error);
    }
  }

  async function handleCreate() {
    if (!canManage || !newName.trim()) return;
    setLoading(true);
    const result = await createTenantRoleTemplate({
      tenantId,
      name: newName.trim(),
      description: description.trim() || null,
      actorId: actorProfileId,
      actorRole: actorRoleKey,
    });
    setLoading(false);
    if (result.ok) {
      setMessage('Mandanten-Rolle angelegt.');
      setNewName('');
      setDescription('');
      await refreshTemplates();
      setSelectedId(result.data.id);
    } else {
      setMessage(result.error);
    }
  }

  async function handleUpdateMetadata() {
    if (!canManage || !selected) return;
    setLoading(true);
    const result = await updateTenantRoleTemplate(
      tenantId,
      selected.id,
      { name: newName.trim() || selected.name, description: description.trim() || null },
      actorProfileId,
      actorRoleKey,
    );
    setLoading(false);
    if (result.ok) {
      setMessage('Rollenvorlage aktualisiert.');
      await refreshTemplates();
    } else {
      setMessage(result.error);
    }
  }

  async function handleDelete() {
    if (!canManage || !selected) return;
    setLoading(true);
    const result = await deleteTenantRoleTemplate(
      tenantId,
      selected.id,
      actorProfileId,
      actorRoleKey,
    );
    setLoading(false);
    if (result.ok) {
      setMessage('Rollenvorlage gelöscht.');
      setSelectedId(null);
      await refreshTemplates();
    } else {
      setMessage(result.error);
    }
  }

  async function handleCopyPermissionsFromSystem() {
    if (!canManage || !selected) return;
    const system = templates.find((template) => template.roleKey === 'dispatch' && template.isSystemRole);
    if (!system) return;
    const sourcePerms = await fetchRoleTemplatePermissions(system.id, 'dispatch');
    if (!sourcePerms.ok) return;
    setLoading(true);
    const result = await saveRoleTemplatePermissions(
      tenantId,
      selected.id,
      sourcePerms.data,
      actorProfileId,
      actorRoleKey,
      'Systemvorlage dispatch übernommen',
    );
    setLoading(false);
    if (result.ok) {
      setPermissionCount(result.data.length);
      setMessage('Rechte aus Systemvorlage übernommen.');
    } else {
      setMessage(result.error);
    }
  }

  if (!canManage) {
    return (
      <InfoBanner
        variant="info"
        title="Keine Admin-Rechte"
        message="Mandanten-Rollenvorlagen können nur von Tenant-Admins verwaltet werden."
      />
    );
  }

  return (
    <View style={styles.block}>
      <InfoBanner
        variant="info"
        title="Mandanten-Rollenvorlagen"
        message="Systemrollen können dupliziert und mandantenspezifisch angepasst werden."
      />
      {message ? <Text style={content.caption}>{message}</Text> : null}

      {templates
        .filter((template) => template.isSystemRole)
        .slice(0, 6)
        .map((template) => (
          <View key={template.id} style={styles.row}>
            <Text style={styles.label}>{template.name} (System)</Text>
            <PremiumButton title="Duplizieren" size="sm" onPress={() => handleDuplicate(template)} loading={loading} />
          </View>
        ))}

      {customTemplates.map((template) => (
        <View key={template.id} style={styles.row}>
          <Text style={styles.label}>{template.name}</Text>
          <PremiumButton title="Bearbeiten" size="sm" variant="secondary" onPress={() => {
            setSelectedId(template.id);
            setNewName(template.name);
            setDescription(template.description ?? '');
          }} />
        </View>
      ))}

      <PremiumInput label="Neue Rolle" value={newName} onChangeText={setNewName} placeholder="Name der Rollenvorlage" />
      <PremiumInput label="Beschreibung" value={description} onChangeText={setDescription} multiline />
      <PremiumButton title="Neue Mandanten-Rolle anlegen" onPress={handleCreate} loading={loading} />

      {selected && selected.tenantId === tenantId ? (
        <View style={styles.block}>
          <Text style={content.subheading}>{selected.name}</Text>
          <Text style={content.caption}>{permissionCount} Rechte zugewiesen</Text>
          <PremiumButton title="Metadaten speichern" onPress={handleUpdateMetadata} loading={loading} />
          <PremiumButton
            title="Rechte aus Einsatzplanung übernehmen"
            variant="secondary"
            onPress={handleCopyPermissionsFromSystem}
            loading={loading}
          />
          <PremiumButton title="Rollenvorlage löschen" variant="secondary" onPress={handleDelete} loading={loading} />
        </View>
      ) : null}
    </View>
  );
}
