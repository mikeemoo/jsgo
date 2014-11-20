JSGO
====

A javascript library for reading CS:GO demo files. It supports both the browser and node.js.

Once parsing starts most data is sent in the form of events. From there you can look up entity properties if needed for additional information.

for example:

```
var fs = require('fs');
var JSGO = require('./lib/jsgo');

fs.readFile('demo.dem', function(err, data) {

  new JSGO().on('game.weapon_fire', function(event) {
    
    var player = this.findPlayerById(event.userid);
    var entity = this.findEntityByPlayer(player);
    var position = entity.getPos();
    
    console.log(player.name + ' used weapon ' + event.weapon + ' at ' + position.x + ', ' + position.y + ', ' + position.z);
  
  }).parse(data);
  
});
```
