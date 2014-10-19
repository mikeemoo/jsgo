JSGO
====
JSGO is a library for reading Counter-Strike: Global Offensive '.dem' replay files.

Most in-game actions are fired as events which you can subscribe to, and the main demo class has a few simple API methods for retrieving data.

Demo
------
A simple demo can be found [here](http://mikeemoo.github.io/jsgo/demo.html). It will display any time a player has been blinded by a flashbang

Example
------

    $('#demo').change(function(e) {

		if (e.target.files.length > 0) {

			var file = e.target.files[0];
			
			// create a new Demo object
			var demo = new Demo();
			
			// when a player dies, log the data
			demo.on('player_death', function(data) {
				console.log(data);
			};
			
			// start the parsing
			demo.parse(file);
		}
	}

Events
-----
- data
- server_info
- players_info
- entity_added
- entity_updated
- hltv_chase
- cs_pre_restart
- round_prestart
- player_spawn
- bomb_pickup
- round_start
- round_poststart
- begin_new_match
- entity_removed
- hltv_status
- cs_round_start_beep
- bomb_dropped
- cs_round_final_beep
- round_freeze_end
- round_announce_match_start
- player_footstep
- weapon_fire
- decoy_started
- player_death
- buytime_ended
- player_jump
- round_mvp
- cs_win_panel_round
- round_end
- round_officially_ended
- round_announce_warmup
- player_team
- weapon_zoom
- hegrenade_detonate
- weapon_reload
- player_blind
- flashbang_detonate
- smokegrenade_detonate
- smokegrenade_expired
- server_cvar
- bomb_beginplant
- bomb_planted
- bomb_beep
- decoy_detonate
- bomb_exploded
- inferno_startburn
- inferno_expire
- bomb_begindefuse
- bomb_defused
- player_falldamage
- round_time_warning
- round_announce_last_round_half
- hltv_fixed
- announce_phase_end
- player_disconnect
- player_connect
- player_connect_full
- round_announce_match_point
- cs_win_panel_match
- done

