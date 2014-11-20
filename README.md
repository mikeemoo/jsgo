JSGO
====

A javascript library for reading CS:GO demo files. It supports both the browser and node.js.

Once parsing starts most data is sent in the form of events. From there you can look up entity properties if needed for additional information.

for example:

```javascript
var fs = require('fs');
var JSGO = require('./lib/jsgo');

fs.readFile('demo.dem', function(err, data) {

  new JSGO().on('game.weapon_fire', function(event) {
    
    var player = this.findPlayerById(event.userid);
    var entity = this.findEntityByPlayer(player);
    var position = entity.getPos();
    
    console.log(player.name + ' used weapon ' + event.weapon + 
                ' at ' + position.x + ', ' + position.y + ', ' + position.z);
  
  }).parse(data);
  
});
```

Output:

```
aizy used weapon ak47 at -1547.6976318359375, 591.0830078125, 32.03125
NiP-Fifflaren- AKRACING used weapon knife at 1376.483154296875, 2409.856689453125, 34.39018630981445
aizy used weapon ak47 at -1547.6976318359375, 591.0830078125, 32.03125
aizy used weapon ak47 at -1547.6976318359375, 591.0830078125, 32.03125
NiP-Fifflaren- AKRACING used weapon knife at 1383.9927978515625, 2505.580322265625, 60.96079635620117
NiP-GeT_RiGhT-A- EIZO used weapon smokegrenade at -617.7000122070312, 2168.052734375, -120.24928283691406
...etc...
```
