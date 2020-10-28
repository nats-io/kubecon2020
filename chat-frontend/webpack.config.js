const webpack = require('webpack');

module.exports = {
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader"
        },
      },
    ],
  },
  plugins:[
    new webpack.DefinePlugin({
      NATS_SERVER_URL: JSON.stringify(process.env.NATS_SERVER_URL),
      NATS_BOOTSTRAP_CREDS: JSON.stringify(process.env.NATS_BOOTSTRAP_CREDS),
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser',
    }),
  ],
  resolve: {
    fallback: {
      util: require.resolve('util/'),
    },
  },
};

