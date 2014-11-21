JSGO
====

A javascript library for reading CS:GO demo files. It supports both the browser and node.js.

Once parsing starts most data is sent in the form of events. From there you can look up entity properties if needed for additional information.

Installing in node
---------
```npm install jsgo```

Example
------

```javascript
var fs = require('fs');
var JSGO = require('jsgo');

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

Events
-----
```demo_header
server_command
server_info
player_added
entity_added
entity_updated
entity_removed
game.cs_round_final_beep
game.round_freeze_end
game.round_announce_match_start
game.player_footstep
game.weapon_fire
game.player_jump
game.hltv_chase
game.weapon_reload
game.decoy_started
game.hltv_status
game.player_death
game.buytime_ended
game.decoy_detonate
game.bomb_dropped
game.player_falldamage
game.weapon_fire_on_empty
game.server_cvar
game.cs_pre_restart
game.round_prestart
game.player_spawn
game.bomb_pickup
game.round_start
game.round_poststart
game.begin_new_match
game.cs_round_start_beep
game.player_connect_full
game.round_mvp
game.cs_win_panel_round
game.round_end
game.round_officially_ended
game.round_announce_warmup
game.hegrenade_detonate
game.smokegrenade_detonate
game.bomb_beginplant
game.bomb_planted
game.bomb_beep
game.smokegrenade_expired
game.player_blind
game.flashbang_detonate
game.weapon_zoom
game.inferno_startburn
game.inferno_expire
game.bomb_begindefuse
game.bomb_defused
game.round_time_warning
game.round_announce_last_round_half
game.announce_phase_end
game.player_team
game.player_disconnect
game.player_connect
game.round_announce_match_point
game.cs_win_panel_match
```

JSGO Methods
-------------
```javascript
demo.findEntityById(entityId);
demo.findEntityByPlayer(playerObject);
demo.findEntityByPlayerId(playerId);
demo.findPlayerByEntity(entityObject);
demo.findPlayerById(playerId);
demo.findPlayerByEntityId(entityId);
```


Entity Methods
-----------

```javascript
myEntity.isPlayer();
myEntity.getPos();
myEntity.getEyeAngle();
myEntity.getHealth();
myEntity.getTeam();
myEntity.getData();
myEntity.getArmorValue();
myEntity.getAimPunchAngle();
myEntity.isWeapon();
myEntity.isDecoyGrenade();
myEntity.isSmokeGrenade();
myEntity.isFlashbang();
myEntity.isHEGrenade();
myEntity.isSpotted();
```
