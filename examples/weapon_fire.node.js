var fs = require('fs');
var jsgo = require('../lib/jsgo');

fs.readFile('../demo.dem', function(err, data) {

    var myDemo = new jsgo.Demo().
    	on('game.weapon_fire', function(event) {

            var player = event.player;
            var position = player.getPosition();

            console.log(player.getName() + ' used weapon ' +
            			event.weapon + ' at ' + position.x + ', ' + position.y + ', ' + position.z);
        }).
        parse(data);

});