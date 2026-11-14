import { Image, type ImageSourcePropType } from 'react-native';
import type { VitalReadingType } from '@/types/modules/pflege';

// Static requires let Expo bundle the same original artwork on Web and native.
const artwork: Readonly<Record<VitalReadingType, ImageSourcePropType>> = {
  blood_pressure: require('../../../assets/vital-measurement-artwork/blood_pressure.png'),
  pulse: require('../../../assets/vital-measurement-artwork/pulse.png'),
  respiratory_rate: require('../../../assets/vital-measurement-artwork/respiratory_rate.png'),
  oxygen: require('../../../assets/vital-measurement-artwork/oxygen.png'),
  temperature: require('../../../assets/vital-measurement-artwork/temperature.png'),
  weight: require('../../../assets/vital-measurement-artwork/weight.png'),
  height: require('../../../assets/vital-measurement-artwork/height.png'),
  bmi: require('../../../assets/vital-measurement-artwork/bmi.png'),
  body_surface_area: require('../../../assets/vital-measurement-artwork/body_surface_area.png'),
  head_circumference: require('../../../assets/vital-measurement-artwork/head_circumference.png'),
  blood_glucose: require('../../../assets/vital-measurement-artwork/blood_glucose.png'),
  blood_ketones: require('../../../assets/vital-measurement-artwork/blood_ketones.png'),
  pain_score: require('../../../assets/vital-measurement-artwork/pain_score.png'),
  capillary_refill: require('../../../assets/vital-measurement-artwork/capillary_refill.png'),
  urine_output: require('../../../assets/vital-measurement-artwork/urine_output.png'),
  fluid_balance: require('../../../assets/vital-measurement-artwork/fluid_balance.png'),
  gcs: require('../../../assets/vital-measurement-artwork/gcs.png'),
  rass: require('../../../assets/vital-measurement-artwork/rass.png'),
  pupils: require('../../../assets/vital-measurement-artwork/pupils.png'),
  arterial_pressure: require('../../../assets/vital-measurement-artwork/arterial_pressure.png'),
  map: require('../../../assets/vital-measurement-artwork/map.png'),
  cvp: require('../../../assets/vital-measurement-artwork/cvp.png'),
  cardiac_output: require('../../../assets/vital-measurement-artwork/cardiac_output.png'),
  cardiac_index: require('../../../assets/vital-measurement-artwork/cardiac_index.png'),
  svv: require('../../../assets/vital-measurement-artwork/svv.png'),
  icp: require('../../../assets/vital-measurement-artwork/icp.png'),
  cpp: require('../../../assets/vital-measurement-artwork/cpp.png'),
  etco2: require('../../../assets/vital-measurement-artwork/etco2.png'),
  oxygen_flow: require('../../../assets/vital-measurement-artwork/oxygen_flow.png'),
  fio2: require('../../../assets/vital-measurement-artwork/fio2.png'),
  peep: require('../../../assets/vital-measurement-artwork/peep.png'),
  tidal_volume: require('../../../assets/vital-measurement-artwork/tidal_volume.png'),
  minute_ventilation: require('../../../assets/vital-measurement-artwork/minute_ventilation.png'),
  peak_airway_pressure: require('../../../assets/vital-measurement-artwork/peak_airway_pressure.png'),
  plateau_pressure: require('../../../assets/vital-measurement-artwork/plateau_pressure.png'),
  ventilator_rate: require('../../../assets/vital-measurement-artwork/ventilator_rate.png'),
  ph: require('../../../assets/vital-measurement-artwork/ph.png'),
  pco2: require('../../../assets/vital-measurement-artwork/pco2.png'),
  po2: require('../../../assets/vital-measurement-artwork/po2.png'),
  bicarbonate: require('../../../assets/vital-measurement-artwork/bicarbonate.png'),
  base_excess: require('../../../assets/vital-measurement-artwork/base_excess.png'),
  lactate: require('../../../assets/vital-measurement-artwork/lactate.png'),
};

export function VitalMeasurementArtwork({ measurementKey, size = 36 }: { measurementKey: string; size?: number }) {
  if (!Object.hasOwn(artwork, measurementKey)) return null;
  return (
    <Image
      accessible={false}
      fadeDuration={0}
      resizeMode="contain"
      source={artwork[measurementKey as VitalReadingType]}
      style={{ width: size, height: size, flexShrink: 0 }}
    />
  );
}
