const gb = require('glov-build');

const spritesheet = require('./spritesheet.js');

module.exports = function (config) {
  config.extra_index = [{
    name: 'itch',
    defines: {
      ...config.default_defines,
      PLATFORM: 'itch',
    },
    zip: true,
  }];

  ['icons'].forEach((name) => {
    gb.task({
      name: `client_sprites_${name}`,
      input: `textures/spritesheets/${name}/*.png`,
      ...spritesheet({
        name: name,
        pad: 8,
        clamp_regex: /./,
      }),
    });
    config.client_js_files.push(`client_sprites_${name}:**/*.js`);
    config.client_png.push(`client_sprites_${name}:**/*.png`);
  });
};
