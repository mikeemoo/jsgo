var SPROP_COORD = (1 << 1);
var SPROP_NOSCALE = (1 << 2);
var SPROP_NORMAL = (1 << 5);
var SPROP_COORD_MP = (1 << 12);
var SPROP_COORD_MP_LOWPRECISION = (1 << 13);
var SPROP_COORD_MP_INTEGRAL = (1 << 14);
var SPROP_CELL_COORD = (1 << 15);
var SPROP_CELL_COORD_LOWPRECISION = (1 << 16);
var SPROP_CELL_COORD_INTEGRAL = (1 << 17);

function intDecode(bitStream, sendProp) {
    if (sendProp.flags & (1 << 19)) {
        if (sendProp.flags & (1 << 0)) {
            return bitStream.readVarInt32();
        } else {
            return bitStream.readSignedVarInt32();
        }
    } else {
        if (sendProp.flags & (1 << 0)) {
            return bitStream.readBits(sendProp.num_bits);
        } else {
            return bitStream.readBits(sendProp.num_bits, true);
        }
    }
}

function floatDecodeSpecial(bitStream, sendProp) {
    var flags = sendProp.flags;
    if (flags & SPROP_COORD) {
        return bitStream.readBitCoord();
    } else if (flags & SPROP_COORD_MP) {
        return bitStream.readBitCoordMP(kCW_None);
    } else if (flags & SPROP_COORD_MP_LOWPRECISION) {
        return bitStream.readBitCoordMP(kCW_LowPrecision);
    } else if (flags & SPROP_COORD_MP_INTEGRAL) {
        return bitStream.readBitCoordMP(kCW_Integral);
    } else if (flags & SPROP_NOSCALE) {
        return bitStream.readFloat32();
    } else if (flags & SPROP_NORMAL) {
        return bitStream.readBitNormal();
    } else if (flags & SPROP_CELL_COORD) {
        return bitStream.readBitCellCoord(sendProp.num_bits, 0); // kCW_None
    } else if (flags & SPROP_CELL_COORD_LOWPRECISION) {
        return bitStream.readBitCellCoord(sendProp.num_bits, 1); // kCW_LowPrecision
    } else if (flags & SPROP_CELL_COORD_INTEGRAL) {
        return bitStream.readBitCellCoord(sendProp.num_bits, 2); // kCW_Integral
    }

    return false;
}

function floatDecode(bitStream, sendProp) {
    var spec = floatDecodeSpecial(bitStream, sendProp);
    if (spec !== false) {
        return spec;
    }
    var dwInterp = bitStream.readBits(sendProp.num_bits);
    var fVal = 0;
    fVal = dwInterp / ((1 << sendProp.num_bits) - 1);
    fVal = sendProp.low_value + (sendProp.high_value - sendProp.low_value) * fVal;
    return fVal;
}

function stringDecode(bitStream, sendProp) {
    var len = bitStream.readBits(9);
    if (len == 0) {
        return '';
    }
    var maxBuffer = (1 << 9);
    if (len >= maxBuffer) {
        len = maxBuffer - 1;
    }
    return bitStream.readASCIIString(len);
}

function vectorDecode(bitStream, sendProp) {
    var v = {
        x: floatDecode(bitStream, sendProp),
        y: floatDecode(bitStream, sendProp)
    };
    if ((sendProp.flags & (1 << 5)) == 0) {
        v.z = floatDecode(bitStream, sendProp);
    } else {
        var signBit = bitStream.readBit(1);
        var v0v0v1v1 = v.x * v.x + v.y * v.y;
        if (v0v0v1v1 < 1) {
            v.z = Math.sqrt(1 - v0v0v1v1);
        } else {
            v.z = 0;
        }
        if (signBit) {
            v.z *= -1;
        }
    }
    return v;
}

function vectorXYDecode(bitStream, sendProp) {
    var vector = {
        x: floatDecode(bitStream, sendProp),
        y: floatDecode(bitStream, sendProp),
        z: 0
    };
    return vector;
}

var Decode = {};
Decode.int = intDecode;
Decode.float = floatDecode;
Decode.string = stringDecode;
Decode.vector = vectorDecode;
Decode.vectorXY = vectorXYDecode;