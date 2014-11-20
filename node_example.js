var fs = require('fs');
var Demo = require('./lib/jsgo');

fs.readFile('demo.dem', function(err, data) {

    var myDemo = new JSGO();
    var tick = 0;

    myDemo.on('server_command', function(e) {
            tick = e.tick;
        })
        .on('game.weapon_fire', function(e) {
            console.log(tick, this.event, e);
        })
        .onAny(function(e) {
            //console.log(tick, this.event, e);
        }).parse(data);

});