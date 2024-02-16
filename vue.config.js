const { defineConfig } = require("@vue/cli-service");
module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    proxy: {
      "/api": {
        target: "http://43.203.20.195:3000",
        changeOrigin: true,
        pathRewrite: { "^/api": "" },
      },
    },
  },
});
