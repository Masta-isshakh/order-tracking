module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo adds react-native-worklets/plugin itself (Reanimated 4)
    // and places it after TypeScript has been stripped. Listing it manually in
    // `plugins` runs it too early — Babel applies plugins before presets — so it
    // is handed raw TypeScript from node_modules and aborts with
    // "[Worklets] Babel plugin exception: unknown node of type TSUnknownKeyword".
    presets: [['babel-preset-expo', { unstable_transformImportMeta: true }]],
  };
};
