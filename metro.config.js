const { getDefaultConfig } = require("expo/metro-config");
const { FileStore } = require("metro-cache");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Use turborepo to restore the cache when possible
config.cacheStores = [
  new FileStore({
    root: path.join(__dirname, "node_modules", ".cache", "metro"),
  }),
];

// Performance optimizations
config.transformer = {
  ...config.transformer,
  // Enable inline requires for better performance (lazy loading)
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
};

// Configure resolver to handle platform-specific extensions properly
config.resolver = {
  ...config.resolver,
  sourceExts: [
    ...(config.resolver?.sourceExts || []),
    "tsx",
    "ts",
    "jsx",
    "js",
    "json",
  ],
  platforms: ["ios", "android", "web"],
  resolverMainFields: ["react-native", "browser", "main"],
  // Enable tree shaking
  unstable_enablePackageExports: true,
};

// Performance optimizations for serializer
// Note: Removed custom createModuleIdFactory as it can cause module ID mismatches
// Metro's default module ID factory is more reliable
config.serializer = {
  ...config.serializer,
};

// Check if we're building for web
const isWeb =
  process.env.EXPO_PUBLIC_PLATFORM === "web" ||
  process.argv.includes("--web") ||
  process.env.PLATFORM === "web";

if (isWeb) {
  // When building for web, exclude all .native.tsx and .native.ts files
  const blockList = [/.*\.native\.(tsx?|jsx?)$/];
  config.resolver.blockList = blockList;
  console.log("Metro: Excluding .native files from web build");
}

module.exports = config;
