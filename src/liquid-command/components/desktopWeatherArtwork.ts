import type { ImageSourcePropType } from 'react-native';
import type { DesktopWeatherIcon } from '@/lib/platform/desktopWeatherModel';

export const desktopWeatherArtwork: Record<DesktopWeatherIcon, ImageSourcePropType> = {
  'clear-day': require('../../../assets/weather/conditions/clear-day.png'),
  'clear-night': require('../../../assets/weather/conditions/clear-night.png'),
  'partly-cloudy-day': require('../../../assets/weather/conditions/partly-cloudy-day.png'),
  'partly-cloudy-night': require('../../../assets/weather/conditions/partly-cloudy-night.png'),
  cloudy: require('../../../assets/weather/conditions/cloudy.png'),
  fog: require('../../../assets/weather/conditions/fog.png'),
  wind: require('../../../assets/weather/conditions/wind.png'),
  rain: require('../../../assets/weather/conditions/rain.png'),
  sleet: require('../../../assets/weather/conditions/sleet.png'),
  snow: require('../../../assets/weather/conditions/snow.png'),
  hail: require('../../../assets/weather/conditions/hail.png'),
  thunderstorm: require('../../../assets/weather/conditions/thunderstorm.png'),
};
