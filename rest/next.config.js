const runtimeCaching = require("next-pwa/cache");
const { i18n } = require("./next-i18next.config");


const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  scope: '/app',
  sw: 'service-worker.js',
  //...
})


module.exports = withPWA({
  i18n,
  pwa: {
    dest: 'public',
    mode: 'production',
    disable: process.env.NODE_ENV === 'development',
  },
  images: {
    domains: [
      "via.placeholder.com",
      "res.cloudinary.com",
      "s3.amazonaws.com",
      "18.141.64.26",
      "127.0.0.1",
      "localhost",
      "picsum.photos",
      "pickbazar-sail.test",
      "pickbazarlaravel.s3.ap-southeast-1.amazonaws.com",
      "chawkbazarlaravel.s3.ap-southeast-1.amazonaws.com",
      "lh3.googleusercontent.com",
      "api.test",
      "idreamshirt.com",
      "api.tee.test",
      "api.idreamshirt.com",
      "api.idreamshirt.local",
      "api.teetochic.com",
      "orders.idreamshirt.com"
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
});
