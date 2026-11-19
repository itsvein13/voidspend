// https://docs.expo.dev/guides/using-eslint/
// ESLint stays on v9: eslint-plugin-import and eslint-plugin-react (pulled in by
// eslint-config-expo) do not declare ESLint 10 support yet.
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      "dist/*",
      ".expo/*",
      "android/*",
      "ios/*",
      "coverage/*",
    ],
  },
]);
