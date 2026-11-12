module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // NOTE: 'expo-router/babel' was removed — since Expo SDK 50 its functionality
    // lives in babel-preset-expo, and keeping it makes Metro throw
    // "expo-router/babel is deprecated in favor of babel-preset-expo in SDK 50".
    plugins: ['react-native-reanimated/plugin'],
  };
};
