const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.watchFolders = [
	path.resolve(__dirname, "../src/utils"),
	path.resolve(__dirname, "../src/assets"),
];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, "node_modules")];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;