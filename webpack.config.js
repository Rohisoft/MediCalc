require('dotenv').config();
const path = require('path');
const webpack            = require('webpack');
const HtmlWebpackPlugin  = require('html-webpack-plugin');
const CopyWebpackPlugin  = require('copy-webpack-plugin');

const RN_PACKAGES = [
  'react-native',
  '@react-native',
  '@react-navigation',
  'react-native-safe-area-context',
  'react-native-screens',
  'react-native-paper',
  'react-native-vector-icons',
  '@react-native-async-storage',
].join('|');

const isProd   = process.env.NODE_ENV === 'production';
const BASE_PATH = process.env.BASE_PATH || '/';

module.exports = {
  mode: isProd ? 'production' : 'development',
  entry: './index.web.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    publicPath: BASE_PATH,
    clean: true,
  },
  resolve: {
    extensions: ['.web.js', '.js', '.jsx', '.ts', '.tsx'],
    alias: { 'react-native$': 'react-native-web' },
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: new RegExp(`node_modules/(?!(${RN_PACKAGES})/)`),
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', { targets: { browsers: 'last 2 versions' } }],
              ['@babel/preset-react', { runtime: 'automatic' }],
            ],
          },
        },
      },
      {
        test: /\.(png|jpg|gif|svg|ttf|woff|woff2|eot)$/,
        type: 'asset/resource',
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.SUPABASE_URL':       JSON.stringify(process.env.SUPABASE_URL       || ''),
      'process.env.SUPABASE_ANON_KEY':  JSON.stringify(process.env.SUPABASE_ANON_KEY  || ''),
      'process.env.ANTHROPIC_API_KEY':  JSON.stringify(process.env.ANTHROPIC_API_KEY  || ''),
      'process.env.BASE_PATH':          JSON.stringify(BASE_PATH),
    }),
    new HtmlWebpackPlugin({ template: './public/index.html' }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'public/manifest.json',  to: 'manifest.json' },
        { from: 'public/sw.js',          to: 'sw.js' },
        { from: 'public/icon-192.png',   to: 'icon-192.png' },
        { from: 'public/icon-512.png',   to: 'icon-512.png' },
        { from: 'public/_redirects',    to: '_redirects', toType: 'file' },
        { from: 'public/guide.html',      to: 'guide.html',       toType: 'file' },
        { from: 'public/vrndai-logo.svg', to: 'vrndai-logo.svg',  toType: 'file' },
      ],
    }),
  ],
  devServer: {
    port: 8081,
    historyApiFallback: true,
    hot: true,
    open: true,
  },
  ...(isProd ? {} : {}),
};
