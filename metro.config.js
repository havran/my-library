const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

config.server = {
  ...config.server,
  host: "0.0.0.0",
};

module.exports = withNativeWind(config, { input: "./global.css" });
