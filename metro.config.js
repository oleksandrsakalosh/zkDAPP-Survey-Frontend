const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

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

module.exports = config;
