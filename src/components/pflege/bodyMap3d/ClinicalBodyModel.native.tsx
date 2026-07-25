import { ParametricBodyModel, type BodyModelProps } from './ParametricBodyModel';

/**
 * Native bleibt bis zur gebündelten GLB-Auslieferung auf dem sicheren
 * parametrischen Fallback. Die Auswahl- und Markerkoordinaten sind identisch.
 */
export function ClinicalBodyModel(props: BodyModelProps) {
  return <ParametricBodyModel {...props} />;
}
