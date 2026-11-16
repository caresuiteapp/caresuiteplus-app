import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FilterChipGroup, PremiumInput, SectionPanel } from '@/components/ui';
import {
  emptyRiskMatrix,
  riskMatrixCellCount,
  riskMatrixProgress,
  riskMatrixRisks,
  riskMatrixTopics,
} from '@/lib/careAssessment/firstRiskMatrix';
import { CARE_ASSESSMENT_TOPIC_LABELS } from '@/lib/careAssessment';
import type { CareRiskMatrix, RiskMatrixRisk, RiskMatrixTopic } from '@/types/modules/careAssessment';
import { colors, radius, spacing, typography } from '@/theme';

type MatrixProps = {
  value: CareRiskMatrix | null;
  locked: boolean;
  ambulant: boolean;
  onChange: (matrix: CareRiskMatrix) => void;
};

export function AssessmentRiskMatrix({ value, locked, ambulant, onChange }: MatrixProps) {
  const [width, setWidth] = useState(0);
  const [selectedTopic, setSelectedTopic] = useState<RiskMatrixTopic>('cognition_communication');
  const matrix = value ?? emptyRiskMatrix;
  const progress = riskMatrixProgress(matrix);
  const wide = width >= (ambulant ? 940 : 830);
  const isEmpty = progress.assessed === 0 && !Object.keys(matrix.counseling).length && !matrix.otherLabel;

  function setRisk(topic: RiskMatrixTopic, risk: RiskMatrixRisk, present: boolean | undefined) {
    const key = `${topic}:${risk}` as const;
    const cells = { ...matrix.cells };
    if (present === undefined) delete cells[key];
    else cells[key] = {
      present,
      furtherAssessment: present && cells[key]?.present ? cells[key].furtherAssessment : null,
    };
    onChange({ ...matrix, cells });
  }

  function setCounseling(topic: RiskMatrixTopic, choice: boolean | undefined) {
    const counseling = { ...matrix.counseling };
    if (choice === undefined) delete counseling[topic];
    else counseling[topic] = choice;
    onChange({ ...matrix, counseling });
  }

  function renderRisk(topic: RiskMatrixTopic, risk: (typeof riskMatrixRisks)[number]) {
    const key = `${topic}:${risk.key}` as const;
    const cell = matrix.cells[key];
    const description = `${CARE_ASSESSMENT_TOPIC_LABELS[topic]}, ${risk.label}`;
    return (
      <View key={risk.key} style={[styles.cell, wide && styles.gridCell, cell?.present && styles.positive]}>
        {!wide ? <Text style={styles.label}>{risk.label}</Text> : null}
        <MatrixChoice label={description} value={cell?.present} locked={locked} onChange={choice => setRisk(topic, risk.key, choice)} />
        {cell?.present ? (
          <View style={styles.further}>
            <Text style={styles.caption}>{wide ? 'Vertiefen?' : 'Weitere Einschätzung nötig?'}</Text>
            <MatrixChoice
              label={`${description}, weitere Einschätzung nötig`}
              value={cell.furtherAssessment ?? undefined}
              locked={locked}
              onChange={choice => onChange({ ...matrix, cells: {
                ...matrix.cells,
                [key]: { present: true, furtherAssessment: choice ?? null },
              } })}
            />
          </View>
        ) : null}
      </View>
    );
  }

  function renderCounseling(topic: RiskMatrixTopic) {
    return (
      <View style={[styles.cell, wide && styles.gridCell]}>
        {!wide ? <Text style={styles.label}>Beratung im Gespräch</Text> : null}
        <MatrixChoice
          label={`${CARE_ASSESSMENT_TOPIC_LABELS[topic]}, Beratung im Gespräch`}
          value={matrix.counseling[topic]}
          locked={locked}
          onChange={choice => setCounseling(topic, choice)}
        />
      </View>
    );
  }

  return (
    <SectionPanel title="Risikomatrix" subtitle="Erste fachliche Einschätzung zu Risiken und Phänomenen">
      <View style={styles.content} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
        <View style={styles.summary}>
          <Text style={styles.label}>{progress.assessed} von {riskMatrixCellCount} Feldern beurteilt</Text>
          {progress.openFurtherAssessments ? (
            <Text style={styles.caption}>{progress.openFurtherAssessments} Rückfragen zur Vertiefung offen</Text>
          ) : null}
        </View>
        {isEmpty ? <Text style={styles.caption}>Leere Felder wurden noch nicht beurteilt.</Text> : null}
        {wide ? (
          <>
            <View style={styles.gridRow}>
              <Text style={[styles.gridTopic, styles.label]}>Themenfeld</Text>
              {riskMatrixRisks.map(risk => <Text key={risk.key} style={[styles.gridCell, styles.gridHeader]}>{risk.label}</Text>)}
              {ambulant ? <Text style={[styles.gridCell, styles.gridHeader]}>Beratung</Text> : null}
            </View>
            {riskMatrixTopics.map(topic => (
              <View key={topic} style={styles.gridRow}>
                <Text style={[styles.gridTopic, styles.label]}>{CARE_ASSESSMENT_TOPIC_LABELS[topic]}</Text>
                {riskMatrixRisks.map(risk => renderRisk(topic, risk))}
                {ambulant ? renderCounseling(topic) : null}
              </View>
            ))}
          </>
        ) : (
          <>
            <FilterChipGroup
              wrap
              options={riskMatrixTopics.map(key => ({ key, label: CARE_ASSESSMENT_TOPIC_LABELS[key] }))}
              value={selectedTopic}
              onChange={key => {
                const topic = riskMatrixTopics.find(candidate => candidate === key);
                if (topic) setSelectedTopic(topic);
              }}
            />
            <View style={styles.compactGrid}>
              {riskMatrixRisks.map(risk => renderRisk(selectedTopic, risk))}
              {ambulant ? renderCounseling(selectedTopic) : null}
            </View>
          </>
        )}
        <PremiumInput
          label={progress.needsOtherLabel ? 'Risiko oder Phänomen unter „Sonstiges“ benennen' : 'Bezeichnung für „Sonstiges“'}
          value={matrix.otherLabel}
          onChangeText={otherLabel => onChange({ ...matrix, otherLabel })}
          editable={!locked}
          maxLength={160}
        />
      </View>
    </SectionPanel>
  );
}

