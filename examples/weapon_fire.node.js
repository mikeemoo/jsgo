var fs = require('fs');
var jsgo = require('../lib/jsgo');

fs.readFile('1668_virtus-pro-fnatic_de_cbble.dem', function(err, data) {

    var fires = 0;

    var myDemo = new jsgo.Demo().
    on('game.weapon_fire', function(event) {
      console.log(Object.keys(event.player.getActiveWeapon().classInfo.dataTable));
      //console.log(event.player.getActiveWeapon().getValue('m_hOwner') & 0x7FF);
    }).
    parse(data);

});