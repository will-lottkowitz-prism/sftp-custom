//@ts-check

'use strict';

const path = require('path');

/**@type {import('webpack').Configuration}*/
const config = {
  target: 'node',

  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]',
  },
  devtool: 'source-map',
  externals: {
    vscode: 'commonjs vscode',
    // ssh2 is bundled (no longer external) so the VSIX is self-contained and
    // needs no `npm install` after install. Its *optional* native deps are kept
    // external — ssh2 wraps these requires in try/catch and falls back to pure
    // JS, so a failed runtime require is harmless.
    'cpu-features': 'commonjs cpu-features',
    './crypto/build/Release/sshcrypto.node':
      'commonjs ./crypto/build/Release/sshcrypto.node',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
          },
        ],
      },
    ],
  },
};

module.exports = config;
