var fs = require('fs');
var jsgo = require('./lib/jsgo');

fs.readFile('../79_fnatic-team-ldlc_de_cache.dem', function(err, data) {

    var myDemo = new jsgo.Demo();

    myDemo.on('game.weapon_fire', function(event) {

            var player = event.player;
            var position = player.getPosition();

            console.log(player.getName() + ' used weapon ' +
            			event.weapon + ' at ' + position.x + ', ' + position.y + ', ' + position.z);
        })
        .onAny(function(e) {
            //console.log(this.event);
        }).parse(data);

});