function MatrixChoice({ label, value, locked, onChange }: {
  label: string;
  value: boolean | undefined;
  locked: boolean;
  onChange: (value: boolean | undefined) => void;
}) {
  if (locked) return <Text style={styles.caption}>{value === undefined ? 'Offen' : value ? 'Ja' : 'Nein'}</Text>;
  return (
    <View style={styles.choiceGroup} accessibilityLabel={label}>
      {([true, false] as const).map(choice => (
        <Pressable
          key={String(choice)}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${choice ? 'Ja' : 'Nein'}`}
          accessibilityState={{ selected: choice === value }}
          onPress={() => onChange(choice === value ? undefined : choice)}
          style={[styles.choice, choice === value && styles.choiceSelected]}
        >
          <Text style={[styles.choiceLabel, choice === value && styles.choiceLabelSelected]}>{choice ? 'Ja' : 'Nein'}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  gridRow: { flexDirection: 'row', gap: spacing.xs, alignItems: 'stretch' },
  gridTopic: { width: 150, paddingVertical: spacing.sm, paddingRight: spacing.xs },
  gridCell: { flexBasis: 0, minWidth: 0 },
  gridHeader: { ...typography.caption, fontWeight: '700', flexGrow: 1, color: colors.textPrimary, paddingHorizontal: 6 },
  compactGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  cell: {
    flexBasis: 126,
    flexGrow: 1,
    padding: 6,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: 'rgba(122,170,222,0.08)',
    borderRadius: radius.md,
  },
  positive: { borderColor: 'rgba(27,108,192,0.46)', backgroundColor: 'rgba(27,108,192,0.08)' },
  further: { gap: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  label: { ...typography.label, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary },
  choiceGroup: { flexDirection: 'row', gap: 3 },
  choice: {
    flex: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.sm,
  },
  choiceSelected: { backgroundColor: '#0865BF', borderColor: '#0865BF' },
  choiceLabel: { ...typography.caption, color: '#123453' },
  choiceLabelSelected: { color: '#FFFFFF', fontWeight: '700' },
});
