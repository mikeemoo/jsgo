var fs = require('fs');
var JSGO = require('./lib/jsgo');

fs.readFile('demo.dem', function(err, data) {

    var myDemo = new JSGO();
    var tick = 0;

    myDemo.on('server_command', function(e) {
            tick = e.tick;
        })
        .on('game.weapon_fire', function(e) {

            var player = this.findPlayerById(e.userid);
            var entity = this.findEntityByPlayer(player);
            var position = entity.getPos();

            console.log(player.name + ' used weapon ' + e.weapon + ' at ' + position.x + ', ' + position.y + ', ' + position.z);
        })
        .onAny(function(e) {
            //console.log(tick, this.event, e);
        }).parse(data);

});