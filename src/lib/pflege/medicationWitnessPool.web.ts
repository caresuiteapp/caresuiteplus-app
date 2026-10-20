// These native options identify a named person only. They do not prove a
// qualification, actual countercheck or separately authenticated signature.
export type MedicationWitnessPoolOption = { id: string; label: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function decodeMedicationWitnessPool(value: unknown): MedicationWitnessPoolOption[] {
  if (!Array.isArray(value)) throw Error('Den vollständigen aktuellen Personenbestand für die Gegenkontrolle zuerst laden.');
  const ids = new Set<string>(), options: MedicationWitnessPoolOption[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const option = value[i];
    if (!Object.hasOwn(value, i) || !option || typeof option !== 'object' || Array.isArray(option) || Object.keys(option).length !== 2 || !Object.hasOwn(option, 'id') || !Object.hasOwn(option, 'label') || typeof option.id !== 'string' || !uuid.test(option.id) || ids.has(option.id.toLowerCase()) || typeof option.label !== 'string' || !option.label.trim()) throw Error('Der vollständige Personenbestand für die Gegenkontrolle ist ungültig oder nicht eindeutig. Bitte neu laden.');
    ids.add(option.id.toLowerCase()); options.push({ id: option.id, label: option.label });
  }
  return options;
}
export function assertMedicationWitnessSelection(pool: unknown, selectedId: string, ready: boolean): void {
  if (ready !== true) throw Error('Die aktuelle Personenabfrage für die Gegenkontrolle zuerst abschließen und prüfen.');
  const options = decodeMedicationWitnessPool(pool);
  if (!uuid.test(selectedId) || options.filter(option => option.id === selectedId).length !== 1) throw Error('Eine eindeutig im aktuellen Personenbestand benannte Gegenkontrolle auswählen.');
}
export function sameMedicationWitnessPool(captured: unknown, current: unknown): boolean {
  try {
    const first = decodeMedicationWitnessPool(captured), latest = decodeMedicationWitnessPool(current);
    return first.length === latest.length && first.every((option, index) => option.id === latest[index].id && option.label === latest[index].label);
  } catch { return false; }
}
