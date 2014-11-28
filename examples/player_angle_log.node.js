var fs = require('fs');
var jsgo = require('../lib/jsgo');


fs.readFile('../../ESL-One-Cologne-Maniac-vs-London_Conspiracy-nuke.dem', function(err, data) {

    var kills = [];
    var log = '';
    var fired = false;
    var playerToTrack = 'LDLC.com Maniac Cooler Master';
    var playerToTrackId = null;
    var angles = [];

    function normalize(n) {
        return (((n + 180) % 360 + 360) % 360) - 180;
    }
    var myDemo = new jsgo.Demo().

    on('entity_added', function(entity) {

        if (entity instanceof jsgo.Player && entity.getName() == playerToTrack) {
            playerToTrackId = entity.entityId;
        }
    }).

    on('tick_end', function(e) {

        if (playerToTrackId !== null) {

            var player = this.findEntityById(playerToTrackId);
            var tick = this.getTick();

            // if theyre alive
            if (player.getHealth() > 0) {

                var eyeAngle = player.getEyeAngle();
                var team = player.getTeam(this).getSide();
                var position = player.getPosition()

                var players = this.getPlayers();
                for (var i = 0; i < players.length; i++) {

                    var enemy = players[i];
                    var enemyTeam = enemy.getTeam(this).getSide();

                    var isValidTeam = enemyTeam == 'CT' || enemyTeam == 'TERRORIST';

                    // if the enemy is alive, they're on a valid team, and they're on the OTHER team
                    if (enemy.getHealth() > 0 && isValidTeam && enemyTeam != team) {

                        var enemyPos = enemy.getPosition();

                        if (angles[enemy.entityId] == null) {
                            angles[enemy.entityId] = [];
                        }

                        var requiredAngle = position.pitchAndYawTo(enemyPos);
                        var pitchDiff = normalize(eyeAngle.pitch - requiredAngle.pitch);
                        var yawDiff = normalize(eyeAngle.yaw - requiredAngle.yaw);

                        angles[enemy.entityId].push({
                            'tick': tick,
                            'angle': eyeAngle,
                            'requiredAngle': requiredAngle,
                            'pitchDiff': pitchDiff,
                            'yawDiff': yawDiff,
                            'fired': fired
                        });

                        if (angles[enemy.entityId].length > 300) {
                            angles[enemy.entityId].shift();
                        }
                    }
                }
            }
        }

        fired = false;

    }).
    on('game.weapon_fire', function(e) {
        if (e.player != null && e.player.entityId == playerToTrackId) {
            fired = true;
        }
    }).
    on('game.player_death', function(e) {

        if (e.attacker != null && e.player != null && e.attacker.entityId == playerToTrackId) {

            var round = this.getRound();

            if (angles[e.player.entityId] == null) {
                return;
            }

            for (var i = 0; i <= angles[e.player.entityId].length; i++) {

                var angleLog = angles[e.player.entityId][i];

                if (angleLog != null) {

                    logEntry = angleLog.tick + "\t" +
                        round + "\t" +
                        e.player.getName() + "\t" +
                        angleLog.angle.pitch + "\t" +
                        angleLog.angle.yaw + "\t" +
                        angleLog.requiredAngle.pitch + "\t" +
                        angleLog.requiredAngle.yaw + "\t" +
                        angleLog.pitchDiff + "\t" +
                        angleLog.yawDiff + "\t" +
                        (angleLog.fired ? 1 : 0) + "\n";

                    log += logEntry;

                    console.log(logEntry);
                }

            }

        }
    }).

    parse(data);

    if (log != '') {
        fs.writeFileSync('log.txt', log);
    }
});