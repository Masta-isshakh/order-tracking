// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// aws-amplify v6 ships "exports" maps that Metro must resolve for its React
// Native entry points to be picked up.
config.resolver.unstable_enablePackageExports = true;

// NOTE: do NOT add `resolver.unstable_conditionNames` here. Expo SDK 57's
// defaults are already correct, and forcing an order that puts "react-native"
// first changes how third-party packages resolve for no benefit.
module.exports = config;
