const path = require('path');

module.exports = {
  mode: 'production',
  entry: {
    popup: './popup-bundle.js',
    background: './background.js'
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  resolve: {
    extensions: ['.js', '.ts']
  }
};
