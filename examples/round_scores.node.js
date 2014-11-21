var fs = require('fs');
var jsgo = require('../lib/jsgo');

fs.readFile('demo.dem', function(err, data) {

    var previousRound = 0;

    var myDemo = new jsgo.Demo().
    on('game.round_end', function(event) {

        console.log('ROUND ' + (previousRound + 1));

        previousRound = 0;
        var teams = this.getTeams();

        for (var i = 0; i < teams.length; i++) {

            var team = teams[i];
            var side = team.getSide();

            if (side == 'TERRORIST' || side == 'CT') {
                console.log(team.getSide() + ' (' + teams[i].getClanName() + '): ' + team.getScore());
                previousRound += team.getScore();
            }
        }

        console.log('--------');

    }).
    parse(data);

});