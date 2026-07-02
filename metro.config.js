const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.transformer.transformIgnorePatterns = [
  'node_modules/(?!(@react-native-async-storage|react-native|@react-native|expo|@expo|@unimodules|unimodules)/)',
];

module.exports = config;
