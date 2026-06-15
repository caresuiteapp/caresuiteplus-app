import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CatalogValueSelect, TemplateDropdownSelect } from '@/components/templates';
import { FormScreenHero, type FormScreenHeroProps } from '@/components/forms';
import { ScreenShell } from '@/components/layout';
import { ErrorState, EmptyState, LoadingState, PremiumButton, PremiumCard, PremiumInput, SuccessState } from '@/components/ui';
import type { CatalogType, TemplateListFilters } from '@/types/templates';
import { createDemoEntity } from '@/lib/create/demoCreateService';
import { spacing } from '@/theme';

type FieldDef = {
  key: string;
  label: string;
  required?: boolean;
  type?: 'text' | 'catalog' | 'template';
  catalogType?: CatalogType;
  templateFilters?: TemplateListFilters;
};

type DomainCreateScreenProps = {
  wpNumber: number;
  title: string;
  entityLabel: string;
  fields: FieldDef[];
  onSubmit: (values: Record<string, string>) => Promise<{ ok: true; id: string } | { ok: false; error: string }>;
  successRoute?: (id: string) => string;
  formHero?: Pick<
    FormScreenHeroProps,
    'eyebrow' | 'meta' | 'icon' | 'accentColor' | 'preparedMessage'
  >;
};

export function DomainCreateScreen({
  wpNumber,
  title,
  entityLabel,
  fields,
  onSubmit,
  successRoute,
  formHero,
}: DomainCreateScreenProps) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.key, ''])),
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const setValue = (key: string, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  };

  const handleSubmit = async () => {
    setError(null);
    for (const field of fields) {
      if (field.required && !values[field.key]?.trim()) {
        setError(`„${field.label}" ist erforderlich.`);
        return;
      }
    }
    setLoading(true);
    const result = await onSubmit(values);
    setLoading(false);
    if (result.ok) {
      setCreatedId(result.id);
    } else {
      setError(result.error);
    }
  };

  if (loading) {
    return (
      <ScreenShell title={title} subtitle="Speichern…">
        <LoadingState message={`${entityLabel} wird gespeichert…`} />
      </ScreenShell>
    );
  }

  if (createdId) {
    return (
      <ScreenShell title={title} subtitle="Erstellt">
        <SuccessState message={`${entityLabel} wurde angelegt (WP ${wpNumber}).`} />
        <PremiumButton
          title="Weiter"
          fullWidth
          onPress={() => {
            if (successRoute) router.replace(successRoute(createdId) as never);
            else router.back();
          }}
        />
      </ScreenShell>
    );
  }

  const isEmpty = fields.every((field) => !values[field.key]?.trim());

  return (
    <ScreenShell title={title} subtitle={`Neu anlegen · WP ${wpNumber}`}>
      {isEmpty ? (
        <EmptyState title={title} message={`${entityLabel} — Pflichtfelder unten ausfüllen.`} />
      ) : null}
      <View style={styles.heroWrap}>
        <FormScreenHero
          eyebrow={formHero?.eyebrow ?? 'MODUL · ANLEGEN'}
          title={title}
          meta={formHero?.meta ?? `${entityLabel} — Demo-Persistenz im Mandanten-Store.`}
          icon={formHero?.icon ?? '📝'}
          formMode="create"
          wpNumber={wpNumber}
          accentColor={formHero?.accentColor}
          preparedMessage={
            formHero?.preparedMessage ??
            `${entityLabel} wird im Demo-Mandanten angelegt — kein Store-Release.`
          }
        />
      </View>
      <PremiumCard>
        {fields.map((field) => {
          if (field.type === 'catalog' && field.catalogType) {
            return (
              <CatalogValueSelect
                key={field.key}
                catalogType={field.catalogType}
                label={field.label}
                required={field.required}
                value={values[field.key] ?? ''}
                onChange={(v) => setValue(field.key, v)}
              />
            );
          }
          if (field.type === 'template') {
            return (
              <TemplateDropdownSelect
                key={field.key}
                label={field.label}
                required={field.required}
                filters={field.templateFilters}
                value={values[field.key] ?? ''}
                onChange={(id, content) => {
                  setValue(field.key, id);
                  setValue(`${field.key}Content`, content);
                }}
              />
            );
          }
          return (
            <PremiumInput
              key={field.key}
              label={field.label}
              value={values[field.key] ?? ''}
              onChangeText={(text) => setValue(field.key, text)}
            />
          );
        })}
        {error ? <ErrorState title="Eingabe" message={error} /> : null}
        <PremiumButton title="Speichern" fullWidth loading={loading} onPress={handleSubmit} />
        <PremiumButton title="Abbrechen" variant="secondary" fullWidth onPress={() => router.back()} />
      </PremiumCard>
    </ScreenShell>
  );
}

void createDemoEntity;

const styles = StyleSheet.create({
  heroWrap: { marginBottom: spacing.md },
});
