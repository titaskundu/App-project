/**
 * Expo config plugin: pin the CMake version used by the app module's native (C++) build.
 *
 * Why: the default CMake 3.22 ships Ninja 1.10, which cannot handle Windows paths longer
 * than 260 characters. React Native's codegen produces paths over that limit, so the build
 * fails on Windows. CMake 4.1.2 ships Ninja 1.12+, which supports long paths (Windows
 * LongPathsEnabled must also be on).
 *
 * Install the matching CMake with: sdkmanager --install "cmake/4.1.2"
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// [with-cmake-version]';

module.exports = function withCmakeVersion(config, { version = '4.1.2' } = {}) {
  return withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes(MARKER)) return cfg;

    const block = `
    ${MARKER} pin CMake so Windows long paths work
    externalNativeBuild {
        cmake {
            version "${version}"
        }
    }
`;
    // Insert right after the opening of the top-level `android {` block.
    const updated = src.replace(/^android\s*\{\s*$/m, (m) => `${m}${block}`);
    if (updated === src) {
      throw new Error('[with-cmake-version] Could not find the `android {` block in app/build.gradle');
    }
    cfg.modResults.contents = updated;
    return cfg;
  });
};
