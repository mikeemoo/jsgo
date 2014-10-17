(function (root) {

/**********************************************************
 *
 * BitView
 *
 * BitView provides a similar interface to the standard
 * DataView, but with support for bit-level reads / writes.
 *
 **********************************************************/
var BitView = function (source, byteOffset, byteLength) {
	var isBuffer = source instanceof ArrayBuffer ||
		(typeof Buffer !== 'undefined' && source instanceof Buffer);

	if (!isBuffer) {
		throw new Error('Must specify a valid ArrayBuffer or Buffer.');
	}

	byteOffset = byteOffset || 0;
	byteLength = byteLength || source.byteLength /* ArrayBuffer */ || source.length /* Buffer */;

	this._buffer = source;
	this._view = new Uint8Array(this._buffer, byteOffset, byteLength);
};

// Used to massage fp values so we can operate on them
// at the bit level.
BitView._scratch = new DataView(new ArrayBuffer(8));

Object.defineProperty(BitView.prototype, 'buffer', {
	get: function () { return this._buffer; },
	enumerable: true,
	configurable: false
});

Object.defineProperty(BitView.prototype, 'byteLength', {
	get: function () { return this._view.length; },
	enumerable: true,
	configurable: false
});

BitView.prototype._getBit = function (offset) {
	return this._view[offset >> 3] >> (offset & 7) & 0x1;
};

BitView.prototype._setBit = function (offset, on) {
	if (on) {
		this._view[offset >> 3] |= 1 << (offset & 7);
	} else {
		this._view[offset >> 3] &= ~(1 << (offset & 7));
	}
};

BitView.prototype.getBits = function (offset, bits, signed) {
	var available = (this._view.length * 8 - offset);

	if (bits > available) {
		throw new Error('Cannot get ' + bits + ' bit(s) from offset ' + offset + ', ' + available + ' available');
	}

	var value = 0;
	for (var i = 0; i < bits;) {
		var read;

		// Read an entire byte if we can.
		if ((bits - i) >= 8 && ((offset & 7) === 0)) {
			value |= (this._view[offset >> 3] << i);
			read = 8;
		} else {
			value |= (this._getBit(offset) << i);
			read = 1;
		}

		offset += read;
		i += read;
	}

	if (signed) {
		// If we're not working with a full 32 bits, check the
		// imaginary MSB for this bit count and convert to a
		// valid 32-bit signed value if set.
		if (bits !== 32 && value & (1 << (bits - 1))) {
			value |= -1 ^ ((1 << bits) - 1);
		}

		return value;
	}

	return value >>> 0;
};

BitView.prototype.setBits = function (offset, value, bits) {
	var available = (this._view.length * 8 - offset);

	if (bits > available) {
		throw new Error('Cannot set ' + bits + ' bit(s) from offset ' + offset + ', ' + available + ' available');
	}

	for (var i = 0; i < bits;) {
		var wrote;

		// Write an entire byte if we can.
		if ((bits - i) >= 8 && ((offset & 7) === 0)) {
			this._view[offset >> 3] = value & 0xFF;
			wrote = 8;
		} else {
			this._setBit(offset, value & 0x1);
			wrote = 1;
		}

		value = (value >> wrote);

		offset += wrote;
		i += wrote;
	}
};

BitView.prototype.getInt8 = function (offset) {
	return this.getBits(offset, 8, true);
};
BitView.prototype.getUint8 = function (offset) {
	return this.getBits(offset, 8, false);
};
BitView.prototype.getInt16 = function (offset) {
	return this.getBits(offset, 16, true);
};
BitView.prototype.getUint16 = function (offset) {
	return this.getBits(offset, 16, false);
};
BitView.prototype.getInt32 = function (offset) {
	return this.getBits(offset, 32, true);
};
BitView.prototype.getUint32 = function (offset) {
	return this.getBits(offset, 32, false);
};
BitView.prototype.getFloat32 = function (offset) {
	BitView._scratch.setUint32(0, this.getUint32(offset));
	return BitView._scratch.getFloat32(0);
};
BitView.prototype.getFloat64 = function (offset) {
	BitView._scratch.setUint32(0, this.getUint32(offset));
	// DataView offset is in bytes.
	BitView._scratch.setUint32(4, this.getUint32(offset+32));
	return BitView._scratch.getFloat64(0);
};

BitView.prototype.setInt8  =
BitView.prototype.setUint8 = function (offset, value) {
	this.setBits(offset, value, 8);
};
BitView.prototype.setInt16  =
BitView.prototype.setUint16 = function (offset, value) {
	this.setBits(offset, value, 16);
};
BitView.prototype.setInt32  =
BitView.prototype.setUint32 = function (offset, value) {
	this.setBits(offset, value, 32);
};
BitView.prototype.setFloat32 = function (offset, value) {
	BitView._scratch.setFloat32(0, value);
	this.setBits(offset, BitView._scratch.getUint32(0), 32);
};
BitView.prototype.setFloat64 = function (offset, value) {
	BitView._scratch.setFloat64(0, value);
	this.setBits(offset, BitView._scratch.getUint32(0), 32);
	this.setBits(offset+32, BitView._scratch.getUint32(4), 32);
};

/**********************************************************
 *
 * BitStream
 *
 * Small wrapper for a BitView to maintain your position,
 * as well as to handle reading / writing of string data
 * to the underlying buffer.
 *
 **********************************************************/
var reader = function (name, size) {
	return function () {
		var val = this._view[name](this._index);
		this._index += size;
		return val;
	};
};

var writer = function (name, size) {
	return function (value) {
		this._view[name](this._index, value);
		this._index += size;
	};
};

function readASCIIString(stream, bytes) {
	var i = 0;
	var chars = [];
	var append = true;

	// Read while we still have space available, or until we've
	// hit the fixed byte length passed in.
	while (!bytes || (bytes && i < bytes)) {
		var c = stream.readUint8();

		// Stop appending chars once we hit 0x00
		if (c === 0x00) {
			append = false;

			// If we don't have a fixed length to read, break out now.
			if (!bytes) {
				break;
			}
		}

		if (append) {
			chars.push(c);
		}

		i++;
	}

	// Convert char code array back to string.
	return chars.map(function (x) {
		return String.fromCharCode(x);
	}).join('');
}

function writeASCIIString(stream, string, bytes) {
	var length = bytes || string.length + 1;  // + 1 for NULL

	for (var i = 0; i < length; i++) {
		stream.writeUint8(i < string.length ? string.charCodeAt(i) : 0x00);
	}
}

var BitStream = function (source, byteOffset, byteLength) {
	var isBuffer = source instanceof ArrayBuffer ||
		(typeof Buffer !== 'undefined' && source instanceof Buffer);

	if (!(source instanceof BitView) && !isBuffer) {
		throw new Error('Must specify a valid BitView, ArrayBuffer or Buffer');
	}

	if (isBuffer) {
		this._view = new BitView(source, byteOffset, byteLength);
	} else {
		this._view = source;
	}

	this._index = 0;
};

Object.defineProperty(BitStream.prototype, 'byteIndex', {
	// Ceil the returned value, over compensating for the amount of
	// bits written to the stream.
	get: function () { return Math.ceil(this._index / 8); },
	set: function (val) { this._index = val * 8; },
	enumerable: true,
	configurable: true
});

Object.defineProperty(BitStream.prototype, 'buffer', {
	get: function () { return this._view.buffer; },
	enumerable: true,
	configurable: false
});

Object.defineProperty(BitStream.prototype, 'view', {
	get: function () { return this._view; },
	enumerable: true,
	configurable: false
});

BitStream.prototype.readBits = function (bits, signed) {
	var val = this._view.getBits(this._index, bits, signed);
	this._index += bits;
	return val;
};

BitStream.prototype.writeBits = function (value, bits) {
	this._view.setBits(this._index, value, bits);
	this._index += bits;
};

BitStream.prototype.readInt8 = reader('getInt8', 8);
BitStream.prototype.readUint8 = reader('getUint8', 8);
BitStream.prototype.readInt16 = reader('getInt16', 16);
BitStream.prototype.readUint16 = reader('getUint16', 16);
BitStream.prototype.readInt32 = reader('getInt32', 32);
BitStream.prototype.readUint32 = reader('getUint32', 32);
BitStream.prototype.readFloat32 = reader('getFloat32', 32);
BitStream.prototype.readFloat64 = reader('getFloat64', 64);

BitStream.prototype.writeInt8 = writer('setInt8', 8);
BitStream.prototype.writeUint8 = writer('setUint8', 8);
BitStream.prototype.writeInt16 = writer('setInt16', 16);
BitStream.prototype.writeUint16 = writer('setUint16', 16);
BitStream.prototype.writeInt32 = writer('setInt32', 32);
BitStream.prototype.writeUint32 = writer('setUint32', 32);
BitStream.prototype.writeFloat32 = writer('setFloat32', 32);
BitStream.prototype.writeFloat64 = writer('setFloat64', 64);

BitStream.prototype.readASCIIString = function (bytes) {
	return readASCIIString(this, bytes);
};

BitStream.prototype.writeASCIIString = function (string, bytes) {
	writeASCIIString(this, string, bytes);
};

BitStream.prototype.readUBitVar = function() {
	var ret = this.readBits(6, false);
	switch(ret & (16 | 32)) {
		case 16:
			ret = (ret & 15) | (this.readBits(4) << 4);
			break;
		case 32:
			ret = (ret & 15) | (this.readBits(8) << 4);
			break;
		case 48:
			ret = (ret & 15) | (this.readBits(32 - 4) << 4);
			break;
	}
	return ret;
}

BitStream.prototype.readBitCoord = function() {

	var intval = 0,
		fractval = 0,
		signbit = 0;

	var value = 0.0;

	var intval = this.readBits(1);
	var fractval = this.readBits(1);

	if (intval || fractval) {
		signbit = this.readBits(1);
		if (intval) {
			intval = this.readBits(14) + 1;
		}
		if (fractval) {
			fractval = this.readBits(5);
		}
		value = intval+(fractval*(1/(1<<5)));
		if (signbit) {
			value = -value;
		}
	}
	return value;
}

BitStream.prototype.readBitCellCoord = function(bits, coordType)
{
	var bIntegral = coordType == 2;
	var bLowPrecision = coordType == 1;

	var intval=0,
		fractval=0;
	var	value = 0;

	if (bIntegral) {
		value = this.readBits(bits);
	} else {
		intval = this.readBits(bits);
		fractval = this.readBits(bLowPrecision ? 3 : 5);
		value = intval + (fractval * (1 / (1 << (bLowPrecision ? 3 : 5))));
	}
	return value;
}

// AMD / RequireJS
if (typeof define !== 'undefined' && define.amd) {
	define(function () {
		return {
			BitView: BitView,
			BitStream: BitStream
		};
	});
}
// Node.js
else if (typeof module !== 'undefined' && module.exports) {
	module.exports = {
		BitView: BitView,
		BitStream: BitStream
	};
}

root.BitView = BitView;
root.BitStream = BitStream;

}(this));