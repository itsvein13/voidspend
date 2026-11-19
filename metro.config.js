// expo-sqlite runs in the browser through a WebAssembly build of SQLite. The web
// preview needs Metro to treat .wasm as an asset, and the page has to be
// cross-origin isolated for SharedArrayBuffer. Android and iOS do not care.
// Found in the M0 spike, see docs/v2-m0-spikes.md.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push("wasm");

config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  middleware(req, res, next);
};

module.exports = config;
