(function () {
    var SPROP_COORD = (1 << 1);
    var SPROP_NOSCALE = (1 << 2);
    var SPROP_NORMAL = (1 << 5);
    var SPROP_COORD_MP = (1 << 12);
    var SPROP_COORD_MP_LOWPRECISION = (1 << 13);
    var SPROP_COORD_MP_INTEGRAL = (1 << 14);
    var SPROP_CELL_COORD = (1 << 15);
    var SPROP_CELL_COORD_LOWPRECISION = (1 << 16);
    var SPROP_CELL_COORD_INTEGRAL = (1 << 17);

    function inherits(childConstructor, parentConstructor) {
        function tempConstructor() { };
        tempConstructor.prototype = parentConstructor.prototype;
        childConstructor.prototype = new tempConstructor();
        childConstructor.prototype.constructor = childConstructor;
    };

    function Entity() {
        this.data = {};
        this.serialNumber = null;
        this.classInfo = null;
        this.latestPositionPath = 'csnonlocaldata';
    }

    Entity.prototype.getData = function () {
        return this.data;
    }

    Entity.prototype.readFieldIndex = function (stream, lastIndex, newWay) {

        if (newWay && stream.bits(1)) {
            return lastIndex + 1;
        }

        var ret = 0;
        if (newWay && stream.bits(1)) {
            ret = stream.bits(3);
        } else {
            ret = stream.bits(7);
            switch (ret & (32 | 64)) {
                case 32:
                    ret = (ret & ~96) | (stream.bits(2) << 5);
                    break;
                case 64:
                    ret = (ret & ~96) | (stream.bits(4) << 5);
                    break;
                case 96:
                    ret = (ret & ~96) | (stream.bits(7) << 5);
                    break;
            }
        }
        if (ret == 0xFFF) {
            return -1;
        }
        return lastIndex + 1 + ret;
    }

    Entity.prototype.readFromStream = function (stream) {
        var fieldIndices = [];
        var newWay = stream.bits(1);
        var index = -1;
        do {
            index = this.readFieldIndex(stream, index, newWay);
            if (index != -1) {
                fieldIndices.push(index);
            }
        } while (index != -1);
        var paths = [];
        for (var i = 0; i < fieldIndices.length; i++) {
            paths = paths.concat(this.decodeProperty(stream, fieldIndices[i]));
        }
        return paths;
    }

    Entity.prototype.getValue = function (path) {
        var objPart = this.getObj(this.data, path);
        return objPart.obj[objPart.property];
    }

    Entity.prototype.setValue = function (path, value) {
        var objPart = this.getObj(this.data, path);
        if (objPart.property == 'm_vecOrigin') {
            this.latestPositionPath = path.indexOf('nonlocal') > -1 ?
                'csnonlocaldata' : 'cslocaldata';
        }
        objPart.obj[objPart.property] = value;
    }

    Entity.prototype.getObj = function (data, path) {
        var parts = path.split('.');
        var prop = parts[parts.length - 1];
        for (var i = 0; i < parts.length - 1; i++) {
            if (parts[i] != 'baseclass') {
                if (data[parts[i]] == null) {
                    data[parts[i]] = {};
                }
                data = data[parts[i]];
            }
        }
        return {
            obj: data,
            property: prop
        };
    }

    Entity.prototype.decodeProperty = function (stream, fieldIndex, _property) {

        var flattenedProp = _property || this.classInfo.flattenedProps[fieldIndex];
        if (flattenedProp == null) {
            return null;
        }
        var prop = flattenedProp.prop;
        var paths = [];
        paths.push(flattenedProp.path);
        if (prop) {
            var result = null;
            switch (prop.type) {
                case 0:
                    this.setValue(flattenedProp.path, this.decodeInt(stream, prop));
                    break;
                case 1:
                    this.setValue(flattenedProp.path, this.decodeFloat(stream, prop));
                    break;
                case 2:
                    this.setValue(flattenedProp.path, this.decodeVector(stream, prop));
                    break;
                case 3:
                    this.setValue(flattenedProp.path, this.decodeVectorXY(stream, prop));
                    break;
                case 4:
                    this.setValue(flattenedProp.path, this.decodeString(stream, prop));
                    break;
                case 5:
                    var result = [];
                    var maxElements = prop.numElements;
                    var numBits = 1;
                    while ((maxElements >>= 1) != 0) {
                        numBits++;
                    }
                    var numElements = stream.bits(numBits);
                    for (var i = 0; i < numElements; i++) {
                        var tmp = {
                            'prop': flattenedProp.elm,
                            'path': flattenedProp.path + '.' + i,
                            'elm': null
                        };
                        paths = paths.concat(this.decodeProperty(stream, fieldIndex, tmp));
                    }
                    break;
                default:
                    console.log('sendProp.type = ' + sendProp.type);
                    exit;
                    break;
            }
            return paths;
        }
    }

    Entity.prototype.decodeInt = function (stream, prop) {
        if (prop.flags & (1 << 19)) {
            if (prop.flags & (1 << 0)) {
                return stream.varInt32();
            } else {
                return stream.signedVarInt32();
            }
        } else {
            if (prop.flags & (1 << 0)) {
                return stream.bits(prop.numBits);
            } else {
                return stream.bits(prop.numBits); // hmm
            }
        }
    }

    Entity.prototype.decodeFloat = function (stream, prop) {

        var flags = prop.flags;

        if (flags & SPROP_COORD) {
            return stream.bitCoord();
        } else if (flags & SPROP_COORD_MP) {
            return stream.bitCoordMP(kCW_None);
        } else if (flags & SPROP_COORD_MP_LOWPRECISION) {
            return stream.bitCoordMP(kCW_LowPrecision);
        } else if (flags & SPROP_COORD_MP_INTEGRAL) {
            return stream.bitCoordMP(kCW_Integral);
        } else if (flags & SPROP_NOSCALE) {
            return stream.float();
        } else if (flags & SPROP_NORMAL) {
            return stream.bitNormal();
        } else if (flags & SPROP_CELL_COORD) {
            return stream.bitCellCoord(prop.numBits, kCW_None);
        } else if (flags & SPROP_CELL_COORD_LOWPRECISION) {
            return stream.bitCellCoord(prop.numBits, kCW_LowPrecision);
        } else if (flags & SPROP_CELL_COORD_INTEGRAL) {
            return stream.bitCellCoord(prop.numBits, kCW_Integral);
        }

        var dwInterp = stream.bits(prop.numBits);
        var fVal = 0;
        fVal = dwInterp / ((1 << prop.numBits) - 1);
        fVal = prop.lowValue + (prop.highValue - prop.lowValue) * fVal;
        return fVal;
    }

    Entity.prototype.decodeVector = function (stream, prop) {
        var v = {
            x: this.decodeFloat(stream, prop),
            y: this.decodeFloat(stream, prop)
        };
        if ((prop.flags & (1 << 5)) == 0) {
            v.z = this.decodeFloat(stream, prop);
        } else {
            var v0v0v1v1 = v.x * v.x + v.y * v.y;
            if (v0v0v1v1 < 1) {
                v.z = Math.sqrt(1 - v0v0v1v1);
            } else {
                v.z = 0;
            }
            if (stream.bits(1)) {
                v.z *= -1;
            }
        }
        return v;
    }

    Entity.prototype.decodeVectorXY = function (stream, prop) {
        var vector = {
            x: this.decodeFloat(stream, prop),
            y: this.decodeFloat(stream, prop)
        };
        return vector;
    }

    Entity.prototype.decodeString = function (stream, prop) {
        var len = stream.bits(9);
        if (len == 0) {
            return '';
        }
        var maxBuffer = (1 << 9);
        if (len >= maxBuffer) {
            len = maxBuffer - 1;
        }
        return stream.string(len);
    }

    function Player() {
        Entity.call(this);
        this.info = {};
    }

    inherits(Player, Entity);

    Player.prototype.getName = function () {
        return this.info.name || 'Unknown';
    }

    Player.prototype.isHLTV = function () {
        return this.info.isHLTV || false;
    }

    Player.prototype.isFakePlayer = function () {
        return this.info.fakePlayer || false;
    }

    Player.prototype.getGuid = function () {
        return this.info.guid || '';
    }

    Player.prototype.getUserId = function () {
        return this.info.userId || null;
    }

    Player.prototype.getHealth = function () {
        return this.getValue('m_iHealth') || 100;
    }

    Player.prototype.isAlive = function () {
        return this.getHealth() > 0;
    }

    Player.prototype.getTeam = function (demo) {
        var teams = demo.getTeams();
        for (var i = 0; i < teams.length; i++) {
            var team = teams[i];
            if (team.getTeamNumber() == this.getValue('m_iTeamNum')) {
                return team;
            }
        }
    }

    Player.prototype.getEyeAngle = function () {
        var angle0 = this.getValue('m_angEyeAngles[0]');
        var angle1 = this.getValue('m_angEyeAngles[1]');
        return {
            pitch: makeAnglePositive(-(angle0 || 0)),
            yaw: makeAnglePositive(angle1 || 0)
        };
    }

    Player.prototype.getEyeAngleVector = function () {
        var angles = this.getEyeAngle();
        return directionToVector(angles.pitch, angles.yaw);
    }

    Player.prototype.getAimLine = function () {
        var position = this.getPosition();
        var angle = this.getEyeAngleVector();
        return new Line3d(position.x, position.y, position.z, angle);
    }

    Player.prototype.getAimDistanceTo = function (player) {
        return this.getAimLine().distanceToPoint(player.getPosition());
    }

    Player.prototype.getAimPunchAngle = function () {
        return this.getValue('localdata.m_Local.m_aimPunchAngle') || {
                x: 0,
                y: 0,
                z: 0
            };
    }

    Player.prototype.getPosition = function () {
        var xy = this.getValue(this.latestPositionPath + '.m_vecOrigin');
        var z = this.getValue(this.latestPositionPath + '.m_vecOrigin[2]');
        if (xy != null && z !== null) {
            return new Vector3d(xy.x, xy.y, z);
        }
        return new Vector3d();
    }

    Player.prototype.getArmorValue = function () {
        return this.getValue('m_ArmorValue') || 0;
    }

    Player.prototype.hasHelmet = function () {
        return this.getValue('m_bHasFelmet') == 1;
    }

    Player.prototype.getCurrentEquipmentValue = function () {
        return this.getValue('m_unCurrentEquipmentValue') || 0;
    }

    Player.prototype.isSpotted = function () {
        return this.getValue('m_bSpotted') == 1;
    }

    Player.prototype.getRoundStartCash = function () {
        return this.getValue('m_iStartAccount') || 0;
    }

    Player.prototype.getCurrentCash = function () {
        return this.getValue('m_iAccount') || 0;
    }

    Player.prototype.getLastPlaceName = function () {
        return this.getValue('m_szLastPlaceName') || '';
    }

    Player.prototype.getRoundKills = function () {
        return this.getValue('m_iNumRoundKills') || 0;
    }

    Player.prototype.getRoundHeadshotKills = function () {
        return this.getValue('m_iNumRoundKillsHeadshots') || 0;
    }

    Player.prototype.isScoped = function () {
        return this.getValue('m_bIsScoped') == 1;
    }

    Player.prototype.isWalking = function () {
        return this.getValue('m_bIsWalking') == 1;
    }

    Player.prototype.hasDefuser = function () {
        return this.getValue('m_bHasDefuser') == 1;
    }

    Player.prototype.getActiveWeapon = function () {
        var active = this.getValue('m_hActiveWeapon') & 0x7FF;
        return demo.findEntityById(active);
    }

    Player.prototype.getWeapons = function () {
        var weapons = [];
        for (var i = 0; i < 10; i++) {
            var weapon = this.getWeapon(i);
            if (weapon != null) {
                weapons.push(weapon);
            }
        }
        return weapons;
    }

    Player.prototype.getWeapon = function (index) {
        var weaponId = this.getValue('m_hMyWeapons.00' + index); // bleh, whatever!
        if (weaponId == null) {
            return null;
        }
        return demo.findEntityById(weaponId & 0x7FF);
    }

    function Team() {
        Entity.call(this);
        this.sides.T = "TERRORIST";
        this.sides.CT = "CT";
    }

    inherits(Team, Entity);

    Team.prototype.getTeamNumber = function () {
        return this.getValue('m_iTeamNum');
    }

    Team.prototype.getSide = function () {
        return (this.getValue('m_szTeamname') || '').toUpperCase();
    }

    Team.prototype.getClanName = function () {
        return this.getValue('m_szClanTeamname');
    }

    Team.prototype.getFlag = function () {
        return this.getValue('m_szTeamFlagImage');
    }

    Team.prototype.getScore = function () {
        return this.getValue('m_scoreTotal') || 0;
    }

    Team.prototype.getScoreFirstHalf = function () {
        return this.getValue('m_scoreFirstHalf') || 0;
    }

    Team.prototype.getScoreSecondHalf = function () {
        return this.getValue('m_scoreSecondHalf') || 0;
    }

    Team.prototype.getPlayers = function (demo) {
        var d = this.getValue('"player_array"') || {};
        var players = [];
        for (var k in d) {
            players.push(demo.findEntityById(d[k]));
        }
        return players;
    }

    function Grenade() {
        Entity.call(this);
    }

    inherits(Grenade, Entity);

    function DecoyGrenade() {
        Grenade.call(this);
    }

    inherits(DecoyGrenade, Grenade);

    function HEGrenade() {
        Grenade.call(this);
    }

    inherits(HEGrenade, Grenade);

    function SmokeGrenade() {
        Grenade.call(this);
    }

    inherits(SmokeGrenade, Grenade);

    function Flashbang() {
        Grenade.call(this);
    }

    inherits(Flashbang, Grenade);

    module.exports.Entity = Entity;
    module.exports.Player = Player;
    module.exports.Team = Team;
    module.exports.Grenade = Grenade;
    module.exports.DecoyGrenade = DecoyGrenade;
    module.exports.HEGrenade = HEGrenade;
    module.exports.SmokeGrenade = SmokeGrenade;
    module.exports.Flashbang = Flashbang;
})();
