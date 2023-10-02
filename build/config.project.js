module.exports = function (config) {
  // nothing; pure defaults
  config.client_static.push(
    'client/**/*.woff',
    'client/**/*.woff2',
  );

  config.extra_index = [{
    name: 'itch',
    defines: {
      ...config.default_defines,
      PLATFORM: 'web',
    },
    zip: true,
  }];
};
