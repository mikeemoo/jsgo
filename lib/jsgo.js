(function() {

    var demo = null;
    var root = this;

    function toRadians(num) {
        return num * (Math.PI / 180);
    }

    function toDegrees(num) {
        return num * (180 / Math.PI);
    }

    function inherits(childConstructor, parentConstructor) {
        function tempConstructor() {};
        tempConstructor.prototype = parentConstructor.prototype;
        childConstructor.prototype = new tempConstructor();
        childConstructor.prototype.constructor = childConstructor;
    };

    function ProtobufDefinition() {
        this.fields = {};
    }
    ProtobufDefinition.prototype.addField = function(id, name, method, args, type) {
        this.fields[id] = {
            'name': name,
            'method': method,
            'type': type || 'value',
            'args': args || []
        };
        return this;
    }
    ProtobufDefinition.prototype.getField = function(id) {
        return this.fields[id]
    }

    var Entity = require('./Entity.js');
    var exports = {}
    exports['BitStream'] = require('./BitStream.js');
    exports['Demo'] = require('./Demo.js');
    exports['Team'] = Entity.Team;
    exports['Player'] = Entity.Player;
    exports['Grenade'] = Entity.Grenade;
    exports['HEGrenade'] = Entity.HEGrenade;
    exports['SmokeGrenade'] = Entity.SmokeGrenade;
    exports['DecoyGrenade'] = Entity.DecoyGrenade;
    exports['Flashbang'] = Entity.Flashbang;
    exports['Vector3d'] = require('./Vector3d.js');
    exports['inherits'] = inherits;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = exports;
        root.jsgo = exports;
    }
    root.jsgo = exports;

})();