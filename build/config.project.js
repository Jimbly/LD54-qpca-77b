module.exports = function (config) {
  config.extra_index = [{
    name: 'itch',
    defines: {
      ...config.default_defines,
      PLATFORM: 'itch',
    },
    zip: true,
  }];
};
