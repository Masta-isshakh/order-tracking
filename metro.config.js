// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// aws-amplify v6 ships "exports" maps that Metro's package-exports resolution
// mis-resolves for some subpaths; keeping the browser/main field order below is
// the combination Amplify documents for React Native.
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ['react-native', 'browser', 'require', 'import'];

module.exports = config;
