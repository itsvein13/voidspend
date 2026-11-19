/* global jest */
// Mocks for native modules, so component tests run in plain Node.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// Reanimated's mock leaves useReducedMotion out ("add me if needed").
jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  ...require("react-native-reanimated/mock"),
  useReducedMotion: () => false,
}));

jest.mock("react-native-safe-area-context", () =>
  require("react-native-safe-area-context/jest/mock").default,
);

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

// The device is English and in Jakarta unless a test says otherwise.
jest.mock("expo-localization", () => ({
  getLocales: jest.fn(() => [{ languageCode: "en", languageTag: "en-US" }]),
  getCalendars: jest.fn(() => [{ timeZone: "Asia/Jakarta" }]),
}));

jest.mock("expo-crypto", () => {
  const nodeCrypto = require("crypto");
  return {
    randomUUID: () => nodeCrypto.randomUUID(),
    digestStringAsync: jest.fn(),
    CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  };
});

jest.mock("expo-status-bar", () => ({
  StatusBar: () => null,
  setStatusBarStyle: jest.fn(),
}));

jest.mock("expo-system-ui", () => ({
  setBackgroundColorAsync: jest.fn(() => Promise.resolve()),
}));
