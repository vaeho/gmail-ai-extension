const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');

module.exports = {
  mode: 'production', // Or 'development' for easier debugging
  devtool: 'cheap-module-source-map', // Recommended for extensions
  entry: {
    background: './src/background.js',
    content: './src/content.js',
    options: './src/options.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js',
    clean: true, // Clean the dist folder before each build
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
          },
        },
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/options.html',
      filename: 'options.html',
      chunks: ['options'], // Only include the options bundle
    }),
    new CopyPlugin({
      patterns: [
        { from: 'src/manifest.json', to: 'manifest.json' },
        { from: 'src/styles.css', to: 'styles.css' },
        { from: 'src/icons', to: 'icons' },
      ],
    }),
    // Provide polyfills for Node.js core modules used by openai
    new webpack.ProvidePlugin({
        // process: ['process/browser'], // Remove from ProvidePlugin
        Buffer: ['buffer', 'Buffer'],
      }),
  ],
  resolve: {
    fallback: {
      "stream": require.resolve("stream-browserify"),
      "buffer": require.resolve("buffer/"), // Note the trailing slash
      "util": require.resolve("util/"),
      "process": require.resolve("process/browser"), // Add back to fallback
      "url": require.resolve("url/"),
      "os": require.resolve("os-browserify/browser"),
      "https": require.resolve("https-browserify"),
      "http": require.resolve("stream-http"),
      "assert": require.resolve("assert/"),
      "path": require.resolve("path-browserify"),
      "fs": false, // fs cannot be polyfilled for browser
      "zlib": require.resolve("browserify-zlib"),
      "net": false, // net cannot be polyfilled
      "tls": false, // tls cannot be polyfilled
      "crypto": require.resolve("crypto-browserify"),
      "constants": require.resolve("constants-browserify"),
      "domain": require.resolve("domain-browser"),
      "querystring": require.resolve("querystring-es3"),
      "vm": require.resolve("vm-browserify"),
      "tty": require.resolve("tty-browserify"),
      "module": false,
    }
  },
}; 