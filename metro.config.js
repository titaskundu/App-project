// Learn more: https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Don't let Metro watch Gradle/CMake output. Native builds rewrite thousands of files there,
// which crashed Metro's file watcher on Windows (lstat UNKNOWN error).
config.resolver.blockList = [
  ...[].concat(config.resolver.blockList ?? []),
  /^(?:android[\\/](?:build|\.cxx|app[\\/]\.cxx)|modules[\\/][^\\/]+[\\/]android[\\/](?:build|\.cxx|\.gradle))$/,
  /[\\/]modules[\\/][^\\/]+[\\/]android[\\/](?:build|\.cxx|\.gradle)[\\/].*/,
];

module.exports = config;
