const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withMetroConfig } = require('react-native-monorepo-config');

const root = path.resolve(__dirname, './MoproReactNativeBindings');

const config = getDefaultConfig(__dirname);

// zk proof file types
config.resolver.assetExts.push('zkey');
config.resolver.assetExts.push('bin');
config.resolver.assetExts.push('local');
config.resolver.assetExts.push('pk');
config.resolver.assetExts.push('vk');
config.resolver.assetExts.push('r1cs');

const webWorkerBrowserEntry = path.resolve(
  __dirname,
  'node_modules',
  'web-worker',
  'dist',
  'browser',
  'index.cjs'
);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'web-worker') {
    return {
      filePath: webWorkerBrowserEntry,
      type: 'sourceFile',
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withMetroConfig(config, {
  root,
  dirname: __dirname,
});
