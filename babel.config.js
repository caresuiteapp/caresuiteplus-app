module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['./scripts/babel-care-suite-text.cjs', 'react-native-reanimated/plugin'],
  };
};
