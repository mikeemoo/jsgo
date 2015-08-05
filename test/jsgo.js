var should = require('chai').should(),
    assert = require('chai').assert,
    jsgo = require('../lib/jsgo.js'),
    fs = require('fs');

describe('JSGO', function() {
  var demData = [];

  beforeEach(function(done) {
    fs.readFile('demos/cloud9vscounterl.dem', function(err, data) {
      demData = data;
      done();
    });
  });
  it('should export modules', function() {
    var modules = [
        'BitStream',
        'Demo',
        'Team',
        'Player',
        'Grenade',
        'HEGrenade',
        'Flashbang',
        'SmokeGrenade',
        'DecoyGrenade',
        'Vector3d'];
    modules.forEach(function(m) {
      should.not.equal(jsgo[m], undefined);
    });
  });

  it('should parse a dem without error', function() {
    var demo = new jsgo.Demo().parse(demData);
  });

  it('should send out some events', function() {
    var eventCalled = false;
    var demo = new jsgo.Demo().on('game.weapon_fire', function(event) {
      eventCalled = true;
    }).parse(demData);
    eventCalled.should.equal(true);
  });

  it('should get players on each team', function() {
    var eventCalled = false;
    var demo = new jsgo.Demo().on('game.begin_new_match', function(event) {
      var tPlayers = this.getTPlayers();
      var ctPlayers = this.getCTPlayers();
      console.log(tPlayers);
      console.log(ctPlayers);
      tPlayers.length.should.not.be(0);
      ctPlayers.length.should.not.be(0);
      //assert.fail();
    }).parse(demData);
    eventCalled.should.equal(true);
    console.log(eventCalled);

  });

})
