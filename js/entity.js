function readFieldIndex(bitStream, lastIndex, newWay) {
    if (newWay) {
        if (bitStream.readBits(1)) {
            return lastIndex + 1;
        }
    }
    var ret = 0;
    if (newWay && bitStream.readBits(1)) {
        ret = bitStream.readBits(3, false);
    } else {
        ret = bitStream.readBits(7, false);
        switch (ret & (32 | 64)) {
            case 32:
                ret = (ret & ~96) | (bitStream.readBits(2, false) << 5);
                break;
            case 64:
                ret = (ret & ~96) | (bitStream.readBits(4, false) << 5);
                break;
            case 96:
                ret = (ret & ~96) | (bitStream.readBits(7, false) << 5);
                break;
        }
    }
    if (ret == 0xFFF) {
        return -1;
    }
    return lastIndex + 1 + ret;
}

function getObj(data, path) {

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
        'obj': data,
        'property': prop
    };
}

var Entity = function() {
	this.data = {};
};
Entity.prototype.classInfo = null;
Entity.prototype.entityId = null;
Entity.prototype.serialNumber = null;
Entity.prototype.data = null;
Entity.prototype.getData = function() { return this.data; };
Entity.prototype.readFromStream = function(bitStream) {
    var fieldIndices = [];
    var newWay = bitStream.readBits(1);
    var index = -1;
    do {
        index = readFieldIndex(bitStream, index, newWay);
        if (index != -1) {
            fieldIndices.push(index);
        }
    } while (index != -1);
    var paths = [];
    for (var i = 0; i < fieldIndices.length; i++) {
        paths = paths.concat(this.decodeProperty(bitStream, fieldIndices[i]));
    }
    return paths;
}

Entity.prototype.generateProperties = function() {
    //for (var i = 0; i < this.classInfo.flattenedProps.length; i++) {
       // this.setValue(this.classInfo.flattenedProps[i].path, null, true);
    //}
}

Entity.prototype.getValue = function(path) {
    var o = getObj(this.data, path);
    return o.obj[o.property];
}

Entity.prototype.setValue = function(path, value, dontfire) {
    var o = getObj(this.data, path);
    o.obj[o.property] = value;
}

Entity.prototype.isPlayerEntity = function() {
	return this.classInfo.strDTName == 'DT_CSPlayer';
}

Entity.prototype.getTeam = function() {
	var v = entity.getValue('m_iTeamNum');
	if (v == null) {
		return null;
	}
	return v == 2 ? 'T' : 'CT';
}

Entity.prototype.getEyeAngle = function() {
	var angle0 = this.getValue('m_angEyeAngles[0]');
	var angle1 = this.getValue('m_angEyeAngles[1]');
	if (angle0 != null && angle1 != null) {
		return {
			pitch: angle0,
			yaw: angle1
		};
	}
}

Entity.prototype.getPos = function() {
	var xy = this.getValue('csnonlocaldata.m_vecOrigin');
	var z = this.getValue('csnonlocaldata.m_vecOrigin[2]');
	if (xy != null && z != null) {
		return {
			x: xy.x,
			y: xy.y,
			z: z
		};s
	}
}

Entity.prototype.decodeProperty = function(bitStream, fieldIndex, _property) {

    var flattenedProp = _property == null ? this.classInfo.flattenedProps[fieldIndex] : _property;
    var prop = flattenedProp.prop;
    var paths = [];
    paths.push(flattenedProp.path);

    if (prop) {
        var result = null;
        switch (prop.type) {
            case 0:
                this.setValue(flattenedProp.path, Decode.int(bitStream, prop));
                break;
            case 1:
                this.setValue(flattenedProp.path, Decode.float(bitStream, prop));
                break;
            case 2:
                this.setValue(flattenedProp.path, Decode.vector(bitStream, prop));
                break;
            case 3:
                this.setValue(flattenedProp.path, Decode.vectorXY(bitStream, prop));
                break;
            case 4:
                this.setValue(flattenedProp.path, Decode.string(bitStream, prop));
                break;
            case 5:
                var result = [];
                var maxElements = prop.num_elements;
                var numBits = 1;
                while ((maxElements >>= 1) != 0) {
                    numBits++;
                }
                var nElements = bitStream.readBits(numBits);
                for (var i = 0; i < nElements; i++) {
                    var tmp = {
                        'prop': flattenedProp.elm,
                        'path': flattenedProp.path + '.' + i,
                        'elm': null
                    };
                    paths = paths.concat(this.decodeProperty(bitStream, fieldIndex, tmp));
                }
                break;
            default:
                console.log('sendProp.type = ' + sendProp.type);
                exit;
                break;
                /*
			case 6:
				break;
			case 7:
				int64Decode(result, bitStream, sendProp);
				break;*/
        }
        return paths;
    }
}