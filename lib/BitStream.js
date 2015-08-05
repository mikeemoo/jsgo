(function() {
var kCW_None = 0;
var kCW_LowPrecision = 1;
var kCW_Integral = 2;


function BitStream(buffer) {
    this.buffer = buffer;
    this.index = 0;
    this.bufferedBits = null;
    this.bitsAvailable = 0;
}

BitStream.prototype.protobuf = function(collector, size) {
    var def = new ProtobufDefinition();
    collector(def);
    var data = {};
    size = size || this.varInt32();
    var offset = this.tell();
    while (this.tell() < offset + size) {
        var tag = this.varInt32();
        var id = tag >> 3;
        var field = def.getField(id);
        if (field != null) {
            var val = null;
            if (typeof field.method == 'string') {
                if (this[field.method] == null) {
                    throw Error('Unable to find method ' + field.method);
                }
                val = this[field.method].apply(this, field.args);
            } else {
                val = field.method(field.args);
            }


            if (field.type == 'array') {
                if (data[field.name] == null) {
                    data[field.name] = [];
                }
                data[field.name].push(val);
            } else {
                data[field.name] = val;
            }
        }
    }
    this.seek(offset + size);
    return data;
}

BitStream.prototype.int32 = function() {
    return this.flatten(4);
}

BitStream.prototype.vString = function() {
    var length = this.varInt32();
    if (length == 0) {
        return '';
    }
    return this.string(length, true);
}

BitStream.prototype.varInt32 = function() {
    return this.varInt(4);
}

BitStream.prototype.varInt64 = function() {
    return this.varInt(8); // yeah whatever. it wont read a valid int64 for now.
}

BitStream.prototype.varInt = function(maxLen) {
    var b = 0;
    var count = 0;
    var result = 0;
    do {
        if (count + 1 == maxLen) {
            return result;
        }
        b = this.byte();
        result |= (b & 0x7F) << (7 * count);
        ++count;
    } while (b & 0x80);
    return result;
}

BitStream.prototype.varInt32Bool = function() {
    return !(!this.varInt32());
}

BitStream.prototype.uBitVar = function() {
    var ret = this.bits(6);
    switch (ret & (16 | 32)) {
        case 16:
            ret = (ret & 15) | (this.bits(4) << 4);
            break;
        case 32:
            ret = (ret & 15) | (this.bits(8) << 4);
            break;
        case 48:
            ret = (ret & 15) | (this.bits(32 - 4) << 4);
            break;
    }
    return ret;
}

BitStream.prototype.int16 = function() {
    return this.flatten(2);
}

BitStream.prototype.float = function() {
    var b = this.bytes(4),
        sign = 1 - (2 * (b[3] >> 7)),
        exponent = (((b[3] << 1) & 0xff) | (b[2] >> 7)) - 127,
        mantissa = ((b[2] & 0x7f) << 16) | (b[1] << 8) | b[0];

    if (exponent === 128) {
        if (mantissa !== 0) {
            return NaN;
        } else {
            return sign * Infinity;
        }
    }

    if (exponent === -127) {
        return sign * mantissa * this.pow2(-126 - 23);
    }

    return sign * (1 + mantissa * this.pow2(-23)) * this.pow2(exponent);
}

BitStream.prototype.vChunk = function() {
    var size = this.varInt32();
    var buffer = new Buffer(size);
    for (var i = 0; i < size; i++) {
        buffer.writeUInt8(this.byte(), i);
    }
    return new BitStream(buffer);
}

BitStream.prototype.pow2 = function(n) {
    return (n >= 0 && n < 31) ? (1 << n) : (this.pow2[n] || (this.pow2[n] = Math.pow(2, n)));
}

BitStream.prototype.flatten = function(bytes) {
    if (typeof bytes === 'number' && isFinite(bytes)) {
        bytes = this.bytes(bytes);
    }
    var ret = 0;
    for (var i = 0; i < bytes.length; i++) {
        ret |= bytes[i] << (i << 3);
    }
    return ret;
}

BitStream.prototype.skip = function(bytes) {
    this.index += bytes;
    if (this.bitsAvailable !== 0) {
        this.bufferedBits = this.takeByteAt(this.index - 1);
    }
    return this;
}

BitStream.prototype.seekBits = function(dest) {
    this.index = dest >> 3;
    this.clearBufferedBits();
    this.bits(dest % 8);
}

BitStream.prototype.seek = function(dest) {
    this.index = dest;
    this.clearBufferedBits();
    return this;
}

BitStream.prototype.tell = function() {
    return this.index;
}

BitStream.prototype.tellBits = function() {
    return ((this.index - 1) << 3) + (8 - this.bitsAvailable);
}

BitStream.prototype.string = function(len, nongreedy) {
    var str = '';
    for (var i = 0; i < len; i++) {
        var char = this.byte();
        if (char == 0) {
            if (!nongreedy) {
                this.skip(len - i - 1);
            }
            break;
        }
        str += String.fromCharCode(char);
    }
    return str;
}

BitStream.prototype.byte = function() {
    return this.bits(8);
}

BitStream.prototype.bool = function() {
    return !(!this.byte());
}

BitStream.prototype.bytes = function(bytes) {
    var result = [];
    for (var i = 0; i < bytes; i++) {
        result.push(this.byte());
    }
    return result;
}

BitStream.prototype.takeByteAt = function(index) {
    return this.buffer[index];
}

BitStream.prototype.takeByte = function() {
    return this.takeByteAt(this.index++);
}

BitStream.prototype.bits = function(bits) {
    if (bits == 8 && this.bitsAvailable == 0) {
        return this.takeByte();
    }
    var ret = 0;
    for (var i = 0; i < bits; i++) {
        if (this.bitsAvailable == 0) {
            this.bufferedBits = this.takeByte();
            this.bitsAvailable = 8;
        }
        ret |= ((this.bufferedBits >> (8 - this.bitsAvailable--)) & 1) << i;
    }
    return ret;
}

BitStream.prototype.clearBufferedBits = function() {
    this.bufferedBits = null;
    this.bitsAvailable = 0;
    return this;
}

BitStream.prototype.bitCoord = function() {
    var value = 0;
    var intval = this.bits(1);
    var fractval = this.bits(1);
    if (intval || fractval) {
        var signbit = this.bits(1);
        if (intval) {
            intval = this.bits(14) + 1;
        }
        if (fractval) {
            fractval = this.bits(5);
        }
        value = intval + (fractval * (1 / (1 << 5)));
        if (signbit) {
            value = -value;
        }
    }
    return value;
}

BitStream.prototype.bitCoordMP = function(coordType) {

    var bIntegral = ( coordType == kCW_Integral );
    var bLowPrecision = ( coordType == kCW_LowPrecision );

    var intval = 0;
    var fractval = 0
    var signbit = 0;
    var value = 0.0;

    var inBounds = this.bits(1) ? true : false;

    if (coordType == kCW_Integral) {
        intval = this.bits(1);
        if (intval) {
            var signbit = this.bits(1);
            if (inBounds) {
                value = this.bits(11) + 1;
            } else {
                value = this.bits(14) + 1;
            }
        }
    } else {
        intval = this.bits(1);
        signbit = this.bits(1);

        if (intval){
            if (inBounds) {
                intval = this.bits(11) + 1;
            } else {
                intval = this.bits(14) + 1;
            }
        }

        fractval = this.bits(coordType == kCW_LowPrecision ? 3 : 5);

        value = intval + (fractval * (1.0/(1<<(coordType == kCW_LowPrecision ? 3 : 5))));
    }

    if (signbit) {
        value = -value;
    }
    return value;
}

BitStream.prototype.bitNormal = function() {

    var signbit = this.bits(1);
    var fractval = this.bits(11);

    var value = fractval * (1 / ((1 << 11) - 1));

    if (signbit) {
        value = -value;
    }

    return value;
}

BitStream.prototype.bitCellCoord = function(bits, coordType) {
    var bIntegral = coordType == kCW_Integral;
    var bLowPrecision = coordType == kCW_LowPrecision;
    var value = 0;
    if (bIntegral) {
        return this.bits(bits);
    }
    var intval = this.bits(bits);
    var fractval = this.bits(bLowPrecision ? 3 : 5);
    return value = intval + (fractval * (1 / (1 << (bLowPrecision ? 3 : 5))));
}

    module.exports.BitStream = BitStream;
})();
