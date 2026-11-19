// Tests live next to the code as *.test.ts(x). Never put them under src/app:
// every file there becomes a route.
module.exports = {
  preset: "jest-expo",
  // Worklets has native-only code that cannot load in Node. This resolver skips
  // the .native files so react-native-reanimated/mock works.
  resolver: "react-native-worklets/jest/resolver",
  setupFiles: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    // Same aliases as tsconfig.json. The longer prefix has to come first.
    "^@/assets/(.*)$": "<rootDir>/assets/$1",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testPathIgnorePatterns: ["/node_modules/", "/.expo/", "/android/", "/ios/"],
};
