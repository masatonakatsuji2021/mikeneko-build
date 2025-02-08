const path = require("path");
const fs = require("fs");

let entryList = [];

const __root = "./dist";
const list = fs.readdirSync(__root, { recursive: true});
for(let n = 0 ; n < list.length ; n++) {
  if (!fs.statSync(__root + "/" + list[n]).isFile()) continue;
  entryList.push(__root + "/" + list[n]);
}

module.exports = {
    mode: "development",
    entry: entryList,
    resolve: {
        modules: [
          __root + "/",
          __root + "/core/",
        ],
      },
    output: {
        filename: 'index.js',
        path: path.resolve(__dirname, 'www'),
        assetModuleFilename: '[hash][ext][query]', 
    },
    module: {
        rules: [
          {
            test: /\.(png|jpg|jpeg|gif|svg|css|html)$/,  
            type: 'asset',
            parser: {
              dataUrlCondition: {
                maxSize: 200 * 1024, 
              },
            },
          },
          {
            test: /\.js$/,
            use: path.resolve(__dirname, 'custom-loader.js'),
          },
        ],
    },
    stats: "errors-only",
};